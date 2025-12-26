# 即梦API镜像加速配置指南

## 📖 概述

本项目支持通过环境变量配置镜像URL来加速API访问，有效解决网络延迟和连接问题。支持美国、香港/新加坡/日本、中国三个主要区域的所有API端点。

## 🚀 支持的镜像端点

### 美国区域 (US)
- `DREAMINA_US_MIRROR` - Dreamina API主站
  - 原始地址: `https://dreamina-api.us.capcut.com`
- `IMAGEX_US_MIRROR` - ImageX图片服务
  - 原始地址: `https://imagex16-normal-us-ttp.capcutapi.us`
- `COMMERCE_US_MIRROR` - 商业服务
  - 原始地址: `https://commerce.us.capcut.com`

### 香港/新加坡/日本区域 (HK/JP/SG)
- `DREAMINA_HK_MIRROR` - Dreamina API
  - 原始地址: `https://mweb-api-sg.capcut.com`
- `IMAGEX_HK_MIRROR` - ImageX图片服务
  - 原始地址: `https://imagex-normal-sg.capcutapi.com`
- `COMMERCE_HK_MIRROR` - 商业服务
  - 原始地址: `https://commerce-api-sg.capcut.com`
- `DREAMINA_HK_API_MIRROR` - Dreamina API备用配置
  - 原始地址: `https://mweb-api-sg.capcut.com`

### 中国区域 (CN)
- `JIMENG_CN_MIRROR` - 即梦主站
  - 原始地址: `https://jimeng.jianying.com`
- `IMAGEX_CN_MIRROR` - ImageX图片服务
  - 原始地址: `https://imagex.bytedanceapi.com`

## 🛠️ 配置方法

### 1. 基础配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
nano .env
```

### 2. 环境变量配置示例

```bash
# 使用国内CDN加速
DREAMINA_US_MIRROR=https://cdn.example.com/dreamina-us
IMAGEX_US_MIRROR=https://cdn.example.com/imagex-us
DREAMINA_HK_MIRROR=https://cdn.example.com/dreamina-hk
IMAGEX_HK_MIRROR=https://cdn.example.com/imagex-hk
JIMENG_CN_MIRROR=https://cdn.example.com/jimeng-cn
IMAGEX_CN_MIRROR=https://cdn.example.com/imagex-cn
```

### 3. Docker 配置

```yaml
# docker-compose.yml
version: '3.8'
services:
  jimeng-api:
    image: ghcr.io/iptag/jimeng-api:latest
    environment:
      - DREAMINA_US_MIRROR=https://your-mirror.com/dreamina-us
      - IMAGEX_US_MIRROR=https://your-mirror.com/imagex-us
      - DREAMINA_HK_MIRROR=https://your-mirror.com/dreamina-hk
      - IMAGEX_HK_MIRROR=https://your-mirror.com/imagex-hk
    ports:
      - "7860:7860"
```

```bash
# Docker run 命令
docker run -d \
  --name jimeng-api \
  -p 7860:7860 \
  -e DREAMINA_US_MIRROR=https://your-mirror.com/dreamina-us \
  -e IMAGEX_US_MIRROR=https://your-mirror.com/imagex-us \
  ghcr.io/iptag/jimeng-api:latest
```

## 📊 监控和验证

### 启动日志
服务启动时会显示已配置的镜像：

```
🚀 已启用 4 个镜像加速配置:
  - DREAMINA_US_MIRROR: https://your-mirror.com/dreamina-us
  - IMAGEX_US_MIRROR: https://your-mirror.com/imagex-us
  - DREAMINA_HK_MIRROR: https://your-mirror.com/dreamina-hk
  - IMAGEX_HK_MIRROR: https://your-mirror.com/imagex-hk
```

### 测试镜像配置
```bash
# 测试美国区域API
curl -X POST http://localhost:7860/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test",
    "model": "jimeng-4.5",
    "token": "your_token"
  }'

# 查看日志确认使用了镜像URL
```

## 🔧 镜像服务要求

### 技术要求
- **协议**: 必须支持 HTTPS
- **接口**: 保持与原始API完全兼容
- **SSL**: 有效的SSL证书
- **响应时间**: 建议低于500ms

### 稳定性要求
- **可用性**: 99.5%以上
- **数据一致性**: 与原始API保持一致
- **错误处理**: 正确转发HTTP状态码和错误信息

## 🌐 推荐镜像服务商

### 国内CDN服务
- **阿里云CDN**
- **腾讯云CDN**
- **华为云CDN**
- **百度智能云CDN**

### 海外反向代理
- **Cloudflare Workers**
- **Vercel Edge Functions**
- **Netlify Edge Functions**
- **AWS CloudFront**

## 📝 配置最佳实践

### 1. 分区域配置
根据用户地理位置配置不同镜像：
```bash
# 针对国内用户
JIMENG_CN_MIRROR=https://cdn1.example.com/jimeng-cn
IMAGEX_CN_MIRROR=https://cdn1.example.com/imagex-cn

# 针对海外用户
DREAMINA_US_MIRROR=https://cdn2.example.com/dreamina-us
IMAGEX_US_MIRROR=https://cdn2.example.com/imagex-us
```

### 2. 健康检查
定期检查镜像服务可用性：
```bash
# 健康检查脚本
#!/bin/bash
MIRROR_URL="https://your-mirror.com/dreamina-us"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $MIRROR_URL/health)
if [ $RESPONSE -eq 200 ]; then
    echo "Mirror is healthy"
else
    echo "Mirror is down, switching to backup"
fi
```

### 3. 负载均衡
配置多个镜像实现负载均衡：
```bash
# 主镜像
DREAMINA_US_MIRROR=https://mirror1.example.com/dreamina-us

# 备用镜像（手动切换）
# DREAMINA_US_MIRROR=https://mirror2.example.com/dreamina-us
```

## ⚠️ 注意事项

1. **安全性**: 确保镜像服务不会记录或泄露敏感数据
2. **合规性**: 遵守当地法律法规和服务条款
3. **成本**: 监控CDN流量成本，合理配置缓存策略
4. **维护**: 定期更新镜像服务配置，保持与官方API同步

## 🔍 故障排除

### 常见问题

**Q: 镜像配置后仍然访问原始URL**
A: 检查环境变量是否正确设置，重启服务使配置生效

**Q: 镜像服务返回502错误**
A: 验证镜像服务配置，检查SSL证书和域名解析

**Q: 图片上传失败**
A: 确认IMAGEX镜像配置正确，检查跨域设置

### 调试模式
启用详细日志：
```bash
DEBUG=true npm start
```

查看网络请求：
```bash
# 监控网络请求
tcpdump -i eth0 host your-mirror.com
```

## 📚 参考资源

- [即梦API文档](https://github.com/iptag/jimeng-api)
- [Docker部署指南](./README.CN.md#docker部署)
- [环境变量配置](./.env.example)

---

如有问题，请提交 [Issue](https://github.com/iptag/jimeng-api/issues) 或联系维护者。