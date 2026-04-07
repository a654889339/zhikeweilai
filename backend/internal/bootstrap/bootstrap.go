package bootstrap

import (
	"crypto/rand"
	"encoding/hex"
	"log"

	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/models"
	"zhikeweilai/backend/internal/services"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const adminPassword = "Vino@2024admin"

// Run 启动时：确保默认管理员存在（与 Node syncDatabase 一致）
func Run() error {
	var n int64
	if err := db.DB.Model(&models.User{}).Where("username = ?", "admin").Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		hash, err := services.HashPassword(adminPassword)
		if err != nil {
			return err
		}
		email := "admin@vino.service"
		u := models.User{
			Username: "admin",
			Email:    &email,
			Password: hash,
			Nickname: "管理员",
			Role:     "admin",
			Status:   "active",
		}
		if err := db.DB.Create(&u).Error; err != nil {
			return err
		}
		log.Println("[DB] Default admin account created.")
	}

	// 若 i18n 为空，插入少量关键键（完整种子见原 Node 或数据库已有数据）
	var i18nCount int64
	_ = db.DB.Model(&models.I18nText{}).Count(&i18nCount).Error
	if i18nCount == 0 {
		rows := []models.I18nText{
			{Key: "tabbar.home", Zh: "首页", En: "Home"},
			{Key: "tabbar.mine", Zh: "我的", En: "Mine"},
		}
		_ = db.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
		log.Println("[DB] Minimal i18n seed applied (full set may exist from previous Node deploy).")
	}

	if err := ensureHomeConfigI18nColumns(); err != nil {
		log.Printf("[zkwl] ensureHomeConfigI18nColumns: %v", err)
	}
	if err := ensureDeviceGuideManualPdfUrlColumn(); err != nil {
		log.Printf("[zkwl] ensureDeviceGuideManualPdfUrlColumn: %v", err)
	}
	if err := ensureDeviceGuideI18nColumns(); err != nil {
		log.Printf("[zkwl] ensureDeviceGuideI18nColumns: %v", err)
	}
	if err := ensureProductCategoryI18nColumns(); err != nil {
		log.Printf("[zkwl] ensureProductCategoryI18nColumns: %v", err)
	}
	if err := ensureCourseCenterItemCourseCategoryIdColumn(); err != nil {
		log.Printf("[zkwl] ensureCourseCenterItemCourseCategoryIdColumn: %v", err)
	}
	if err := ensureCourseCenterValidTimestamps(); err != nil {
		log.Printf("[zkwl] ensureCourseCenterValidTimestamps: %v", err)
	}
	if err := ensureShopCartCommerceColumns(); err != nil {
		log.Printf("[zkwl] ensureShopCartCommerceColumns: %v", err)
	}

	return seedDefaultsIfEmpty()
}

func ensureShopCartCommerceColumns() error {
	type colDDL struct {
		table, column, ddl string
	}
	for _, c := range []colDDL{
		{"device_guides", "listPrice", "ALTER TABLE `device_guides` ADD COLUMN `listPrice` DECIMAL(10,2) NOT NULL DEFAULT 0"},
		{"device_guides", "rewardPoints", "ALTER TABLE `device_guides` ADD COLUMN `rewardPoints` INT NOT NULL DEFAULT 0"},
		{"users", "cartJson", "ALTER TABLE `users` ADD COLUMN `cartJson` LONGTEXT NULL"},
		{"orders", "cartItems", "ALTER TABLE `orders` ADD COLUMN `cartItems` JSON NULL"},
	} {
		var n int64
		if err := db.DB.Raw(`
			SELECT COUNT(*) FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
		`, c.table, c.column).Scan(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		if err := db.DB.Exec(c.ddl).Error; err != nil {
			return err
		}
		log.Printf("[zkwl] ensureShopCartCommerceColumns: added %s.%s", c.table, c.column)
	}
	return nil
}

func ensureDeviceGuideManualPdfUrlColumn() error {
	var n int64
	if err := db.DB.Raw(`
		SELECT COUNT(*) FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_guides' AND COLUMN_NAME = 'manualPdfUrl'
	`).Scan(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	return db.DB.Exec("ALTER TABLE `device_guides` ADD COLUMN `manualPdfUrl` VARCHAR(500) NOT NULL DEFAULT ''").Error
}

// ensureDeviceGuideI18nColumns 旧库 device_guides 可能无英文等列，GORM Save 会报 Unknown column 'name_en'。
func ensureDeviceGuideI18nColumns() error {
	type colDDL struct {
		name string
		ddl  string
	}
	steps := []colDDL{
		{"name_en", "ALTER TABLE `device_guides` ADD COLUMN `name_en` VARCHAR(100) NOT NULL DEFAULT ''"},
		{"subtitle_en", "ALTER TABLE `device_guides` ADD COLUMN `subtitle_en` VARCHAR(200) NOT NULL DEFAULT ''"},
		{"badge_en", "ALTER TABLE `device_guides` ADD COLUMN `badge_en` VARCHAR(20) NOT NULL DEFAULT ''"},
		{"description_en", "ALTER TABLE `device_guides` ADD COLUMN `description_en` TEXT"},
		{"iconUrlEn", "ALTER TABLE `device_guides` ADD COLUMN `iconUrlEn` VARCHAR(500) NOT NULL DEFAULT ''"},
		{"iconUrlThumbEn", "ALTER TABLE `device_guides` ADD COLUMN `iconUrlThumbEn` VARCHAR(500) NOT NULL DEFAULT ''"},
		{"coverImageEn", "ALTER TABLE `device_guides` ADD COLUMN `coverImageEn` VARCHAR(500) NOT NULL DEFAULT ''"},
		{"coverImageThumbEn", "ALTER TABLE `device_guides` ADD COLUMN `coverImageThumbEn` VARCHAR(500) NOT NULL DEFAULT ''"},
		{"emoji_en", "ALTER TABLE `device_guides` ADD COLUMN `emoji_en` VARCHAR(20) NOT NULL DEFAULT ''"},
		{"gradient_en", "ALTER TABLE `device_guides` ADD COLUMN `gradient_en` VARCHAR(300) NOT NULL DEFAULT ''"},
	}
	added := 0
	for _, step := range steps {
		var n int64
		if err := db.DB.Raw(`
			SELECT COUNT(*) FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_guides' AND COLUMN_NAME = ?
		`, step.name).Scan(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		if err := db.DB.Exec(step.ddl).Error; err != nil {
			log.Printf("[zkwl] ensureDeviceGuideI18nColumns ADD %s: %v", step.name, err)
			continue
		}
		added++
	}
	if added > 0 {
		log.Printf("[zkwl] ensureDeviceGuideI18nColumns: added %d column(s)", added)
	}
	return nil
}

// ensureProductCategoryI18nColumns 旧库 product_categories 可能无 name_en / thumbnailUrlEn。
func ensureProductCategoryI18nColumns() error {
	type colDDL struct {
		name string
		ddl  string
	}
	steps := []colDDL{
		{"name_en", "ALTER TABLE `product_categories` ADD COLUMN `name_en` VARCHAR(100) NOT NULL DEFAULT ''"},
		{"thumbnailUrlEn", "ALTER TABLE `product_categories` ADD COLUMN `thumbnailUrlEn` VARCHAR(1024) NULL"},
	}
	added := 0
	for _, step := range steps {
		var n int64
		if err := db.DB.Raw(`
			SELECT COUNT(*) FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_categories' AND COLUMN_NAME = ?
		`, step.name).Scan(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		if err := db.DB.Exec(step.ddl).Error; err != nil {
			log.Printf("[zkwl] ensureProductCategoryI18nColumns ADD %s: %v", step.name, err)
			continue
		}
		added++
	}
	if added > 0 {
		log.Printf("[zkwl] ensureProductCategoryI18nColumns: added %d column(s)", added)
	}
	return nil
}

func ensureCourseCenterItemCourseCategoryIdColumn() error {
	var n int64
	if err := db.DB.Raw(`
		SELECT COUNT(*) FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_center_items' AND COLUMN_NAME = 'courseCategoryId'
	`).Scan(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	return db.DB.Exec("ALTER TABLE `course_center_items` ADD COLUMN `courseCategoryId` INT NOT NULL DEFAULT 0").Error
}

// ensureCourseCenterValidTimestamps 将 0000-00-00 等无效时间修正为当前时间，避免 GORM 读入后写回触发 1292。
func ensureCourseCenterValidTimestamps() error {
	for _, tbl := range []string{"course_center_items", "course_center_categories"} {
		if err := db.DB.Exec(
			"UPDATE `" + tbl + "` SET `createdAt` = CURRENT_TIMESTAMP(3) WHERE `createdAt` IS NULL OR `createdAt` < '1971-01-02'",
		).Error; err != nil {
			log.Printf("[zkwl] ensureCourseCenterValidTimestamps createdAt %s: %v", tbl, err)
		}
		if err := db.DB.Exec(
			"UPDATE `" + tbl + "` SET `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `updatedAt` IS NULL OR `updatedAt` < '1971-01-02'",
		).Error; err != nil {
			log.Printf("[zkwl] ensureCourseCenterValidTimestamps updatedAt %s: %v", tbl, err)
		}
	}
	return nil
}

// ensureHomeConfigI18nColumns 旧库 home_configs 可能无英文列，GORM Save 会报 Unknown column 'titleEn'。
func ensureHomeConfigI18nColumns() error {
	type colDDL struct {
		name string
		ddl  string
	}
	// 列名与 models.HomeConfig 的 gorm column 一致
	steps := []colDDL{
		{"titleEn", "ALTER TABLE `home_configs` ADD COLUMN `titleEn` VARCHAR(100) NOT NULL DEFAULT ''"},
		{"descEn", "ALTER TABLE `home_configs` ADD COLUMN `descEn` VARCHAR(200) NOT NULL DEFAULT ''"},
		{"iconEn", "ALTER TABLE `home_configs` ADD COLUMN `iconEn` VARCHAR(100) NOT NULL DEFAULT ''"},
		{"imageUrlEn", "ALTER TABLE `home_configs` ADD COLUMN `imageUrlEn` VARCHAR(500) NOT NULL DEFAULT ''"},
		{"imageUrlThumbEn", "ALTER TABLE `home_configs` ADD COLUMN `imageUrlThumbEn` VARCHAR(500) NOT NULL DEFAULT ''"},
	}
	added := 0
	for _, step := range steps {
		var n int64
		if err := db.DB.Raw(`
			SELECT COUNT(*) FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'home_configs' AND COLUMN_NAME = ?
		`, step.name).Scan(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		if err := db.DB.Exec(step.ddl).Error; err != nil {
			log.Printf("[zkwl] ensureHomeConfigI18nColumns ADD %s: %v", step.name, err)
			continue
		}
		added++
	}
	if added > 0 {
		log.Printf("[zkwl] ensureHomeConfigI18nColumns: added %d column(s)", added)
	}
	return nil
}

func migrateLegacyProductCategoryHierarchy() error {
	_ = db.DB.Exec("UPDATE product_categories SET level = 1 WHERE level IS NULL OR level = 0").Error
	var guides []models.DeviceGuide
	if err := db.DB.Where("categoryId IS NOT NULL").Find(&guides).Error; err != nil {
		return err
	}
	for _, g := range guides {
		if g.CategoryID == nil {
			continue
		}
		var pc models.ProductCategory
		if err := db.DB.First(&pc, *g.CategoryID).Error; err != nil {
			continue
		}
		if pc.Level == 2 {
			continue
		}
		var l2s []models.ProductCategory
		db.DB.Where("parentId = ? AND level = ?", pc.ID, 2).Order("sortOrder ASC, id ASC").Find(&l2s)
		var targetID int
		if len(l2s) > 0 {
			targetID = l2s[0].ID
		} else {
			pid := pc.ID
			child := models.ProductCategory{
				Name:      pc.Name,
				Level:     2,
				ParentID:  &pid,
				SortOrder: pc.SortOrder,
				Status:    pc.Status,
				Points:    pc.Points,
			}
			if err := db.DB.Create(&child).Error; err != nil {
				continue
			}
			targetID = child.ID
		}
		_ = db.DB.Model(&models.DeviceGuide{}).Where("id = ?", g.ID).UpdateColumn("categoryId", targetID).Error
	}
	return nil
}

// ensureL2UnderEveryL1 为每个一级分类补一条默认二级，避免前端侧栏用一级 ID 请求 /guides 而指南已全部挂在二级下导致空白。
func ensureL2UnderEveryL1() error {
	var l1s []models.ProductCategory
	if err := db.DB.Where("level = ? AND status = ?", 1, "active").Order("sortOrder ASC, id ASC").Find(&l1s).Error; err != nil {
		return err
	}
	created := 0
	for _, p := range l1s {
		var n int64
		if err := db.DB.Model(&models.ProductCategory{}).Where("parentId = ? AND level = ?", p.ID, 2).Count(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		pid := p.ID
		child := models.ProductCategory{
			Name:      p.Name + "·系列",
			Level:     2,
			ParentID:  &pid,
			SortOrder: 0,
			Status:    "active",
			Points:    p.Points,
		}
		if err := db.DB.Create(&child).Error; err != nil {
			log.Printf("[zkwl] ensureL2UnderEveryL1 L1 id=%d: %v", p.ID, err)
			continue
		}
		created++
	}
	if created > 0 {
		log.Printf("[zkwl] ensureL2UnderEveryL1: created %d default L2 row(s)", created)
	}
	return nil
}

// promoteGuidesStillOnL1 在补全二级后，把仍指向一级的指南改到该一级下第一个二级（与前端 /guides?categoryId=二级 一致）。
func promoteGuidesStillOnL1() error {
	var guides []models.DeviceGuide
	if err := db.DB.Where("categoryId IS NOT NULL").Find(&guides).Error; err != nil {
		return err
	}
	fixed := 0
	for _, g := range guides {
		if g.CategoryID == nil {
			continue
		}
		var pc models.ProductCategory
		if err := db.DB.First(&pc, *g.CategoryID).Error; err != nil {
			continue
		}
		if pc.Level == 2 {
			continue
		}
		var l2s []models.ProductCategory
		db.DB.Where("parentId = ? AND level = ?", pc.ID, 2).Order("sortOrder ASC, id ASC").Find(&l2s)
		if len(l2s) == 0 {
			continue
		}
		tid := l2s[0].ID
		if err := db.DB.Model(&models.DeviceGuide{}).Where("id = ?", g.ID).UpdateColumn("categoryId", tid).Error; err != nil {
			log.Printf("[zkwl] promoteGuidesStillOnL1 guide id=%d: %v", g.ID, err)
			continue
		}
		fixed++
	}
	if fixed > 0 {
		log.Printf("[zkwl] promoteGuidesStillOnL1: moved %d guide(s) from L1 to L2", fixed)
	}
	return nil
}

// normalizeMislabeledProductCategories 将「已有 parentId 却仍标为一级」的行纠正为二级（后台误操作数据）。
func normalizeMislabeledProductCategories() error {
	res := db.DB.Exec("UPDATE product_categories SET `level` = 2 WHERE `parentId` IS NOT NULL AND `parentId` > 0 AND `level` = 1")
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		log.Printf("[zkwl] normalizeMislabeledProductCategories: fixed %d row(s)", res.RowsAffected)
	}
	return nil
}

func ensureInventoryProductCategoryIDColumn() error {
	var n int64
	if err := db.DB.Raw(`
		SELECT COUNT(*) FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_products' AND COLUMN_NAME = 'productCategoryId'
	`).Scan(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	if err := db.DB.Exec("ALTER TABLE inventory_products ADD COLUMN `productCategoryId` INT NOT NULL DEFAULT 0").Error; err != nil {
		return err
	}
	log.Println("[zkwl] ensureInventoryProductCategoryIDColumn: added column productCategoryId")
	return nil
}

func fixInventoryProductCategoryPlaceholders() error {
	if err := ensureInventoryProductCategoryIDColumn(); err != nil {
		return err
	}
	var nBad int64
	if err := db.DB.Model(&models.InventoryProduct{}).Where("productCategoryId = ?", 0).Count(&nBad).Error; err != nil {
		return err
	}
	if nBad == 0 {
		return nil
	}
	var l2 []models.ProductCategory
	if err := db.DB.Where("level = ? AND status = ?", 2, "active").Order("id ASC").Find(&l2).Error; err != nil {
		return err
	}
	if len(l2) == 0 {
		return nil
	}
	var rows []models.InventoryProduct
	if err := db.DB.Where("productCategoryId = ?", 0).Find(&rows).Error; err != nil {
		return err
	}
	for i := range rows {
		pid := l2[i%len(l2)].ID
		if err := db.DB.Model(&models.InventoryProduct{}).Where("id = ?", rows[i].ID).UpdateColumn("productCategoryId", pid).Error; err != nil {
			log.Printf("[zkwl] fixInventoryProductCategoryPlaceholders id=%d: %v", rows[i].ID, err)
		}
	}
	log.Printf("[zkwl] fixInventoryProductCategoryPlaceholders: reassigned %d row(s)", len(rows))
	return nil
}

func randInventorySerial() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "ZKWL-" + hex.EncodeToString(b)
}

func seedInventorySamplesIfSparse() error {
	var invCount int64
	if err := db.DB.Model(&models.InventoryProduct{}).Count(&invCount).Error; err != nil {
		return err
	}
	const target = 18
	if invCount >= target {
		return nil
	}
	var l2 []models.ProductCategory
	if err := db.DB.Where("level = ? AND status = ?", 2, "active").Order("sortOrder ASC, id ASC").Find(&l2).Error; err != nil {
		return err
	}
	if len(l2) == 0 {
		return nil
	}
	names := []string{
		"演示样机 α", "演示样机 β", "渠道展示机 01", "渠道展示机 02", "备机 A", "备机 B",
		"周转机 #1", "周转机 #2", "测试机 T1", "测试机 T2", "展厅样机 S1", "展厅样机 S2",
		"库存单元 X1", "库存单元 X2", "抽检留样 01", "抽检留样 02", "随机样机 R1", "随机样机 R2",
	}
	need := int(target - invCount)
	if need > len(names) {
		need = len(names)
	}
	added := 0
	for i := 0; i < need; i++ {
		cat := l2[i%len(l2)]
		var serial string
		for attempt := 0; attempt < 8; attempt++ {
			serial = randInventorySerial()
			var ex int64
			db.DB.Model(&models.InventoryProduct{}).Where("serialNumber = ?", serial).Count(&ex)
			if ex == 0 {
				break
			}
		}
		row := models.InventoryProduct{
			ProductCategoryID:         cat.ID,
			InventoryCategoryIDLegacy: 0,
			Name:                      names[i],
			SerialNumber:              serial,
			SortOrder:                 i + 1,
			Status:                    "active",
			Tags:                      "演示,种子",
		}
		if err := db.DB.Create(&row).Error; err != nil {
			log.Printf("[zkwl] seedInventorySamplesIfSparse: %v", err)
			continue
		}
		added++
	}
	if added > 0 {
		log.Printf("[zkwl] seedInventorySamplesIfSparse: inserted %d demo inventory row(s)", added)
	}
	return nil
}

func seedDefaultsIfEmpty() error {
	if err := migrateLegacyProductCategoryHierarchy(); err != nil {
		log.Printf("[zkwl] migrateLegacyProductCategoryHierarchy: %v", err)
	}
	if err := ensureL2UnderEveryL1(); err != nil {
		log.Printf("[zkwl] ensureL2UnderEveryL1: %v", err)
	}
	if err := normalizeMislabeledProductCategories(); err != nil {
		log.Printf("[zkwl] normalizeMislabeledProductCategories: %v", err)
	}
	if err := promoteGuidesStillOnL1(); err != nil {
		log.Printf("[zkwl] promoteGuidesStillOnL1: %v", err)
	}
	var pc int64
	if err := db.DB.Model(&models.ProductCategory{}).Count(&pc).Error; err != nil {
		return err
	}
	if pc == 0 {
		a := models.ProductCategory{Name: "空调", Level: 1, SortOrder: 1, Status: "active"}
		b := models.ProductCategory{Name: "除湿与储能", Level: 1, SortOrder: 2, Status: "active"}
		if err := db.DB.Create(&a).Error; err != nil {
			return err
		}
		if err := db.DB.Create(&b).Error; err != nil {
			return err
		}
		pa, pb := a.ID, b.ID
		a1 := models.ProductCategory{Name: "壁挂空调", Level: 2, ParentID: &pa, SortOrder: 1, Status: "active"}
		b1 := models.ProductCategory{Name: "除湿机", Level: 2, ParentID: &pb, SortOrder: 1, Status: "active"}
		if err := db.DB.Create(&a1).Error; err != nil {
			return err
		}
		if err := db.DB.Create(&b1).Error; err != nil {
			return err
		}
		log.Println("[DB] Default product categories (L1+L2) created.")
	}

	var hc int64
	if err := db.DB.Model(&models.HomeConfig{}).Count(&hc).Error; err != nil {
		return err
	}
	if hc == 0 {
		seed := []models.HomeConfig{
			{Section: "banner", Title: "科必学 品质服务", Desc: "专业·高效·可信赖", Color: "linear-gradient(135deg, #B91C1C, #7F1D1D)", SortOrder: 1, Status: "active"},
			{Section: "nav", Title: "全部商品", Icon: "apps-o", Path: "/products", Color: "#B91C1C", SortOrder: 1, Status: "active"},
		}
		if err := db.DB.Create(&seed).Error; err != nil {
			return err
		}
		log.Println("[DB] Default home configs (partial) created.")
	}

	var dg int64
	if err := db.DB.Model(&models.DeviceGuide{}).Count(&dg).Error; err != nil {
		return err
	}
	if dg == 0 {
		var l2 []models.ProductCategory
		if err := db.DB.Where("level = ?", 2).Order("sortOrder ASC, id ASC").Limit(2).Find(&l2).Error; err != nil {
			return err
		}
		if len(l2) >= 2 {
			c1, c2 := l2[0].ID, l2[1].ID
			guides := []models.DeviceGuide{
				{Name: "空调", Slug: strPtr("aircondition"), Subtitle: "家用/商用中央空调", Icon: "cluster-o", Emoji: "❄️", Gradient: "linear-gradient(135deg, #3B82F6, #1D4ED8)", Badge: "热门", SortOrder: 1, CategoryID: &c1, Status: "active"},
				{Name: "除湿机", Slug: strPtr("dehumidifier"), Subtitle: "家用/工业除湿设备", Icon: "filter-o", Emoji: "💧", Gradient: "linear-gradient(135deg, #06B6D4, #0891B2)", SortOrder: 2, CategoryID: &c2, Status: "active"},
			}
			if err := db.DB.Create(&guides).Error; err != nil {
				return err
			}
			log.Println("[DB] Default device guides (partial) created.")
		}
	}

	if err := fixInventoryProductCategoryPlaceholders(); err != nil {
		log.Printf("[zkwl] fixInventoryProductCategoryPlaceholders: %v", err)
	}
	if err := seedInventorySamplesIfSparse(); err != nil {
		log.Printf("[zkwl] seedInventorySamplesIfSparse: %v", err)
	}

	return nil
}

func strPtr(s string) *string { return &s }
func f64Ptr(f float64) *float64 { return &f }

// CleanDuplicateIndexes 可选：与 Node 一致清理重复索引（简化版跳过）
func CleanDuplicateIndexes(_ *gorm.DB) {}
