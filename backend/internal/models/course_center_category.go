package models

import "time"

// CourseCenterCategory 课程中心两级分类（与商品种类结构一致：一级无父，二级必选一级父类）
type CourseCenterCategory struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	Level       int       `gorm:"column:level;not null;default:1" json:"level"`
	ParentID    *int      `gorm:"column:parentId;index" json:"parentId"`
	EnKey       string    `gorm:"column:enKey;size:100;not null" json:"key"` // 英文标识
	Title       string    `gorm:"size:200;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	SortOrder   int       `gorm:"column:sortOrder" json:"sortOrder"`
	Status      string    `gorm:"type:enum('active','inactive');default:active" json:"status"`
	CreatedAt   time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt" json:"updatedAt"`
	Parent      *CourseCenterCategory  `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children    []CourseCenterCategory `gorm:"foreignKey:ParentID" json:"children,omitempty"`
}

func (CourseCenterCategory) TableName() string { return "course_center_categories" }
