# tunn

HTTP Tunnel via WebSocket

## 特性

- ✅ HTTP/HTTPS、WebSocket、SSE、流式响应
- ✅ 自动重连、并发处理、大文件传输（最大 100MB）
- ✅ 集中式配置管理 + RESTful API
- ✅ 优雅的 CLI 界面

## 安装

需要安装 [Bun](https://bun.sh/) 运行环境。

```bash
# 使用 bunx（推荐，无需安装）
bunx tunn --help

# 或全局安装
bun install -g tunn
tunn --help
```

## 快速开始

### 1. 创建隧道配置

```bash
bunx tunn new my-app "My Application" --port 3000 --server-port 8080
```

### 2. 启动服务器

```bash
bunx tunn server
```

### 3. 连接客户端

```bash
bunx tunn client 'ws://localhost:7777/tunn?id=my-app'
```

### 4. 访问应用

```bash
curl http://localhost:8080
```

## 常用命令

```bash
# 创建隧道
bunx tunn new my-app "My App" --port 3000 --server-port 8080

# 启动服务器
bunx tunn server

# 连接客户端
bunx tunn client 'ws://localhost:7777/tunn?id=my-app'

# 管理隧道
bunx tunn ls              # 列出所有隧道
bunx tunn show my-app     # 查看详情
bunx tunn enable my-app   # 启用
bunx tunn disable my-app  # 禁用
bunx tunn delete my-app --force  # 删除

# 查看帮助
bunx tunn --help
```

## 配置

隧道配置默认存储在 `~/.config/tunn/data/db.yaml`，通过 CLI 管理。可选环境变量：

```bash
# 服务器
SERVER_BIND_PORT=7777            # 服务器端口（WebSocket + API）
SERVER_BIND_HOST=localhost       # 绑定地址
DATA_DIR=~/.config/tunn/data     # 数据目录（默认：~/.config/tunn/data）

# 性能（可选）
REQUEST_TIMEOUT=30000       # 请求超时，毫秒
MAX_BODY_SIZE=104857600     # 最大请求体，字节（100MB）
LOG_LEVEL=info              # 日志级别：debug/info/warn/error
```

## API

Base URL: `http://localhost:7777`

```bash
GET    /api/tunnels      # 获取所有隧道
GET    /api/tunnels/:id  # 获取单个隧道
POST   /api/tunnels      # 创建隧道
PUT    /api/tunnels/:id  # 更新隧道
DELETE /api/tunnels/:id  # 删除隧道
```

## 开发

```bash
bun install  # 安装依赖
bun test     # 运行测试
```

**技术栈**: Bun + TypeScript + Hono + lowdb + Commander

## 许可证

MIT
