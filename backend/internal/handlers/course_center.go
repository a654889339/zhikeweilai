package handlers

import (
	"strconv"
	"strings"

	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"

	"github.com/gin-gonic/gin"
)

func courseCenterPublicList(c *gin.Context) {
	var rows []models.CourseCenterItem
	db.DB.Where("status = ?", "active").Order("sortOrder ASC, id ASC").Find(&rows)
	resp.OK(c, rows)
}

func courseCenterAdminList(c *gin.Context) {
	var rows []models.CourseCenterItem
	db.DB.Order("sortOrder ASC, id ASC").Find(&rows)
	resp.OK(c, rows)
}

func courseCenterCreate(c *gin.Context) {
	var body models.CourseCenterItem
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
	if err := db.DB.Create(&body).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, body)
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
	var body models.CourseCenterItem
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
	body.ID = id
	body.CreatedAt = row.CreatedAt
	if err := db.DB.Save(&body).Error; err != nil {
		resp.Err(c, 500, 500, err.Error())
		return
	}
	resp.OK(c, body)
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
