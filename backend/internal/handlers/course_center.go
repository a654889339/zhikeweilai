package handlers

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"

	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

var courseDetailIDNumeric = regexp.MustCompile(`^\d+$`)

type courseCenterPayload struct {
	CourseCategoryID int      `json:"courseCategoryId"`
	Name             string   `json:"name"`
	Subtitle         string   `json:"subtitle"`
	Slug             string   `json:"slug"`
	Icon             string   `json:"icon"`
	CoverImage       string   `json:"coverImage"`
	Videos           []string `json:"videos"`
	Description      string   `json:"description"`
	SortOrder        int      `json:"sortOrder"`
	Status           string   `json:"status"`
}

type courseCategoryPayload struct {
	Level       int    `json:"level"`
	ParentID    *int   `json:"parentId"`
	Key         string `json:"key"`
	Title       string `json:"title"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
	Status      string `json:"status"`
}

func validateCourseCategoryL2(id int) bool {
	if id <= 0 {
		return false
	}
	var cat models.CourseCenterCategory
	if err := db.DB.First(&cat, id).Error; err != nil {
		return false
	}
	return cat.Level == 2 && productCategoryHasParent(cat.ParentID)
}

func courseItemToMap(c models.CourseCenterItem) gin.H {
	var videos []string
	if len(c.Videos) > 0 {
		_ = json.Unmarshal(c.Videos, &videos)
	}
	if videos == nil {
		videos = []string{}
	}
	h := gin.H{
		"id":               c.ID,
		"courseCategoryId": c.CourseCategoryID,
		"name":             c.Name,
		"subtitle":         c.Subtitle,
		"slug":             c.Slug,
		"icon":             c.Icon,
		"coverImage":       c.CoverImage,
		"videos":           videos,
		"description":      c.Description,
		"sortOrder":        c.SortOrder,
		"status":           c.Status,
		"createdAt":        c.CreatedAt,
		"updatedAt":        c.UpdatedAt,
	}
	if c.CourseCategory != nil {
		h["courseCategoryTitle"] = c.CourseCategory.Title
	}
	return h
}

func courseCategoryToTree(cat models.CourseCenterCategory) gin.H {
	h := gin.H{
		"id":          cat.ID,
		"title":       cat.Title,
		"key":         cat.EnKey,
		"description": cat.Description,
		"sortOrder":   cat.SortOrder,
		"level":       cat.Level,
	}
	if productCategoryHasParent(cat.ParentID) {
		h["parentId"] = *cat.ParentID
	} else {
		h["parentId"] = nil
	}
	return h
}

func videosToJSON(urls []string) datatypes.JSON {
	if len(urls) == 0 {
		return datatypes.JSON("[]")
	}
	b, err := json.Marshal(urls)
	if err != nil {
		return datatypes.JSON("[]")
	}
	return datatypes.JSON(b)
}

// GET /api/course-categories 公开树（仅 active）
func courseCenterCategoriesTree(c *gin.Context) {
	var all []models.CourseCenterCategory
	db.DB.Where("status = ?", "active").Order("sortOrder ASC, id ASC").Find(&all)
	childrenOf := map[int][]models.CourseCenterCategory{}
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
		h := courseCategoryToTree(cat)
		if ch := childrenOf[cat.ID]; len(ch) > 0 {
			arr := make([]gin.H, 0, len(ch))
			for _, x := range ch {
				arr = append(arr, courseCategoryToTree(x))
			}
			h["children"] = arr
		}
		out = append(out, h)
	}
	resp.OK(c, out)
}

func courseCenterCategoryAdminList(c *gin.Context) {
	var rows []models.CourseCenterCategory
	db.DB.Order("sortOrder ASC, id ASC").Find(&rows)
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, courseCategoryToTree(rows[i]))
	}
	resp.OK(c, out)
}

func courseCenterCategoryCreate(c *gin.Context) {
	var body courseCategoryPayload
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	body.Key = strings.TrimSpace(body.Key)
	body.Title = strings.TrimSpace(body.Title)
	if body.Key == "" || body.Title == "" {
		resp.Err(c, 400, 400, "英文标识与标题不能为空")
		return
	}
	if body.Level != 1 && body.Level != 2 {
		resp.Err(c, 400, 400, "层级须为 1 或 2")
		return
	}
	if body.Level == 2 {
		if !productCategoryHasParent(body.ParentID) {
			resp.Err(c, 400, 400, "二级分类必须选择一级父类")
			return
		}
		var parent models.CourseCenterCategory
		if err := db.DB.First(&parent, *body.ParentID).Error; err != nil || parent.Level != 1 {
			resp.Err(c, 400, 400, "父类无效")
			return
		}
	} else {
		body.ParentID = nil
	}
	var n int64
	db.DB.Model(&models.CourseCenterCategory{}).Where("enKey = ?", body.Key).Count(&n)
	if n > 0 {
		resp.Err(c, 400, 400, "英文标识已存在")
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}
	row := models.CourseCenterCategory{
		Level:       body.Level,
		ParentID:    body.ParentID,
		EnKey:       body.Key,
		Title:       body.Title,
		Description: body.Description,
		SortOrder:   body.SortOrder,
		Status:      body.Status,
	}
	if err := db.DB.Create(&row).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, courseCategoryToTree(row))
}

func courseCenterCategoryUpdate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id < 1 {
		resp.Err(c, 400, 400, "无效 ID")
		return
	}
	var row models.CourseCenterCategory
	if err := db.DB.First(&row, id).Error; err != nil {
		resp.Err(c, 404, 404, "不存在")
		return
	}
	var body courseCategoryPayload
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	body.Key = strings.TrimSpace(body.Key)
	body.Title = strings.TrimSpace(body.Title)
	if body.Key == "" || body.Title == "" {
		resp.Err(c, 400, 400, "英文标识与标题不能为空")
		return
	}
	if body.Level != 1 && body.Level != 2 {
		resp.Err(c, 400, 400, "层级须为 1 或 2")
		return
	}
	if body.Level == 2 {
		if !productCategoryHasParent(body.ParentID) {
			resp.Err(c, 400, 400, "二级分类必须选择一级父类")
			return
		}
		var parent models.CourseCenterCategory
		if err := db.DB.First(&parent, *body.ParentID).Error; err != nil || parent.Level != 1 || parent.ID == row.ID {
			resp.Err(c, 400, 400, "父类无效")
			return
		}
	} else {
		body.ParentID = nil
	}
	if body.Key != row.EnKey {
		var n int64
		db.DB.Model(&models.CourseCenterCategory{}).Where("enKey = ? AND id <> ?", body.Key, id).Count(&n)
		if n > 0 {
			resp.Err(c, 400, 400, "英文标识已存在")
			return
		}
	}
	var nChild int64
	db.DB.Model(&models.CourseCenterCategory{}).Where("parentId = ?", id).Count(&nChild)
	if row.Level == 1 && body.Level == 2 && nChild > 0 {
		resp.Err(c, 400, 400, "该一级下已有二级，不能改为二级")
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}
	row.Level = body.Level
	if body.Level == 1 {
		row.ParentID = nil
	} else {
		row.ParentID = body.ParentID
	}
	row.EnKey = body.Key
	row.Title = body.Title
	row.Description = body.Description
	row.SortOrder = body.SortOrder
	row.Status = body.Status
	if err := db.DB.Save(&row).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, courseCategoryToTree(row))
}

func courseCenterCategoryRemove(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id < 1 {
		resp.Err(c, 400, 400, "无效 ID")
		return
	}
	var nChild int64
	db.DB.Model(&models.CourseCenterCategory{}).Where("parentId = ?", id).Count(&nChild)
	if nChild > 0 {
		resp.Err(c, 400, 400, "请先删除子分类")
		return
	}
	var nItem int64
	db.DB.Model(&models.CourseCenterItem{}).Where("courseCategoryId = ?", id).Count(&nItem)
	if nItem > 0 {
		resp.Err(c, 400, 400, "该分类下仍有课程，无法删除")
		return
	}
	if err := db.DB.Delete(&models.CourseCenterCategory{}, id).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OKMsg(c, "删除成功")
}

func courseCenterPublicList(c *gin.Context) {
	q := db.DB.Model(&models.CourseCenterItem{}).Where("status = ?", "active")
	if cid := strings.TrimSpace(c.Query("categoryId")); cid != "" {
		if id, err := strconv.Atoi(cid); err == nil && id > 0 {
			q = q.Where("courseCategoryId = ?", id)
		}
	}
	var rows []models.CourseCenterItem
	q.Order("sortOrder ASC, id ASC").Find(&rows)
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, courseItemToMap(rows[i]))
	}
	resp.OK(c, out)
}

func courseCenterPublicDetail(c *gin.Context) {
	param := c.Param("id")
	var row models.CourseCenterItem
	qq := db.DB.Where("status = ?", "active")
	if courseDetailIDNumeric.MatchString(param) {
		id, _ := strconv.Atoi(param)
		qq = qq.Where("id = ?", id)
	} else {
		qq = qq.Where("slug = ?", param)
	}
	if err := qq.First(&row).Error; err != nil {
		resp.Err(c, 404, 404, "不存在")
		return
	}
	resp.OK(c, courseItemToMap(row))
}

func courseCenterAdminList(c *gin.Context) {
	var rows []models.CourseCenterItem
	db.DB.Preload("CourseCategory").Order("sortOrder ASC, id ASC").Find(&rows)
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, courseItemToMap(rows[i]))
	}
	resp.OK(c, out)
}

func courseCenterCreate(c *gin.Context) {
	var body courseCenterPayload
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Slug = strings.TrimSpace(body.Slug)
	if body.Name == "" {
		resp.Err(c, 400, 400, "名称不能为空")
		return
	}
	if body.Slug == "" {
		resp.Err(c, 400, 400, "路径标识 slug 不能为空")
		return
	}
	if !validateCourseCategoryL2(body.CourseCategoryID) {
		resp.Err(c, 400, 400, "请选择二级课程分类")
		return
	}
	var n int64
	db.DB.Model(&models.CourseCenterItem{}).Where("slug = ?", body.Slug).Count(&n)
	if n > 0 {
		resp.Err(c, 400, 400, "slug 已存在")
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}
	row := models.CourseCenterItem{
		CourseCategoryID: body.CourseCategoryID,
		Name:               body.Name,
		Subtitle:           body.Subtitle,
		Slug:               body.Slug,
		Icon:               body.Icon,
		CoverImage:         body.CoverImage,
		Videos:             videosToJSON(body.Videos),
		Description:        body.Description,
		SortOrder:          body.SortOrder,
		Status:             body.Status,
	}
	if err := db.DB.Create(&row).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	_ = db.DB.Preload("CourseCategory").First(&row, row.ID).Error
	resp.OK(c, courseItemToMap(row))
}

func courseCenterUpdate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id < 1 {
		resp.Err(c, 400, 400, "无效 ID")
		return
	}
	var row models.CourseCenterItem
	if err := db.DB.First(&row, id).Error; err != nil {
		resp.Err(c, 404, 404, "不存在")
		return
	}
	var body courseCenterPayload
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Slug = strings.TrimSpace(body.Slug)
	if body.Name == "" {
		resp.Err(c, 400, 400, "名称不能为空")
		return
	}
	if body.Slug == "" {
		resp.Err(c, 400, 400, "路径标识 slug 不能为空")
		return
	}
	if !validateCourseCategoryL2(body.CourseCategoryID) {
		resp.Err(c, 400, 400, "请选择二级课程分类")
		return
	}
	if body.Slug != row.Slug {
		var n int64
		db.DB.Model(&models.CourseCenterItem{}).Where("slug = ? AND id <> ?", body.Slug, id).Count(&n)
		if n > 0 {
			resp.Err(c, 400, 400, "slug 已存在")
			return
		}
	}
	if body.Status == "" {
		body.Status = "active"
	}
	row.CourseCategoryID = body.CourseCategoryID
	row.Name = body.Name
	row.Subtitle = body.Subtitle
	row.Slug = body.Slug
	row.Icon = body.Icon
	row.CoverImage = body.CoverImage
	row.Videos = videosToJSON(body.Videos)
	row.Description = body.Description
	row.SortOrder = body.SortOrder
	row.Status = body.Status
	if err := db.DB.Save(&row).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	_ = db.DB.Preload("CourseCategory").First(&row, row.ID).Error
	resp.OK(c, courseItemToMap(row))
}

func courseCenterRemove(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id < 1 {
		resp.Err(c, 400, 400, "无效 ID")
		return
	}
	if err := db.DB.Delete(&models.CourseCenterItem{}, id).Error; err != nil {
		resp.Err(c, 500, 500, "删除失败")
		return
	}
	resp.OKMsg(c, "删除成功")
}
