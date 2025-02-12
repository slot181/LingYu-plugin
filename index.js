import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!global.segment) {
  global.segment = (await import("oicq")).segment;
}

let ret = [];

logger.info(logger.yellow("- 正在载入 lingyu-plugin"));

// 使用绝对路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appsPath = path.join(__dirname, 'apps'); // 直接使用相对路径

const readJsFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    logger.warn(`路径不存在: ${dirPath}`);
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(dirPath, file));
};

const appsFiles = readJsFiles(appsPath);

const allFiles = [...appsFiles];

allFiles.forEach((filePath) => {
  ret.push(import(filePath));
});

ret = await Promise.allSettled(ret);

let apps = {};
for (let i in allFiles) {
  let name = path.basename(allFiles[i], '.js');

  if (ret[i].status !== 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`);
    logger.error(ret[i].reason);
    continue;
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
}

logger.info(logger.green("- lingyu-plugin 载入成功"));

export { apps };