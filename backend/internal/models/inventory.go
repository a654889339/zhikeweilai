package models

import "time"

type InventoryCategory struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	SortOrder int       `gorm:"column:sortOrder" json:"sortOrder"`
	Status    string    `gorm:"type:enum('active','inactive');default:active" json:"status"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (InventoryCategory) TableName() string { return "inventory_categories" }

type InventoryProduct struct {
	ID                int       `gorm:"primaryKey" json:"id"`
	ProductCategoryID int       `gorm:"column:productCategoryId;not null;default:0;index" json:"productCategoryId"` // 商品配置中的二级种类 ID
	// 旧「库存种类」列，历史表多为 NOT NULL；新逻辑固定写 0，业务以 ProductCategoryID 为准
	InventoryCategoryIDLegacy int `gorm:"column:categoryId;not null;default:0" json:"-"`
	Name              string    `gorm:"size:200;not null" json:"name"`
	SerialNumber      string    `gorm:"column:serialNumber;size:100;not null;uniqueIndex:serialNumber" json:"serialNumber"`
	GuideSlug         string    `gorm:"column:guideSlug;size:200" json:"guideSlug"`
	SortOrder         int       `gorm:"column:sortOrder" json:"sortOrder"`
	Status            string    `gorm:"type:enum('active','inactive');default:active" json:"status"`
	Tags              string    `gorm:"size:200" json:"tags"`
	CreatedAt         time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt         time.Time `gorm:"column:updatedAt" json:"updatedAt"`
	ProductCategory   *ProductCategory `gorm:"foreignKey:ProductCategoryID" json:"productCategory,omitempty"`
}

func (InventoryProduct) TableName() string { return "inventory_products" }

type UserProduct struct {
	ID         int       `gorm:"primaryKey" json:"id"`
	UserID     int       `gorm:"column:userId;not null;index" json:"userId"`
	ProductKey string    `gorm:"column:productKey;size:100;not null;uniqueIndex:productKey" json:"productKey"`
	CreatedAt  time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (UserProduct) TableName() string { return "user_products" }
