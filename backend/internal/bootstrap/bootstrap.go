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

	return seedDefaultsIfEmpty()
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

func firstInventoryCategoryIDForSeed() (int, error) {
	var ic models.InventoryCategory
	err := db.DB.Where("status = ?", "active").Order("id ASC").First(&ic).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			row := models.InventoryCategory{Name: "默认", SortOrder: 0, Status: "active"}
			if err := db.DB.Create(&row).Error; err != nil {
				return 0, err
			}
			return row.ID, nil
		}
		return 0, err
	}
	return ic.ID, nil
}

func seedInventorySamplesIfSparse() error {
	legacyInvCatID, err := firstInventoryCategoryIDForSeed()
	if err != nil || legacyInvCatID <= 0 {
		log.Printf("[zkwl] seedInventorySamplesIfSparse: skip inventory legacy category: %v", err)
		return nil
	}
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
			InventoryCategoryIDLegacy: legacyInvCatID,
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

	var sc int64
	if err := db.DB.Model(&models.ServiceCategory{}).Count(&sc).Error; err != nil {
		return err
	}
	if sc == 0 {
		if err := db.DB.Create([]models.ServiceCategory{
			{Name: "维修", Key: strPtr("repair"), SortOrder: 1, Status: "active"},
			{Name: "清洁", Key: strPtr("clean"), SortOrder: 2, Status: "active"},
			{Name: "检测", Key: strPtr("inspect"), SortOrder: 3, Status: "active"},
			{Name: "数据", Key: strPtr("data"), SortOrder: 4, Status: "active"},
		}).Error; err != nil {
			return err
		}
		log.Println("[DB] Default service categories created.")
	}

	var hc int64
	if err := db.DB.Model(&models.HomeConfig{}).Count(&hc).Error; err != nil {
		return err
	}
	if hc == 0 {
		seed := []models.HomeConfig{
			{Section: "banner", Title: "科必学 品质服务", Desc: "专业·高效·可信赖", Color: "linear-gradient(135deg, #B91C1C, #7F1D1D)", SortOrder: 1, Status: "active"},
			{Section: "nav", Title: "全部服务", Icon: "apps-o", Path: "/services", Color: "#B91C1C", SortOrder: 1, Status: "active"},
		}
		if err := db.DB.Create(&seed).Error; err != nil {
			return err
		}
		log.Println("[DB] Default home configs (partial) created.")
	}

	var svc int64
	if err := db.DB.Model(&models.Service{}).Count(&svc).Error; err != nil {
		return err
	}
	if svc == 0 {
		var cats []models.ServiceCategory
		if err := db.DB.Order("sortOrder ASC").Find(&cats).Error; err != nil {
			return err
		}
		if len(cats) >= 4 {
			repair, clean, inspect, data := cats[0].ID, cats[1].ID, cats[2].ID, cats[3].ID
			services := []models.Service{
				{Title: "设备维修", Description: "专业工程师提供全方位维修服务", Icon: "setting-o", CategoryID: &repair, Price: 99, OriginPrice: f64Ptr(159), Bg: "#B91C1C", SortOrder: 1, Status: "active"},
				{Title: "深度清洁", Description: "全方位清洁保养", Icon: "brush-o", CategoryID: &clean, Price: 149, OriginPrice: f64Ptr(199), Bg: "#2563EB", SortOrder: 1, Status: "active"},
				{Title: "全面检测", Description: "系统全面评估", Icon: "scan", CategoryID: &inspect, Price: 49, OriginPrice: f64Ptr(79), Bg: "#059669", SortOrder: 1, Status: "active"},
				{Title: "数据恢复", Description: "专业数据找回", Icon: "replay", CategoryID: &data, Price: 199, OriginPrice: f64Ptr(299), Bg: "#7C3AED", SortOrder: 1, Status: "active"},
			}
			if err := db.DB.Create(&services).Error; err != nil {
				return err
			}
			log.Println("[DB] Default services created.")
		}
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
