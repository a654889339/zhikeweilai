package handlers

import (
	"zhikeweilai/backend/internal/config"
	"zhikeweilai/backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes 注册 /api 下全部路由（Wechat 回调在 main 中单独注册）
func RegisterRoutes(engine *gin.Engine, cfg *config.Config) {
	api := engine.Group("/api")

	api.GET("/health", Health)

	api.GET("/media/cos", MediaCosStream)
	api.POST("/analytics/page-view", AnalyticsPageView)
	api.GET("/admin/page-visit-stats", middleware.Auth(cfg), middleware.Admin(), AnalyticsStats)

	auth := api.Group("/auth")
	{
		auth.POST("/send-code", func(c *gin.Context) { authSendCode(c, cfg) })
		auth.POST("/send-sms-code", func(c *gin.Context) { authSendSmsCode(c, cfg) })
		auth.POST("/register", func(c *gin.Context) { authRegister(c, cfg) })
		auth.POST("/login", func(c *gin.Context) { authLogin(c, cfg) })
		auth.POST("/bind-phone", middleware.Auth(cfg), func(c *gin.Context) { authBindPhone(c, cfg) })
		auth.POST("/wx-login", func(c *gin.Context) { authWxLogin(c, cfg) })
		auth.POST("/alipay-login", func(c *gin.Context) { authAlipayLogin(c, cfg) })
		auth.GET("/profile", middleware.Auth(cfg), authGetProfile)
		auth.PUT("/profile", middleware.Auth(cfg), authUpdateProfile)
		auth.POST("/upload-avatar", middleware.Auth(cfg), func(c *gin.Context) { authUploadAvatar(c, cfg) })
		auth.GET("/admin/users", middleware.Auth(cfg), middleware.Admin(), authAdminGetUsers)
		auth.DELETE("/admin/users/:userId", middleware.Auth(cfg), middleware.Admin(), authAdminDeleteUser)
		auth.DELETE("/admin/users/:userId/products/:productKey", middleware.Auth(cfg), middleware.Admin(), authAdminUnbindProduct)
		auth.GET("/my-products", middleware.Auth(cfg), authMyProducts)
		auth.POST("/bind-product", middleware.Auth(cfg), authBindProduct)
		auth.POST("/bind-by-qr-image", middleware.Auth(cfg), authBindByQrImage)
	}

	orders := api.Group("/orders")
	{
		orders.POST("/", middleware.Auth(cfg), orderCreate)
		orders.GET("/mine", middleware.Auth(cfg), orderMyOrders)
		orders.GET("/mine/stats", middleware.Auth(cfg), orderMineStats)
		orders.POST("/:id/pay-wechat", middleware.Auth(cfg), func(c *gin.Context) { orderPayWechatPrepay(c, cfg) })
		orders.GET("/admin/list", middleware.Auth(cfg), middleware.Admin(), orderAdminList)
		orders.GET("/admin/stats", middleware.Auth(cfg), middleware.Admin(), orderAdminStats)
		orders.GET("/:id", middleware.Auth(cfg), orderDetail)
		orders.PUT("/:id/cancel", middleware.Auth(cfg), orderCancel)
		orders.PUT("/admin/:id/status", middleware.Auth(cfg), middleware.Admin(), orderAdminUpdateStatus)
		orders.PUT("/admin/:id/price", middleware.Auth(cfg), middleware.Admin(), orderAdminUpdatePrice)
		orders.POST("/admin/:id/remark", middleware.Auth(cfg), middleware.Admin(), orderAdminAddRemark)
		orders.GET("/admin/:id/logs", middleware.Auth(cfg), middleware.Admin(), orderAdminLogs)
	}

	svc := api.Group("/services")
	{
		svc.GET("/", svcList)
		svc.GET("/admin/list", middleware.Auth(cfg), middleware.Admin(), svcAdminList)
		svc.GET("/:id", svcDetail)
		svc.POST("/", middleware.Auth(cfg), middleware.Admin(), svcCreate)
		svc.PUT("/:id", middleware.Auth(cfg), middleware.Admin(), svcUpdate)
		svc.DELETE("/:id", middleware.Auth(cfg), middleware.Admin(), svcRemove)
	}

	sc := api.Group("/service-categories")
	{
		sc.GET("/", middleware.Auth(cfg), middleware.Admin(), scatList)
		sc.POST("/", middleware.Auth(cfg), middleware.Admin(), scatCreate)
		sc.PUT("/:id", middleware.Auth(cfg), middleware.Admin(), scatUpdate)
		sc.DELETE("/:id", middleware.Auth(cfg), middleware.Admin(), scatRemove)
	}

	courses := api.Group("/courses")
	{
		courses.GET("/", courseCenterPublicList)
		courses.GET("/admin/list", middleware.Auth(cfg), middleware.Admin(), courseCenterAdminList)
		courses.POST("/admin", middleware.Auth(cfg), middleware.Admin(), courseCenterCreate)
		courses.PUT("/admin/:id", middleware.Auth(cfg), middleware.Admin(), courseCenterUpdate)
		courses.DELETE("/admin/:id", middleware.Auth(cfg), middleware.Admin(), courseCenterRemove)
	}

	guides := api.Group("/guides")
	{
		guides.GET("/categories", guideCategories)
		guides.GET("/", guideList)
		guides.GET("/admin/list", middleware.Auth(cfg), middleware.Admin(), guideAdminList)
		guides.POST("/admin", middleware.Auth(cfg), middleware.Admin(), guideCreate)
		guides.PUT("/admin/:id", middleware.Auth(cfg), middleware.Admin(), guideUpdate)
		guides.DELETE("/admin/:id", middleware.Auth(cfg), middleware.Admin(), guideRemove)
		guides.POST("/admin/upload", middleware.Auth(cfg), middleware.Admin(), func(c *gin.Context) { guideUploadFile(c, cfg) })
		guides.GET("/:id", guideDetail)
		guides.POST("/:id/qrcode", middleware.Auth(cfg), middleware.Admin(), func(c *gin.Context) { guideGenerateQR(c, cfg) })
	}

	pc := api.Group("/product-categories")
	{
		pc.GET("/", middleware.Auth(cfg), middleware.Admin(), pcList)
		pc.POST("/", middleware.Auth(cfg), middleware.Admin(), pcCreate)
		pc.PUT("/:id", middleware.Auth(cfg), middleware.Admin(), pcUpdate)
		pc.DELETE("/:id", middleware.Auth(cfg), middleware.Admin(), pcRemove)
	}

	hc := api.Group("/home-config")
	{
		hc.GET("/", hcList)
		hc.POST("/", middleware.Auth(cfg), middleware.Admin(), hcCreate)
		hc.POST("/upload", middleware.Auth(cfg), middleware.Admin(), func(c *gin.Context) { hcUploadImage(c, cfg) })
		hc.PUT("/:id", middleware.Auth(cfg), middleware.Admin(), hcUpdate)
		hc.DELETE("/:id", middleware.Auth(cfg), middleware.Admin(), hcRemove)
	}

	addr := api.Group("/addresses")
	{
		addr.GET("/", middleware.Auth(cfg), addrList)
		addr.POST("/", middleware.Auth(cfg), addrCreate)
		addr.PUT("/:id", middleware.Auth(cfg), addrUpdate)
		addr.DELETE("/:id", middleware.Auth(cfg), addrRemove)
		addr.PUT("/:id/default", middleware.Auth(cfg), addrSetDefault)
	}

	msg := api.Group("/messages")
	{
		msg.GET("/mine", middleware.Auth(cfg), msgMy)
		msg.POST("/send", middleware.Auth(cfg), msgSend)
		msg.POST("/upload-image", middleware.Auth(cfg), func(c *gin.Context) { msgUploadImage(c, cfg) })
		msg.GET("/unread", middleware.Auth(cfg), msgUnread)
		msg.GET("/admin/conversations", middleware.Auth(cfg), middleware.Admin(), msgAdminConversations)
		msg.GET("/admin/:userId", middleware.Auth(cfg), middleware.Admin(), msgAdminGet)
		msg.POST("/admin/:userId/reply", middleware.Auth(cfg), middleware.Admin(), msgAdminReply)
	}

	cg := api.Group("/chat-groups")
	{
		cg.GET("/admin/list", middleware.Auth(cfg), middleware.Admin(), chatGroupAdminListAll)
		cg.GET("/mine", middleware.Auth(cfg), chatGroupListMine)
		cg.POST("/", middleware.Auth(cfg), chatGroupCreate)
		cg.POST("/:id/join", middleware.Auth(cfg), chatGroupJoin)
		cg.GET("/:id/messages", middleware.Auth(cfg), chatGroupListMessages)
		cg.POST("/:id/messages", middleware.Auth(cfg), chatGroupSendMessage)
		cg.POST("/:id/upload-image", middleware.Auth(cfg), func(c *gin.Context) { chatGroupUploadImage(c, cfg) })
	}

	inv := api.Group("/inventory")
	{
		inv.GET("/categories", middleware.Auth(cfg), middleware.Admin(), invListCategories)
		inv.POST("/categories", middleware.Auth(cfg), middleware.Admin(), invCreateCategory)
		inv.PUT("/categories/:id", middleware.Auth(cfg), middleware.Admin(), invUpdateCategory)
		inv.DELETE("/categories/:id", middleware.Auth(cfg), middleware.Admin(), invRemoveCategory)
		inv.GET("/sample-excel", middleware.Auth(cfg), middleware.Admin(), invGetSampleExcel)
		inv.POST("/import-excel", middleware.Auth(cfg), middleware.Admin(), func(c *gin.Context) { invImportExcel(c, cfg) })
		inv.GET("/sample-delete-excel", middleware.Auth(cfg), middleware.Admin(), invGetSampleDeleteExcel)
		inv.POST("/delete-excel", middleware.Auth(cfg), middleware.Admin(), invBatchDeleteExcel)
		inv.GET("/export-products", middleware.Auth(cfg), middleware.Admin(), func(c *gin.Context) { invExportProducts(c, cfg) })
		inv.GET("/products", middleware.Auth(cfg), middleware.Admin(), invListProducts)
		inv.POST("/products", middleware.Auth(cfg), middleware.Admin(), invCreateProduct)
		inv.PUT("/products/:id", middleware.Auth(cfg), middleware.Admin(), invUpdateProduct)
		inv.DELETE("/products/:id", middleware.Auth(cfg), middleware.Admin(), invRemoveProduct)
		inv.GET("/products/:id/bind-qr-url", middleware.Auth(cfg), middleware.Admin(), func(c *gin.Context) { invGetBindQrURL(c, cfg) })
	}

	out := api.Group("/outlet")
	{
		out.POST("/auth/send-code", func(c *gin.Context) { outletSendCode(c, cfg) })
		out.POST("/auth/send-sms-code", func(c *gin.Context) { outletSendSmsCode(c, cfg) })
		out.POST("/auth/register", func(c *gin.Context) { outletRegister(c, cfg) })
		out.POST("/auth/login", func(c *gin.Context) { outletLogin(c, cfg) })
		out.GET("/auth/profile", middleware.OutletAuth(cfg), outletGetProfile)
		out.PUT("/auth/profile", middleware.OutletAuth(cfg), outletUpdateProfile)
		out.POST("/auth/avatar", middleware.OutletAuth(cfg), func(c *gin.Context) { outletUploadAvatar(c, cfg) })
		out.POST("/auth/bind-phone", middleware.OutletAuth(cfg), func(c *gin.Context) { outletBindPhone(c, cfg) })

		out.POST("/orders", middleware.OutletAuth(cfg), outletOrderCreate)
		out.GET("/orders/mine", middleware.OutletAuth(cfg), outletOrderMy)
		out.GET("/orders/:id", middleware.OutletAuth(cfg), outletOrderDetail)
		out.PUT("/orders/:id/cancel", middleware.OutletAuth(cfg), outletOrderCancel)

		out.GET("/addresses", middleware.OutletAuth(cfg), outletAddrList)
		out.POST("/addresses", middleware.OutletAuth(cfg), outletAddrCreate)
		out.PUT("/addresses/:id", middleware.OutletAuth(cfg), outletAddrUpdate)
		out.DELETE("/addresses/:id", middleware.OutletAuth(cfg), outletAddrRemove)
		out.PUT("/addresses/:id/default", middleware.OutletAuth(cfg), outletAddrDefault)

		out.GET("/home-config", outletHCList)
		out.POST("/home-config", middleware.Auth(cfg), middleware.Admin(), outletHCCreate)
		out.POST("/home-config/upload", middleware.Auth(cfg), middleware.Admin(), func(c *gin.Context) { outletHCUpload(c, cfg) })
		out.PUT("/home-config/:id", middleware.Auth(cfg), middleware.Admin(), outletHCUpdate)
		out.DELETE("/home-config/:id", middleware.Auth(cfg), middleware.Admin(), outletHCRemove)

		out.GET("/service-categories", outletSvcCatList)
		out.GET("/services", outletSvcList)
		out.GET("/services/admin/list", middleware.Auth(cfg), middleware.Admin(), outletSvcAdminList)
		out.POST("/service-categories", middleware.Auth(cfg), middleware.Admin(), outletSvcCatCreate)
		out.PUT("/service-categories/:id", middleware.Auth(cfg), middleware.Admin(), outletSvcCatUpdate)
		out.DELETE("/service-categories/:id", middleware.Auth(cfg), middleware.Admin(), outletSvcCatRemove)
		out.POST("/services", middleware.Auth(cfg), middleware.Admin(), outletSvcCreate)
		out.PUT("/services/:id", middleware.Auth(cfg), middleware.Admin(), outletSvcUpdate)
		out.DELETE("/services/:id", middleware.Auth(cfg), middleware.Admin(), outletSvcRemove)

		out.GET("/messages/mine", middleware.OutletAuth(cfg), outletMsgMy)
		out.POST("/messages/send", middleware.OutletAuth(cfg), outletMsgSend)
		out.POST("/messages/upload-image", middleware.OutletAuth(cfg), func(c *gin.Context) { outletMsgUpload(c, cfg) })
		out.GET("/messages/unread", middleware.OutletAuth(cfg), outletMsgUnread)

		out.GET("/admin/users", middleware.Auth(cfg), middleware.Admin(), outletAdminUsers)
		out.GET("/admin/users/:id/detail", middleware.Auth(cfg), middleware.Admin(), outletAdminUserDetail)
		out.GET("/admin/orders", middleware.Auth(cfg), middleware.Admin(), outletAdminOrderList)
		out.GET("/admin/orders/stats", middleware.Auth(cfg), middleware.Admin(), outletAdminOrderStats)
		out.PUT("/admin/orders/:id/status", middleware.Auth(cfg), middleware.Admin(), outletAdminOrderUpdateStatus)
		out.PUT("/admin/orders/:id/price", middleware.Auth(cfg), middleware.Admin(), outletAdminOrderUpdatePrice)
		out.POST("/admin/orders/:id/remark", middleware.Auth(cfg), middleware.Admin(), outletAdminOrderRemark)
		out.GET("/admin/orders/:id/logs", middleware.Auth(cfg), middleware.Admin(), outletAdminOrderLogs)
		out.GET("/admin/messages/conversations", middleware.Auth(cfg), middleware.Admin(), outletMsgAdminConv)
		out.GET("/admin/messages/:userId", middleware.Auth(cfg), middleware.Admin(), outletMsgAdminGet)
		out.POST("/admin/messages/:userId/reply", middleware.Auth(cfg), middleware.Admin(), outletMsgAdminReply)
	}

	api.POST("/admin/generate-thumbs", middleware.Auth(cfg), middleware.Admin(), func(c *gin.Context) { AdminGenerateThumbs(c, cfg) })
	api.POST("/admin/seed", middleware.Auth(cfg), middleware.Admin(), SeedData)

	api.GET("/i18n", I18nList)
	api.POST("/i18n/bulk", middleware.Auth(cfg), middleware.Admin(), I18nBulkUpsert)
	api.PUT("/i18n/:id", middleware.Auth(cfg), middleware.Admin(), I18nUpdate)
	api.DELETE("/i18n/:id", middleware.Auth(cfg), middleware.Admin(), I18nRemove)
}
