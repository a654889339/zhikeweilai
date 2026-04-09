---
name: deploy-to-106
description: 将 zhikeweilai 部署到 106.54.50.88；与 Vino_test 同机并存（zkwl-* 容器、主前端 5301:80 / API 5302 / 门店 5303、3310 MySQL 映射、独立 MySQL 卷）。后端为 Go（Gin，`backend/Dockerfile` 构建）。使用 SSH + ghfast 镜像拉代码 + docker compose。在用户要求发布/部署/上 106 时执行本 skill。
---

# Deploy zhikeweilai to 106

## 与同机 Vino_test 的约定（勿改乱）

| 项目 | 主前端 | 门店 | API | MySQL 宿主机端口 |
|------|--------|------|-----|------------------|
| **Vino_test** | 5201 | 5203 | 5202 | 3308 |
| **zhikeweilai** | 5301→容器80 | 5303 | 5302 | **3310**（106 上 3309 已被 jiuyoumi 占用） |

- 容器名：`zkwl-mysql`、`zkwl-backend`、`zkwl-frontend`、`zkwl-frontend-outlet`（禁止再用 `vino-*`，会与 Vino 冲突）。
- 数据卷：`zkwl-mysql-data`（与 `vino-mysql-data` 独立）。

## 后端说明（Go）

- **技术栈**：Go 1.22 + Gin + GORM + MySQL，目录 `backend/`，入口 `cmd/server/main.go`（与 `F:\Vino_test\backend` 对齐）。
- **镜像**：`backend/Dockerfile` 多阶段构建（`golang:1.22-alpine` → `alpine`），产物二进制 `/app/zkwl-server`，监听 **`PORT`（默认 5302）**。
- **构建提示**：首次在服务器构建会拉取 Go 模块，可能较慢；已设置 `GOPROXY=https://goproxy.cn,direct`（见 Dockerfile）。
- **环境变量**：`docker-compose.yaml` 中仍使用 `NODE_ENV`、`PORT` 等名称，与旧 Node 部署兼容，供配置读取运行模式（如 `NODE_ENV=production` 时 Gin 为 Release 模式）。

## 连接与变量

- **服务器**：`ubuntu@106.54.50.88:22`
- **密钥**：`F:/ItsyourTurnMy/backend/deploy/test.pem`
- **部署目录**：`REMOTE_PATH=/home/ubuntu/zhikeweilai`（与 Vino 的 `/home/ubuntu/Vino_test` 分开）
- **GitHub 镜像**（服务器直连 GitHub 不稳定时用）：`https://ghfast.top/https://github.com/a654889339/zhikeweilai.git`
- **SSH 选项**（与 Vino 一致，兼容 RSA 密钥）：
  - `-o HostKeyAlgorithms=+ssh-rsa`
  - `-o PubkeyAcceptedKeyTypes=+ssh-rsa`
  - `-o StrictHostKeyChecking=no`

**SSH 一行模板**（PowerShell / bash 均可把引号内换成实际命令）：

```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88 "<command>"
```

## 前置条件

- 本地已提交并准备推送的 `main`（或你实际使用的分支）。
- 服务器已安装 Docker 与 `docker compose` v2；`git` 与 `curl` 可用。

## 执行步骤（按顺序）

### 1. 本地推送 GitHub

在 **`F:\zhikeweilai`** 仓库根目录：

```bash
git push origin main
```

### 2. 服务器：拉代码（首次 clone / 已有则 pull）

在服务器上逻辑应为：

- 若 **`/home/ubuntu/zhikeweilai/.git` 存在**：`cd /home/ubuntu/zhikeweilai && git pull`
- 否则：`cd /home/ubuntu && git clone https://ghfast.top/https://github.com/a654889339/zhikeweilai.git zhikeweilai`，进入目录后执行  
  `git remote set-url origin https://ghfast.top/https://github.com/a654889339/zhikeweilai.git`（便于后续 `git pull`）

**远程拉代码**（用 **ubuntu** 执行，不要用 sudo，避免目录属主变成 root）：

```bash
if [ -d /home/ubuntu/zhikeweilai/.git ]; then
  cd /home/ubuntu/zhikeweilai && git pull
else
  cd /home/ubuntu && git clone https://ghfast.top/https://github.com/a654889339/zhikeweilai.git zhikeweilai
  cd /home/ubuntu/zhikeweilai && git remote set-url origin https://ghfast.top/https://github.com/a654889339/zhikeweilai.git
fi
```

### 3. 构建并启动容器

- **首次或 compose/镜像大改**：全量构建

```bash
sudo bash -c 'cd /home/ubuntu/zhikeweilai && docker compose up -d --build'
```

- **日常更新（尽量不动 MySQL、不 down 整栈）**：只重建应用层

```bash
sudo bash -c 'cd /home/ubuntu/zhikeweilai && docker compose up -d --build zkwl-backend zkwl-frontend zkwl-frontend-outlet'
```

避免例行发布执行 **`docker compose down`**，以免误伤运行中的库与网络（除非你有意维护停机）。

### 4. 验证

```bash
sudo docker ps --filter name=zkwl --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -s http://localhost:5302/api/health
```

浏览器：主站 `http://106.54.50.88:5301`（或宿主机 nginx 反代到该端口后用标准 80）；门店 `http://106.54.50.88:5303`。

## 常见说明

- 若服务器上仍残留 **旧 compose**（容器名 `vino-*`、占用 3308/5203），需先在该目录 **`docker compose down`**（旧项目）再启本栈，否则端口/容器名冲突。
- MySQL 数据在卷 **`zkwl-mysql-data`**；从旧卷迁数据需自行 `docker volume` + 数据导入，不在本 skill 默认流程内。
