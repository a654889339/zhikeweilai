package handlers

import (
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
