import path from 'path';

import fs from 'fs-extra';
import yaml from 'yaml';
import _ from 'lodash';

import environment from '../environment.ts';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const CONFIG_PATH = path.join(path.resolve(), 'configs/', environment.env, "/system.yml");

/**
 * 代理配置
 */
export interface ProxyConfig {
    /** 是否���用代理 */
    enabled: boolean;
    /** 代理服务器地址 */
    host: string;
    /** 代理服务器端口 */
    port: number;
    /** 代理类型：http, https, socks5 */
    type: 'http' | 'https' | 'socks5';
    /** 代理认证（可选） */
    auth: {
        username: string;
        password: string;
    };
    /** 不使用代理的域名列表（支持通配符） */
    bypass: string[];
    /** 代理连接超时时间（毫秒） */
    timeout: number;
}

/**
 * 系统配置
 */
export class SystemConfig {

    /** 是否开启请求日志 */
    requestLog: boolean;
    /** 临时目录路径 */
    tmpDir: string;
    /** 日志目录路径 */
    logDir: string;
    /** 日志写入间隔（毫秒） */
    logWriteInterval: number;
    /** 日志文件有效期（毫秒） */
    logFileExpires: number;
    /** 临时文件有效期（毫秒） */
    tmpFileExpires: number;
    /** 请求体配置 */
    requestBody: any;
    /** 是否调试模式 */
    debug: boolean;
    /** 日志级别 */
    log_level: string;
    /** 代理配置 */
    proxy: ProxyConfig;

    constructor(options?: any) {
        const { requestLog, tmpDir, logDir, logWriteInterval, logFileExpires, tmpFileExpires, requestBody, debug, log_level, proxy } = options || {};
        this.requestLog = _.defaultTo(requestLog, false);
        this.tmpDir = _.defaultTo(tmpDir, './tmp');
        this.logDir = _.defaultTo(logDir, './logs');
        this.logWriteInterval = _.defaultTo(logWriteInterval, 200);
        this.logFileExpires = _.defaultTo(logFileExpires, 2626560000);
        this.tmpFileExpires = _.defaultTo(tmpFileExpires, 86400000);
        this.requestBody = Object.assign(requestBody || {}, {
            enableTypes: ['form', 'text', 'xml'],  // 移除 json，由自定义中间件处理
            encoding: 'utf-8',
            formLimit: '100mb',
            jsonLimit: '100mb',
            textLimit: '100mb',
            xmlLimit: '100mb',
            formidable: {
                maxFileSize: '100mb'
            },
            multipart: true,
            parsedMethods: ['POST', 'PUT', 'PATCH']
        });
        this.debug = _.defaultTo(debug, true);
        this.log_level = _.defaultTo(log_level, 'info');
        this.proxy = _.defaultTo(proxy, {
            enabled: false,
            host: '',
            port: 0,
            type: 'http',
            auth: {
                username: '',
                password: ''
            },
            bypass: ['localhost', '127.0.0.1', '*.local'],
            timeout: 10000
        });
    }

    get rootDirPath() {
        return path.resolve();
    }

    get tmpDirPath() {
        return path.resolve(this.tmpDir);
    }

    get logDirPath() {
        return path.resolve(this.logDir);
    }

    /**
     * 从环境变量获取值
     */
    private static getEnvValue(key: string, defaultValue: any): any {
        const envKey = key.toUpperCase();
        if (process.env[envKey] !== undefined) {
            // 尝试转换类型
            const value = process.env[envKey];
            if (value === 'true') return true;
            if (value === 'false') return false;
            if (/^\d+$/.test(value)) return parseInt(value, 10);
            return value;
        }
        return defaultValue;
    }

    static load() {
        let config: any = {};

        // 1. 首先尝试加载配置文件
        if (fs.pathExistsSync(CONFIG_PATH)) {
            config = yaml.parse(fs.readFileSync(CONFIG_PATH).toString());
        }

        // 2. 从环境变量覆盖配置（环境变量优先级更高）
        const envConfig = {
            requestLog: this.getEnvValue('PROXY_REQUEST_LOG', config.requestLog),
            tmpDir: this.getEnvValue('PROXY_TMP_DIR', config.tmpDir),
            logDir: this.getEnvValue('PROXY_LOG_DIR', config.logDir),
            logWriteInterval: this.getEnvValue('PROXY_LOG_WRITE_INTERVAL', config.logWriteInterval),
            logFileExpires: this.getEnvValue('PROXY_LOG_FILE_EXPIRES', config.logFileExpires),
            tmpFileExpires: this.getEnvValue('PROXY_TMP_FILE_EXPIRES', config.tmpFileExpires),
            debug: this.getEnvValue('PROXY_DEBUG', config.debug),
            log_level: this.getEnvValue('PROXY_LOG_LEVEL', config.log_level),
            proxy: {
                enabled: this.getEnvValue('PROXY_ENABLED', config.proxy?.enabled || false),
                host: this.getEnvValue('PROXY_HOST', config.proxy?.host || ''),
                port: this.getEnvValue('PROXY_PORT', config.proxy?.port || 0),
                type: this.getEnvValue('PROXY_TYPE', config.proxy?.type || 'socks5'),
                auth: {
                    username: this.getEnvValue('PROXY_AUTH_USERNAME', config.proxy?.auth?.username || ''),
                    password: this.getEnvValue('PROXY_AUTH_PASSWORD', config.proxy?.auth?.password || '')
                },
                bypass: this.getEnvValue('PROXY_BYPASS', config.proxy?.bypass || []).toString().split(',').map((s: string) => s.trim()),
                timeout: this.getEnvValue('PROXY_TIMEOUT', config.proxy?.timeout || 10000)
            }
        };

        // 深度合并环境变量配置
        config = _.mergeWith({}, config, envConfig, (objValue, srcValue) => {
            if (_.isArray(srcValue)) {
                return srcValue;
            }
            return srcValue;
        });

        return new SystemConfig(config);
    }

}

export default SystemConfig.load();