#!/usr/bin/env bash
# @author: zhjj

set -euo pipefail

APP_NAME="${APP_NAME:-canvas-vue-sql-lab}"
IMAGE_NAME="${IMAGE_NAME:-canvas-vue-sql-lab:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-canvas-vue-sql-lab}"
HOST_PORT="${HOST_PORT:-3210}"
ARCHIVE_NAME="${ARCHIVE_NAME:-dist.zip}"
WORK_ROOT="${WORK_ROOT:-/opt/${APP_NAME}}"
RELEASE_DIR="${WORK_ROOT}/release"
BUILD_DIR="${WORK_ROOT}/build"
DIST_DIR="${BUILD_DIR}/dist"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_PATH="${SCRIPT_DIR}/${ARCHIVE_NAME}"

log() {
  printf '[deploy] %s\n' "$1"
}

fail() {
  printf '[deploy][error] %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令: $1"
}

require_cmd docker
require_cmd unzip

[ -f "${ARCHIVE_PATH}" ] || fail "未找到压缩包: ${ARCHIVE_PATH}"

log "准备目录: ${WORK_ROOT}"
mkdir -p "${RELEASE_DIR}" "${BUILD_DIR}"
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  log "发现旧容器 ${CONTAINER_NAME}，停止并删除"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

if docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
  log "发现旧镜像 ${IMAGE_NAME}，删除后重建"
  docker rmi -f "${IMAGE_NAME}" >/dev/null
fi

log "解压 ${ARCHIVE_NAME}"
unzip -oq "${ARCHIVE_PATH}" -d "${DIST_DIR}"

if [ -f "${DIST_DIR}/dist/index.html" ] && [ ! -f "${DIST_DIR}/index.html" ]; then
  log "检测到压缩包外层包含 dist 目录，调整解压结果"
  rm -rf "${DIST_DIR}/__dist_tmp__"
  mv "${DIST_DIR}/dist" "${DIST_DIR}/__dist_tmp__"
  find "${DIST_DIR}" -mindepth 1 -maxdepth 1 ! -name "__dist_tmp__" -exec rm -rf {} +
  mv "${DIST_DIR}/__dist_tmp__"/* "${DIST_DIR}/"
  rmdir "${DIST_DIR}/__dist_tmp__"
fi

if [ ! -f "${DIST_DIR}/index.html" ]; then
  fail "解压后未找到 ${DIST_DIR}/index.html，请确认压缩包内容包含 dist/index.html 或直接包含 index.html"
fi

cat > "${BUILD_DIR}/Dockerfile" <<'EOF'
FROM nginx:latest
COPY dist/ /usr/share/nginx/html/
EOF

log "构建镜像 ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" "${BUILD_DIR}"

log "启动容器 ${CONTAINER_NAME}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${HOST_PORT}:80" \
  "${IMAGE_NAME}" >/dev/null

log "部署完成"
log "访问地址: http://<server-ip>:${HOST_PORT}/"
