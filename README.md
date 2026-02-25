# tunn

基于 WebSocket 的 HTTP 隧道服务，允许将本地服务通过远程服务器暴露。

## 架构

```
┌─────────────┐     WebSocket      ┌─────────────┐     HTTP      ┌─────────────┐
│   外部请求   │ ─────────────────►│   Server    │──────────────►│   Client    │
│             │   端口: serverPort │             │               │             │
└─────────────┘                    └─────────────┘               └─────────────┘
                                                                              │
                                                                              ▼
                                                                       ┌─────────────┐
                                                                       │  本地服务   │
                                                                       │ localhost:  │
                                                                       │  LOCAL_PORT │
                                                                       └─────────────┘
```

## 工作流程

1. **Server** 在指定端口启动 WebSocket 服务器，监听客户端连接
2. **Client** 连接到 Server，指定 `serverPort`（对外暴露的端口）和 `LOCAL_PORT`（本地服务端口）
3. Server 根据 `serverPort` 动态启动 HTTP 服务器接收外部请求
4. 外部请求通过 WebSocket 转发给 Client，Client 再转发给本地服务
5. 响应按原路径返回

## 使用

### Server

```bash
bun run ./src/server.ts
```

环境变量：

- `SERVER_BIND_PORT` - WebSocket 监听端口（默认 7777）
- `SERVER_HOST` - 监听地址（默认 localhost）

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
