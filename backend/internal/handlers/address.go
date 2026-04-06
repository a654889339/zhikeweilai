package handlers

import (
	"strconv"
	"strings"

	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"

	"github.com/gin-gonic/gin"
)

func addrList(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var list []models.Address
	db.DB.Where("userId = ?", u.ID).Order("isDefault DESC, updatedAt DESC").Find(&list)
	resp.OK(c, list)
}

func addrCreate(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body models.Address
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if strings.TrimSpace(body.ContactName) == "" || strings.TrimSpace(body.ContactPhone) == "" {
		resp.Err(c, 400, 400, "联系人和电话不能为空")
		return
	}
	if strings.TrimSpace(body.Country) == "" {
		resp.Err(c, 400, 400, "请选择国家/地区")
		return
	}
	if strings.TrimSpace(body.DetailAddress) == "" {
		resp.Err(c, 400, 400, "请填写详细地址")
		return
	}
	if body.IsDefault {
		db.DB.Model(&models.Address{}).Where("userId = ?", u.ID).Update("isDefault", false)
	}
	body.UserID = u.ID
	if body.Country == "" {
		body.Country = "中国大陆"
	}
	if err := db.DB.Create(&body).Error; err != nil {
		resp.Err(c, 500, 500, "创建地址失败")
		return
	}
	resp.OK(c, body)
}

func addrUpdate(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var a models.Address
	if err := db.DB.First(&a, id).Error; err != nil {
		resp.Err(c, 404, 404, "地址不存在")
		return
	}
	if a.UserID != u.ID {
		resp.Err(c, 403, 403, "无权操作")
		return
	}
	var body models.Address
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if body.IsDefault && !a.IsDefault {
		db.DB.Model(&models.Address{}).Where("userId = ?", u.ID).Update("isDefault", false)
	}
	if body.ContactName != "" {
		a.ContactName = strings.TrimSpace(body.ContactName)
	}
	if body.ContactPhone != "" {
		a.ContactPhone = strings.TrimSpace(body.ContactPhone)
	}
	if body.Country != "" {
		a.Country = body.Country
	}
	a.CustomCountry = body.CustomCountry
	a.Province = body.Province
	a.City = body.City
	a.District = body.District
	if body.DetailAddress != "" {
		a.DetailAddress = strings.TrimSpace(body.DetailAddress)
	}
	if body.DetailAddress == "" {
		// keep old
	}
	a.IsDefault = body.IsDefault
	db.DB.Save(&a)
	resp.OK(c, a)
}

func addrRemove(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var a models.Address
	if err := db.DB.First(&a, id).Error; err != nil {
		resp.Err(c, 404, 404, "地址不存在")
		return
	}
	if a.UserID != u.ID {
		resp.Err(c, 403, 403, "无权操作")
		return
	}
	db.DB.Delete(&a)
	resp.OKMsg(c, "删除成功")
}

func addrSetDefault(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var a models.Address
	if err := db.DB.First(&a, id).Error; err != nil {
		resp.Err(c, 404, 404, "地址不存在")
		return
	}
	if a.UserID != u.ID {
		resp.Err(c, 403, 403, "无权操作")
		return
	}
	db.DB.Model(&models.Address{}).Where("userId = ?", u.ID).Update("isDefault", false)
	a.IsDefault = true
	db.DB.Save(&a)
	resp.OK(c, a)
}
