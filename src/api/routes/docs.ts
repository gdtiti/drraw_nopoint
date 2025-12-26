import swaggerSpec from '@/lib/swagger-config.ts';
import logger from '@/lib/logger.ts';
import Response from '@/lib/response/Response.ts';

// 导入 swagger-ui-dist 的静态文件
import swaggerUiDist from 'swagger-ui-dist';

/**
 * 生成 Swagger UI HTML 页面
 */
function generateSwaggerUiHtml(specUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>即梦 API - 在线文档</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.31.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin: 0;
      background: #fafafa;
    }
    .swagger-ui .topbar {
      background-color: #1a1a1a;
      border-bottom: 1px solid #000;
    }
    .swagger-ui .topbar .download-url-wrapper .download-url-button {
      background: #4CAF50;
      color: white;
      border: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .swagger-ui .topbar .download-url-wrapper .download-url-button:hover {
      background: #45a049;
    }
    .custom-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    .custom-header h1 {
      margin: 0;
      font-size: 2.5em;
      font-weight: 300;
    }
    .custom-header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 1.1em;
    }
    .api-info {
      max-width: 1200px;
      margin: 0 auto 20px;
      padding: 0 20px;
    }
    .api-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 15px;
    }
    .api-info-card {
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .api-info-card h3 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 1.1em;
    }
    .api-info-card p {
      margin: 0;
      color: #666;
      font-size: 0.9em;
      line-height: 1.4;
    }
    .api-info-card .endpoint {
      font-family: monospace;
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      color: #e91e63;
    }
  </style>
</head>
<body>
  <div class="custom-header">
    <h1>即梦 API 文档</h1>
    <p>免费的 AI 图像和视频生成 API 服务 - 基于即梦AI的逆向工程实现</p>
  </div>

  <div class="api-info">
    <div class="api-info-grid">
      <div class="api-info-card">
        <h3>🎨 图像生成</h3>
        <p>文本生成图像：<span class="endpoint">POST /v1/images/generations</span></p>
        <p>图像合成：<span class="endpoint">POST /v1/images/compositions</span></p>
      </div>
      <div class="api-info-card">
        <h3>🎬 视频生成</h3>
        <p>图像生成视频：<span class="endpoint">POST /v1/videos/generations</span></p>
      </div>
      <div class="api-info-card">
        <h3>💬 智能对话</h3>
        <p>兼容OpenAI格式：<span class="endpoint">POST /v1/chat/completions</span></p>
      </div>
      <div class="api-info-card">
        <h3>🔄 异步处理</h3>
        <p>异步任务提交：<span class="endpoint">/v1/async/*</span></p>
        <p>支持进度查询和批量操作</p>
      </div>
      <div class="api-info-card">
        <h3>📊 系统信息</h3>
        <p>健康检查：<span class="endpoint">GET /ping</span></p>
        <p>使用统计：<span class="endpoint">GET /usage</span></p>
        <p>模型列表：<span class="endpoint">GET /v1/models</span></p>
      </div>
      <div class="api-info-card">
        <h3>🔑 认证管理</h3>
        <p>刷新令牌：<span class="endpoint">POST /token</span></p>
        <p>所有API需要Bearer Token认证</p>
      </div>
    </div>
  </div>

  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.31.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.31.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        filter: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        onComplete: function() {
          console.log("Swagger UI 加载完成");
        },
        docExpansion: "list",
        operationsSorter: function(a, b) {
          const methodsOrder = ['get', 'post', 'put', 'delete', 'patch'];
          const aMethod = a.get("method");
          const bMethod = b.get("method");
          const aIndex = methodsOrder.indexOf(aMethod);
          const bIndex = methodsOrder.indexOf(bMethod);

          if (aIndex === bIndex) {
            return a.get("path").localeCompare(b.get("path"));
          }
          return aIndex - bIndex;
        },
        tagsSorter: function(a, b) {
          const tagsOrder = [
            'System', 'Health', 'Models', 'Token', 'Usage', 'Proxy',
            'Images', 'Videos', 'Chat', 'Async'
          ];
          const aIndex = tagsOrder.indexOf(a);
          const bIndex = tagsOrder.indexOf(b);

          if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }
      });

      // 添加自定义样式
      setTimeout(() => {
        const swaggerUi = document.querySelector('.swagger-ui');
        if (swaggerUi) {
          swaggerUi.style.marginTop = '0';
        }
      }, 100);
    };
  </script>
</body>
</html>
  `;
}

export default {
  prefix: '/docs',

  get: {
    '': async () => {
      logger.info('访问 Swagger API 文档页面');

      const specUrl = '/docs/json';
      const html = generateSwaggerUiHtml(specUrl);

      // 直接返回 Response 对象
      return new Response(html, {
        type: 'text/html; charset=utf-8'
      });
    },

    '/json': async () => {
      logger.info('获取 Swagger API 规范 JSON');

      // 直接返回 OpenAPI 规范对象，不包装
      return swaggerSpec;
    },

    '/yaml': async () => {
      logger.info('获取 Swagger API 规范 YAML');

      // 将 JSON 转换为 YAML
      const yaml = await import('yaml');
      const yamlContent = yaml.stringify(swaggerSpec, {
        indent: 2,
        lineWidth: 120,
        minContentWidth: 0
      });

      return yamlContent;
    }
  }
};