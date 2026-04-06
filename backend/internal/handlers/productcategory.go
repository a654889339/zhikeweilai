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

func pcCreate(c *gin.Context) {
	var body models.ProductCategory
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		resp.Err(c, 400, 400, "种类名称不能为空")
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
	var body models.ProductCategory
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
	cat.SortOrder = body.SortOrder
	if body.Status != "" {
		cat.Status = body.Status
	}
	if err := db.DB.Save(&cat).Error; err != nil {
		resp.Err(c, 500, 500, "更新失败")
		return
	}
	resp.OK(c, cat)
}

func pcRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := db.DB.Delete(&models.ProductCategory{}, id).Error; err != nil {
		resp.Err(c, 500, 500, "删除失败")
		return
	}
	resp.OKMsg(c, "删除成功")
}
