package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"zhikeweilai/backend/internal/config"
	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"

	"github.com/gin-gonic/gin"
	qrcodegen "github.com/skip2/go-qrcode"
	"github.com/xuri/excelize/v2"
)

func invListProducts(c *gin.Context) {
	productCategoryID := c.Query("productCategoryId")
	status := c.Query("status")
	keyword := strings.TrimSpace(c.Query("keyword"))
	tag := strings.TrimSpace(c.Query("tag"))
	page := queryInt(c, "page", 1)
	pageSize := queryInt(c, "pageSize", 50)
	if pageSize > 200 {
		pageSize = 200
	}
	q := db.DB.Model(&models.InventoryProduct{})
	if productCategoryID != "" {
		q = q.Where("productCategoryId = ?", productCategoryID)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if tag != "" {
		q = q.Where("tags LIKE ?", "%"+escapeLike(tag)+"%")
	}
	if keyword != "" {
		kw := "%" + escapeLike(keyword) + "%"
		q = q.Where("name LIKE ? OR serialNumber LIKE ?", kw, kw)
	}
	var total int64
	q.Count(&total)
	var rows []models.InventoryProduct
	q.Preload("ProductCategory").Order("productCategoryId ASC, sortOrder ASC, id ASC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&rows)
	sns := make([]string, len(rows))
	for i, p := range rows {
		sns[i] = p.SerialNumber
	}
	bound := map[string][]int{}
	if len(sns) > 0 {
		var ups []models.UserProduct
		db.DB.Where("productKey IN ?", sns).Find(&ups)
		for _, u := range ups {
			bound[u.ProductKey] = append(bound[u.ProductKey], u.UserID)
		}
	}
	list := make([]gin.H, 0, len(rows))
	for _, p := range rows {
		raw, _ := json.Marshal(p)
		var h gin.H
		_ = json.Unmarshal(raw, &h)
		h["boundUserIds"] = bound[p.SerialNumber]
		if h["boundUserIds"] == nil {
			h["boundUserIds"] = []int{}
		}
		list = append(list, h)
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func invValidateProductCategoryL2(id int) bool {
	if id <= 0 {
		return false
	}
	var pc models.ProductCategory
	if err := db.DB.First(&pc, id).Error; err != nil {
		return false
	}
	return pc.Level == 2 && pc.ParentID != nil
}

func invCreateProduct(c *gin.Context) {
	var body models.InventoryProduct
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if body.ProductCategoryID == 0 || strings.TrimSpace(body.Name) == "" || strings.TrimSpace(body.SerialNumber) == "" {
		resp.Err(c, 400, 400, "信息不完整")
		return
	}
	if !invValidateProductCategoryL2(body.ProductCategoryID) {
		resp.Err(c, 400, 400, "种类须选择商品配置中的二级分类")
		return
	}
	var n int64
	db.DB.Model(&models.InventoryProduct{}).Where("serialNumber = ?", strings.TrimSpace(body.SerialNumber)).Count(&n)
	if n > 0 {
		resp.Err(c, 400, 400, "该序列号已存在")
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}
	body.SerialNumber = strings.TrimSpace(body.SerialNumber)
	body.Name = strings.TrimSpace(body.Name)
	db.DB.Create(&body)
	resp.OK(c, body)
}

func invUpdateProduct(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var p models.InventoryProduct
	if err := db.DB.First(&p, id).Error; err != nil {
		resp.Err(c, 404, 404, "商品不存在")
		return
	}
	var body models.InventoryProduct
	_ = c.ShouldBindJSON(&body)
	if body.ProductCategoryID != 0 {
		if !invValidateProductCategoryL2(body.ProductCategoryID) {
			resp.Err(c, 400, 400, "种类须选择商品配置中的二级分类")
			return
		}
		p.ProductCategoryID = body.ProductCategoryID
	}
	if body.Name != "" {
		p.Name = strings.TrimSpace(body.Name)
	}
	if body.SerialNumber != "" && strings.TrimSpace(body.SerialNumber) != p.SerialNumber {
		sn := strings.TrimSpace(body.SerialNumber)
		var n int64
		db.DB.Model(&models.InventoryProduct{}).Where("serialNumber = ? AND id <> ?", sn, id).Count(&n)
		if n > 0 {
			resp.Err(c, 400, 400, "该序列号已被其他商品使用")
			return
		}
		p.SerialNumber = sn
	}
	p.GuideSlug = body.GuideSlug
	p.SortOrder = body.SortOrder
	if body.Status != "" {
		p.Status = body.Status
	}
	p.Tags = body.Tags
	db.DB.Save(&p)
	resp.OK(c, p)
}

func invRemoveProduct(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db.DB.Delete(&models.InventoryProduct{}, id)
	resp.OKMsg(c, "删除成功")
}

func buildBindURL(cfg *config.Config, p *models.InventoryProduct) string {
	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = cfg.FrontendURL
	}
	u := base + "/bind-product?sn=" + url.QueryEscape(p.SerialNumber)
	if gs := strings.TrimSpace(p.GuideSlug); gs != "" {
		u += "&guide=" + url.QueryEscape(gs)
	}
	return u
}

func invGetBindQrURL(c *gin.Context, cfg *config.Config) {
	id, _ := strconv.Atoi(c.Param("id"))
	var p models.InventoryProduct
	if err := db.DB.First(&p, id).Error; err != nil {
		resp.Err(c, 404, 404, "商品不存在")
		return
	}
	bindURL := buildBindURL(cfg, &p)
	png, err := qrcodegen.Encode(bindURL, qrcodegen.Medium, 400)
	if err != nil {
		resp.Err(c, 500, 500, "获取失败")
		return
	}
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
	resp.OK(c, gin.H{"url": bindURL, "serialNumber": p.SerialNumber, "dataUrl": dataURL})
}

func invGetSampleExcel(c *gin.Context) {
	f := excelize.NewFile()
	headers := []string{"种类名称", "商品名称", "序列号", "商品配置", "排序", "状态", "标签"}
	_ = f.SetSheetRow("Sheet1", "A1", &headers)
	_ = f.SetSheetRow("Sheet1", "A2", &[]interface{}{"空调", "示例商品A", "AC001", "aircondition", 0, "启用", "常用,新品"})
	c.Header("Content-Disposition", `attachment; filename="inventory_import_sample.xlsx"`)
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	buf, _ := f.WriteToBuffer()
	c.Data(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

func invGetSampleDeleteExcel(c *gin.Context) {
	f := excelize.NewFile()
	headers := []string{"序列号", "商品名称（选填，仅作对照）"}
	_ = f.SetSheetRow("Sheet1", "A1", &headers)
	_ = f.SetSheetRow("Sheet1", "A2", &[]interface{}{"AC001"})
	_ = f.SetSheetRow("Sheet1", "A3", &[]interface{}{"AC123456"})
	c.Header("Content-Disposition", `attachment; filename="inventory_delete_sample.xlsx"`)
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	buf, _ := f.WriteToBuffer()
	c.Data(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

func invImportExcel(c *gin.Context, cfg *config.Config) {
	_ = cfg
	fh, err := c.FormFile("file")
	if err != nil {
		resp.Err(c, 400, 400, "请上传 Excel 文件")
		return
	}
	f, err := fh.Open()
	if err != nil {
		resp.Err(c, 500, 500, "读取失败")
		return
	}
	defer f.Close()
	buf, err := io.ReadAll(f)
	if err != nil {
		resp.Err(c, 500, 500, "读取失败")
		return
	}
	xl, err := excelize.OpenReader(bytes.NewReader(buf))
	if err != nil {
		resp.Err(c, 500, 500, "解析失败")
		return
	}
	defer xl.Close()
	sheets := xl.GetSheetList()
	if len(sheets) == 0 {
		resp.OK(c, gin.H{"success": 0, "failed": []interface{}{}, "message": "表格为空"})
		return
	}
	rows, err := xl.GetRows(sheets[0])
	if err != nil || len(rows) == 0 {
		resp.OK(c, gin.H{"success": 0, "failed": []interface{}{}, "message": "表格为空"})
		return
	}
	header := rows[0]
	var pcL2 []models.ProductCategory
	db.DB.Where("level = ? AND status = ?", 2, "active").Find(&pcL2)
	byName := map[string]int{}
	for _, cat := range pcL2 {
		byName[cat.Name] = cat.ID
	}
	success := 0
	var failed []gin.H
	col := func(name string) int {
		for i, h := range header {
			if strings.TrimSpace(h) == name {
				return i
			}
		}
		return -1
	}
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		get := func(n string) string {
			idx := col(n)
			if idx < 0 || idx >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[idx])
		}
		catName := get("种类名称")
		name := get("商品名称")
		sn := get("序列号")
		guideSlug := get("商品配置")
		sortOrder, _ := strconv.Atoi(get("排序"))
		statusRaw := get("状态")
		tags := get("标签")
		status := "active"
		if statusRaw == "停用" || statusRaw == "inactive" {
			status = "inactive"
		}
		if catName == "" || name == "" || sn == "" {
			failed = append(failed, gin.H{"row": i + 2, "reason": "种类名称、商品名称、序列号不能为空"})
			continue
		}
		cid, ok := byName[catName]
		if !ok {
			failed = append(failed, gin.H{"row": i + 2, "reason": fmt.Sprintf("二级种类「%s」不存在（请在商品配置中维护同名二级种类）", catName)})
			continue
		}
		var ex int64
		db.DB.Model(&models.InventoryProduct{}).Where("serialNumber = ?", sn).Count(&ex)
		if ex > 0 {
			failed = append(failed, gin.H{"row": i + 2, "reason": "序列号已存在"})
			continue
		}
		db.DB.Create(&models.InventoryProduct{
			ProductCategoryID: cid, Name: name, SerialNumber: sn, GuideSlug: guideSlug, SortOrder: sortOrder, Status: status, Tags: tags,
		})
		success++
	}
	msg := fmt.Sprintf("成功导入 %d 条", success)
	if len(failed) > 0 {
		msg += fmt.Sprintf("，失败 %d 条", len(failed))
	}
	resp.OK(c, gin.H{"success": success, "failed": failed, "message": msg})
}

func invBatchDeleteExcel(c *gin.Context) {
	fh, err := c.FormFile("file")
	if err != nil {
		resp.Err(c, 400, 400, "请上传 Excel 文件")
		return
	}
	f, err := fh.Open()
	if err != nil {
		resp.Err(c, 500, 500, "读取失败")
		return
	}
	defer f.Close()
	buf, err := io.ReadAll(f)
	if err != nil {
		resp.Err(c, 500, 500, "读取失败")
		return
	}
	xl, err := excelize.OpenReader(bytes.NewReader(buf))
	if err != nil {
		resp.Err(c, 500, 500, "解析失败")
		return
	}
	defer xl.Close()
	sheets := xl.GetSheetList()
	if len(sheets) == 0 {
		resp.OK(c, gin.H{"deleted": 0, "failed": []interface{}{}, "message": "表格为空"})
		return
	}
	rows, err := xl.GetRows(sheets[0])
	if err != nil || len(rows) == 0 {
		resp.OK(c, gin.H{"deleted": 0, "failed": []interface{}{}, "message": "表格为空"})
		return
	}
	header := rows[0]
	snIdx := -1
	for i, h := range header {
		if strings.TrimSpace(h) == "序列号" {
			snIdx = i
			break
		}
	}
	if snIdx < 0 {
		resp.Err(c, 400, 400, "Excel 中需包含「序列号」列")
		return
	}
	deleted := 0
	var failed []gin.H
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		sn := ""
		if snIdx < len(row) {
			sn = strings.TrimSpace(row[snIdx])
		}
		if sn == "" {
			failed = append(failed, gin.H{"row": i + 2, "serialNumber": "(空)", "reason": "序列号为空"})
			continue
		}
		var p models.InventoryProduct
		if err := db.DB.Where("serialNumber = ?", sn).First(&p).Error; err != nil {
			failed = append(failed, gin.H{"row": i + 2, "serialNumber": sn, "reason": "未找到该序列号商品"})
			continue
		}
		db.DB.Delete(&p)
		deleted++
	}
	msg := fmt.Sprintf("成功删除 %d 条", deleted)
	if len(failed) > 0 {
		msg += fmt.Sprintf("，失败 %d 条", len(failed))
	}
	resp.OK(c, gin.H{"deleted": deleted, "failed": failed, "message": msg})
}

func invExportProducts(c *gin.Context, cfg *config.Config) {
	productCategoryID := c.Query("productCategoryId")
	status := c.Query("status")
	keyword := strings.TrimSpace(c.Query("keyword"))
	tag := strings.TrimSpace(c.Query("tag"))
	q := db.DB.Model(&models.InventoryProduct{})
	if productCategoryID != "" {
		q = q.Where("productCategoryId = ?", productCategoryID)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if tag != "" {
		q = q.Where("tags LIKE ?", "%"+escapeLike(tag)+"%")
	}
	if keyword != "" {
		kw := "%" + escapeLike(keyword) + "%"
		q = q.Where("name LIKE ? OR serialNumber LIKE ?", kw, kw)
	}
	var list []models.InventoryProduct
	q.Preload("ProductCategory").Order("productCategoryId ASC, sortOrder ASC, id ASC").Find(&list)
	sns := make([]string, len(list))
	for i, p := range list {
		sns[i] = p.SerialNumber
	}
	bound := map[string][]int{}
	if len(sns) > 0 {
		var ups []models.UserProduct
		db.DB.Where("productKey IN ?", sns).Find(&ups)
		for _, u := range ups {
			bound[u.ProductKey] = append(bound[u.ProductKey], u.UserID)
		}
	}
	f := excelize.NewFile()
	headers := []string{"ID", "种类", "名称", "序列号", "商品配置", "排序", "状态", "标签", "添加时间", "被绑定用户ID", "绑定链接", "绑定二维码"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue("Sheet1", cell, h)
	}
	for i, p := range list {
		catName := ""
		if p.ProductCategory != nil {
			catName = p.ProductCategory.Name
		}
		st := "启用"
		if p.Status == "inactive" {
			st = "禁用"
		}
		bindURL := buildBindURL(cfg, &p)
		uids := bound[p.SerialNumber]
		uidStrs := make([]string, len(uids))
		for j, id := range uids {
			uidStrs[j] = strconv.Itoa(id)
		}
		rowIdx := i + 2
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("A%d", rowIdx), p.ID)
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("B%d", rowIdx), catName)
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("C%d", rowIdx), p.Name)
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("D%d", rowIdx), p.SerialNumber)
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("E%d", rowIdx), p.GuideSlug)
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("F%d", rowIdx), p.SortOrder)
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("G%d", rowIdx), st)
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("H%d", rowIdx), p.Tags)
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("I%d", rowIdx), p.CreatedAt.Format("2006-01-02 15:04"))
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("J%d", rowIdx), strings.Join(uidStrs, ", "))
		_ = f.SetCellValue("Sheet1", fmt.Sprintf("K%d", rowIdx), bindURL)
		png, err := qrcodegen.Encode(bindURL, qrcodegen.Medium, 160)
		if err == nil && len(png) > 0 {
			_ = f.AddPictureFromBytes("Sheet1", fmt.Sprintf("L%d", rowIdx), &excelize.Picture{File: png, Extension: "png"})
		}
		_ = f.SetRowHeight("Sheet1", rowIdx, 96)
	}
	fn := "inventory_products_" + time.Now().Format("2006-01-02") + ".xlsx"
	c.Header("Content-Disposition", `attachment; filename="`+fn+`"`)
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	buf, err := f.WriteToBuffer()
	if err != nil {
		resp.Err(c, 500, 500, "导出失败")
		return
	}
	c.Data(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}
