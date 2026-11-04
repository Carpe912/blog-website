#!/usr/bin/env bash
#
# 服务器端一键部署脚本
#
# 用途：GitHub Actions 推送后自动部署，或 SSH 上去手动执行，两条路径共用同一套逻辑。
# 设计要点：
#   1. 自动切到部署用户（node / pm2 只装在 admin 名下，root 环境里没有）
#   2. 加文件锁，手动部署与自动部署并发时排队，不会互相清空 node_modules
#   3. 不使用 git reset --hard，服务器上的本地改动不会被抹掉
#   4. 依赖只在 package-lock 变化或缺失时重装，不再每次 rm -rf
#   5. 前端构建失败自动回滚上一版 .output，构建失败不重启进程
#
# 用法：
#   bash scripts/deploy.sh              # 正常部署
#   PROJECT_DIR=/xxx bash scripts/deploy.sh
#
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/www/wwwroot/blog-website}"
DEPLOY_USER="${DEPLOY_USER:-admin}"
NODE_VERSION="${NODE_VERSION:-v22.22.2}"
LOCK_FILE="${LOCK_FILE:-$PROJECT_DIR/.deploy.lock}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/blog-frontend-output.bak}"

log() { echo "[$(date '+%F %T')] $*"; }

# 脚本自身绝对路径：切用户后仍能用同一路径重新执行
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

# ── 1. 必须在部署用户名下执行（root 没有 node / pm2）──────────────────────
if [ "$(id -un)" != "$DEPLOY_USER" ]; then
  log "切换到用户 $DEPLOY_USER 执行"
  exec su - "$DEPLOY_USER" -c \
    "PROJECT_DIR='$PROJECT_DIR' DEPLOY_USER='$DEPLOY_USER' NODE_VERSION='$NODE_VERSION' LOCK_FILE='$LOCK_FILE' BACKUP_DIR='$BACKUP_DIR' bash '$SCRIPT_PATH'"
fi

# ── 2. 环境变量：nvm 是非交互 shell，必须手动加载 ─────────────────────────
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/.nvm/versions/node/$NODE_VERSION/bin:$PATH"

if ! command -v node >/dev/null 2>&1 || ! command -v pm2 >/dev/null 2>&1; then
  log "找不到 node / pm2，请检查 $NODE_VERSION 是否已安装"
  exit 1
fi

cd "$PROJECT_DIR"

# ── 3. 串行化：手动部署和自动部署不能同时跑 ──────────────────────────────
exec 9>"$LOCK_FILE"
if ! flock -w 900 9; then
  log "等待部署锁超时（另一个部署仍在执行）"
  exit 1
fi
log "===== 开始部署 $(git rev-parse --short HEAD) ====="

# ── 4. 拉取代码（只用快进合并，避免覆盖服务器上的本地改动）──────────────
log "拉取代码"
if ! git pull --ff-only origin main; then
  log "快进合并失败，服务器工作区可能有本地改动："
  git status --short || true
  log "请先处理这些改动再部署（脚本不会执行 git reset --hard）"
  exit 1
fi

# ── 5. 依赖：只有 lockfile 变化或依赖缺失才重装 ──────────────────────────
LOCK_HASH_FILE="$PROJECT_DIR/node_modules/.deploy-lock-hash"
CURRENT_HASH="$(cat package.json package-lock.json | sha256sum | cut -d' ' -f1)"
if [ ! -d node_modules ] || [ ! -f "$LOCK_HASH_FILE" ] \
   || [ "$(cat "$LOCK_HASH_FILE" 2>/dev/null)" != "$CURRENT_HASH" ]; then
  log "安装依赖（package-lock 有变化或依赖缺失）"
  npm install --no-audit --no-fund
  echo "$CURRENT_HASH" > "$LOCK_HASH_FILE"
else
  log "依赖未变化，跳过安装"
fi

# ── 6. 数据库 ────────────────────────────────────────────────────────────
log "生成 Prisma Client"
(cd backend && npx prisma generate)

log "执行数据库迁移"
(cd backend && npx prisma migrate deploy)

# ── 7. 构建后端 ──────────────────────────────────────────────────────────
log "构建后端"
NODE_OPTIONS=--max-old-space-size=1000 npm run build:backend

# ── 8. 构建前端（失败回滚产物，不重启进程）───────────────────────────────
log "构建前端"
rm -rf "$BACKUP_DIR"
cp -a frontend/.output "$BACKUP_DIR" 2>/dev/null || log "没有可备份的旧产物，跳过备份"

if ! NODE_OPTIONS=--max-old-space-size=2048 npm run build:frontend; then
  log "前端构建失败，回滚到上一版产物"
  rm -rf frontend/.output
  [ -d "$BACKUP_DIR" ] && cp -a "$BACKUP_DIR" frontend/.output
  exit 1
fi

if [ ! -f frontend/.output/server/index.mjs ]; then
  log "前端产物不完整（缺少 server/index.mjs），回滚"
  rm -rf frontend/.output
  [ -d "$BACKUP_DIR" ] && cp -a "$BACKUP_DIR" frontend/.output
  exit 1
fi

# ── 9. 重启进程（进程不存在时自动创建）───────────────────────────────────
restart_or_start() {
  local name="$1" entry="$2" dir="$3"
  if pm2 describe "$name" >/dev/null 2>&1; then
    pm2 restart "$name" --update-env
  else
    (cd "$dir" && pm2 start "$entry" --name "$name")
  fi
}

log "重启进程"
restart_or_start blog-backend dist/main.js backend
restart_or_start blog-frontend .output/server/index.mjs frontend
pm2 save

# ── 10. 健康检查 ─────────────────────────────────────────────────────────
log "健康检查"
code=""
for _ in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:3000/ || true)"
  [ "$code" = "200" ] && break
  sleep 3
done

if [ "$code" != "200" ]; then
  log "前端健康检查失败（HTTP ${code:-无响应}），请查看 pm2 logs blog-frontend"
  exit 1
fi

log "===== 部署完成 $(git rev-parse --short HEAD) ====="
