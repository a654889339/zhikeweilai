package handlers

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"zhikeweilai/backend/internal/bootstrap"
	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/resp"
	"zhikeweilai/backend/internal/services"

	"github.com/gin-gonic/gin"
)

type cartLineIn struct {
	GuideID int `json:"guideId"`
	Qty     int `json:"qty"`
}

type cartLineOut struct {
	GuideID     int     `json:"guideId"`
	Qty         int     `json:"qty"`
	Name        string  `json:"name"`
	ListPrice   float64 `json:"listPrice"`
	RewardPoints int    `json:"rewardPoints"`
	LineTotal   float64 `json:"lineTotal"`
}

type cartSnapshotItem struct {
	GuideID      int     `json:"guideId"`
	Name         string  `json:"name"`
	Qty          int     `json:"qty"`
	UnitPrice    float64 `json:"unitPrice"`
	LineTotal    float64 `json:"lineTotal"`
	RewardPoints int     `json:"rewardPoints"`
	LinePoints   int     `json:"linePoints"`
}

func parseUserCartJSON(raw *string) []cartLineIn {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil
	}
	var items []cartLineIn
	if err := json.Unmarshal([]byte(*raw), &items); err != nil {
		return nil
	}
	out := make([]cartLineIn, 0, len(items))
	for _, it := range items {
		if it.GuideID <= 0 || it.Qty <= 0 {
			continue
		}
		if it.Qty > 9999 {
			it.Qty = 9999
		}
		out = append(out, it)
	}
	return out
}

func mergeCartLines(items []cartLineIn) []cartLineIn {
	byID := map[int]int{}
	for _, it := range items {
		byID[it.GuideID] += it.Qty
	}
	out := make([]cartLineIn, 0, len(byID))
	for gid, q := range byID {
		if q > 9999 {
			q = 9999
		}
		out = append(out, cartLineIn{GuideID: gid, Qty: q})
	}
	return out
}

func ensureUsersCartJSONColumn() error {
	var n int64
	if err := db.DB.Raw(`
		SELECT COUNT(*) FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'cartJson'
	`).Scan(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	// LONGTEXT 兼容所有 MySQL 版本，避免部分环境下 JSON 类型与 GORM 更新不兼容
	if err := db.DB.Exec("ALTER TABLE `users` ADD COLUMN `cartJson` LONGTEXT NULL").Error; err != nil {
		return err
	}
	return nil
}

func saveUserCartJSON(userID int, jsonStr string) error {
	err := db.DB.Exec("UPDATE `users` SET `cartJson` = ? WHERE `id` = ?", jsonStr, userID).Error
	if err == nil {
		return nil
	}
	if err := ensureUsersCartJSONColumn(); err != nil {
		return err
	}
	return db.DB.Exec("UPDATE `users` SET `cartJson` = ? WHERE `id` = ?", jsonStr, userID).Error
}

// authGetCart GET /auth/cart
func authGetCart(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var user models.User
	if err := db.DB.First(&user, u.ID).Error; err != nil {
		resp.Err(c, 404, 404, "用户不存在")
		return
	}
	lines, totalPrice, totalPoints := resolveCartLines(user.CartJSON)
	resp.OK(c, gin.H{
		"items":       lines,
		"totalPrice":  totalPrice,
		"totalPoints": totalPoints,
	})
}

func resolveCartLines(cartRaw *string) (lines []cartLineOut, totalPrice float64, totalPoints int) {
	items := parseUserCartJSON(cartRaw)
	if len(items) == 0 {
		return nil, 0, 0
	}
	lines = make([]cartLineOut, 0, len(items))
	for _, it := range items {
		var g models.DeviceGuide
		if err := db.DB.First(&g, it.GuideID).Error; err != nil || g.Status != "active" {
			continue
		}
		unit := g.ListPrice
		if unit < 0 {
			unit = 0
		}
		rp := guidePointsForOrder(&g)
		lineTot := unit * float64(it.Qty)
		lines = append(lines, cartLineOut{
			GuideID:      it.GuideID,
			Qty:          it.Qty,
			Name:         g.Name,
			ListPrice:    unit,
			RewardPoints: rp,
			LineTotal:    lineTot,
		})
		totalPrice += lineTot
		totalPoints += rp * it.Qty
	}
	return lines, totalPrice, totalPoints
}

// authPutCart PUT /auth/cart  body: { items: [{ guideId, qty }] }
func authPutCart(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		Items []cartLineIn `json:"items"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	merged := mergeCartLines(body.Items)
	b, err := json.Marshal(merged)
	if err != nil {
		resp.Err(c, 500, 500, "保存失败")
		return
	}
	s := string(b)
	if err := saveUserCartJSON(u.ID, s); err != nil {
		resp.Err(c, 500, 500, "保存失败")
		return
	}
	var user models.User
	_ = db.DB.First(&user, u.ID)
	lines, totalPrice, totalPoints := resolveCartLines(user.CartJSON)
	resp.OK(c, gin.H{
		"items":       lines,
		"totalPrice":  totalPrice,
		"totalPoints": totalPoints,
	})
}

// orderCartCheckout POST /orders/cart-checkout
func orderCartCheckout(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		ContactName     string  `json:"contactName"`
		ContactPhone    string  `json:"contactPhone"`
		Address         string  `json:"address"`
		Remark          string  `json:"remark"`
		AppointmentTime *string `json:"appointmentTime"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 400, "参数错误")
		return
	}
	if strings.TrimSpace(body.ContactName) == "" || strings.TrimSpace(body.ContactPhone) == "" {
		resp.Err(c, 400, 400, "请填写联系人和电话")
		return
	}
	phoneKey := services.NormalizePhone(body.ContactPhone)
	if !services.ValidChinaMobile(phoneKey) {
		resp.Err(c, 400, 400, "请输入正确的11位大陆手机号")
		return
	}
	var user models.User
	if err := db.DB.First(&user, u.ID).Error; err != nil {
		resp.Err(c, 404, 404, "用户不存在")
		return
	}
	items := parseUserCartJSON(user.CartJSON)
	if len(items) == 0 {
		resp.Err(c, 400, 400, "购物车为空")
		return
	}
	var snap []cartSnapshotItem
	var totalPrice float64
	var totalPoints int
	for _, it := range items {
		var g models.DeviceGuide
		if err := db.DB.First(&g, it.GuideID).Error; err != nil || g.Status != "active" {
			continue
		}
		unit := g.ListPrice
		if unit < 0 {
			unit = 0
		}
		rp := guidePointsForOrder(&g)
		lineTot := unit * float64(it.Qty)
		snap = append(snap, cartSnapshotItem{
			GuideID:      g.ID,
			Name:         g.Name,
			Qty:          it.Qty,
			UnitPrice:    unit,
			LineTotal:    lineTot,
			RewardPoints: rp,
			LinePoints:   rp * it.Qty,
		})
		totalPrice += lineTot
		totalPoints += rp * it.Qty
	}
	if len(snap) == 0 {
		resp.Err(c, 400, 400, "购物车中没有可结算的商品")
		return
	}
	snapBytes, _ := json.Marshal(snap)
	snapStr := string(snapBytes)
	title := "购物车订单"
	if len(snap) == 1 {
		title = snap[0].Name
	}
	var appt *time.Time
	if body.AppointmentTime != nil && *body.AppointmentTime != "" {
		t, err := time.Parse(time.RFC3339, *body.AppointmentTime)
		if err == nil {
			appt = &t
		}
	}
	o := models.Order{
		OrderNo:         genOrderNo(),
		UserID:          u.ID,
		ServiceID:       nil,
		ServiceTitle:    title,
		ServiceTitleEn:  "Cart order",
		ServiceIcon:     "shopping-cart-o",
		Price:           totalPrice,
		ContactName:     strings.TrimSpace(body.ContactName),
		ContactPhone:    phoneKey,
		Address:         strings.TrimSpace(body.Address),
		Remark:          strings.TrimSpace(body.Remark),
		AppointmentTime: appt,
		GuideID:         nil,
		CartItems:       &snapStr,
		Points:          totalPoints,
		Status:          "pending",
	}
	if err := bootstrap.EnsureShopCartCommerceColumns(); err != nil {
		log.Printf("[zkwl] orderCartCheckout EnsureShopCartCommerceColumns: %v", err)
	}
	if err := db.DB.Create(&o).Error; err != nil {
		log.Printf("[zkwl] orderCartCheckout Create: %v", err)
		resp.Err(c, 500, 500, "创建订单失败")
		return
	}
	_ = saveUserCartJSON(u.ID, "[]")
	resp.OK(c, o)
}
