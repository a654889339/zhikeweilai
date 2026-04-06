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

func assertChatGroupMember(groupID, userID int) bool {
	var n int64
	db.DB.Model(&models.ChatGroupMember{}).Where("groupId = ? AND userId = ?", groupID, userID).Count(&n)
	return n > 0
}

func chatGroupListMine(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var memberships []models.ChatGroupMember
	if err := db.DB.Where("userId = ?", u.ID).Preload("Group").Preload("Group.Creator").Find(&memberships).Error; err != nil {
		resp.Err(c, 500, 1, "加载失败")
		return
	}
	type sortPair struct {
		UpdatedAt time.Time
		Item      gin.H
	}
	var pairs []sortPair
	for _, m := range memberships {
		g := m.Group
		if g.ID == 0 {
			continue
		}
		pairs = append(pairs, sortPair{
			UpdatedAt: g.UpdatedAt,
			Item: gin.H{
				"id":        g.ID,
				"name":      g.Name,
				"creatorId": g.CreatorID,
				"createdAt": g.CreatedAt,
				"updatedAt": g.UpdatedAt,
				"creator":   g.Creator,
				"myRole":    m.Role,
			},
		})
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].UpdatedAt.After(pairs[j].UpdatedAt)
	})
	out := make([]gin.H, 0, len(pairs))
	for _, p := range pairs {
		out = append(out, p.Item)
	}
	resp.OK(c, out)
}

func chatGroupCreate(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		resp.Err(c, 400, 1, "请输入群组名称")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		resp.Err(c, 400, 1, "请输入群组名称")
		return
	}
	g := models.ChatGroup{Name: name, CreatorID: u.ID}
	if err := db.DB.Create(&g).Error; err != nil {
		resp.Err(c, 500, 1, "创建失败")
		return
	}
	mem := models.ChatGroupMember{GroupID: g.ID, UserID: u.ID, Role: "owner"}
	if err := db.DB.Create(&mem).Error; err != nil {
		resp.Err(c, 500, 1, "创建失败")
		return
	}
	var full models.ChatGroup
	db.DB.Preload("Creator").First(&full, g.ID)
	resp.OK(c, full)
}

func chatGroupJoin(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	gid, _ := strconv.Atoi(c.Param("id"))
	if gid <= 0 {
		resp.Err(c, 400, 1, "无效的群组")
		return
	}
	var g models.ChatGroup
	if err := db.DB.First(&g, gid).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			resp.Err(c, 404, 1, "群组不存在")
			return
		}
		resp.Err(c, 500, 1, "加入失败")
		return
	}
	var existing models.ChatGroupMember
	err := db.DB.Where("groupId = ? AND userId = ?", gid, u.ID).First(&existing).Error
	if err == nil {
		resp.OK(c, gin.H{"joined": true, "role": existing.Role, "created": false})
		return
	}
	if err != gorm.ErrRecordNotFound {
		resp.Err(c, 500, 1, "加入失败")
		return
	}
	existing = models.ChatGroupMember{GroupID: gid, UserID: u.ID, Role: "member"}
	if err := db.DB.Create(&existing).Error; err != nil {
		resp.Err(c, 500, 1, "加入失败")
		return
	}
	resp.OK(c, gin.H{"joined": true, "role": existing.Role, "created": true})
}

func chatGroupListMessages(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	gid, _ := strconv.Atoi(c.Param("id"))
	if gid <= 0 {
		resp.Err(c, 400, 1, "无效的群组")
		return
	}
	if !assertChatGroupMember(gid, u.ID) {
		resp.Err(c, 403, 1, "您不在该群组中")
		return
	}
	beforeID, _ := strconv.Atoi(c.Query("beforeId"))
	limit := 50
	if l, e := strconv.Atoi(c.Query("limit")); e == nil && l > 0 {
		if l > 100 {
			l = 100
		}
		limit = l
	}
	q := db.DB.Where("groupId = ?", gid).Preload("User").Order("id DESC").Limit(limit)
	if beforeID > 0 {
		q = q.Where("id < ?", beforeID)
	}
	var messages []models.GroupMessage
	if err := q.Find(&messages).Error; err != nil {
		resp.Err(c, 500, 1, "加载失败")
		return
	}
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	resp.OK(c, messages)
}

func chatGroupSendMessage(c *gin.Context) {
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	gid, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Content string `json:"content"`
		Type    string `json:"type"`
	}
	_ = c.ShouldBindJSON(&body)
	content := strings.TrimSpace(body.Content)
	if gid <= 0 || content == "" {
		resp.Err(c, 400, 1, "内容不能为空")
		return
	}
	if !assertChatGroupMember(gid, u.ID) {
		resp.Err(c, 403, 1, "您不在该群组中")
		return
	}
	t := "text"
	if body.Type == "image" {
		t = "image"
	}
	msg := models.GroupMessage{GroupID: gid, UserID: u.ID, Content: content, Type: t}
	if err := db.DB.Create(&msg).Error; err != nil {
		resp.Err(c, 500, 1, "发送失败")
		return
	}
	touchChatGroupUpdatedAt(gid)
	var withUser models.GroupMessage
	db.DB.Preload("User").First(&withUser, msg.ID)
	resp.OK(c, withUser)
}

func chatGroupUploadImage(c *gin.Context, cfg *config.Config) {
	_ = cfg
	u, ok := ctxUser(c)
	if !ok {
		return
	}
	gid, _ := strconv.Atoi(c.Param("id"))
	if gid <= 0 {
		resp.Err(c, 400, 1, "无效的群组")
		return
	}
	if !assertChatGroupMember(gid, u.ID) {
		resp.Err(c, 403, 1, "您不在该群组中")
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
	filename := "gchat_" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "_" + hex.EncodeToString(b) + ext
	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	url, err := services.UploadCOS(c.Request.Context(), buf, filename, ct)
	if err != nil {
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	msg := models.GroupMessage{GroupID: gid, UserID: u.ID, Content: url, Type: "image"}
	if err := db.DB.Create(&msg).Error; err != nil {
		resp.Err(c, 500, 1, "上传失败")
		return
	}
	touchChatGroupUpdatedAt(gid)
	var withUser models.GroupMessage
	db.DB.Preload("User").First(&withUser, msg.ID)
	resp.OK(c, withUser)
}

func touchChatGroupUpdatedAt(groupID int) {
	_ = db.DB.Model(&models.ChatGroup{}).Where("id = ?", groupID).Updates(map[string]interface{}{
		"updated_at": time.Now(),
	}).Error
}

func chatGroupAdminListAll(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("pageSize"))
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	var total int64
	db.DB.Model(&models.ChatGroup{}).Count(&total)
	var rows []models.ChatGroup
	db.DB.Preload("Creator").Preload("Members").Preload("Members.User").
		Order("createdAt DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&rows)
	list := make([]gin.H, 0, len(rows))
	for _, g := range rows {
		members := g.Members
		var owners, admins, normal []gin.H
		var allMembers []gin.H
		for _, m := range members {
			item := gin.H{"id": m.ID, "groupId": m.GroupID, "userId": m.UserID, "role": m.Role, "createdAt": m.CreatedAt, "user": m.User}
			allMembers = append(allMembers, item)
			switch m.Role {
			case "owner":
				owners = append(owners, item)
			case "admin":
				admins = append(admins, item)
			default:
				normal = append(normal, item)
			}
		}
		list = append(list, gin.H{
			"id":          g.ID,
			"name":        g.Name,
			"creator":     g.Creator,
			"createdAt":   g.CreatedAt,
			"memberCount": len(members),
			"owners":      owners,
			"admins":      admins,
			"members":     normal,
			"allMembers":  allMembers,
		})
	}
	resp.OK(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}
