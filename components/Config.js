import fs from 'fs';
import { PATHS } from '../config/settings.js';
import { ensureDirExists, readJSON, writeJSON } from '../utils/fsUtils.js';

function initializeDirectories() {
  const directories = [
    PATHS.configDir,
    PATHS.dataDir,
    PATHS.groupChatDir,
    PATHS.userChatDir,
    PATHS.promptsDir,
  ];
  directories.forEach(dir => {
    ensureDirExists(dir);
  });
}

function initializeConfigFiles() {
  if (!fs.existsSync(PATHS.globalConfigPath)) {
    console.log(`正在创建默认全局配置: ${PATHS.globalConfigPath}`);
    writeJSON(PATHS.globalConfigPath, {});
  }
  if (!fs.existsSync(PATHS.groupConfigPath)) {
    console.log(`正在创建默认群组配置: ${PATHS.groupConfigPath}`);
    writeJSON(PATHS.groupConfigPath, {
      groupStatus: {},
      groupReplyConfig: { default: 0.99 },
      groupCharacterConfig: {}
    });
  }
  if (!fs.existsSync(PATHS.contextCountsPath)) {
    console.log(`正在创建默认上下文计数配置: ${PATHS.contextCountsPath}`);
    writeJSON(PATHS.contextCountsPath, {});
  }
}

export function initializeAppConfig() {
  initializeDirectories();
  initializeConfigFiles();
  console.log("配置初始化完成。");
}

export function loadGlobalConfig() {
  return readJSON(PATHS.globalConfigPath) || {};
}

export function loadGroupConfig() {
  return readJSON(PATHS.groupConfigPath) || { 
    groupStatus: {}, 
    groupReplyConfig: { default: 0.99 }, 
    groupCharacterConfig: {} 
  };
}

export function loadContextCounts() {
  return readJSON(PATHS.contextCountsPath) || {};
}