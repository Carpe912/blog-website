#!/usr/bin/env bash
set -euo pipefail

script_path="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
project_dir="$(dirname "$(dirname "$script_path")")"
deploy_user="${DEPLOY_USER:-admin}"
node_version="${NODE_VERSION:-v22.22.2}"

if [ "$(id -un)" != "$deploy_user" ]; then
  printf -v sync_command 'DEPLOY_USER=%q NODE_VERSION=%q bash %q' "$deploy_user" "$node_version" "$script_path"
  exec su - "$deploy_user" -c "$sync_command"
fi

export PATH="$HOME/.nvm/versions/node/$node_version/bin:$PATH"

if ! pm2 describe blog-mcp >/dev/null 2>&1; then
  # 部分机器最初通过 root 的 PM2 启动博客工具。
  if [ "$deploy_user" != root ] && sudo -n -H env PATH="$PATH" pm2 describe blog-mcp >/dev/null 2>&1; then
    exec sudo -n -H env PATH="$PATH" DEPLOY_USER=root NODE_VERSION="$node_version" bash "$script_path"
  fi
  if [ -f "$project_dir/mcp-server/index.mjs" ]; then
    echo "存在博客 MCP 运行文件，但部署账号和可访问的管理账号下没有 blog-mcp 进程"
  else
    echo "此服务器未找到博客 MCP 运行目录"
  fi
  if command -v ss >/dev/null 2>&1 && [ -n "$(ss -H -ltn 'sport = :3010')" ]; then
    echo "本机 3010 端口仍有服务监听"
  fi
  exit 0
fi

# 现有运行目录由 PM2 使用。Git 中的源文件单独存放，避免覆盖服务器尚未纳入版本控制的目录。
source_file="$project_dir/integrations/blog-mcp/index.mjs"
runtime_file="$project_dir/mcp-server/index.mjs"
if [ ! -f "$runtime_file" ]; then
  echo "找不到博客 MCP 入口：$runtime_file" >&2
  exit 1
fi
if cmp -s "$source_file" "$runtime_file"; then exit 0; fi

node --check "$source_file"
cp -p "$runtime_file" "$runtime_file.previous"
install -m 0644 "$source_file" "$runtime_file.next"
mv "$runtime_file.next" "$runtime_file"
if ! pm2 restart blog-mcp; then
  cp -p "$runtime_file.previous" "$runtime_file"
  pm2 restart blog-mcp || true
  exit 1
fi
