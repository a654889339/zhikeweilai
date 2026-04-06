package handlers

import (
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	mathrand "math/rand"
	"path"
	"strconv"
	"strings"
	"time"

	"zhikeweilai/backend/internal/config"
	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"
	"zhikeweilai/backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func outletGenOrderNo() string {
	now := time.Now()
	r := mathrand.Intn(10000)
	return fmt.Sprintf("OT%d%02d%02d%02d%02d%02d%04d",
		now.Year(), int(now.Month()), now.Day(), now.Hour(), now.Minute(), now.Second(), r)
}

var outletStatusMap = map[string]struct{ Text, Type string }{
	"pending":    {Text: "待支付", Type: "warning"},
	"paid":       {Text: "已支付", Type: "primary"},
	"processing": {Text: "进行中", Type: "primary"},
	"completed":  {Text: "已完成", Type: "success"},
	"cancelled":  {Text: "已取消", Type: "default"},
}

// --- outlet auth ---
func outletSendCode(c *gin.Context, cfg *config.Config) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "邮箱不能为空")
		return
	}
	email := strings.TrimSpace(body.Email)
	if email == "" || !emailRegex.MatchString(email) {
		resp.Err(c, 400, 400, "邮箱格式不正确")
		return
	}
	var n int64
	db.DB.Model(&models.OutletUser{}).Where("email = ?", email).Count(&n)
	if n > 0 {
		resp.Err(c, 400, 400, "该邮箱已被注册")
		return
	}
	if err := services.SendEmailCode(cfg, email); err != nil {
		resp.Err(c, 400, 400, err.Error())
		return
	}
	resp.OKMsg(c, "验证码已发送")
}

func outletSendSmsCode(c *gin.Context, cfg *config.Config) {
	var body struct {
		Phone string `json:"phone"`
		Scene string `json:"scene"`
	}
	_ = c.ShouldBindJSON(&body)
	if body.Phone == "" {
		resp.Err(c, 400, 400, "手机号不能为空")
		return
	}
	key := services.NormalizePhone(body.Phone)
	if len(key) != 11 || key[0] != '1' {
		resp.Err(c, 400, 400, "请输入正确的11位大陆手机号")
		return
	}
	if body.Scene == "register" {
		var n int64
		db.DB.Model(&models.OutletUser{}).Where("phone = ?", key).Count(&n)
		if n > 0 {
			resp.Err(c, 400, 400, "该手机号已注册")
			return
		}
	}
	if err := services.SendSMSCode(cfg, body.Phone); err != nil {
		resp.Err(c, 400, 400, err.Error())
		return
	}
	resp.OKMsg(c, "验证码已发送")
}

func outletRegister(c *gin.Context, cfg *config.Config) {
	var body struct {
		Username, Password, Email, Code, Nickname, Phone, SmsCode string
	}
	_ = c.ShouldBindJSON(&body)
	usePhone := strings.TrimSpace(body.Phone) != ""
	if usePhone {
		code := body.SmsCode
		if code == "" {
			code = body.Code
		}
		if code == "" {
			resp.Err(c, 400, 400, "验证码不能为空")
			return
		}
		normalized := services.NormalizePhone(body.Phone)
		if ok, msg := services.SMSVerify(body.Phone, code); !ok {
			resp.Err(c, 400, 400, msg)
			return
		}
		var n int64
		db.DB.Model(&models.OutletUser{}).Where("phone = ?", normalized).Count(&n)
		if n > 0 {
			resp.Err(c, 400, 400, "该手机号已注册")
			return
		}
		base := strings.TrimSpace(body.Username)
		if base == "" {
			base = "outlet_" + normalized[len(normalized)-8:]
		}
		final := base
		for i := 0; ; i++ {
			var cnt int64
			db.DB.Model(&models.OutletUser{}).Where("username = ?", final).Count(&cnt)
			if cnt == 0 {
				break
			}
			final = fmt.Sprintf("%s%d", base, i+1)
		}
		if len(body.Password) < 6 {
			resp.Err(c, 400, 400, "密码长度不能少于6位")
			return
		}
		hash, _ := services.HashPassword(body.Password)
		nick := strings.TrimSpace(body.Nickname)
		if nick == "" {
			nick = normalized[:3] + "****" + normalized[len(normalized)-4:]
		}
		u := models.OutletUser{Username: final, Password: hash, Phone: normalized, Nickname: nick, Role: "outlet", Status: "active"}
		db.DB.Create(&u)
		tok, _ := services.SignJWT(cfg, u.ID, u.Username, u.Role, "outlet")
		resp.OK(c, gin.H{"token": tok, "user": u})
		return
	}
	if body.Username == "" || body.Password == "" {
		resp.Err(c, 400, 400, "用户名和密码不能为空")
		return
	}
	if body.Email == "" || body.Code == "" {
		resp.Err(c, 400, 400, "邮箱或验证码缺失")
		return
	}
	if ok, msg := services.EmailVerify(body.Email, body.Code); !ok {
		resp.Err(c, 400, 400, msg)
		return
	}
	if len(body.Password) < 6 {
		resp.Err(c, 400, 400, "密码长度不能少于6位")
		return
	}
	uName := strings.TrimSpace(body.Username)
	if len(uName) < 2 || len(uName) > 50 {
		resp.Err(c, 400, 400, "用户名长度需在2-50个字符之间")
		return
	}
	var cnt int64
	db.DB.Model(&models.OutletUser{}).Where("username = ?", uName).Count(&cnt)
	if cnt > 0 {
		resp.Err(c, 400, 400, "用户名已存在")
		return
	}
	db.DB.Model(&models.OutletUser{}).Where("email = ?", body.Email).Count(&cnt)
	if cnt > 0 {
		resp.Err(c, 400, 400, "该邮箱已被注册")
		return
	}
	hash, _ := services.HashPassword(body.Password)
	nick := strings.TrimSpace(body.Nickname)
	if nick == "" {
		nick = uName
	}
	em := body.Email
	u := models.OutletUser{Username: uName, Password: hash, Email: &em, Nickname: nick, Role: "outlet", Status: "active"}
	db.DB.Create(&u)
	tok, _ := services.SignJWT(cfg, u.ID, u.Username, u.Role, "outlet")
	resp.OK(c, gin.H{"token": tok, "user": u})
}

func outletLogin(c *gin.Context, cfg *config.Config) {
	var body struct {
		Username, Password, Phone, Code string
	}
	_ = c.ShouldBindJSON(&body)
	if strings.TrimSpace(body.Phone) != "" {
		if body.Code == "" {
			resp.Err(c, 400, 400, "验证码不能为空")
			return
		}
		normalized := services.NormalizePhone(body.Phone)
		if ok, msg := services.SMSVerify(body.Phone, body.Code); !ok {
			resp.Err(c, 400, 400, msg)
			return
		}
		var u models.OutletUser
		if err := db.DB.Where("phone = ?", normalized).First(&u).Error; err != nil {
			resp.Err(c, 400, 400, "该手机号未注册，请先注册")
			return
		}
		if u.Status != "active" {
			resp.Err(c, 403, 403, "账号已被禁用")
			return
		}
		tok, _ := services.SignJWT(cfg, u.ID, u.Username, u.Role, "outlet")
		resp.OK(c, gin.H{"token": tok, "user": u})
		return
	}
	if body.Username == "" || body.Password == "" {
		resp.Err(c, 400, 400, "用户名和密码不能为空")
		return
	}
	var u models.OutletUser
	if err := db.DB.Where("username = ?", strings.TrimSpace(body.Username)).First(&u).Error; err != nil {
		resp.Err(c, 401, 401, "用户名或密码错误")
		return
	}
	if !services.CheckPassword(u.Password, body.Password) {
		resp.Err(c, 401, 401, "用户名或密码错误")
		return
	}
	if u.Status != "active" {
		resp.Err(c, 403, 403, "账号已被禁用")
		return
	}
	tok, _ := services.SignJWT(cfg, u.ID, u.Username, u.Role, "outlet")
	resp.OK(c, gin.H{"token": tok, "user": u})
}

func outletGetProfile(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var user models.OutletUser
	if err := db.DB.First(&user, u.ID).Error; err != nil {
		resp.Err(c, 404, 404, "用户不存在")
		return
	}
	if user.Status != "active" {
		resp.Err(c, 403, 403, "账号已被禁用")
		return
	}
	resp.OK(c, user)
}

func outletUpdateProfile(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var user models.OutletUser
	if err := db.DB.First(&user, u.ID).Error; err != nil {
		resp.Err(c, 404, 404, "用户不存在")
		return
	}
	var body struct {
		Nickname *string `json:"nickname"`
		Avatar   *string `json:"avatar"`
	}
	_ = c.ShouldBindJSON(&body)
	if body.Nickname != nil {
		s := strings.TrimSpace(*body.Nickname)
		if s != "" {
			user.Nickname = s
		}
	}
	if body.Avatar != nil {
		user.Avatar = strings.TrimSpace(*body.Avatar)
	}
	db.DB.Save(&user)
	resp.OK(c, user)
}

func outletUploadAvatar(c *gin.Context, cfg *config.Config) {
	_ = cfg
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	fh, err := c.FormFile("avatar")
	if err != nil {
		resp.Err(c, 400, 400, "请选择图片")
		return
	}
	f, err := fh.Open()
	if err != nil {
		return
	}
	defer f.Close()
	buf, _ := io.ReadAll(f)
	ext := path.Ext(fh.Filename)
	if ext == "" {
		ext = ".png"
	}
	b := make([]byte, 8)
	_, _ = crand.Read(b)
	filename := "outlet_avatar_" + hex.EncodeToString(b) + ext
	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	url, err := services.UploadCOS(c.Request.Context(), buf, filename, ct)
	if err != nil {
		resp.Err(c, 500, 500, "上传失败")
		return
	}
	_ = db.DB.Model(&models.OutletUser{}).Where("id = ?", u.ID).Update("avatar", url).Error
	resp.OK(c, gin.H{"url": url})
}

func outletBindPhone(c *gin.Context, cfg *config.Config) {
	_ = cfg
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		Phone, Code string
	}
	_ = c.ShouldBindJSON(&body)
	if body.Phone == "" || body.Code == "" {
		resp.Err(c, 400, 400, "手机号和验证码不能为空")
		return
	}
	normalized := services.NormalizePhone(body.Phone)
	if ok2, msg := services.SMSVerify(body.Phone, body.Code); !ok2 {
		resp.Err(c, 400, 400, msg)
		return
	}
	var ex models.OutletUser
	if err := db.DB.Where("phone = ?", normalized).First(&ex).Error; err == nil && ex.ID != u.ID {
		resp.Err(c, 400, 400, "该手机号已被其他账号绑定")
		return
	}
	var user models.OutletUser
	db.DB.First(&user, u.ID)
	user.Phone = normalized
	db.DB.Save(&user)
	resp.JSON(c, 0, gin.H{"data": user, "message": "绑定成功"})
}

// --- outlet orders ---
func outletOrderCreate(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		ServiceID       *int    `json:"serviceId"`
		ServiceTitle    string  `json:"serviceTitle"`
		ServiceIcon     string  `json:"serviceIcon"`
		Price           float64 `json:"price"`
		ContactName     string  `json:"contactName"`
		ContactPhone    string  `json:"contactPhone"`
		Address         string  `json:"address"`
		AppointmentTime *string `json:"appointmentTime"`
		Remark          string  `json:"remark"`
	}
	_ = c.ShouldBindJSON(&body)
	if strings.TrimSpace(body.ServiceTitle) == "" || body.Price == 0 {
		resp.Err(c, 400, 400, "服务信息不完整")
		return
	}
	o := models.OutletOrder{
		OrderNo: outletGenOrderNo(), UserID: u.ID, ServiceID: body.ServiceID,
		ServiceTitle: body.ServiceTitle, ServiceIcon: firstNonEmpty(body.ServiceIcon, "setting-o"),
		Price: body.Price, ContactName: body.ContactName, ContactPhone: body.ContactPhone,
		Address: body.Address, Remark: body.Remark, Status: "pending",
	}
	if body.AppointmentTime != nil && *body.AppointmentTime != "" {
		t, err := time.Parse(time.RFC3339, *body.AppointmentTime)
		if err == nil {
			o.AppointmentTime = &t
		}
	}
	db.DB.Create(&o)
	resp.OK(c, o)
}

func outletOrderMy(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	status := c.Query("status")
	page := queryInt(c, "page", 1)
	ps := queryInt(c, "pageSize", 10)
	if ps > 100 {
		ps = 100
	}
	q := db.DB.Model(&models.OutletOrder{}).Where("userId = ?", u.ID)
	if status != "" && status != "all" {
		q = q.Where("status = ?", status)
	}
	var total int64
	q.Count(&total)
	var rows []models.OutletOrder
	q.Order("createdAt DESC").Limit(ps).Offset((page - 1) * ps).Find(&rows)
	list := make([]gin.H, 0, len(rows))
	for _, o := range rows {
		s := outletStatusMap[o.Status]
		raw, _ := json.Marshal(o)
		var h gin.H
		_ = json.Unmarshal(raw, &h)
		h["statusText"] = s.Text
		h["statusType"] = s.Type
		list = append(list, h)
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": ps})
}

func outletOrderDetail(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var o models.OutletOrder
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	if o.UserID != u.ID && u.Role != "admin" {
		resp.Err(c, 403, 403, "无权查看")
		return
	}
	s := outletStatusMap[o.Status]
	raw, _ := json.Marshal(o)
	var h gin.H
	_ = json.Unmarshal(raw, &h)
	h["statusText"] = s.Text
	h["statusType"] = s.Type
	resp.OK(c, h)
}

func outletOrderCancel(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var o models.OutletOrder
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	if o.UserID != u.ID && u.Role != "admin" {
		resp.Err(c, 403, 403, "无权操作")
		return
	}
	if o.Status == "completed" || o.Status == "cancelled" {
		resp.Err(c, 400, 400, "当前状态无法取消")
		return
	}
	o.Status = "cancelled"
	db.DB.Save(&o)
	resp.OKMsg(c, "订单已取消")
}

func outletAdminOrderList(c *gin.Context) {
	status := c.Query("status")
	userID := c.Query("userId")
	page := queryInt(c, "page", 1)
	ps := queryInt(c, "pageSize", 20)
	q := db.DB.Model(&models.OutletOrder{})
	if status != "" && status != "all" {
		q = q.Where("status = ?", status)
	}
	if userID != "" {
		if uid, err := strconv.Atoi(userID); err == nil {
			q = q.Where("userId = ?", uid)
		}
	}
	var total int64
	q.Count(&total)
	var rows []models.OutletOrder
	q.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "username", "email", "nickname")
	}).Order("createdAt DESC").Limit(ps).Offset((page - 1) * ps).Find(&rows)
	list := make([]gin.H, 0, len(rows))
	for _, o := range rows {
		s := outletStatusMap[o.Status]
		raw, _ := json.Marshal(o)
		var h gin.H
		_ = json.Unmarshal(raw, &h)
		h["statusText"] = s.Text
		h["statusType"] = s.Type
		list = append(list, h)
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": ps})
}

func outletAdminOrderStats(c *gin.Context) {
	var total, pending, processing, completed, cancelled int64
	db.DB.Model(&models.OutletOrder{}).Count(&total)
	db.DB.Model(&models.OutletOrder{}).Where("status = ?", "pending").Count(&pending)
	db.DB.Model(&models.OutletOrder{}).Where("status = ?", "processing").Count(&processing)
	db.DB.Model(&models.OutletOrder{}).Where("status = ?", "completed").Count(&completed)
	db.DB.Model(&models.OutletOrder{}).Where("status = ?", "cancelled").Count(&cancelled)
	resp.OK(c, gin.H{"total": total, "pending": pending, "processing": processing, "completed": completed, "cancelled": cancelled})
}

func outletAdminOrderUpdateStatus(c *gin.Context) {
	u, _ := ctxUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Status string `json:"status"`
	}
	_ = c.ShouldBindJSON(&body)
	if _, ok := outletStatusMap[body.Status]; !ok {
		resp.Err(c, 400, 400, "无效状态")
		return
	}
	var o models.OutletOrder
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	old := o.Status
	if old != body.Status {
		db.DB.Create(&models.OutletOrderLog{
			OrderID: o.ID, ChangeType: "status",
			OldValue: outletStatusMap[old].Text, NewValue: outletStatusMap[body.Status].Text,
			Operator: u.Username,
		})
	}
	o.Status = body.Status
	db.DB.Save(&o)
	s := outletStatusMap[o.Status]
	raw, _ := json.Marshal(o)
	var h gin.H
	_ = json.Unmarshal(raw, &h)
	h["statusText"] = s.Text
	h["statusType"] = s.Type
	resp.OK(c, h)
}

func outletAdminOrderUpdatePrice(c *gin.Context) {
	u, _ := ctxUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Price float64 `json:"price"`
	}
	_ = c.ShouldBindJSON(&body)
	if body.Price < 0 || math.IsNaN(body.Price) {
		resp.Err(c, 400, 400, "无效金额")
		return
	}
	var o models.OutletOrder
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	oldP := o.Price
	if oldP != body.Price {
		db.DB.Create(&models.OutletOrderLog{
			OrderID: o.ID, ChangeType: "price",
			OldValue: fmt.Sprintf("¥%.2f", oldP), NewValue: fmt.Sprintf("¥%.2f", body.Price),
			Operator: u.Username,
		})
	}
	o.Price = body.Price
	db.DB.Save(&o)
	resp.OK(c, o)
}

func outletAdminOrderRemark(c *gin.Context) {
	u, _ := ctxUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Remark string `json:"remark"`
	}
	_ = c.ShouldBindJSON(&body)
	if strings.TrimSpace(body.Remark) == "" {
		resp.Err(c, 400, 400, "备注不能为空")
		return
	}
	var o models.OutletOrder
	if err := db.DB.First(&o, id).Error; err != nil {
		resp.Err(c, 404, 404, "订单不存在")
		return
	}
	db.DB.Create(&models.OutletOrderLog{
		OrderID: o.ID, ChangeType: "admin_remark", OldValue: "", NewValue: strings.TrimSpace(body.Remark), Operator: u.Username,
	})
	o.AdminRemark = strings.TrimSpace(body.Remark)
	db.DB.Save(&o)
	resp.OKMsg(c, "备注已添加")
}

func outletAdminOrderLogs(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var logs []models.OutletOrderLog
	db.DB.Where("orderId = ?", id).Order("createdAt DESC").Find(&logs)
	var o models.OutletOrder
	db.DB.Select("id", "orderNo", "adminRemark").First(&o, id)
	resp.OK(c, gin.H{"logs": logs, "adminRemark": o.AdminRemark})
}

// --- outlet addresses ---
func outletAddrList(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var list []models.OutletAddress
	db.DB.Where("userId = ?", u.ID).Order("isDefault DESC, updatedAt DESC").Find(&list)
	resp.OK(c, list)
}

func outletAddrCreate(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body models.OutletAddress
	_ = c.ShouldBindJSON(&body)
	if body.ContactName == "" || body.ContactPhone == "" {
		resp.Err(c, 400, 400, "联系人和电话不能为空")
		return
	}
	if body.Country == "" {
		resp.Err(c, 400, 400, "请选择国家/地区")
		return
	}
	if body.DetailAddress == "" {
		resp.Err(c, 400, 400, "请填写详细地址")
		return
	}
	if body.IsDefault {
		db.DB.Model(&models.OutletAddress{}).Where("userId = ?", u.ID).Update("isDefault", false)
	}
	body.UserID = u.ID
	if body.Country == "" {
		body.Country = "中国大陆"
	}
	db.DB.Create(&body)
	resp.OK(c, body)
}

func outletAddrUpdate(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var a models.OutletAddress
	if err := db.DB.First(&a, id).Error; err != nil || a.UserID != u.ID {
		resp.Err(c, 404, 404, "地址不存在")
		return
	}
	var body models.OutletAddress
	_ = c.ShouldBindJSON(&body)
	if body.IsDefault && !a.IsDefault {
		db.DB.Model(&models.OutletAddress{}).Where("userId = ?", u.ID).Update("isDefault", false)
	}
	if body.ContactName != "" {
		a.ContactName = body.ContactName
	}
	if body.ContactPhone != "" {
		a.ContactPhone = body.ContactPhone
	}
	if body.Country != "" {
		a.Country = body.Country
	}
	a.CustomCountry = body.CustomCountry
	a.Province = body.Province
	a.City = body.City
	a.District = body.District
	if body.DetailAddress != "" {
		a.DetailAddress = body.DetailAddress
	}
	a.IsDefault = body.IsDefault
	db.DB.Save(&a)
	resp.OK(c, a)
}

func outletAddrRemove(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var a models.OutletAddress
	if err := db.DB.First(&a, id).Error; err != nil || a.UserID != u.ID {
		resp.Err(c, 404, 404, "地址不存在")
		return
	}
	db.DB.Delete(&a)
	resp.OKMsg(c, "删除成功")
}

func outletAddrDefault(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var a models.OutletAddress
	if err := db.DB.First(&a, id).Error; err != nil || a.UserID != u.ID {
		resp.Err(c, 404, 404, "地址不存在")
		return
	}
	db.DB.Model(&models.OutletAddress{}).Where("userId = ?", u.ID).Update("isDefault", false)
	a.IsDefault = true
	db.DB.Save(&a)
	resp.OK(c, a)
}

// --- outlet home config ---
func outletHCList(c *gin.Context) {
	q := db.DB.Model(&models.OutletHomeConfig{})
	if sec := c.Query("section"); sec != "" {
		q = q.Where("section = ?", sec)
	}
	if c.Query("all") == "" {
		q = q.Where("status = ?", "active")
	}
	var items []models.OutletHomeConfig
	q.Order("section ASC, sortOrder ASC, id ASC").Find(&items)
	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		raw, _ := json.Marshal(it)
		var o gin.H
		_ = json.Unmarshal(raw, &o)
		thumb := ""
		if x, ok := o["imageUrlThumb"].(string); ok {
			thumb = x
		}
		o["imageUrlThumb"] = strings.TrimSpace(thumb)
		out = append(out, o)
	}
	resp.OK(c, out)
}

func outletHCCreate(c *gin.Context) {
	var body models.OutletHomeConfig
	_ = c.ShouldBindJSON(&body)
	db.DB.Create(&body)
	resp.OK(c, body)
}

func outletHCUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var item models.OutletHomeConfig
	if err := db.DB.First(&item, id).Error; err != nil {
		resp.Err(c, 404, 1, "配置不存在")
		return
	}
	_ = c.ShouldBindJSON(&item)
	item.ID = id
	db.DB.Save(&item)
	resp.OK(c, item)
}

func outletHCRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db.DB.Delete(&models.OutletHomeConfig{}, id)
	resp.OKMsg(c, "删除成功")
}

func outletHCUpload(c *gin.Context, cfg *config.Config) {
	_ = cfg
	fh, err := c.FormFile("file")
	if err != nil {
		resp.Err(c, 400, 1, "请选择图片文件")
		return
	}
	f, err := fh.Open()
	if err != nil {
		return
	}
	defer f.Close()
	buf, _ := io.ReadAll(f)
	ext := path.Ext(fh.Filename)
	if ext == "" {
		ext = ".png"
	}
	filename := "outlet-homeconfig-" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "-" + randomHex6() + ext
	ct := fh.Header.Get("Content-Type")
	url, thumb, err := services.UploadWithThumb(c.Request.Context(), buf, filename, ct, 0)
	if err != nil {
		resp.Err(c, 500, 1, err.Error())
		return
	}
	resp.OK(c, gin.H{"url": url, "thumbUrl": thumb})
}

func randomHex6() string {
	b := make([]byte, 3)
	_, _ = crand.Read(b)
	return hex.EncodeToString(b)
}

// --- outlet services ---
func outletSvcCatList(c *gin.Context) {
	var list []models.OutletServiceCategory
	db.DB.Order("sortOrder ASC, id ASC").Find(&list)
	resp.OK(c, list)
}

func outletSvcList(c *gin.Context) {
	cid := strings.TrimSpace(c.Query("categoryId"))
	q := db.DB.Model(&models.OutletService{}).Where("outlet_services.status = ?", "active")
	if cid != "" {
		if id, err := strconv.Atoi(cid); err == nil {
			q = q.Where("outlet_services.categoryId = ?", id)
		}
	}
	var rows []models.OutletService
	q.Preload("ServiceCategory", "status = ?", "active").Order("sortOrder ASC, id ASC").Find(&rows)
	out := make([]models.OutletService, 0)
	for _, s := range rows {
		if s.ServiceCategory != nil && s.ServiceCategory.Status == "active" {
			out = append(out, s)
		}
	}
	resp.OK(c, gin.H{"list": out})
}

func outletSvcAdminList(c *gin.Context) {
	var rows []models.OutletService
	db.DB.Model(&models.OutletService{}).Preload("ServiceCategory").
		Joins("LEFT JOIN outlet_service_categories osc ON osc.id = outlet_services.categoryId").
		Order("osc.sortOrder ASC, outlet_services.sortOrder ASC, outlet_services.id ASC").Find(&rows)
	resp.OK(c, rows)
}

func outletSvcCatCreate(c *gin.Context) {
	var body models.OutletServiceCategory
	_ = c.ShouldBindJSON(&body)
	if body.Name == "" {
		resp.Err(c, 400, 400, "种类名称不能为空")
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}
	db.DB.Create(&body)
	resp.OK(c, body)
}

func outletSvcCatUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cat models.OutletServiceCategory
	if err := db.DB.First(&cat, id).Error; err != nil {
		resp.Err(c, 404, 404, "种类不存在")
		return
	}
	_ = c.ShouldBindJSON(&cat)
	cat.ID = id
	db.DB.Save(&cat)
	resp.OK(c, cat)
}

func outletSvcCatRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cat models.OutletServiceCategory
	if err := db.DB.First(&cat, id).Error; err != nil {
		resp.Err(c, 404, 404, "种类不存在")
		return
	}
	var n int64
	db.DB.Model(&models.OutletService{}).Where("categoryId = ?", cat.ID).Count(&n)
	if n > 0 {
		resp.Err(c, 400, 400, "该种类下还有具体服务，请先删除或移出后再删种类")
		return
	}
	db.DB.Delete(&cat)
	resp.OKMsg(c, "删除成功")
}

func outletSvcCreate(c *gin.Context) {
	var body models.OutletService
	_ = c.ShouldBindJSON(&body)
	if strings.TrimSpace(body.Title) == "" {
		resp.Err(c, 400, 400, "标题不能为空")
		return
	}
	if body.CategoryID == nil && (body.Category == nil || strings.TrimSpace(*body.Category) == "") {
		resp.Err(c, 400, 400, "请选择服务种类")
		return
	}
	db.DB.Create(&body)
	db.DB.Preload("ServiceCategory").First(&body, body.ID)
	resp.OK(c, body)
}

func outletSvcUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var s models.OutletService
	if err := db.DB.First(&s, id).Error; err != nil {
		resp.Err(c, 404, 404, "服务不存在")
		return
	}
	_ = c.ShouldBindJSON(&s)
	s.ID = id
	db.DB.Save(&s)
	db.DB.Preload("ServiceCategory").First(&s, id)
	resp.OK(c, s)
}

func outletSvcRemove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db.DB.Delete(&models.OutletService{}, id)
	resp.OKMsg(c, "删除成功")
}

// --- outlet messages ---
func outletMsgMy(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var list []models.OutletMessage
	db.DB.Where("userId = ?", u.ID).Order("createdAt ASC").Find(&list)
	db.DB.Model(&models.OutletMessage{}).Where("userId = ? AND sender = ? AND `read` = ?", u.ID, "admin", false).Update("read", true)
	resp.OK(c, list)
}

func outletMsgSend(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		Content, Type string
	}
	_ = c.ShouldBindJSON(&body)
	if strings.TrimSpace(body.Content) == "" {
		resp.Err(c, 400, 1, "消息不能为空")
		return
	}
	t := "text"
	if body.Type == "image" {
		t = "image"
	}
	m := models.OutletMessage{UserID: u.ID, Sender: "user", Content: strings.TrimSpace(body.Content), Type: t}
	db.DB.Create(&m)
	resp.OK(c, m)
}

func outletMsgUpload(c *gin.Context, cfg *config.Config) {
	_ = cfg
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	fh, err := c.FormFile("image")
	if err != nil {
		resp.Err(c, 400, 1, "请选择图片")
		return
	}
	f, err := fh.Open()
	if err != nil {
		return
	}
	defer f.Close()
	buf, _ := io.ReadAll(f)
	ext := path.Ext(fh.Filename)
	if ext == "" {
		ext = ".png"
	}
	b := make([]byte, 4)
	_, _ = crand.Read(b)
	filename := "outlet_chat_" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "_" + hex.EncodeToString(b) + ext
	url, err := services.UploadCOS(c.Request.Context(), buf, filename, fh.Header.Get("Content-Type"))
	if err != nil {
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	_ = u
	resp.OK(c, gin.H{"url": url})
}

func outletMsgUnread(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var n int64
	db.DB.Model(&models.OutletMessage{}).Where("userId = ? AND sender = ? AND `read` = ?", u.ID, "admin", false).Count(&n)
	resp.OK(c, n)
}

func outletMsgAdminConv(c *gin.Context) {
	var users []models.OutletUser
	db.DB.Preload("Messages", func(db *gorm.DB) *gorm.DB {
		return db.Order("createdAt DESC").Limit(1)
	}).Find(&users)
	type conv struct {
		uid                                    int
		username, nickname, avatar, lastMsg    string
		lastTime                               time.Time
		lastSender, lastType                   string
	}
	var list []conv
	for _, u := range users {
		if len(u.Messages) == 0 {
			continue
		}
		last := u.Messages[0]
		nick := u.Nickname
		if nick == "" {
			nick = u.Username
		}
		list = append(list, conv{uid: u.ID, username: u.Username, nickname: nick, avatar: u.Avatar, lastMsg: last.Content, lastTime: last.CreatedAt, lastSender: last.Sender, lastType: last.Type})
	}
	for i := 0; i < len(list); i++ {
		for j := i + 1; j < len(list); j++ {
			if list[i].lastTime.Before(list[j].lastTime) {
				list[i], list[j] = list[j], list[i]
			}
		}
	}
	type row struct {
		UserID int `gorm:"column:userId"`
		Cnt    int `gorm:"column:cnt"`
	}
	var rows []row
	db.DB.Model(&models.OutletMessage{}).Select("userId, COUNT(id) as cnt").Where("sender = ? AND `read` = ?", "user", false).Group("userId").Scan(&rows)
	unread := map[int]int{}
	for _, r := range rows {
		unread[r.UserID] = r.Cnt
	}
	out := make([]gin.H, 0, len(list))
	for _, it := range list {
		out = append(out, gin.H{
			"userId": it.uid, "username": it.username, "nickname": it.nickname, "avatar": it.avatar,
			"lastMessage": it.lastMsg, "lastTime": it.lastTime, "lastSender": it.lastSender, "lastType": it.lastType,
			"unread": unread[it.uid],
		})
	}
	resp.OK(c, out)
}

func outletMsgAdminGet(c *gin.Context) {
	uid, _ := strconv.Atoi(c.Param("userId"))
	var list []models.OutletMessage
	db.DB.Where("userId = ?", uid).Order("createdAt ASC").Find(&list)
	db.DB.Model(&models.OutletMessage{}).Where("userId = ? AND sender = ? AND `read` = ?", uid, "user", false).Update("read", true)
	resp.OK(c, list)
}

func outletMsgAdminReply(c *gin.Context) {
	uid, _ := strconv.Atoi(c.Param("userId"))
	var body struct {
		Content, Type string
	}
	_ = c.ShouldBindJSON(&body)
	if strings.TrimSpace(body.Content) == "" {
		resp.Err(c, 400, 1, "消息不能为空")
		return
	}
	t := "text"
	if body.Type == "image" {
		t = "image"
	}
	m := models.OutletMessage{UserID: uid, Sender: "admin", Content: strings.TrimSpace(body.Content), Type: t}
	db.DB.Create(&m)
	resp.OK(c, m)
}

// --- outlet admin users ---
func outletAdminUsers(c *gin.Context) {
	page := queryInt(c, "page", 1)
	ps := queryInt(c, "pageSize", 50)
	if ps > 200 {
		ps = 200
	}
	q := db.DB.Model(&models.OutletUser{})
	qw := strings.TrimSpace(c.Query("q"))
	st := c.Query("searchType")
	if qw != "" && st != "" {
		switch st {
		case "id":
			if id, err := strconv.Atoi(qw); err == nil && id > 0 {
				q = q.Where("id = ?", id)
			} else {
				q = q.Where("id = ?", -1)
			}
		case "username":
			q = q.Where("username LIKE ?", "%"+escapeLike(qw)+"%")
		case "phone":
			q = q.Where("phone LIKE ?", "%"+escapeLike(qw)+"%")
		}
	}
	var total int64
	q.Count(&total)
	var users []models.OutletUser
	q.Preload("Addresses").Order("createdAt DESC").Limit(ps).Offset((page - 1) * ps).Find(&users)
	ids := make([]int, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.ID)
	}
	countMap := map[int]int{}
	if len(ids) > 0 {
		type crow struct {
			UserID int `gorm:"column:userId"`
			Cnt    int `gorm:"column:cnt"`
		}
		var cr []crow
		db.DB.Model(&models.OutletOrder{}).Select("userId, COUNT(id) as cnt").Where("userId IN ?", ids).Group("userId").Scan(&cr)
		for _, r := range cr {
			countMap[r.UserID] = r.Cnt
		}
	}
	list := make([]gin.H, 0, len(users))
	for _, u := range users {
		raw, _ := json.Marshal(u)
		var h gin.H
		_ = json.Unmarshal(raw, &h)
		delete(h, "password")
		h["orderCount"] = countMap[u.ID]
		list = append(list, h)
	}
	var totalUsers, outletCount, totalAddr int64
	db.DB.Model(&models.OutletUser{}).Count(&totalUsers)
	db.DB.Model(&models.OutletUser{}).Where("role = ?", "outlet").Count(&outletCount)
	db.DB.Model(&models.OutletAddress{}).Count(&totalAddr)
	resp.OK(c, gin.H{
		"list": list, "total": total, "page": page, "pageSize": ps,
		"stats": gin.H{"totalUsers": totalUsers, "outletCount": outletCount, "totalAddresses": totalAddr},
	})
}

func outletAdminUserDetail(c *gin.Context) {
	uid, _ := strconv.Atoi(c.Param("id"))
	var user models.OutletUser
	if err := db.DB.Preload("Addresses", func(db *gorm.DB) *gorm.DB {
		return db.Order("createdAt DESC")
	}).First(&user, uid).Error; err != nil {
		resp.Err(c, 404, 404, "用户不存在")
		return
	}
	var orders []models.OutletOrder
	db.DB.Where("userId = ?", uid).Order("createdAt DESC").Select("id", "orderNo", "status", "price", "createdAt").Find(&orders)
	type ordRow struct {
		ID        int       `json:"id"`
		OrderNo   string    `json:"orderNo"`
		Status    string    `json:"status"`
		StatusText string   `json:"statusText"`
		Price     float64   `json:"price"`
		CreatedAt time.Time `json:"createdAt"`
	}
	sm := map[string]string{"pending": "待支付", "paid": "已支付", "processing": "进行中", "completed": "已完成", "cancelled": "已取消"}
	out := make([]ordRow, 0, len(orders))
	for _, o := range orders {
		out = append(out, ordRow{o.ID, o.OrderNo, o.Status, sm[o.Status], o.Price, o.CreatedAt})
	}
	raw, _ := json.Marshal(user)
	var uh gin.H
	_ = json.Unmarshal(raw, &uh)
	delete(uh, "password")
	resp.OK(c, gin.H{"user": uh, "orders": out})
}
