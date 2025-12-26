# 代理服务器配置指南

本项目支持通过代理服务器访问上游API，适用于需要通���代理访问即梦服务的场景。

## 配置方式

### 1. 配置文件方式

编辑 `configs/{env}/system.yml` 文件（env为dev或prod）：

```yaml
# 代理服务器配置
proxy:
  # 是否启用代理
  enabled: true
  # 代理服务器地址
  host: "127.0.0.1"
  # 代理服务器端口
  port: 7890
  # 代理类型：http, https, socks5
  type: "http"
  # 代理认���（可选）
  auth:
    username: "your_username"
    password: "your_password"
  # 不使用代理的域名列表（支持通配符）
  bypass: ["localhost", "127.0.0.1", "*.local"]
  # 代理连接超时时间（毫秒）
  timeout: 10000
```

### 2. API动态配置

#### 获取当前代理配置

```bash
curl -X GET http://localhost:5100/proxy/config
```

#### 更新代理配置

```bash
curl -X POST http://localhost:5100/proxy/config \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "host": "127.0.0.1",
    "port": 7890,
    "type": "http",
    "auth": {
      "username": "your_username",
      "password": "your_password"
    },
    "bypass": ["localhost", "127.0.0.1", "*.local"],
    "timeout": 10000
  }'
```

#### 快速启用/禁用代理

```bash
# 启用代理
curl -X POST http://localhost:5100/proxy/enable \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# 禁用代理
curl -X POST http://localhost:5100/proxy/enable \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

#### 测试代理连接

```bash
curl -X POST http://localhost:5100/proxy/test \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://httpbin.org/ip"
  }'
```

## 常见代理软件配置示例

### Clash

```yaml
# config.yml
port: 7890
socks-port: 7891
# 其他配置...
```

代理设置：
- host: 127.0.0.1
- port: 7890
- type: http

### V2Ray

```json
{
  "inbounds": [{
    "port": 1080,
    "protocol": "socks5",
    "sniffing": {
      "enabled": true,
      "destOverride": ["http", "tls"]
    }
  }],
  # 其他配置...
}
```

代理设置：
- host: 127.0.0.1
- port: 1080
- type: socks5

### Shadowsocks

```bash
# 启动本地SOCKS5代理
ss-local -s server_ip -p server_port -l 1080 -k password -m aes-256-gcm
```

代理设置：
- host: 127.0.0.1
- port: 1080
- type: socks5

## 注意事项

1. **代理类型支持**
   - `http`: HTTP代理
   - `https`: HTTPS代理
   - `socks5`: SOCKS5代理

2. **认证方式**
   - 支持用户名/密码认证
   - 密码在API返回中会被隐藏为 `***`

3. **绕过列表**
   - 支持通配符匹配（如 `*.local`）
   - 匹配域名的请求将不使用代理

4. **性能影响**
   - 使用代理会增加请求延迟
   - 建议根据网络情况调整超时时间

5. **日志记录**
   - 所有通过代理的请求都会在日志中标记
   - 代理连接失败会记录错误日志

## 故障排查

### 代理连接失败

1. 检查代理服务器是否正常运行
2. 验证代理地址和端口是否正确
3. 确认认证信息（用户名/密码）是否正确
4. 使用测试API验证代理连接

### 特定网站无法访问

1. 将网站域名添加到绕过列表
2. 检查代��服务器是否允许访问该网站
3. 尝试使用不同的代理类型

### 性能问题

1. 增加代理超时时间
2. 选择距离更近的代理服务器
3. 考虑使用HTTP代理代替SOCKS5代理以获得更好的性能