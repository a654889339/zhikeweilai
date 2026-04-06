package models

import (
	"time"

	"gorm.io/datatypes"
)

// CourseCenterItem 课程中心条目（后台配置，结构类似商品指南的精简版）
type CourseCenterItem struct {
	ID          int            `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"size:200;not null" json:"name"`
	Subtitle    string         `gorm:"size:300" json:"subtitle"`
	Slug        string         `gorm:"size:120;uniqueIndex" json:"slug"`
	Icon        string         `gorm:"size:100" json:"icon"`
	CoverImage  string         `gorm:"column:coverImage;size:500" json:"coverImage"`
	Videos      datatypes.JSON `gorm:"type:longtext;column:videos" json:"-"` // []string URL，JSON 存储
	Description string         `gorm:"type:text" json:"description"`
	SortOrder   int            `gorm:"column:sortOrder" json:"sortOrder"`
	Status      string         `gorm:"type:enum('active','inactive');default:active" json:"status"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

func (CourseCenterItem) TableName() string { return "course_center_items" }
