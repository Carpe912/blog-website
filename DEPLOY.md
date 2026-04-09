# 宝塔 Linux 部署指南

本文档描述如何在一台全新的宝塔 Linux 服务器上完整部署本博客系统（Nuxt 3 前端 + NestJS 后端 + PostgreSQL 数据库）。

---

## 架构概览

```
外网请求
    │
    ▼
  Nginx（宝塔管理，80/443 端口）
    ├── / → 反向代理 → Nuxt 前端（Node 进程，端口 3000）
    └── /api → 反向代理 → NestJS 后端（Node 进程，端口 3001）
                                │
                                ▼
                         PostgreSQL（本机 5432）
```

---

## 一、服务器基础环境

### 1.1 安装宝塔面板

登录服务器 SSH，执行宝塔官方一键安装脚本（CentOS / Ubuntu 二选一）：

```bash
# CentOS 7/8
yum install -y wget && wget -O install.sh https://download.bt.cn/install/install_6.0.sh && sh install.sh ed8484bec

# Ubuntu 20.04 / 22.04
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec
```

安装完成后按提示记录：
- 面板地址（如 `http://your-ip:8888/xxxxxxxx`）
- 面板用户名和密码

浏览器打开面板地址，完成初始化。

---

### 1.2 通过宝塔安装基础软件

登录宝塔面板 → **软件商店**，安装以下软件：

| 软件 | 推荐版本 | 说明 |
|------|----------|------|
| Nginx | 1.24.x | Web 服务器 / 反向代理 |
| PM2 管理器 | 最新版 | Node.js 进程守护 |

> **不要通过宝塔安装 Node.js**，下一步用 nvm 安装以便管理版本。

---

### 1.3 安装 Node.js（通过 nvm）

SSH 连接服务器，执行：

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 使环境变量生效
source ~/.bashrc   # 或 source ~/.zshrc

# 安装 Node.js 18 LTS
nvm install 18
nvm use 18
nvm alias default 18

# 验证
node -v   # 应输出 v18.x.x
npm -v
```

---

### 1.4 安装 PostgreSQL

```bash
# Ubuntu 22.04
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# CentOS 8
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

**配置 PostgreSQL 用户和数据库：**

```bash
# 切换到 postgres 用户
sudo -i -u postgres

# 进入 psql
psql

# 执行以下 SQL（替换 your_password 为强密码）
ALTER USER postgres WITH PASSWORD 'your_password';
CREATE DATABASE blog_db;
\q

exit
```

**修改认证方式（Ubuntu）：**

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

找到以下行，将 `peer` 改为 `md5`：

```
# 修改前
local   all   postgres   peer
# 修改后
local   all   postgres   md5
```

```bash
sudo systemctl restart postgresql
```

验证连接：

```bash
psql -U postgres -d blog_db -W
# 输入密码后进入 psql 表示成功
\q
```

---

## 二、上传项目代码

### 方式一：Git 拉取（推荐）

```bash
# 在服务器上
cd /www/wwwroot
git clone https://github.com/your-username/blog-website.git
cd blog-website
```

### 方式二：宝塔文件管理器上传

1. 宝塔面板 → **文件** → 进入 `/www/wwwroot/`
2. 上传本地打包好的 `blog-website.zip`
3. 解压：右键 → 解压

---

## 三、配置后端

### 3.1 安装依赖

```bash
cd /www/wwwroot/blog-website/backend
npm install

# 安装 cookie-parser（若 package.json 中没有）
npm install cookie-parser @types/cookie-parser
```

### 3.2 配置环境变量

```bash
cp .env .env.bak   # 备份示例
nano .env
```

填入以下内容（按实际情况修改）：

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/blog_db?schema=public"
PORT=3001
ADMIN_PASSWORD=你的管理密码（设置一个强密码）
CORS_ORIGIN=https://your-domain.com
```

> - `your_password` 替换为第一步设置的 PostgreSQL 密码
> - `CORS_ORIGIN` 填写你的实际域名（带 `https://`）
> - `ADMIN_PASSWORD` 务必修改为强密码

### 3.3 初始化数据库

```bash
cd /www/wwwroot/blog-website/backend

# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移（创建表结构）
npx prisma migrate deploy
```

> 生产环境使用 `migrate deploy` 而非 `migrate dev`。

### 3.4 构建后端

```bash
npm run build
# 构建产物在 dist/ 目录
```

### 3.5 用 PM2 启动后端

```bash
# 用 PM2 启动后端
pm2 start dist/main.js --name blog-backend

# 设置开机自启
pm2 save
pm2 startup
# 按照输出提示执行对应的 sudo 命令

# 查看运行状态
pm2 status
pm2 logs blog-backend
```

---

## 四、配置前端

### 4.1 安装依赖

```bash
cd /www/wwwroot/blog-website/frontend
npm install
```

### 4.2 配置前端环境变量

```bash
nano .env
```

内容如下：

```env
NUXT_PUBLIC_API_BASE=https://your-domain.com/api
NUXT_PUBLIC_SITE_NAME=我的博客
NUXT_PUBLIC_SITE_DESCRIPTION=记录思考，分享知识
NUXT_PUBLIC_SITE_URL=https://your-domain.com
NUXT_PUBLIC_AUTHOR=你的名字
```

### 4.3 构建前端

```bash
npm run build
# 构建产物在 .output/ 目录
```

### 4.4 用 PM2 启动前端

```bash
pm2 start .output/server/index.mjs --name blog-frontend

pm2 save

# 查看状态
pm2 status
pm2 logs blog-frontend
```

---

## 五、配置 Nginx 反向代理（宝塔）

### 5.1 创建站点

1. 宝塔面板 → **网站** → **添加站点**
2. 填写域名（如 `your-domain.com`）
3. 根目录随便填（如 `/www/wwwroot/blog-website`，实际流量由 Nginx 反代处理）
4. 数据库选择**不创建**
5. PHP 版本选择**纯静态**
6. 点击**提交**

### 5.2 配置 Nginx 反向代理规则

1. 宝塔面板 → **网站** → 点击域名右侧**设置**
2. 选择**配置文件**，将内容替换为以下完整配置：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 将 HTTP 重定向到 HTTPS（配置 SSL 后取消注释）
    # return 301 https://$host$request_uri;

    # 日志
    access_log  /www/wwwlogs/blog.access.log;
    error_log   /www/wwwlogs/blog.error.log;

    # 后端 API 反向代理（/api 开头的请求转发到 NestJS）
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 前端反向代理（其余请求转发到 Nuxt）
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> 将 `your-domain.com` 替换为你的实际域名。

3. 点击**保存**，宝塔会自动重载 Nginx。

### 5.3 验证

浏览器访问 `http://your-domain.com`，应看到博客首页。
访问 `http://your-domain.com/api`，应返回 404 JSON（说明后端正常）。

---

## 六、配置 HTTPS（SSL 证书）

### 方式一：宝塔免费证书（Let's Encrypt）

1. 宝塔面板 → **网站** → 站点**设置** → **SSL**
2. 选择 **Let's Encrypt**
3. 勾选域名，点击**申请**
4. 申请成功后开启**强制 HTTPS**

### 方式二：上传自有证书

1. 宝塔面板 → **网站** → 站点**设置** → **SSL**
2. 选择**其他证书**，粘贴证书和私钥内容
3. 点击**保存**

SSL 配置完成后，修改环境变量：

```bash
# 后端
nano /www/wwwroot/blog-website/backend/.env
# CORS_ORIGIN=https://your-domain.com

# 前端
nano /www/wwwroot/blog-website/frontend/.env
# NUXT_PUBLIC_API_BASE=https://your-domain.com/api
# NUXT_PUBLIC_SITE_URL=https://your-domain.com
```

重启服务：

```bash
pm2 restart blog-backend blog-frontend
```

---

## 七、防火墙配置

宝塔面板 → **安全** → **系统防火墙**，确认端口规则：

| 端口 | 状态 | 说明 |
|------|------|------|
| 22 | 开放 | SSH |
| 80 | 开放 | HTTP |
| 443 | 开放 | HTTPS |
| 8888 | 开放（可限制 IP） | 宝塔面板 |
| 3000 | **关闭** | 前端（只允许本机访问） |
| 3001 | **关闭** | 后端（只允许本机访问） |
| 5432 | **关闭** | PostgreSQL（只允许本机访问） |

> 3000 / 3001 / 5432 端口**不要对外开放**，通过 Nginx 代理访问即可。

---

## 八、日常运维

### 查看服务状态

```bash
pm2 status                        # 查看所有进程状态
pm2 logs blog-backend             # 后端实时日志
pm2 logs blog-frontend            # 前端实时日志
pm2 logs blog-backend --lines 100 # 查看最近 100 行日志
```

### 更新代码

```bash
cd /www/wwwroot/blog-website

# 拉取最新代码
git pull

# 重新构建并重启后端
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart blog-backend

# 重新构建并重启前端
cd ../frontend
npm install
npm run build
pm2 restart blog-frontend
```

### 数据库备份

```bash
# 手动备份
pg_dump -U postgres blog_db > /www/backup/blog_db_$(date +%Y%m%d).sql

# 恢复
psql -U postgres blog_db < /www/backup/blog_db_20240101.sql
```

宝塔面板 → **数据库** → 可设置定时自动备份（需先在宝塔中添加 PostgreSQL 数据库管理）。

### 重启 Nginx

```bash
# 宝塔面板 → 软件商店 → Nginx → 重启
# 或 SSH
nginx -t && nginx -s reload
```

---

## 九、常见问题排查

### 前端访问 502 Bad Gateway

```bash
# 检查前端进程是否在运行
pm2 status
pm2 logs blog-frontend

# 检查端口是否监听
ss -tlnp | grep 3000
```

### API 请求 502

```bash
pm2 status
pm2 logs blog-backend
ss -tlnp | grep 3001
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 测试连接
psql -U postgres -d blog_db -W

# 检查 .env 中 DATABASE_URL 是否正确
cat /www/wwwroot/blog-website/backend/.env
```

### Prisma 迁移失败

```bash
cd /www/wwwroot/blog-website/backend

# 查看迁移状态
npx prisma migrate status

# 若环境全新，重新初始化
npx prisma migrate deploy
```

### PM2 开机未自启

```bash
pm2 startup   # 复制输出的命令执行
pm2 save
```

---

## 十、目录结构参考（服务器）

```
/www/wwwroot/blog-website/
├── backend/
│   ├── .env              ← 生产环境变量（勿提交 Git）
│   ├── dist/             ← 构建产物（pm2 运行此目录）
│   └── prisma/
│       └── schema.prisma
└── frontend/
    ├── .env              ← 前端环境变量
    └── .output/          ← Nuxt 构建产物（pm2 运行此目录）
        └── server/
            └── index.mjs ← pm2 入口
```
