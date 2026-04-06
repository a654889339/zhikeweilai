package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"zhikeweilai/backend/internal/config"
	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"
	"zhikeweilai/backend/internal/services"

	"github.com/gin-gonic/gin"
	qrcodegen "github.com/skip2/go-qrcode"
)

var guideIDNumeric = regexp.MustCompile(`^\d+$`)

// productCategoryHasParent 历史数据可能把「无父级」存成 parentId=0（非 NULL），与 nil 一样视为一级根节点。
func productCategoryHasParent(parentID *int) bool {
	if parentID == nil {
		return false
	}
	return *parentID != 0
}

func categoryToGuideTree(cat models.ProductCategory) gin.H {
	var parentOut interface{}
	if productCategoryHasParent(cat.ParentID) {
		parentOut = *cat.ParentID
	} else {
		parentOut = nil
	}
	h := gin.H{
		"id":        cat.ID,
		"name":      cat.Name,
		"nameEn":    cat.NameEn,
		"sortOrder": cat.SortOrder,
		"level":     cat.Level,
		"parentId":  parentOut,
	}
	if cat.ThumbnailURL != nil {
		h["thumbnailUrl"] = *cat.ThumbnailURL
	} else {
		h["thumbnailUrl"] = ""
	}
	if cat.ThumbnailURLEn != nil {
		h["thumbnailUrlEn"] = *cat.ThumbnailURLEn
	} else {
		h["thumbnailUrlEn"] = ""
	}
	return h
}

func guideCategories(c *gin.Context) {
	var all []models.ProductCategory
	db.DB.Where("status = ?", "active").Order("sortOrder ASC, id ASC").Find(&all)
	childrenOf := map[int][]models.ProductCategory{}
	for _, cat := range all {
		if cat.Level == 2 && productCategoryHasParent(cat.ParentID) {
			pid := *cat.ParentID
			childrenOf[pid] = append(childrenOf[pid], cat)
		}
	}
	out := make([]gin.H, 0)
	for _, cat := range all {
		if productCategoryHasParent(cat.ParentID) {
			continue
		}
		if cat.Level != 1 && cat.Level != 0 {
			continue
		}
		h := categoryToGuideTree(cat)
		if ch := childrenOf[cat.ID]; len(ch) > 0 {
			arr := make([]gin.H, 0, len(ch))
			for _, c := range ch {
				arr = append(arr, categoryToGuideTree(c))
			}
			h["children"] = arr
		}
		out = append(out, h)
	}
	resp.OK(c, out)
}

func validateGuideProductCategoryID(cid *int) error {
	if cid == nil || *cid <= 0 {
		return fmt.Errorf("请选择二级商品种类")
	}
	var pc models.ProductCategory
	if err := db.DB.First(&pc, *cid).Error; err != nil {
		return fmt.Errorf("商品种类不存在")
	}
	if pc.Level != 2 || !productCategoryHasParent(pc.ParentID) {
		return fmt.Errorf("商品种类必须选择二级分类")
	}
	return nil
}

func guideList(c *gin.Context) {
	q := db.DB.Model(&models.DeviceGuide{}).Where("status = ?", "active")
	if cid := strings.TrimSpace(c.Query("categoryId")); cid != "" {
		if id, err := strconv.Atoi(cid); err == nil {
			q = q.Where("categoryId = ?", id)
		}
	}
	var guides []models.DeviceGuide
	q.Order("sortOrder ASC, id ASC").Find(&guides)
	out := make([]gin.H, 0, len(guides))
	for i := range guides {
		out = append(out, attachGuideThumbs(&guides[i]))
	}
	resp.OK(c, out)
}

func attachGuideThumbs(g *models.DeviceGuide) gin.H {
	raw, _ := json.Marshal(g)
	var h gin.H
	_ = json.Unmarshal(raw, &h)
	iconThumb := strings.TrimSpace(g.IconURLThumb)
	if iconThumb == "" && g.IconURL != "" {
		iconThumb = services.GetThumbURL(g.IconURL)
	}
	coverThumb := strings.TrimSpace(g.CoverImageThumb)
	if coverThumb == "" && g.CoverImage != "" {
		coverThumb = services.GetThumbURL(g.CoverImage)
	}
	h["iconUrlThumb"] = iconThumb
	h["coverImageThumb"] = coverThumb
	h["qrcodeUrlThumb"] = services.GetThumbURL(g.QrcodeURL)
	return h
}

func guideDetail(c *gin.Context) {
	param := c.Param("id")
	var g models.DeviceGuide
	var err error
	if guideIDNumeric.MatchString(param) {
		err = db.DB.First(&g, param).Error
	} else {
		err = db.DB.Where("slug = ?", param).First(&g).Error
	}
	if err != nil {
		resp.Err(c, 404, 404, "不存在")
		return
	}
	resp.OK(c, attachGuideThumbs(&g))
}

func guideAdminList(c *gin.Context) {
	var guides []models.DeviceGuide
	db.DB.Preload("Category").Order("sortOrder ASC, id ASC").Find(&guides)
	out := make([]gin.H, 0, len(guides))
	for i := range guides {
		out = append(out, attachGuideThumbs(&guides[i]))
	}
	resp.OK(c, out)
}

func guideCreate(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	name, _ := body["name"].(string)
	slug, _ := body["slug"].(string)
	if strings.TrimSpace(name) == "" {
		resp.Err(c, 400, 400, "名称不能为空")
		return
	}
	if strings.TrimSpace(slug) == "" {
		resp.Err(c, 400, 400, "英文描述不能为空")
		return
	}
	var n int64
	db.DB.Model(&models.DeviceGuide{}).Where("slug = ?", strings.TrimSpace(slug)).Count(&n)
	if n > 0 {
		resp.Err(c, 400, 400, "英文描述 \""+slug+"\" 已被使用")
		return
	}
	raw, _ := json.Marshal(body)
	var g models.DeviceGuide
	if err := json.Unmarshal(raw, &g); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if err := validateGuideProductCategoryID(g.CategoryID); err != nil {
		resp.Err(c, 400, 400, err.Error())
		return
	}
	if err := db.DB.Create(&g).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, g)
}

func guideUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var guide models.DeviceGuide
	if err := db.DB.First(&guide, id).Error; err != nil {
		resp.Err(c, 404, 404, "不存在")
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if slug, ok := body["slug"].(string); ok && strings.TrimSpace(slug) != "" {
		var n int64
		db.DB.Model(&models.DeviceGuide{}).Where("slug = ? AND id <> ?", strings.TrimSpace(slug), id).Count(&n)
		if n > 0 {
			resp.Err(c, 400, 400, "英文描述 \""+slug+"\" 已被使用")
			return
		}
	}
	raw, _ := json.Marshal(body)
	_ = json.Unmarshal(raw, &guide)
	if err := validateGuideProductCategoryID(guide.CategoryID); err != nil {
		resp.Err(c, 400, 400, err.Error())
		return
	}
	if err := db.DB.Save(&guide).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, guide)
}

func guideRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := db.DB.Delete(&models.DeviceGuide{}, id).Error; err != nil {
		resp.Err(c, 500, 500, "删除失败")
		return
	}
	resp.OKMsg(c, "删除成功")
}

func guideUploadFile(c *gin.Context, cfg *config.Config) {
	_ = cfg
	fh, err := c.FormFile("file")
	if err != nil {
		resp.Err(c, 400, 400, "未选择文件")
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
	ext := path.Ext(fh.Filename)
	if ext == "" {
		ext = ".bin"
	}
	filename := "guide-" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "-" + randomHex(6) + ext
	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	ctx := c.Request.Context()
	if strings.HasPrefix(ct, "image/") {
		url, thumb, err := services.UploadWithThumb(ctx, buf, filename, ct, 0)
		if err != nil {
			resp.Err(c, 500, 500, "上传失败: "+err.Error())
			return
		}
		resp.OK(c, gin.H{"url": url, "thumbUrl": thumb})
		return
	}
	url, err := services.UploadCOS(ctx, buf, filename, ct)
	if err != nil {
		resp.Err(c, 500, 500, "上传失败: "+err.Error())
		return
	}
	resp.OK(c, gin.H{"url": url, "thumbUrl": nil})
}

func randomHex(n int) string {
	b := make([]byte, (n+1)/2)
	_, _ = rand.Read(b)
	h := hex.EncodeToString(b)
	if len(h) > n {
		return h[:n]
	}
	return h
}

func guideGenerateQR(c *gin.Context, cfg *config.Config) {
	id, _ := strconv.Atoi(c.Param("id"))
	var guide models.DeviceGuide
	if err := db.DB.First(&guide, id).Error; err != nil {
		resp.Err(c, 404, 1, "商品不存在")
		return
	}
	var body struct {
		Force bool `json:"force"`
	}
	_ = c.ShouldBindJSON(&body)
	if guide.QrcodeURL != "" && !body.Force {
		resp.OK(c, gin.H{"url": guide.QrcodeURL})
		return
	}
	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = cfg.FrontendURL
	}
	pagePath := strconv.Itoa(guide.ID)
	if guide.Slug != nil && strings.TrimSpace(*guide.Slug) != "" {
		pagePath = strings.TrimSpace(*guide.Slug)
	}
	page := base + "/guide/" + pagePath
	png, err := qrcodegen.Encode(page, qrcodegen.Medium, 400)
	if err != nil {
		resp.Err(c, 500, 1, "生成失败: "+err.Error())
		return
	}
	filename := "qrcode_guide_" + strconv.Itoa(guide.ID) + "_" + strconv.FormatInt(time.Now().UnixMilli(), 10) + ".png"
	url, _, err := services.UploadWithThumb(c.Request.Context(), png, filename, "image/png", 120)
	if err != nil {
		resp.Err(c, 500, 1, "生成失败: "+err.Error())
		return
	}
	_ = db.DB.Model(&guide).Update("qrcodeUrl", url).Error
	resp.OK(c, gin.H{"url": url})
}
