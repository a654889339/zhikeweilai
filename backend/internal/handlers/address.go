package handlers

import (
	"log"
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
	var body struct {
		ContactName   string `json:"contactName"`
		ContactPhone  string `json:"contactPhone"`
		Country       string `json:"country"`
		CustomCountry string `json:"customCountry"`
		Province      string `json:"province"`
		City          string `json:"city"`
		District      string `json:"district"`
		DetailAddress string `json:"detailAddress"`
		IsDefault     bool   `json:"isDefault"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if strings.TrimSpace(body.ContactName) == "" || strings.TrimSpace(body.ContactPhone) == "" {
		resp.Err(c, 400, 400, "联系人和电话不能为空")
		return
	}
	country := strings.TrimSpace(body.Country)
	if country == "中国" {
		country = "中国大陆"
	}
	if country == "" {
		resp.Err(c, 400, 400, "请选择国家/地区")
		return
	}
	if strings.TrimSpace(body.DetailAddress) == "" {
		resp.Err(c, 400, 400, "请填写详细地址")
		return
	}
	var nUser int64
	db.DB.Model(&models.User{}).Where("id = ?", u.ID).Count(&nUser)
	if nUser == 0 {
		resp.Err(c, 401, 401, "登录已失效，请重新登录")
		return
	}
	if body.IsDefault {
		db.DB.Model(&models.Address{}).Where("userId = ?", u.ID).Update("isDefault", false)
	}
	a := models.Address{
		UserID:        u.ID,
		ContactName:   strings.TrimSpace(body.ContactName),
		ContactPhone:  strings.TrimSpace(body.ContactPhone),
		Country:       country,
		CustomCountry: strings.TrimSpace(body.CustomCountry),
		Province:      strings.TrimSpace(body.Province),
		City:          strings.TrimSpace(body.City),
		District:      strings.TrimSpace(body.District),
		DetailAddress: strings.TrimSpace(body.DetailAddress),
		IsDefault:     body.IsDefault,
	}
	if err := db.DB.Create(&a).Error; err != nil {
		log.Printf("addrCreate: userId=%d err=%v", u.ID, err)
		msg := "创建地址失败，请稍后重试"
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") || strings.Contains(err.Error(), "1452") {
			msg = "用户不存在或已失效，请重新登录后再试"
		}
		resp.Err(c, 500, 500, msg)
		return
	}
	resp.OK(c, a)
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
