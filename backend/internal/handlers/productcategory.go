package handlers

import (
	"strconv"
	"strings"

	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"

	"github.com/gin-gonic/gin"
)

func pcList(c *gin.Context) {
	var list []models.ProductCategory
	db.DB.Order("sortOrder ASC, id ASC").Find(&list)
	resp.OK(c, list)
}

func validateProductCategoryPayload(cat *models.ProductCategory, isCreate bool) string {
	if cat.Level != 1 && cat.Level != 2 {
		return "层级只能为 1（一级）或 2（二级）"
	}
	if cat.Level == 1 {
		cat.ParentID = nil
		return ""
	}
	// Level 2
	if cat.ParentID == nil || *cat.ParentID <= 0 {
		return "二级种类必须选择归属的一级父类"
	}
	var parent models.ProductCategory
	if err := db.DB.First(&parent, *cat.ParentID).Error; err != nil {
		return "父类不存在"
	}
	if parent.Level != 1 {
		return "父类必须是一级种类"
	}
	return ""
}

func pcCreate(c *gin.Context) {
	var body models.ProductCategory
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		resp.Err(c, 400, 400, "种类名称不能为空")
		return
	}
	if body.Level == 0 {
		body.Level = 1
	}
	if msg := validateProductCategoryPayload(&body, true); msg != "" {
		resp.Err(c, 400, 400, msg)
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}
	if err := db.DB.Create(&body).Error; err != nil {
		resp.Err(c, 500, 500, "创建失败")
		return
	}
	resp.OK(c, body)
}

func pcUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cat models.ProductCategory
	if err := db.DB.First(&cat, id).Error; err != nil {
		resp.Err(c, 404, 404, "种类不存在")
		return
	}
	var body struct {
		Name           string  `json:"name"`
		NameEn         string  `json:"nameEn"`
		ThumbnailURL   *string `json:"thumbnailUrl"`
		ThumbnailURLEn *string `json:"thumbnailUrlEn"`
		SortOrder      *int    `json:"sortOrder"`
		Points         *int    `json:"points"`
		Status         string  `json:"status"`
		Level          *int    `json:"level"`
		ParentID       *int    `json:"parentId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if body.Name != "" {
		cat.Name = strings.TrimSpace(body.Name)
	}
	cat.NameEn = body.NameEn
	if body.ThumbnailURL != nil {
		cat.ThumbnailURL = body.ThumbnailURL
	}
	if body.ThumbnailURLEn != nil {
		cat.ThumbnailURLEn = body.ThumbnailURLEn
	}
	if body.SortOrder != nil {
		cat.SortOrder = *body.SortOrder
	}
	if body.Points != nil {
		cat.Points = *body.Points
	}
	if body.Status != "" {
		cat.Status = body.Status
	}
	if body.Level != nil {
		cat.Level = *body.Level
	}
	if cat.Level == 1 {
		cat.ParentID = nil
	} else if body.ParentID != nil {
		cat.ParentID = body.ParentID
	}
	if cat.Level == 0 {
		cat.Level = 1
	}
	if msg := validateProductCategoryPayload(&cat, false); msg != "" {
		resp.Err(c, 400, 400, msg)
		return
	}
	if err := db.DB.Save(&cat).Error; err != nil {
		resp.Err(c, 500, 500, "更新失败")
		return
	}
	resp.OK(c, cat)
}

func pcRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cat models.ProductCategory
	if err := db.DB.First(&cat, id).Error; err != nil {
		resp.Err(c, 404, 404, "种类不存在")
		return
	}
	var nChild int64
	db.DB.Model(&models.ProductCategory{}).Where("parentId = ?", id).Count(&nChild)
	if nChild > 0 {
		resp.Err(c, 400, 400, "请先删除其下的二级种类")
		return
	}
	var nGuide int64
	db.DB.Model(&models.DeviceGuide{}).Where("categoryId = ?", id).Count(&nGuide)
	if nGuide > 0 {
		resp.Err(c, 400, 400, "仍有商品绑定该种类，无法删除")
		return
	}
	var nInv int64
	db.DB.Model(&models.InventoryProduct{}).Where("productCategoryId = ?", id).Count(&nInv)
	if nInv > 0 {
		resp.Err(c, 400, 400, "仍有库存商品使用该种类，无法删除")
		return
	}
	if err := db.DB.Delete(&models.ProductCategory{}, id).Error; err != nil {
		resp.Err(c, 500, 500, "删除失败")
		return
	}
	resp.OKMsg(c, "删除成功")
}
