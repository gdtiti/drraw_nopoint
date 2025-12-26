import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Swagger API 文档配置
 * 自动扫描项目中的 API 路由并生成 OpenAPI 3.0 规范文档
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '即梦 API (Jimeng API)',
      version: '1.6.3',
      description: `
        免费的AI图像和视频生成API服务 - 基于即梦AI的逆向工程实现

        ## 功能特性
        - 🎨 **AI图像生成**: 支持文本生成图像、图像合成等功能
        - 🎬 **AI视频生成**: 支持静态图像生成动态视频
        - 💬 **智能对话**: 兼容 OpenAI API 格式的聊天接口
        - 🔄 **异步处理**: 支持任务队列和批量处理
        - 🌍 **全球加速**: 支持多区域镜像配置

        ## 认证方式
        所有需要认证的接口都需要在请求头中携带 Authorization Token：
        \`Authorization: Bearer YOUR_TOKEN\`

        ## 错误处理
        API 使用标准 HTTP 状态码，所有错误响应都包含详细的错误信息。

        ## 速率限制
        为了保证服务质量，API 实施了合理的速率限制策略。
      `,
      contact: {
        name: 'Jimeng API Team',
        url: 'https://github.com/iptag/jimeng-api',
        email: 'support@example.com'
      },
      license: {
        name: 'GPL-3.0',
        url: 'https://raw.githubusercontent.com/iptag/jimeng-api/main/LICENSE'
      }
    },
    servers: [
      {
        url: 'http://localhost:7860',
        description: '本地开发服务器'
      },
      {
        url: 'https://your-domain.com',
        description: '生产环境服务器'
      }
    ],
    tags: [
      {
        name: 'Images',
        description: 'AI 图像生成相关接口'
      },
      {
        name: 'Videos',
        description: 'AI 视频生成相关接口'
      },
      {
        name: 'Chat',
        description: '智能对话相关接口'
      },
      {
        name: 'Async',
        description: '异步任务处理相关接口'
      },
      {
        name: 'Models',
        description: '模型信息相关接口'
      },
      {
        name: 'Token',
        description: 'Token 管理相关接口'
      },
      {
        name: 'Usage',
        description: '使用统计相关接口'
      },
      {
        name: 'Proxy',
        description: '代理服务相关接口'
      },
      {
        name: 'Health',
        description: '健康检查相关接口'
      },
      {
        name: 'System',
        description: '系统信息相关接口'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '请输入您的认证 Token'
        }
      },
      schemas: {
        // 通用响应模式
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              description: '响应数据'
            }
          }
        },

        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: '错误信息'
            },
            code: {
              type: 'string',
              description: '错误代码'
            }
          }
        },

        // 图像相关模式
        ImageGenerationRequest: {
          type: 'object',
          required: ['prompt'],
          properties: {
            model: {
              type: 'string',
              description: '使用的模型',
              enum: ['jimeng-4.5', 'jimeng-4.0', 'jimeng-2.1'],
              example: 'jimeng-4.5'
            },
            prompt: {
              type: 'string',
              description: '图像生成提示词',
              example: '美丽的日落风景'
            },
            negative_prompt: {
              type: 'string',
              description: '负面提示词',
              example: '模糊, 低质量'
            },
            ratio: {
              type: 'string',
              description: '图像宽高比',
              enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
              example: '16:9'
            },
            resolution: {
              type: 'string',
              description: '图像分辨率',
              enum: ['480p', '720p', '1080p', '2k'],
              example: '1080p'
            },
            intelligent_ratio: {
              type: 'boolean',
              description: '是否启用智能比例',
              example: false
            },
            sample_strength: {
              type: 'number',
              description: '采样强度 (0.1-1.0)',
              minimum: 0.1,
              maximum: 1.0,
              example: 0.8
            },
            response_format: {
              type: 'string',
              description: '响应格式',
              enum: ['url', 'b64_json'],
              example: 'url'
            }
          }
        },

        ImageCompositionRequest: {
          type: 'object',
          required: ['prompt', 'images'],
          properties: {
            model: {
              type: 'string',
              description: '使用的模型',
              example: 'jimeng-4.5'
            },
            prompt: {
              type: 'string',
              description: '图像合成提示词',
              example: '将两张图片合成风景画'
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
                description: 'Base64 编码的图像数据'
              },
              description: '要合成的图像列表',
              maxItems: 4,
              minItems: 1
            },
            ratio: {
              type: 'string',
              description: '输出图像宽高比',
              example: '16:9'
            },
            sample_strength: {
              type: 'number',
              description: '采样强度',
              example: 0.8
            }
          }
        },

        ImageResponse: {
          type: 'object',
          properties: {
            created: {
              type: 'integer',
              description: '创建时间戳',
              example: 1705870400
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: '生成的图像 URL',
                    example: 'https://example.com/generated-image.jpg'
                  },
                  b64_json: {
                    type: 'string',
                    description: 'Base64 编码的图像数据'
                  }
                }
              }
            }
          }
        },

        // 视频相关模式
        VideoGenerationRequest: {
          type: 'object',
          required: ['prompt'],
          properties: {
            model: {
              type: 'string',
              description: '使用的模型',
              enum: ['jimeng-video-3.5-pro', 'jimeng-video-3.5'],
              example: 'jimeng-video-3.5-pro'
            },
            prompt: {
              type: 'string',
              description: '视频生成提示词',
              example: '动态的海浪拍打沙滩'
            },
            file_paths: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri'
              },
              description: '参考图像路径列表',
              maxItems: 5,
              minItems: 0
            },
            ratio: {
              type: 'string',
              description: '视频宽高比',
              enum: ['16:9', '9:16', '1:1'],
              example: '16:9'
            },
            resolution: {
              type: 'string',
              description: '视频分辨率',
              enum: ['720p', '1080p'],
              example: '1080p'
            },
            duration: {
              type: 'integer',
              description: '视频时长（秒）',
              enum: [5, 10],
              example: 5
            }
          }
        },

        VideoResponse: {
          type: 'object',
          properties: {
            created: {
              type: 'integer',
              description: '创建时间戳',
              example: 1705870400
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  video_url: {
                    type: 'string',
                    description: '生成的视频 URL',
                    example: 'https://example.com/generated-video.mp4'
                  },
                  cover_url: {
                    type: 'string',
                    description: '视频封面图 URL',
                    example: 'https://example.com/video-cover.jpg'
                  }
                }
              }
            }
          }
        },

        // 异步任务相关模式
        AsyncTaskResponse: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: '任务ID',
              example: 'uuid-string'
            },
            status: {
              type: 'string',
              description: '任务状态',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
              example: 'pending'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: '任务创建时间',
              example: '2025-01-22T10:00:00.000Z'
            },
            message: {
              type: 'string',
              description: '状态消息',
              example: '任务已提交，请使用task_id查询进度和结果'
            }
          }
        },

        TaskStatusResponse: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: '任务ID'
            },
            type: {
              type: 'string',
              description: '任务类型',
              enum: ['image_generation', 'image_composition', 'video_generation']
            },
            status: {
              type: 'string',
              description: '任务状态'
            },
            progress: {
              type: 'integer',
              description: '任务进度 (0-100)',
              example: 45
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            },
            started_at: {
              type: 'string',
              format: 'date-time'
            },
            error: {
              type: 'string',
              description: '错误信息（如果有）'
            },
            has_result: {
              type: 'boolean',
              description: '是否已有结果'
            },
            estimated_time_remaining: {
              type: 'integer',
              description: '预计剩余时间（秒）'
            }
          }
        },

        BatchSubmitRequest: {
          type: 'object',
          required: ['tasks'],
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                oneOf: [
                  { $ref: '#/components/schemas/ImageGenerationRequest' },
                  { $ref: '#/components/schemas/ImageCompositionRequest' },
                  { $ref: '#/components/schemas/VideoGenerationRequest' }
                ],
                required: ['type'],
                properties: {
                  type: {
                    type: 'string',
                    enum: ['image_generation', 'image_composition', 'video_generation']
                  }
                }
              },
              description: '要提交的任务列表',
              maxItems: 20
            }
          }
        },
        ChatCompletionRequest: {
          type: 'object',
          required: ['messages'],
          properties: {
            model: {
              type: 'string',
              description: '使用的模型',
              example: 'jimeng-chat'
            },
            messages: {
              type: 'array',
              description: '对话消息列表',
              items: {
                type: 'object',
                required: ['role', 'content'],
                properties: {
                  role: {
                    type: 'string',
                    enum: ['system', 'user', 'assistant'],
                    description: '消息角色'
                  },
                  content: {
                    type: 'string',
                    description: '消息内容'
                  }
                }
              }
            },
            stream: {
              type: 'boolean',
              description: '是否使用流式响应',
              example: false
            },
            temperature: {
              type: 'number',
              minimum: 0,
              maximum: 2,
              description: '控制输出的随机性',
              example: 0.7
            },
            max_tokens: {
              type: 'integer',
              minimum: 1,
              description: '最大生成token数',
              example: 1000
            }
          }
        },
        ChatCompletionResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'chatcmpl-abc123'
            },
            object: {
              type: 'string',
              example: 'chat.completion'
            },
            created: {
              type: 'integer',
              description: '创建时间戳',
              example: 1705870400
            },
            model: {
              type: 'string',
              example: 'jimeng-chat'
            },
            choices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: {
                    type: 'integer',
                    example: 0
                  },
                  message: {
                    type: 'object',
                    properties: {
                      role: {
                        type: 'string',
                        example: 'assistant'
                      },
                      content: {
                        type: 'string',
                        example: '你好！我是即梦AI助手...'
                      }
                    }
                  },
                  finish_reason: {
                    type: 'string',
                    example: 'stop'
                  }
                }
              }
            },
            usage: {
              type: 'object',
              properties: {
                prompt_tokens: {
                  type: 'integer',
                  example: 20
                },
                completion_tokens: {
                  type: 'integer',
                  example: 100
                },
                total_tokens: {
                  type: 'integer',
                  example: 120
                }
              }
            }
          }
        }
      }
    }
  },
  apis: [
    path.resolve(process.cwd(), 'src/api/routes/*.ts'),
    path.resolve(process.cwd(), 'src/lib/swagger-docs/*.js')
  ],
  // 添加自定义解析器配置
  customResourcePath: '/{path}',
  customCss: undefined,
  customSiteTitle: "即梦 API 文档"
};

/**
 * 生成 Swagger API 规范文档
 */
export const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;