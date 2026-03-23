# Vino 服务

一站式服务管理平台，包含 **Web 前端**、**后端 API**、**微信小程序**和**支付宝小程序**，支持服务预约、设备指南、订单管理、收货地址、产品绑定与客服消息等能力。

---

# 技术文档

https://docs.qq.com/doc/DSnprd3pzR09mdUdQ?no_promotion=1&is_blank_or_template=blank&is_no_hook_redirect=1
https://docs.qq.com/doc/DSktJZmd1dmZRSkVy?no_promotion=1&is_blank_or_template=blank&is_no_hook_redirect=1
https://docs.qq.com/doc/DSmtWcm9vZ3RTSkto?no_promotion=1&is_blank_or_template=blank&is_no_hook_redirect=1


## 项目结构

```
Vino_test/
├── frontend/           # Vue3 + Vite 前端（移动端优先）
│   ├── src/
│   │   ├── views/      # 页面组件（首页、服务、订单、我的、地址、绑定产品等）
│   │   ├── components/ # 公共组件（ChatWidget、LodImg、SplashScreen）
│   │   ├── api/        # API 请求封装
│   │   ├── stores/     # Pinia 状态管理
│   │   └── router/     # 路由配置
│   ├── Dockerfile
│   └── nginx.conf
├── backend/            # Node.js + Express 后端
│   ├── src/
│   │   ├── routes/     # 路由（auth、orders、addresses、guides、inventory 等）
│   │   ├── controllers/# 控制器
│   │   ├── models/     # Sequelize 模型
│   │   ├── middleware/ # 中间件（JWT、管理员校验）
│   │   ├── public/     # 后台管理 SPA（admin.html）
│   │   └── config/     # 配置
│   └── Dockerfile
├── wechat-mp/          # 微信小程序（原生）
│   ├── pages/          # 首页、产品、服务、订单、我的、登录、地址、聊天等
│   └── app.json
├── alipay-mp/          # 支付宝小程序（原生）
│   ├── p[后端说明书.md](%E5%90%8E%E7%AB%AF%E8%AF%B4%E6%98%8E%E4%B9%A6.md)ages/          # 页面与微信端一一对应
│   └── app.json
├── docker-compose.yaml # Docker 编排（vino-frontend、vino-backend、vino-mysql）
├── 前端说明书.md        # 前端功能拆解、入口、测试与前后端联动
├── 小程序说明书.md      # 微信/支付宝小程序功能、接口与测试说明
└── 后端说明书.md        # 后端接口、权限、数据模型与测试说明
```

---

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Vant 4 + Pinia |
| 后端 | Node.js + Express + Sequelize + MySQL |
| 微信小程序 | 原生小程序（wx.* API） |
| 支付宝小程序 | 原生小程序（my.* API） |
| 部署 | Docker + Docker Compose |

---

## 端口分配

| 服务 | 端口 |
|------|------|
| 前端 | 5301 |
| 后端 API | 5302 |
| MySQL | 3308 |

> 端口设计避免与同机其他项目（如 5001/5002、5101/5102）冲突。

---

## 说明书文档（根目录）

根目录下提供三份详细说明书，便于功能排查、联调与测试：

| 文档 | 内容概要 |
|------|----------|
| [前端说明书.md](./前端说明书.md) | Web 前端功能点拆解、路由与页面、API 与后端路径对照、功能入口、测试方向、与后端联动关系 |
| [小程序说明书.md](./小程序说明书.md) | 微信/支付宝小程序页面与 Tab、功能点、接口对接方式、双端差异、测试方向、与前端/后端联动 |
| [后端说明书.md](./后端说明书.md) | 后端路由与挂载、中间件与权限（公开/需登录/需管理员）、各模块接口说明、数据模型、测试方向 |

开发与测试时可按模块查阅对应说明书中的「功能入口」「测试方向」「前后端联动」等小节。

---

## 快速开始

### 本地开发

```bash
# 后端
cd backend
cp .env.example .env   # 配置数据库等
npm install
npm run dev

# 前端
cd frontend
npm install
npm run dev
```

### Docker 部署

```bash
docker compose up -d --build
```

仅更新后端与前端（不重启 MySQL）：

```bash
docker compose up -d --build vino-backend vino-frontend
```

---

## API 接口概览

后端挂载在 `/api` 下，主要模块包括：

| 前缀 | 说明 |
|------|------|
| /api/auth | 注册、登录（含微信/支付宝）、profile、绑定产品、管理员用户列表等 |
| /api/services | 服务列表与详情（公开）；管理端增删改 |
| /api/orders | 创建订单、我的订单（分页）、取消；管理端列表/状态/金额/备注 |
| /api/addresses | 地址增删改查、设默认（需登录） |
| /api/guides | 指南分类、列表、详情（公开）；管理端增删改与上传 |
| /api/home-config | 首页配置列表（公开）；管理端增删改与上传 |
| /api/messages | 用户端会话与发送；管理端会话列表与回复 |
| /api/inventory | 库存种类与商品、导入导出、二维码（仅管理员） |
| /api/health | 健康检查（匿名） |

完整路径、方法、权限与参数见 [后端说明书.md](./后端说明书.md)。

---

## 服务器信息

- **IP**: 106.54.50.88
- **前端访问**: http://106.54.50.88:5301
- **后端 API**: http://106.54.50.88:5302
- **健康检查**: http://106.54.50.88:5302/api/health
- **后台管理**: 登录后访问后端提供的 admin 页面（与前端同源或同域配置）
