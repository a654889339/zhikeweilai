package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"path"
	"sort"
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

func msgMy(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var list []models.Message
	db.DB.Where("userId = ?", u.ID).Order("createdAt ASC").Find(&list)
	db.DB.Model(&models.Message{}).Where("userId = ? AND sender = ? AND `read` = ?", u.ID, "admin", false).Update("read", true)
	resp.OK(c, list)
}

func msgSend(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		Content string `json:"content"`
		Type    string `json:"type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Content) == "" {
		resp.Err(c, 400, 1, "消息不能为空")
		return
	}
	t := "text"
	if body.Type == "image" {
		t = "image"
	}
	m := models.Message{UserID: u.ID, Sender: "user", Content: strings.TrimSpace(body.Content), Type: t}
	db.DB.Create(&m)
	resp.OK(c, m)
}

func msgUploadImage(c *gin.Context, cfg *config.Config) {
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
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	defer f.Close()
	buf, err := io.ReadAll(f)
	if err != nil {
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	ext := path.Ext(fh.Filename)
	if ext == "" {
		ext = ".png"
	}
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	filename := "chat_" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "_" + hex.EncodeToString(b) + ext
	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	url, err := services.UploadCOS(c.Request.Context(), buf, filename, ct)
	if err != nil {
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	_ = u
	resp.OK(c, gin.H{"url": url})
}

func msgUnread(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var n int64
	db.DB.Model(&models.Message{}).Where("userId = ? AND sender = ? AND `read` = ?", u.ID, "admin", false).Count(&n)
	resp.OK(c, n)
}

func msgAdminConversations(c *gin.Context) {
	var users []models.User
	db.DB.Preload("Messages", func(db *gorm.DB) *gorm.DB {
		return db.Order("createdAt DESC").Limit(1)
	}).Find(&users)
	type conv struct {
		userID                                          int
		username, nickname, avatar, lastMessage       string
		lastTime                                        time.Time
		lastSender, lastType                          string
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
		list = append(list, conv{
			userID: u.ID, username: u.Username, nickname: nick, avatar: u.Avatar,
			lastMessage: last.Content, lastTime: last.CreatedAt, lastSender: last.Sender, lastType: last.Type,
		})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].lastTime.After(list[j].lastTime) })
	type row struct {
		UserID int `gorm:"column:userId"`
		Cnt    int `gorm:"column:cnt"`
	}
	var rows []row
	db.DB.Model(&models.Message{}).Select("userId, COUNT(id) as cnt").Where("sender = ? AND `read` = ?", "user", false).Group("userId").Scan(&rows)
	unread := map[int]int{}
	for _, r := range rows {
		unread[r.UserID] = r.Cnt
	}
	out := make([]gin.H, 0, len(list))
	for _, it := range list {
		out = append(out, gin.H{
			"userId": it.userID, "username": it.username, "nickname": it.nickname, "avatar": it.avatar,
			"lastMessage": it.lastMessage, "lastTime": it.lastTime, "lastSender": it.lastSender, "lastType": it.lastType,
			"unread": unread[it.userID],
		})
	}
	resp.OK(c, out)
}

func msgAdminGet(c *gin.Context) {
	userID, _ := strconv.Atoi(c.Param("userId"))
	var list []models.Message
	db.DB.Where("userId = ?", userID).Order("createdAt ASC").Find(&list)
	db.DB.Model(&models.Message{}).Where("userId = ? AND sender = ? AND `read` = ?", userID, "user", false).Update("read", true)
	resp.OK(c, list)
}

func msgAdminReply(c *gin.Context) {
	userID, _ := strconv.Atoi(c.Param("userId"))
	var body struct {
		Content string `json:"content"`
		Type    string `json:"type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Content) == "" {
		resp.Err(c, 400, 1, "消息不能为空")
		return
	}
	t := "text"
	if body.Type == "image" {
		t = "image"
	}
	m := models.Message{UserID: userID, Sender: "admin", Content: strings.TrimSpace(body.Content), Type: t}
	db.DB.Create(&m)
	resp.OK(c, m)
}
