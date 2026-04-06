package handlers

import (
	"encoding/json"
	"strconv"
	"strings"

	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

type courseCenterPayload struct {
	Name        string   `json:"name"`
	Subtitle    string   `json:"subtitle"`
	Slug        string   `json:"slug"`
	Icon        string   `json:"icon"`
	CoverImage  string   `json:"coverImage"`
	Videos      []string `json:"videos"`
	Description string   `json:"description"`
	SortOrder   int      `json:"sortOrder"`
	Status      string   `json:"status"`
}

func courseItemToMap(c models.CourseCenterItem) gin.H {
	var videos []string
	if len(c.Videos) > 0 {
		_ = json.Unmarshal(c.Videos, &videos)
	}
	if videos == nil {
		videos = []string{}
	}
	return gin.H{
		"id":          c.ID,
		"name":        c.Name,
		"subtitle":    c.Subtitle,
		"slug":        c.Slug,
		"icon":        c.Icon,
		"coverImage":  c.CoverImage,
		"videos":      videos,
		"description": c.Description,
		"sortOrder":   c.SortOrder,
		"status":      c.Status,
		"createdAt":   c.CreatedAt,
		"updatedAt":   c.UpdatedAt,
	}
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

func courseCenterPublicList(c *gin.Context) {
	var rows []models.CourseCenterItem
	db.DB.Where("status = ?", "active").Order("sortOrder ASC, id ASC").Find(&rows)
	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		out = append(out, courseItemToMap(rows[i]))
	}
	resp.OK(c, out)
}

func courseCenterAdminList(c *gin.Context) {
	var rows []models.CourseCenterItem
	db.DB.Order("sortOrder ASC, id ASC").Find(&rows)
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
		Name:        body.Name,
		Subtitle:    body.Subtitle,
		Slug:        body.Slug,
		Icon:        body.Icon,
		CoverImage:  body.CoverImage,
		Videos:      videosToJSON(body.Videos),
		Description: body.Description,
		SortOrder:   body.SortOrder,
		Status:      body.Status,
	}
	if err := db.DB.Create(&row).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
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
