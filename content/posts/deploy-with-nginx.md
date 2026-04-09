---
title: 用 nginx 部署静态网站：从零到上线
date: 2025-03-25
tags:
  - 运维
  - nginx
  - 部署
excerpt: 购买了云服务器，然后呢？本文手把手讲解如何用 nginx 托管 Nuxt 静态博客，包括 HTTPS 配置和自动部署。
cover: ''
---

# 用 nginx 部署静态网站：从零到上线

购买了云服务器，拿到 IP 地址，接下来怎么把博客跑起来？这篇文章讲清楚每一步。

## 准备工作

- 一台云服务器（Ubuntu 22.04 推荐）
- 一个域名（可选，但推荐）
- 本地已安装 Node.js 22

## 第一步：本地构建静态文件

```bash
# 在项目根目录
npm run generate

# 构建完成后，静态文件在 .output/public/ 目录
ls .output/public/
```

`nuxt generate` 会把所有页面预渲染成 HTML 文件，不需要服务器运行 Node.js 进程。

## 第二步：上传文件到服务器

```bash
# 方法一：用 scp 上传（简单）
scp -r .output/public/ root@YOUR_SERVER_IP:/var/www/blog

# 方法二：用 rsync（增量同步，更快）
rsync -avz --delete .output/public/ root@YOUR_SERVER_IP:/var/www/blog/
```

## 第三步：安装 nginx

SSH 登录服务器后：

```bash
# 更新包列表
sudo apt update

# 安装 nginx
sudo apt install nginx -y

# 启动并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx

# 查看状态
sudo systemctl status nginx
```

## 第四步：配置 nginx

创建站点配置文件：

```bash
sudo nano /etc/nginx/sites-available/blog
```

填入以下内容：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # 替换成你的域名
    root /var/www/blog;
    index index.html;

    # 对于 SPA/SSG 站点，找不到文件时返回 index.html
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 开启 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/

# 测试配置语法
sudo nginx -t

# 重载 nginx
sudo systemctl reload nginx
```

此时访问你的服务器 IP 就能看到博客了！

## 第五步：配置 HTTPS（强烈推荐）

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 申请证书（替换成你的域名和邮箱）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com --email your@email.com --agree-tos
```

Certbot 会自动修改 nginx 配置，添加 HTTPS 并将 HTTP 重定向到 HTTPS。证书每 90 天自动续期。

## 自动化更新博客

每次写完新文章，只需要两步：

```bash
# 1. 在本地重新构建
npm run generate

# 2. 同步到服务器
rsync -avz --delete .output/public/ root@YOUR_SERVER_IP:/var/www/blog/
```

可以把这两个命令写成一个脚本 `deploy.sh`：

```bash
#!/bin/bash
set -e

echo "🔨 构建静态文件..."
npm run generate

echo "🚀 上传到服务器..."
rsync -avz --delete .output/public/ root@YOUR_SERVER_IP:/var/www/blog/

echo "✅ 部署完成！"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

## 常见问题

**问：页面刷新后 404？**

检查 nginx 配置中 `try_files $uri $uri/ $uri.html /index.html;` 是否正确。

**问：CSS/JS 加载了旧版本？**

Nuxt 构建的资源文件名包含 hash（如 `_nuxt/entry.abc123.js`），浏览器缓存不会出问题。如果看到旧内容，按 `Ctrl+Shift+R` 强制刷新。

**问：图片不显示？**

确保图片放在 `public/images/` 目录下，并且通过 `/images/xxx.jpg` 路径引用。

至此，你的博客已经正式上线了 🎉
