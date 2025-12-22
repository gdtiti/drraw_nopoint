/**
 * IP测速和优选工具
 * 用于测试各个后端服务器的延迟和可用性
 */

// 要测试的服务器列表
const SERVERS = [
  'https://your-jimeng-api-1.com',
  'https://your-jimeng-api-2.com',
  'https://your-jimeng-api-3.com',
  'https://your-jimeng-api-4.com'
];

// 测试配置
const TEST_CONFIG = {
  concurrent: 10,      // 并发测试数
  timeout: 5000,       // 5秒超时
  retries: 3,          // 重试次数
  testPath: '/ping',   // 测试路径
  interval: 100,       // 测试间隔（毫秒）
  duration: 60000      // 测试持续时间（毫秒）
};

// 测试结果存储
const testResults = new Map();

// 主测试函数
async function runIPTest() {
  console.log('开始IP测速测试...');
  console.log(`测试服务器: ${SERVERS.join(', ')}`);
  console.log(`测试时长: ${TEST_CONFIG.duration / 1000}秒`);
  console.log('----------------------------------------');

  // 初始化测试结果
  for (const server of SERVERS) {
    testResults.set(server, {
      server: server,
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      latencies: [],
      errors: [],
      minLatency: Infinity,
      maxLatency: 0,
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      availability: 0
    });
  }

  // 开始测试
  const startTime = Date.now();
  const endTime = startTime + TEST_CONFIG.duration;
  const testPromises = [];

  // 启动并发测试
  for (let i = 0; i < TEST_CONFIG.concurrent; i++) {
    testPromises.push(testLoop(endTime, i));
  }

  // 等待所有测试完成
  await Promise.all(testPromises);

  // 计算统计信息
  calculateStatistics();

  // 输出结果
  printResults();

  // 返回排序后的服务器列表
  return getSortedServers();
}

// 测试循环
async function testLoop(endTime, workerId) {
  while (Date.now() < endTime) {
    // 随机选择一个服务器进行测试
    const server = SERVERS[Math.floor(Math.random() * SERVERS.length)];

    // 执行测试
    await testServer(server);

    // 等待下次测试
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.interval));
  }
}

// 测试单个服务器
async function testServer(server) {
  const result = testResults.get(server);
  const startTime = Date.now();

  try {
    // 发送测试请求
    const response = await fetch(server + TEST_CONFIG.testPath, {
      method: 'GET',
      signal: AbortSignal.timeout(TEST_CONFIG.timeout)
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      // 测试成功
      result.successfulTests++;
      result.latencies.push(latency);
      result.minLatency = Math.min(result.minLatency, latency);
      result.maxLatency = Math.max(result.maxLatency, latency);
    } else {
      // 服务器返回错误
      result.failedTests++;
      result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    // 请求失败
    result.failedTests++;
    result.errors.push(error.message);
  }

  result.totalTests++;
}

// 计算统计信息
function calculateStatistics() {
  for (const result of testResults.values()) {
    if (result.successfulTests > 0) {
      // 计算平均延迟
      result.avgLatency = Math.round(
        result.latencies.reduce((sum, lat) => sum + lat, 0) / result.latencies.length
      );

      // 计算百分位数
      const sortedLatencies = result.latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p99Index = Math.floor(sortedLatencies.length * 0.99);

      result.p95Latency = sortedLatencies[p95Index] || 0;
      result.p99Latency = sortedLatencies[p99Index] || 0;
    }

    // 计算可用性
    result.availability = result.totalTests > 0
      ? Math.round((result.successfulTests / result.totalTests) * 100)
      : 0;
  }
}

// 打印测试结果
function printResults() {
  console.log('\n测试完成！');
  console.log('----------------------------------------');

  // 打印每个服务器的详细结果
  for (const result of testResults.values()) {
    console.log(`\n服务器: ${result.server}`);
    console.log(`总测试次数: ${result.totalTests}`);
    console.log(`成功次数: ${result.successfulTests}`);
    console.log(`失败次数: ${result.failedTests}`);
    console.log(`可用性: ${result.availability}%`);

    if (result.successfulTests > 0) {
      console.log(`延迟统计:`);
      console.log(`  最小: ${result.minLatency}ms`);
      console.log(`  最大: ${result.maxLatency}ms`);
      console.log(`  平均: ${result.avgLatency}ms`);
      console.log(`  P95: ${result.p95Latency}ms`);
      console.log(`  P99: ${result.p99Latency}ms`);
    }

    if (result.errors.length > 0) {
      console.log(`常见错误:`);
      const errorCounts = {};
      for (const error of result.errors) {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      }
      for (const [error, count] of Object.entries(errorCounts)) {
        console.log(`  ${error}: ${count}次`);
      }
    }
  }

  // 打印推荐的服务器排序
  console.log('\n----------------------------------------');
  console.log('服务器推荐排序（按可用性和延迟）:');
  const sortedServers = getSortedServers();
  sortedServers.forEach((server, index) => {
    console.log(`${index + 1}. ${server.server}`);
    console.log(`   可用性: ${server.availability}%, 平均延迟: ${server.avgLatency}ms`);
  });
}

// 获取排序后的服务器列表
function getSortedServers() {
  return Array.from(testResults.values()).sort((a, b) => {
    // 首先按可用性排序
    if (a.availability !== b.availability) {
      return b.availability - a.availability;
    }

    // 然后按平均延迟排序
    if (a.avgLatency !== b.avgLatency) {
      return a.avgLatency - b.avgLatency;
    }

    // 最后按P95延迟排序
    return a.p95Latency - b.p95Latency;
  });
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runIPTest,
    SERVERS,
    TEST_CONFIG
  };
}

// 如果直接运行
if (typeof window === 'undefined' && typeof global !== 'undefined') {
  runIPTest().catch(console.error);
}