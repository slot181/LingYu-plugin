import { PATHS } from '../../config/settings.js';
import { readJSON, writeJSON } from '../../utils/fsUtils.js';
import fs from 'fs';
import path from 'path';

export class GroupManager {
  constructor() {
    // 加载统一的群组配置文件
    this.groupConfig = this.loadUnifiedGroupConfig();
    // 若配置中不存在相关字段，则设置默认值
    if (!this.groupConfig.groupStatus) {
      this.groupConfig.groupStatus = {};
    }
    if (!this.groupConfig.groupReplyConfig) {
      this.groupConfig.groupReplyConfig = { default: 0.99 };
    }
    if (!this.groupConfig.groupCharacterConfig) {
      this.groupConfig.groupCharacterConfig = {};
    }
    this.lastReplyTime = {};
    this.cooldownPeriod = 3000;
  }

  loadUnifiedGroupConfig() {
    const config = readJSON(PATHS.groupConfigPath);
    return config || {};
  }

  saveUnifiedGroupConfig() {
    writeJSON(PATHS.groupConfigPath, this.groupConfig);
  }

  setGroupStatus(groupId, status) {
    this.groupConfig.groupStatus[groupId] = status;
    this.saveUnifiedGroupConfig();
  }

  isPluginEnabled(groupId) {
    return this.groupConfig.groupStatus[groupId] !== false;
  }

  setGroupReplyProbability(groupId, probability) {
    this.groupConfig.groupReplyConfig[groupId] = probability;
    this.saveUnifiedGroupConfig();
  }

  getReplyProbability(groupId) {
    const groupProbability = this.groupConfig.groupReplyConfig[groupId];
    if (groupProbability !== undefined) {
      return groupProbability;
    }
    const defaultProbability = this.groupConfig.groupReplyConfig.default;
    if (defaultProbability !== undefined) {
      return defaultProbability;
    }
    return 1.0;
  }

  isInCooldown(groupId) {
    const lastReply = this.lastReplyTime[groupId] || 0;
    return Date.now() - lastReply < this.cooldownPeriod;
  }

  updateLastReplyTime(groupId) {
    this.lastReplyTime[groupId] = Date.now();
  }

  async setCharacterSetting(groupId, settingName) {
    const newPath = path.join(PATHS.promptsDir, `${settingName}.txt`);
    if (fs.existsSync(newPath)) {
      this.groupConfig.groupCharacterConfig[groupId] = newPath;
      this.saveUnifiedGroupConfig();
      return true;
    }
    return false;
  }

  getCharacterSetting(groupId) {
    return this.groupConfig.groupCharacterConfig[groupId];
  }
}