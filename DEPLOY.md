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

【云服务器】请在安全组放行 8888 端口
外网ipv4面板地址: https://47.116.6.132:8888/ab3fbd34
内网面板地址: https://172.24.11.217:8888/ab3fbd34
username: cda222c6
password: 83e1cc34

安装完成后按提示记录：

- 面板地址（如 `http://your-ip:8888/xxxxxxxx`）
- 面板用户名和密码

浏览器打开面板地址，完成初始化。

---

### 1.2 通过宝塔安装基础软件

登录宝塔面板 → **软件商店**，安装以下软件：

| 软件       | 推荐版本 | 说明                  |
| ---------- | -------- | --------------------- |
| Nginx      | 1.24.x   | Web 服务器 / 反向代理 |
| PM2 管理器 | 最新版   | Node.js 进程守护      |

> **不要通过宝塔安装 Node.js**，下一步用 nvm 安装以便管理版本。

---

### 1.3 安装 Node.js（通过 nvm）

SSH 连接服务器，执行：

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 使环境变量生效
source ~/.bashrc   # 或 source ~/.zshrc

# 安装 Node.js 20 LTS
nvm install 22
nvm use 22
nvm alias default 22

# 验证
node -v   # 应输出 v22.x.x
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

# 执行以下 SQL（替换 your_password 为强密码）  666666 就是密码
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
npm install --no-workspaces

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

| 端口 | 状态              | 说明                         |
| ---- | ----------------- | ---------------------------- |
| 22   | 开放              | SSH                          |
| 80   | 开放              | HTTP                         |
| 443  | 开放              | HTTPS                        |
| 8888 | 开放（可限制 IP） | 宝塔面板                     |
| 3000 | **关闭**          | 前端（只允许本机访问）       |
| 3001 | **关闭**          | 后端（只允许本机访问）       |
| 5432 | **关闭**          | PostgreSQL（只允许本机访问） |

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

---

## 十一、代码更新后自动部署

当你推送代码到 GitHub 后，有两种方式让服务器自动拉取并重新部署。

---

### 方式一：GitHub Actions 自动部署（推荐）

推送到 `main` 分支后，GitHub Actions 自动 SSH 连接服务器执行部署脚本。

#### 第 1 步：在服务器上生成 SSH 密钥对

```bash
# 在服务器上执行
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""

# 将公钥加入授权列表（允许该密钥 SSH 登录）
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 查看私钥（下一步要复制到 GitHub）
cat ~/.ssh/github_actions
```

#### 第 2 步：在 GitHub 仓库配置 Secrets

进入 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，依次添加：

| Secret 名称       | 值                                                        |
| ----------------- | --------------------------------------------------------- |
| `SSH_HOST`        | 服务器公网 IP                                             |
| `SSH_PORT`        | SSH 端口（默认 `22`）                                     |
| `SSH_USER`        | SSH 登录用户名（如 `root`）                               |
| `SSH_PRIVATE_KEY` | 上一步 `cat ~/.ssh/github_actions` 输出的**完整私钥**内容 |

#### 第 3 步：创建 GitHub Actions workflow 文件

项目根目录已提供 `.github/workflows/deploy.yml`，内容见下方。

每次向 `main` 分支推送代码，workflow 会自动：

1. SSH 连接服务器
2. `git pull` 拉取最新代码
3. 重新安装依赖、执行数据库迁移、构建
4. PM2 重启前后端进程

#### workflow 触发条件

只要 `main` 分支上**产生新提交**，就会触发，包括：

- `git push origin main`（本地直接推送）
- GitHub 上 **Pull Request merge 到 main**
- GitHub 网页上直接编辑文件提交到 main

> merge PR 的本质也是向 main 推送新提交，所以同样触发。
> 只是提交了 PR 但还未 merge，不会触发。

可在 GitHub 仓库 → **Actions** 页面查看每次部署的实时日志。

---

### 方式二：宝塔 Webhook 自动部署

无需配置 GitHub Secrets，由服务器主动监听 GitHub 的推送通知。

#### 第 1 步：在服务器创建部署脚本

```bash
mkdir -p /www/scripts
nano /www/scripts/deploy.sh
```

粘贴以下内容：

```bash
#!/bin/bash
set -e

PROJECT_DIR="/www/wwwroot/blog-website"
LOG_FILE="/www/wwwlogs/deploy.log"

echo "==============================" >> $LOG_FILE
echo "Deploy started: $(date)" >> $LOG_FILE

cd $PROJECT_DIR

# 拉取最新代码
git pull origin main >> $LOG_FILE 2>&1

# 加载 nvm（非交互式 shell 需手动 source）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 更新后端
echo "--- Building backend ---" >> $LOG_FILE
cd $PROJECT_DIR/backend
npm install --production=false >> $LOG_FILE 2>&1
npx prisma generate >> $LOG_FILE 2>&1
npx prisma migrate deploy >> $LOG_FILE 2>&1
npm run build >> $LOG_FILE 2>&1
pm2 restart blog-backend >> $LOG_FILE 2>&1

# 更新前端
echo "--- Building frontend ---" >> $LOG_FILE
cd $PROJECT_DIR/frontend
npm install >> $LOG_FILE 2>&1
npm run build >> $LOG_FILE 2>&1
pm2 restart blog-frontend >> $LOG_FILE 2>&1

echo "Deploy finished: $(date)" >> $LOG_FILE
echo "==============================" >> $LOG_FILE
```

赋予执行权限：

```bash
chmod +x /www/scripts/deploy.sh
```

#### 第 2 步：在宝塔面板配置 Webhook

1. 宝塔面板 → **软件商店** → 搜索 **宝塔WebHook** → 安装
2. 打开宝塔 WebHook → **添加**：
   - 名称：`blog-deploy`
   - 脚本：`/www/scripts/deploy.sh`
3. 保存后复制生成的 **Webhook URL**，格式如：
   ```
   http://your-server-ip:8888/hook?access_key=xxxxxxxx&param=blog-deploy
   ```

#### 第 3 步：在 GitHub 配置 Webhook

1. GitHub 仓库 → **Settings** → **Webhooks** → **Add webhook**
2. 填写：
   - **Payload URL**：粘贴上一步复制的宝塔 Webhook URL
   - **Content type**：`application/json`
   - **Which events**：选 **Just the push event**
3. 点击 **Add webhook**

#### 触发方式

同 GitHub Actions，只要 `main` 分支产生新提交（直接 push 或 PR merge）都会触发。

```
git push origin main   # 推送后 GitHub 自动通知服务器执行部署脚本
```

查看部署日志：

```bash
tail -f /www/wwwlogs/deploy.log
```

---

### 两种方式对比

| 对比项             | GitHub Actions                     | 宝塔 Webhook                          |
| ------------------ | ---------------------------------- | ------------------------------------- |
| 配置复杂度         | 中（需配置 Secrets）               | 低（宝塔界面操作）                    |
| 构建位置           | GitHub 服务器 SSH 到你的服务器执行 | 服务器本地执行                        |
| 日志查看           | GitHub Actions 页面，清晰          | 服务器 `/www/wwwlogs/deploy.log`      |
| 需要服务器开放端口 | 只需 22（SSH）                     | 需要 8888（宝塔端口）可被 GitHub 访问 |
| 推荐场景           | 有 GitHub 付费套餐或公开仓库       | 简单快速，私有仓库也适用              |

> **推荐**：优先用 **GitHub Actions**，日志更清晰，出错更容易排查。若服务器无法被 GitHub 访问 8888 端口，改用 GitHub Actions 的 SSH 方案。

【云服务器】请在安全组放行 8888 端口
外网ipv4面板地址: https://47.116.6.132:8888/ab3fbd34
内网面板地址: https://172.24.11.217:8888/ab3fbd34
username: cda222c6
password: 83e1cc34
