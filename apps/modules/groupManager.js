import { PATHS } from '../../config/settings.js';
import { readJSON, writeJSON } from '../../utils/fsUtils.js';
import fs from 'fs';
import path from 'path';

export class GroupManager {
  constructor() {
    this.groupStatus = this.loadGroupStatus();
    this.groupReplyConfig = this.loadGroupReplyConfig();容器选择菜单.sh
    this.groupCharacterConfig = this.loadGroupCharacterConfig();
    this.lastReplyTime = {};
    this.cooldownPeriod = 3000;
  }

  loadGroupStatus() {
    return readJSON(PATHS.groupStatusPath) || {};
  }

  saveGroupStatus() {
    writeJSON(PATHS.groupStatusPath, this.groupStatus);
  }

  loadGroupReplyConfig() {
    const config = readJSON(PATHS.groupReplyConfigPath);
    if (!config) {
      const defaultConfig = { default: 0.99 };
      writeJSON(PATHS.groupReplyConfigPath, defaultConfig);
      return defaultConfig;
    }
    return config;
  }

  saveGroupReplyConfig() {
    writeJSON(PATHS.groupReplyConfigPath, this.groupReplyConfig);
  }

  loadGroupCharacterConfig() {
    return readJSON(PATHS.groupCharacterConfigPath) || {};
  }

  saveGroupCharacterConfig() {
    writeJSON(PATHS.groupCharacterConfigPath, this.groupCharacterConfig);
  }

  setGroupStatus(groupId, status) {
    this.groupStatus[groupId] = status;
    this.saveGroupStatus();
  }

  isPluginEnabled(groupId) {
    return this.groupStatus[groupId] !== false;
  }

  setGroupReplyProbability(groupId, probability) {
    this.groupReplyConfig[groupId] = probability;
    this.saveGroupReplyConfig();
  }

  getReplyProbability(groupId) {
    const groupProbability = this.groupReplyConfig[groupId];
    if (groupProbability !== undefined) {
      return groupProbability;
    }

    const defaultProbability = this.groupReplyConfig.default;
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
      this.groupCharacterConfig[groupId] = newPath;
      this.saveGroupCharacterConfig();
      return true;
    }
    return false;
  }

  getCharacterSetting(groupId) {
    return this.groupCharacterConfig[groupId] || PATHS.DEFAULT_CHARACTER_FILE;
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
      return files.filter(file => file.endsWith('.txt'))
                 .map(file => path.parse(file).name);
    } catch (error) {
      console.error('读取角色设定文件失败:', error);
      return [];
    }
  }

  clearGroupConfig(groupId) {
    delete this.groupReplyConfig[groupId];
    this.saveGroupReplyConfig();

    delete this.groupStatus[groupId];
    this.saveGroupStatus();

    delete this.groupCharacterConfig[groupId];
    this.saveGroupCharacterConfig();

    const groupContextFile = path.join(PATHS.groupChatDir, `${groupId}_group_context.json`);
    if (fs.existsSync(groupContextFile)) {
      fs.writeFileSync(groupContextFile, '[]', 'utf-8');
    }

    return true;
  }

  async getGroupStatus() {
    let statusMessage = '群组状态:\n';
    for (const [groupId, status] of Object.entries(this.groupStatus)) {
      const probability = this.getReplyProbability(groupId);
      const characterSetting = this.getCharacterSetting(groupId);
      const settingName = path.basename(characterSetting, '.txt');
      statusMessage += `群 ${groupId}: ${status ? '说话' : '闭嘴'}, 回复概率: ${probability}, 角色设定: ${settingName}\n`;
    }
    return statusMessage;
  }
}