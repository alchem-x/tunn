# tunn

基于 WebSocket 的 HTTP 隧道服务。

## 架构

外部请求 → Server (SERVER_PORT) → Client (WebSocket) → 本地服务 (LOCAL_PORT)

## 使用

### Server

```bash
bun run ./src/server.ts
```

环境变量：

```bash
SERVER_BIND_PORT=7777       # 穿透服务端口（WebSocket，默认 7777）
SERVER_BIND_HOST=0.0.0.0    # 服务绑定地址（默认 localhost）
```

### Client

```bash
bun run ./src/client.ts
```

环境变量：

```bash
LOCAL_HOST=localhost        # 本地服务地址
LOCAL_PORT=3000             # 本地服务端口
SERVER_PORT=7321            # 穿透暴露的端口
SERVER_HOST=localhost       # 穿透服务地址
SERVER_BIND_PORT=7777       # 穿透服务端口
```

## 测试

```bash
bun test
```
