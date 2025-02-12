import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!global.segment) {
  global.segment = (await import("oicq")).segment;
}

let ret = [];

logger.info(logger.yellow("- 正在载入 siliconflow-PLUGIN"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, './plugins/siliconflow-plugin');
const appsPath = path.join(baseDir, 'apps');

const files = fs
  .readdirSync(appsPath)
  .filter((file) => file.endsWith('.js'));

files.forEach((file) => {
  ret.push(import(path.join(appsPath, file)));
});

ret = await Promise.allSettled(ret);

let apps = {};
for (let i in files) {
  let name = files[i].replace('.js', '');

  if (ret[i].status !== 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`);
    logger.error(ret[i].reason);
    continue;
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
}

logger.info(logger.green("- siliconflow-PLUGIN 载入成功"));

export { apps };