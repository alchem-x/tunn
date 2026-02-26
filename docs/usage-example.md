# Tunn 使用示例

## 🎯 基本工作流程

### 1. 查看帮助

```bash
$ bunx tunn --help
```

输出：
```
Usage: tunn [options] [command]

HTTP tunnel service with centralized configuration

Options:
  -V, --version                     output the version number
  -h, --help                        display help for command

Commands:
  server [options]                  Start the tunnel server
  client <url>                      Connect a tunnel client to the server
  new|create [options] <id> <name>  Create a new tunnel configuration
  list|ls [options]                 List all tunnel configurations
  show|info <id>                    Show detailed information about a tunnel
  enable <id>                       Enable a tunnel
  disable <id>                      Disable a tunnel
  delete|rm [options] <id>          Delete a tunnel configuration
```

### 2. 创建隧道

```bash
$ bunx tunn new my-app "My Application" --port 3000 --server-port 8080
```

输出：
```
- Creating tunnel...
✔ Tunnel created successfully!

  Tunnel Details:
  ● ID:          my-app
  ● Name:        My Application
  ● Local:       localhost:3000
  ● Server Port: 8080
  ● Status:      Enabled

  Connection Command:
  $ bunx tunn client 'ws://localhost:7777/tunn?id=my-app'
```

### 3. 列出所有隧道

```bash
$ bunx tunn ls
```

输出：
```
- Loading tunnels...

  Tunnels (2)

STATUS ID              NAME                 LOCAL          SERVER PORT CREATED  
●      test-tunnel     Test Tunnel          localhost:3456 7321        2/26/2026
●      my-app          My Application       localhost:3000 8080        2/26/2026
```

### 4. 查看隧道详情

```bash
$ bunx tunn show my-app
```

输出：
```
- Loading tunnel...

  Tunnel: my-app

  Name:         My Application
  Status:       Enabled
  Local Host:   localhost
  Local Port:   3000
  Server Port:  8080
  Created:      2/26/2026, 3:38:27 PM
  Updated:      2/26/2026, 3:38:27 PM

  Connection:
  $ bunx tunn client 'ws://localhost:7777/tunn?id=my-app'

  Access URL:
  http://localhost:8080
```

### 5. 启动服务器

```bash
$ bunx tunn server
```

输出：
```
- Starting tunnel server...
✔ Tunnel server started successfully!

  Server Information:
  ● WebSocket: ws://0.0.0.0:7777/tunn?id=<tunnel-id>
  ● API:       http://0.0.0.0:7777/api/tunnels
  ● Data:      ~/.config/tunn/data

  Press Ctrl+C to stop
```

### 6. 连接客户端

```bash
$ bunx tunn client 'ws://localhost:7777/tunn?id=my-app'
```

输出：
```
- Fetching tunnel configuration for my-app...
✔ Tunnel client connected: my-app

  Tunnel Information:
  ● ID:     my-app
  ● Server: ws://localhost:7777/tunn?id=my-app

  Press Ctrl+C to disconnect
```

### 7. 管理隧道

#### 禁用隧道
```bash
$ bunx tunn disable my-app
```

输出：
```
- Disabling tunnel...
✔ Tunnel "my-app" disabled
```

#### 启用隧道
```bash
$ bunx tunn enable my-app
```

输出：
```
- Enabling tunnel...
✔ Tunnel "my-app" enabled
```

#### 删除隧道
```bash
$ bunx tunn delete my-app --force
```

输出：
```
- Deleting tunnel...
✔ Tunnel "my-app" deleted
```

## 🎨 高级示例

### 示例 1: 开发环境配置

```bash
# 创建前端隧道
bunx tunn new frontend "Frontend App" \
  --host localhost \
  --port 3000 \
  --server-port 8080

# 创建后端隧道
bunx tunn new backend "Backend API" \
  --host localhost \
  --port 4000 \
  --server-port 9090

# 查看所有配置
bunx tunn ls

# 启动服务器
bunx tunn server

# 在不同终端连接客户端
bunx tunn client 'ws://localhost:7777/tunn?id=frontend'
bunx tunn client 'ws://localhost:7777/tunn?id=backend'

# 访问应用
curl http://localhost:8080  # Frontend
curl http://localhost:9090  # Backend
```

### 示例 2: 临时共享

```bash
# 1. 快速创建
bunx tunn new demo "Demo" --port 3000 --server-port 8888

# 2. 一键启动（使用&&链接命令）
bunx tunn server &
sleep 3
bunx tunn client 'ws://localhost:7777/tunn?id=demo' &

# 3. 分享URL
echo "访问: http://localhost:8888"

# 4. 完成后清理
bunx tunn delete demo --force
```

### 示例 3: WebSocket应用

```bash
# 创建WebSocket隧道
bunx tunn new ws-app "WebSocket App" --port 3000 --server-port 8080

# 启动服务器和客户端
bunx tunn server &
bunx tunn client 'ws://localhost:7777/tunn?id=ws-app' &

# 测试WebSocket连接
# 在浏览器或代码中连接到 ws://localhost:8080
```

### 示例 4: SSE/流式应用

```bash
# 创建SSE隧道
bunx tunn new sse-app "SSE App" --port 3000 --server-port 8080

# 启动并连接
bunx tunn server &
bunx tunn client 'ws://localhost:7777/tunn?id=sse-app' &

# 测试SSE
curl -N http://localhost:8080/events
```

## 🔧 常见任务

### 快速查看状态

```bash
bunx tunn ls
```

### 查看隧道详情和连接命令

```bash
bunx tunn show <tunnel-id>
```

### 批量操作

```bash
# 禁用所有旧隧道
for id in $(bunx tunn ls | grep "old-" | awk '{print $2}'); do
  bunx tunn disable $id
done
```

### 备份和恢复

```bash
# 备份
cp ~/.config/tunn/data/db.yaml ~/.config/tunn/data/db.backup.yaml

# 恢复
cp ~/.config/tunn/data/db.backup.yaml ~/.config/tunn/data/db.yaml
```

## 📊 性能测试

```bash
# 创建测试隧道
bunx tunn new perf-test "Performance Test" --port 3000 --server-port 8080

# 启动
bunx tunn server &
bunx tunn client 'ws://localhost:7777/tunn?id=perf-test' &

# 并发测试
ab -n 1000 -c 10 http://localhost:8080/

# WebSocket测试
# 使用 ws 或其他 WebSocket 测试工具
```

## 💡 提示和技巧

### 1. 全局安装（可选）

```bash
# 全局安装后可省略 bunx
bun install -g tunn

# 然后直接使用
tunn ls
tunn new my-app "My App"
```

### 2. 查看日志

```bash
# 服务器调试模式
LOG_LEVEL=debug bunx tunn server

# 客户端调试模式
LOG_LEVEL=debug bunx tunn client <url>
```

### 3. 端口管理

```bash
# 查看所有使用的端口
bunx tunn ls | grep "SERVER PORT"

# 找到空闲端口
for port in {8080..8090}; do
  if ! bunx tunn ls | grep -q $port; then
    echo "Port $port is available"
    break
  fi
done
```

### 4. 快速重启

```bash
# 服务器
pkill -f "tunn.*server" && bunx tunn server

# 客户端
pkill -f "tunn.*client" && bunx tunn client <url>
```

## 🎊 结论

Tunn 现在拥有：
- ✅ 统一的CLI界面
- ✅ 美观的输出格式
- ✅ 完整的命令集
- ✅ 优雅的用户体验
- ✅ 专业级的工具质量

开始使用吧！🚀
