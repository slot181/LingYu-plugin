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
    return this.groupConfig.groupCharacterConfig[groupId] || PATHS.DEFAULT_CHARACTER_FILE;
  }

  async addCharacterSetting(settingName, settingContent) {
    const filePath = path.join(PATHS.promptsDir, `${settingName}.txt`);
    if (fs.existsSync(filePath)) {
      return false;
    }
    try {
      await fs.promises.writeFile(filePath, settingContent, 'utf-8');
      return true;
    } catch (error) {
      console.error(`创建设定文件失败: ${error}`);
      return false;
    }
  }

  async deleteCharacterSetting(settingName) {
    const settingPath = path.join(PATHS.promptsDir, `${settingName}.txt`);
    if (!fs.existsSync(settingPath)) {
      return false;
    }
    try {
      await fs.promises.unlink(settingPath);
      return true;
    } catch (error) {
      console.error(`删除角色设定失败: ${error}`);
      return false;
    }
  }

  async listCharacterSettings() {
    try {
      const files = await fs.promises.readdir(PATHS.promptsDir);
      return files.filter(file => file.endsWith('.txt')).map(file => path.parse(file).name);
    } catch (error) {
      console.error('读取角色设定文件失败:', error);
      return [];
    }
  }

  clearGroupConfig(groupId) {
    delete this.groupConfig.groupReplyConfig[groupId];
    delete this.groupConfig.groupStatus[groupId];
    delete this.groupConfig.groupCharacterConfig[groupId];
    this.saveUnifiedGroupConfig();

    const groupContextFile = path.join(PATHS.groupChatDir, `${groupId}_group_context.json`);
    if (fs.existsSync(groupContextFile)) {
      fs.writeFileSync(groupContextFile, '[]', 'utf-8');
    }
    return true;
  }

  async getGroupStatus() {
    let statusMessage = '群组状态:\n';
    for (const [groupId, status] of Object.entries(this.groupConfig.groupStatus)) {
      const probability = this.getReplyProbability(groupId);
      const characterSetting = this.getCharacterSetting(groupId);
      const settingName = path.basename(characterSetting, '.txt');
      statusMessage += `群 ${groupId}: ${status ? '说话' : '闭嘴'}, 回复概率: ${probability}, 角色设定: ${settingName}\n`;
    }
    return statusMessage;
  }
}