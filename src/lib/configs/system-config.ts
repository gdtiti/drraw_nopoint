import path from 'path';

import fs from 'fs-extra';
import yaml from 'yaml';
import _ from 'lodash';

import environment from '../environment.ts';

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

    static load() {
        if (!fs.pathExistsSync(CONFIG_PATH)) return new SystemConfig();
        const data = yaml.parse(fs.readFileSync(CONFIG_PATH).toString());
        return new SystemConfig(data);
    }

}

export default SystemConfig.load();