package handlers

import (
	"encoding/json"
	"strconv"
	"strings"

	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"

	"github.com/gin-gonic/gin"
)

func svcList(c *gin.Context) {
	q := db.DB.Model(&models.Service{}).Where("services.status = ?", "active").
		Joins("INNER JOIN service_categories sc ON sc.id = services.categoryId AND sc.status = ?", "active")
	if cid := strings.TrimSpace(c.Query("categoryId")); cid != "" {
		if id, err := strconv.Atoi(cid); err == nil {
			q = q.Where("services.categoryId = ?", id)
		}
	}
	var rows []models.Service
	q.Preload("ServiceCategory").Order("sc.sortOrder ASC, services.sortOrder ASC, services.id ASC").Find(&rows)
	resp.OK(c, gin.H{"list": rows})
}

func svcDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		resp.Err(c, 400, 400, "无效的服务ID")
		return
	}
	var s models.Service
	if err := db.DB.Preload("ServiceCategory").First(&s, id).Error; err != nil {
		resp.Err(c, 404, 404, "服务不存在")
		return
	}
	resp.OK(c, s)
}

func svcAdminList(c *gin.Context) {
	var rows []models.Service
	db.DB.Model(&models.Service{}).Preload("ServiceCategory").
		Joins("LEFT JOIN service_categories sc ON sc.id = services.categoryId").
		Order("sc.sortOrder ASC, services.sortOrder ASC, services.id ASC").
		Find(&rows)
	resp.OK(c, rows)
}

func svcCreate(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	raw, _ := json.Marshal(body)
	var s models.Service
	_ = json.Unmarshal(raw, &s)
	if strings.TrimSpace(s.Title) == "" {
		resp.Err(c, 400, 400, "标题不能为空")
		return
	}
	if s.CategoryID == nil && (s.Category == nil || strings.TrimSpace(*s.Category) == "") {
		resp.Err(c, 400, 400, "请选择服务种类")
		return
	}
	if err := db.DB.Create(&s).Error; err != nil {
		resp.Err(c, 500, 500, "创建服务失败")
		return
	}
	db.DB.Preload("ServiceCategory").First(&s, s.ID)
	resp.OK(c, s)
}

func svcUpdate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		resp.Err(c, 400, 400, "无效的服务ID")
		return
	}
	var s models.Service
	if err := db.DB.First(&s, id).Error; err != nil {
		resp.Err(c, 404, 404, "服务不存在")
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	raw, _ := json.Marshal(body)
	_ = json.Unmarshal(raw, &s)
	if err := db.DB.Save(&s).Error; err != nil {
		resp.Err(c, 500, 500, "更新服务失败")
		return
	}
	db.DB.Preload("ServiceCategory").First(&s, s.ID)
	resp.OK(c, s)
}

func svcRemove(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		resp.Err(c, 400, 400, "无效的服务ID")
		return
	}
	if err := db.DB.Delete(&models.Service{}, id).Error; err != nil {
		resp.Err(c, 500, 500, "删除服务失败")
		return
	}
	resp.OKMsg(c, "删除成功")
}
