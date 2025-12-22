/**
 * Cloudflare Worker 部署脚本
 * 自动化部署和配置流程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 部署步骤
async function deploy() {
  log('\n🚀 开始部署即梦API Cloudflare Worker代理\n', 'bright');

  try {
    // 1. 检查wrangler是否安装
    log('1️⃣ 检查依赖...');
    try {
      execSync('wrangler --version', { stdio: 'pipe' });
      log('   ✅ Wrangler已安装', 'green');
    } catch (error) {
      log('   ❌ Wrangler未安装，正在安装...', 'yellow');
      execSync('npm install -g wrangler', { stdio: 'inherit' });
      log('   ✅ Wrangle安装成功', 'green');
    }

    // 2. 检查是否已登录
    log('\n2️⃣ 检查登录状态...');
    try {
      execSync('wrangler whoami', { stdio: 'pipe' });
      log('   ✅ 已登录Cloudflare', 'green');
    } catch (error) {
      log('   ⚠️  未登录，请先登录Cloudflare', 'yellow');
      log('   运行: wrangler login', 'blue');
      return;
    }

    // 3. 检查配置文件
    log('\n3️⃣ 检查配置文件...');
    if (!fs.existsSync('wrangler.toml')) {
      log('   ❌ 找不到wrangler.toml配置文件', 'red');
      log('   请先配置account_id和zone_id', 'yellow');
      return;
    }
    log('   ✅ 配置文件存在', 'green');

    // 4. 检查worker.js中的后端服务器配置
    log('\n4️⃣ 检查后端服务器配置...');
    const workerContent = fs.readFileSync('worker.js', 'utf8');
    if (workerContent.includes('your-jimeng-api-1.com')) {
      log('   ⚠️  请先配置后端服务器地址', 'yellow');
      log('   编辑worker.js中的CONFIG.BACKEND_SERVERS', 'blue');

      // 显示示例配置
      log('\n   示例配置:', 'blue');
      log('   BACKEND_SERVERS: [');
      log('     {');
      log('       url: "https://api1.example.com",');
      log('       priority: 1,');
      log('       region: "default",');
      log('       weight: 3');
      log('     }');
      log('   ]');

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('\n   是否继续部署？(y/n): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        log('   部署已取消', 'yellow');
        return;
      }
    } else {
      log('   ✅ 后端服务器已配置', 'green');
    }

    // 5. 可选：运行IP测速
    log('\n5️⃣ IP测速（可选）...');
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const runTest = await new Promise(resolve => {
      rl.question('   是否运行IP测速以优化配置？(y/n): ', resolve);
    });
    rl.close();

    if (runTest.toLowerCase() === 'y') {
      log('   运行IP测速...', 'yellow');
      try {
        execSync('node ip-tester.js', { stdio: 'inherit', timeout: 120000 });
        log('   ✅ IP测速完成', 'green');
      } catch (error) {
        log('   ⚠️  IP测速失败，但继续部署', 'yellow');
      }
    }

    // 6. 部署Worker
    log('\n6️⃣ 部署Worker...');
    try {
      execSync('wrangler deploy', { stdio: 'inherit' });
      log('   ✅ Worker部署成功', 'green');
    } catch (error) {
      log('   ❌ Worker部署失败', 'red');
      log('   请检查配置和网络连接', 'yellow');
      return;
    }

    // 7. 设置定时任务（健康检查）
    log('\n7️⃣ 设置定时任务...');
    try {
      execSync('wrangler cron schedule "*/1 * * * *"', { stdio: 'pipe' });
      log('   ✅ 定时任务设置成功（每分钟健康检查）', 'green');
    } catch (error) {
      log('   ⚠️  定时任务设置失败，请手动配置', 'yellow');
    }

    // 8. 配置自定义域名（可选）
    log('\n8️⃣ 配置自定义域名...');
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const configureDomain = await new Promise(resolve => {
      rl2.question('   是否配置自定义域名？(y/n): ', resolve);
    });
    rl2.close();

    if (configureDomain.toLowerCase() === 'y') {
      const domain = await new Promise(resolve => {
        const rl3 = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl3.question('   请输入域名（如: api.example.com）: ', resolve);
        rl3.close();
      });

      try {
        execSync(`wrangler custom-domains add ${domain}`, { stdio: 'inherit' });
        log(`   ✅ 域名 ${domain} 配置成功`, 'green');
      } catch (error) {
        log(`   ❌ 域名 ${domain} 配置失败`, 'red');
        log('   请确保DNS已正确配置', 'yellow');
      }
    }

    // 9. 部署完成
    log('\n✨ 部署完成！', 'bright', 'green');
    log('\n📋 后续步骤:', 'blue');
    log('1. 访问 https://your-worker-domain.com/health 查看健康状态');
    log('2. 访问 https://your-worker-domain.com/api/ip-preference 查看服务器优选信息');
    log('3. 更新客户端API地址到Worker域名');
    log('4. 监控日志: wrangler tail');

    log('\n🔧 管理命令:', 'blue');
    log('- 查看日志: npm run tail');
    log('- 重新部署: npm run deploy');
    log('- 本地开发: npm run dev');

  } catch (error) {
    log('\n❌ 部署失败:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// 运行部署
if (require.main === module) {
  deploy();
}

module.exports = { deploy };