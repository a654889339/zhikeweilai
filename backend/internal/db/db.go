package db

import (
	"fmt"

	"zhikeweilai/backend/internal/config"
	"zhikeweilai/backend/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(cfg *config.Config) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DB.User, cfg.DB.Password, cfg.DB.Host, cfg.DB.Port, cfg.DB.Name)
	var err error
	logLevel := logger.Silent
	if cfg.NodeEnv == "development" {
		logLevel = logger.Info
	}
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return err
	}
	return nil
}

func AutoMigrate() error {
	// 课程分类表须在课程条目之前
	if err := DB.AutoMigrate(&models.CourseCenterCategory{}); err != nil {
		return err
	}
	// 课程中心表优先迁移：主列表中若后续某表因历史结构不一致失败，GORM 会提前返回，导致该表从未创建（曾出现 1146 course_center_items 不存在）
	if err := DB.AutoMigrate(&models.CourseCenterItem{}); err != nil {
		return err
	}
	// device_guides.manualPdfUrl 等列若主迁移失败则不会创建（曾出现 1054 unknown column manualPdfUrl）
	if err := DB.AutoMigrate(&models.DeviceGuide{}); err != nil {
		return err
	}
	return DB.AutoMigrate(
		&models.User{},
		&models.OutletUser{},
		&models.Order{},
		&models.OrderLog{},
		&models.OutletOrder{},
		&models.OutletOrderLog{},
		&models.ServiceCategory{},
		&models.Service{},
		&models.ProductCategory{},
		&models.HomeConfig{},
		&models.DeviceGuide{},
		&models.Address{},
		&models.OutletAddress{},
		&models.Message{},
		&models.OutletMessage{},
		&models.InventoryCategory{},
		&models.InventoryProduct{},
		&models.UserProduct{},
		&models.OutletServiceCategory{},
		&models.OutletService{},
		&models.OutletHomeConfig{},
		&models.PageVisitDaily{},
		&models.I18nText{},
		&models.CourseCenterCategory{},
		&models.CourseCenterItem{},
		&models.ChatGroup{},
		&models.ChatGroupMember{},
		&models.GroupMessage{},
	)
}
