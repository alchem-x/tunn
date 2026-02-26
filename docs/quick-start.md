# Tunn 快速开始指南

欢迎使用 Tunn！这是一个基于 WebSocket 的 HTTP 隧道服务，配置集中管理，使用简单。

## 📦 前置要求

- [Bun](https://bun.sh/) JavaScript 运行时

## 🚀 5分钟快速开始

### 1. 创建第一个隧道

```bash
bunx tunn new my-app "My Application" --port 3000 --server-port 8080
```

你会看到：
```
✔ Tunnel created successfully!

  Tunnel Details:
  ● ID:          my-app
  ● Name:        My Application
  ● Local:       localhost:3000
  ● Server Port: 8080
  ● Status:      Enabled
```

### 2. 启动服务器

```bash
bunx tunn server
```

服务器将在以下端口启动：
- WebSocket: `ws://0.0.0.0:7777/tunn`
- API: `http://0.0.0.0:7777/api/tunnels`

### 3. 启动你的本地应用

在另一个终端启动你的应用（假设在3000端口）：
```bash
# 示例：启动一个Node.js应用
npm run dev
```

### 4. 连接隧道客户端

在第三个终端连接客户端：
```bash
bunx tunn client 'ws://localhost:7777/tunn?id=my-app'
```

### 5. 访问你的应用

现在可以通过隧道访问你的应用了：
```bash
curl http://localhost:8080
```

或在浏览器中打开：`http://localhost:8080`

## 📝 常用命令

### 管理隧道

```bash
# 列出所有隧道
bunx tunn ls

# 查看隧道详情
bunx tunn show my-app

# 启用隧道
bunx tunn enable my-app

# 禁用隧道
bunx tunn disable my-app

# 删除隧道
bunx tunn delete my-app --force
```

### 服务器选项

```bash
# 自定义端口
bunx tunn server --port 7777

# 绑定到特定地址
bunx tunn server --host 127.0.0.1
```

### 创建隧道选项

```bash
# 完整示例
bunx tunn new \
  web-app \
  "My Web App" \
  --host localhost \
  --port 3000 \
  --server-port 8080

# 创建为禁用状态
bunx tunn new api "API Server" --disabled
```

## 🎯 使用场景

### 场景 1: 本地开发测试

```bash
# 1. 创建隧道
bunx tunn new local-dev "Local Development" --port 3000 --server-port 8080

# 2. 启动服务器
bunx tunn server

# 3. 启动开发服务器
npm run dev

# 4. 连接客户端
bunx tunn client 'ws://localhost:7777/tunn?id=local-dev'

# 5. 测试
curl http://localhost:8080/api/test
```

### 场景 2: 多个项目同时开发

```bash
# 创建多个隧道
bunx tunn new frontend "Frontend" --port 3000 --server-port 8080
bunx tunn new backend "Backend" --port 4000 --server-port 9090
bunx tunn new api "API" --port 5000 --server-port 9091

# 启动服务器（一次）
bunx tunn server

# 在不同终端连接客户端
bunx tunn client 'ws://localhost:7777/tunn?id=frontend'
bunx tunn client 'ws://localhost:7777/tunn?id=backend'
bunx tunn client 'ws://localhost:7777/tunn?id=api'
```

### 场景 3: 临时共享本地服务

```bash
# 1. 创建临时隧道
bunx tunn new demo "Demo App" --port 3000 --server-port 8888

# 2. 启动和连接
bunx tunn server &
bunx tunn client 'ws://localhost:7777/tunn?id=demo' &

# 3. 分享访问地址
echo "Visit: http://localhost:8888"

# 4. 完成后清理
bunx tunn delete demo --force
```

## 🔧 故障排除

### 问题：端口已被占用

```bash
# 查看隧道列表，检查端口冲突
bunx tunn ls

# 使用不同的端口
bunx tunn new my-app "My App" --server-port 9999
```

### 问题：客户端连接失败

```bash
# 1. 确认服务器正在运行
curl http://localhost:7777/api/tunnels

# 2. 检查隧道配置
bunx tunn show my-app

# 3. 确认隧道已启用
bunx tunn enable my-app
```

### 问题：无法访问本地服务

```bash
# 1. 确认本地服务正在运行
curl http://localhost:3000

# 2. 检查隧道配置的端口是否正确
bunx tunn show my-app

# 3. 重新创建隧道
bunx tunn delete my-app --force
bunx tunn new my-app "My App" --port 3000 --server-port 8080
```

## 🛠️ 本地开发

如果你克隆了代码仓库进行开发：

```bash
# 安装依赖
bun install

# 在 .env 中设置本地数据目录
echo "DATA_DIR=./data" > .env

# 使用本地命令
./bin/tunn new my-app "My App"
./bin/tunn server
./bin/tunn client 'ws://localhost:7777/tunn?id=my-app'
```

## 💡 提示

1. 使用 `bunx tunn --help` 查看所有命令
2. 使用 `bunx tunn <command> --help` 查看命令详情
3. 数据存储在 `~/.config/tunn/data/db.yaml`，可以手动编辑
4. 日志级别可通过环境变量 `LOG_LEVEL` 设置
5. 数据目录可通过环境变量 `DATA_DIR` 自定义

## 🎉 开始使用

现在你已经准备好使用 Tunn 了！试试创建你的第一个隧道吧：

```bash
bunx tunn new my-first-tunnel "My First Tunnel" --port 3000 --server-port 8080
```

祝你使用愉快！🚀
