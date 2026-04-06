package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"zhikeweilai/backend/internal/bootstrap"
	"zhikeweilai/backend/internal/config"
	"zhikeweilai/backend/internal/db"
	"zhikeweilai/backend/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	if err := db.Connect(cfg); err != nil {
		log.Fatalf("[zkwl] DB connect: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		// 与已有 MySQL 表结构不完全一致时仅告警，避免进程退出（可手工对齐外键/列类型）
		log.Printf("[zkwl] AutoMigrate: %v", err)
	}
	if err := bootstrap.Run(); err != nil {
		log.Fatalf("[zkwl] bootstrap: %v", err)
	}

	if cfg.NodeEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(gin.Logger())
	engine.Use(cors.Default())
	engine.MaxMultipartMemory = 10 << 20

	// 微信支付回调：需在 JSON 解析之前保留原始 body（handler 内自行 ReadAll）
	engine.POST("/api/orders/wechat/notify", handlers.WechatPayNotify)

	handlers.RegisterRoutes(engine, cfg)

	uploadsDir := filepath.Join("public", "uploads")
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		log.Printf("[zkwl] mkdir uploads: %v", err)
	}
	engine.Static("/uploads", uploadsDir)
	engine.StaticFile("/", filepath.Join("static", "admin.html"))

	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	log.Printf("[zkwl backend] listening on http://%s", addr)
	if err := engine.Run(addr); err != nil {
		log.Fatal(err)
	}
}
