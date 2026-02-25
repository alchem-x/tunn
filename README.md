# tunn

基于 WebSocket 的 HTTP 隧道服务。

## 架构

外部请求 → Server (serverPort) → Client (WebSocket) → 本地服务 (LOCAL_PORT)

## 使用

### Server

```bash
bun run ./src/server.ts
```

环境变量：`SERVER_BIND_PORT` - WebSocket 监听端口（默认 7777）

### Client

```bash
SERVER_HOST=localhost SERVER_BIND_PORT=7777 SERVER_PORT=3721 LOCAL_HOST=localhost LOCAL_PORT=3000 bun run ./src/client.ts
```

环境变量：

- `SERVER_HOST` - Server 地址
- `SERVER_BIND_PORT` - Server WebSocket 端口
- `SERVER_PORT` - 对外暴露的端口
- `LOCAL_HOST` - 本地服务地址
- `LOCAL_PORT` - 本地服务端口

## 测试

```bash
bun test
```
