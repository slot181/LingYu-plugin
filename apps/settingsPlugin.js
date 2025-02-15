import plugin from '../../../lib/plugins/plugin.js'
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import common from "../../../lib/common/common.js";

import { PATHS, ADMIN_QQ } from "../config/settings.js";

const promptsDir = PATHS.promptsDir
const groupConfigPath = PATHS.groupConfigPath;

export class SettingsPlugin extends plugin {
  constructor() {
    super({
      name: 'SettingsPlugin',
      dsc: '扩展角色设定功能插件，提供添加、删除、设置和查看角色设定功能',
      event: 'message',
      priority: 10000,
      rule: [
        {
          reg: '^#lingyu添加设定\\s+(\\S+)\\s+([\\s\\S]+)$',
          fnc: 'addSetting',
          permission: 'master,admin,owner'
        },
        {
          reg: '^#lingyu删除角色设定\\s+(.+)$',
          fnc: 'deleteCharacterSetting',
          permission: 'master'
        },
        {
          reg: '^#lingyu设置角色设定\\s+(.+)$',
          fnc: 'setCharacterSetting',
          permission: 'master,admin,owner'
        },
        {
          reg: '^#lingyu查看角色设定$',
          fnc: 'readCharacterSettings',
          permission: 'master,admin,owner'
        },
        {
          reg: '^#lingyu查看角色设定列表$',
          fnc: 'readCharacterSettingList',
          permission: 'master,admin,owner'
        }
      ]
    });
  }

  isMaster(e) {
    return e.sender && e.sender.user_id === ADMIN_QQ;
  }

  isGroupAdmin(e) {
    return e.sender && ['owner', 'admin'].includes(e.sender.role);
  }

  async addSetting(e) {
    // 权限检查
    if (!this.isMaster(e) && !this.isGroupAdmin(e)) {
      await this.reply('只有主人、群主和管理员可以添加设定。', false);
      return;
    }

    const match = e.msg.match(/^#lingyu添加设定\s+(\S+)\s+([\s\S]+)$/);
    if (!match) {
      await this.reply('请输入正确的格式: #lingyu添加设定 设定名 设定内容', false);
      return;
    }

    const [, settingName, settingContent] = match;
    const filePath = path.join(promptsDir, `${settingName}.txt`);

    if (fs.existsSync(filePath)) {
      await this.reply(`设定 "${settingName}" 已存在。`, false);
      return;
    }

    try {
      await fsPromises.writeFile(filePath, settingContent, 'utf-8');
      await this.reply(`设定 "${settingName}" 已成功添加。`, false);
      console.log(`新增设定文件: ${filePath}`);
    } catch (error) {
      console.error(`创建设定文件失败: ${error}`);
      await this.reply('添加设定时发生错误，请检查日志。', false);
    }
  }

  async deleteCharacterSetting(e) {
    // 权限检查，删除设定仅允许主人操作
    if (!this.isMaster(e)) {
      await this.reply('只有主人可以删除角色设定。', false);
      return;
    }

    const match = e.msg.match(/^#lingyu删除角色设定\s+(.+)$/);
    if (!match) {
      await this.reply('请输入正确的格式: #lingyu删除角色设定 设定名', false);
      return;
    }

    const settingName = match[1].trim();
    const filePath = path.join(promptsDir, `${settingName}.txt`);

    if (!fs.existsSync(filePath)) {
      await this.reply(`角色设定文件不存在: ${settingName}`, false);
      return;
    }

    try {
      await fsPromises.unlink(filePath);
      await this.reply(`角色设定 "${settingName}" 已被删除。`, false);
      console.log(`删除设定文件: ${filePath}`);
    } catch (error) {
      console.error(`删除角色设定 "${settingName}" 失败: ${error}`);
      await this.reply(`删除 "${settingName}" 时出错，请检查日志。`, false);
    }
  }

  async setCharacterSetting(e) {
    // 权限检查
    if (!this.isMaster(e) && !this.isGroupAdmin(e)) {
      await this.reply('只有主人、群主和管理员可以设置角色设定。', false);
      return;
    }

    const match = e.msg.match(/^#lingyu设置角色设定\s+(.+)$/);
    if (!match) {
      await this.reply('设置路径格式错误。请使用 "#lingyu设置角色设定 [文件名]"', false);
      return;
    }

    const settingName = match[1].trim();
    const newPath = path.join(promptsDir, `${settingName}.txt`);

    if (!fs.existsSync(newPath)) {
      await this.reply(`角色设定文件不存在: ${settingName}`, false);
      return;
    }

    // 读取现有群组配置
    let groupConfig = {};
    if (fs.existsSync(groupConfigPath)) {
      try {
        groupConfig = JSON.parse(fs.readFileSync(groupConfigPath, 'utf-8'));
      } catch (error) {
        console.error('加载群组配置失败:', error);
      }
    }

    // 确保 groupCharacterConfig 字段存在
    if (!groupConfig.groupCharacterConfig) {
      groupConfig.groupCharacterConfig = {};
    }

    groupConfig.groupCharacterConfig[e.group_id] = newPath;
    try {
      fs.writeFileSync(groupConfigPath, JSON.stringify(groupConfig, null, 2), 'utf-8');
      await this.reply(`群 ${e.group_id} 的角色设定已设置为: ${settingName}`, false);
      console.log(`群 ${e.group_id} 角色设定更新为: ${newPath}`);
    } catch (error) {
      console.error('保存群组配置失败:', error);
      await this.reply('设置角色设定时发生错误，请检查日志。', false);
    }
  }

  async readCharacterSettings(e) {
    try {
      let groupConfig = {};
      if (fs.existsSync(groupConfigPath)) {
        try {
          groupConfig = JSON.parse(fs.readFileSync(groupConfigPath, 'utf-8'));
        } catch (error) {
          console.error('加载群组配置失败:', error);
        }
      }
      const groupCharConfig = groupConfig.groupCharacterConfig || {};
      const currentSettingPath = groupCharConfig[e.group_id];
      if (!currentSettingPath) {
        await this.reply('当前群暂未设置角色设定。', false);
      } else {
        const settingName = path.basename(currentSettingPath, '.txt');
  
      await this.reply(`当前群角色设定为: ${settingName}`, false);
      }
    } catch (error) {
      console.error('读取角色设定失败:', error);
      await this.reply('读取角色设定时出错，请检查日志。', false);
    }
  }

  async readCharacterSettingList(e) {
    // 权限检查
    if (!this.isMaster(e) && !this.isGroupAdmin(e)) {
      await this.reply('只有主人、群主和管理员可以查看角色设定。', false);
      return;
    }

    try {
      // 读取prompts目录下的所有文件
      const files = await fsPromises.readdir(promptsDir);
      const txtFiles = files.filter(file => file.endsWith('.txt'));

      if (txtFiles.length === 0) {
        await this.reply('当前没有任何角色设定。', false);
        return;
      }

      // 构建角色设定列表消息
      let settingsList = '当前可用的角色设定列表：\n';
      for (let i = 0; i < txtFiles.length; i++) {
        const settingName = path.basename(txtFiles[i], '.txt');
        settingsList += `${i + 1}. ${settingName}\n`;
      }

      // 使用转发消息的方法发送角色设定列表
      const forwardMsg = await common.makeForwardMsg(e, [settingsList], `${e.sender.card || e.sender.nickname} 的角色设定列表`);
      await this.reply(forwardMsg);
    } catch (error) {
      console.error('读取角色设定列表失败:', error);
      await this.reply('读取角色设定列表时出错，请检查日志。', false);
    }
  }
}