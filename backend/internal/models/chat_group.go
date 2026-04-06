package models

import "time"

type ChatGroup struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:120;not null" json:"name"`
	CreatorID int       `gorm:"column:creatorId;not null" json:"creatorId"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	Creator *User             `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
	Members []ChatGroupMember `gorm:"foreignKey:GroupID" json:"members,omitempty"`
}

func (ChatGroup) TableName() string { return "chat_groups" }

type ChatGroupMember struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	GroupID   int       `gorm:"column:groupId;not null;uniqueIndex:uniq_group_user,priority:1" json:"groupId"`
	UserID    int       `gorm:"column:userId;not null;uniqueIndex:uniq_group_user,priority:2" json:"userId"`
	Role      string    `gorm:"type:enum('owner','admin','member');default:member;not null" json:"role"`
	CreatedAt time.Time `json:"createdAt"`

	User  *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Group ChatGroup `gorm:"foreignKey:GroupID" json:"-"`
}

func (ChatGroupMember) TableName() string { return "chat_group_members" }

type GroupMessage struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	GroupID   int       `gorm:"column:groupId;not null" json:"groupId"`
	UserID    int       `gorm:"column:userId;not null" json:"userId"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	Type      string    `gorm:"size:16;default:text" json:"type"`
	CreatedAt time.Time `json:"createdAt"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (GroupMessage) TableName() string { return "group_messages" }
