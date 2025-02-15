import fs from 'fs';
import path from 'path';
import { PATHS, BOT_SETTINGS, GLOBAL_CONFIG_DEFAULTS } from '../../config/settings.js';
import { readJSON, writeJSON } from '../../utils/fsUtils.js';

const AI_DISPLAY_NAME = `${BOT_SETTINGS.AI_NAME}(AI)`;

export class ContextManager {
  constructor() {
    this.contextCounts = this.loadContextCounts();
  }

  loadContextCounts() {
    return readJSON(PATHS.contextCountsPath) || {};
  }

  saveContextCounts() {
    writeJSON(PATHS.contextCountsPath, this.contextCounts);
  }

  async updateContext(groupId, newMessage, isAIReply = false, quotedMessage = null, quotedSender = null) {
    const groupContextFile = path.join(PATHS.groupChatDir, `${groupId}_group_context.json`);
    const tempFile = `${groupContextFile}.tmp`;

    try {
      const context = await this.updateContextCommon(groupContextFile, newMessage, isAIReply, quotedMessage, quotedSender);
      await fs.promises.writeFile(tempFile, JSON.stringify(context, null, 2), 'utf-8');
      await fs.promises.rename(tempFile, groupContextFile);
      console.log(`成功更新群体上下文: ${groupContextFile}`);
      this.countContextUpdates('group', groupId);
    } catch (error) {
      console.error(`更新上下文失败: ${error}`);
      try {
        await fs.promises.unlink(tempFile);
      } catch (unlinkError) {
        // 忽略删除临时文件时的错误
      }
    }
  }

  async updateUserContext(groupId, userId, newMessage, isAIReply = false, quotedMessage = null, quotedSender = null) {
    const userContextFile = path.join(PATHS.userChatDir, `${groupId}_${userId}_user_context.json`);
    const tempFile = `${userContextFile}.tmp`;

    try {
      const context = await this.updateContextCommon(userContextFile, newMessage, isAIReply, quotedMessage, quotedSender);
      await fs.promises.writeFile(tempFile, JSON.stringify(context, null, 2), 'utf-8');
      await fs.promises.rename(tempFile, userContextFile);
      console.log(`成功更新用户上下文: ${userContextFile}`);
      this.countContextUpdates('user', groupId, userId);
    } catch (error) {
      console.error(`更新用户上下文失败: ${error}`);
      try {
        await fs.promises.unlink(tempFile);
      } catch (unlinkError) {
        // 忽略删除临时文件时的错误
      }
    }
  }

  async updateContextCommon(contextFile, newMessage, isAIReply = false, quotedMessage = null, quotedSender = null) {
    let context = [];
    try {
      if (fs.existsSync(contextFile)) {
        const content = await fs.promises.readFile(contextFile, 'utf-8');
        try {
          context = JSON.parse(content);
          if (!Array.isArray(context)) {
            console.warn(`上下文文件格式不正确，已重置为空数组: ${contextFile}`);
            context = [];
          }
        } catch (parseError) {
          console.error(`解析上下文文件失败: ${parseError}`);
          context = [];
        }
      }
      // 如果是AI回复，则添加前缀
      if (isAIReply) {
        newMessage = `${AI_DISPLAY_NAME}: ${newMessage}`;
      }
      const sequenceNumber = context.length > 0 ? context[context.length - 1].seq + 1 : 1;
      const now = new Date();
      const timestamp = now.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const messageObject = { seq: sequenceNumber, message: newMessage, timestamp };

      if (quotedMessage && quotedSender) {
        console.log('引用:', quotedMessage, '来自:', quotedSender);
        messageObject.message = `${messageObject.message} [引用: "${quotedMessage}" 来自 ${quotedSender}]`;
      }

      const similarMessageExists = context.some(msg => {
        const msgWithoutQuote = msg.message.split(' [引用:')[0].trim().toLowerCase();
        const newMsgWithoutQuote = messageObject.message.split(' [引用:')[0].trim().toLowerCase();
        return msgWithoutQuote === newMsgWithoutQuote;
      });

      if (!similarMessageExists) {
        context.push(messageObject);
      }

      return context;
    } catch (error) {
      console.error(`更新上下文失败: ${error}`);
      throw error;
    }
  }

  countContextUpdates(contextType, groupId, userId = null) {
    // 获取最新全局配置中设置的对话轮数
    const config = readJSON(PATHS.globalConfigPath) || {};
    const maxContextLength = config.MAX_CONTEXT_LENGTH || GLOBAL_CONFIG_DEFAULTS.MAX_CONTEXT_LENGTH;
    
    if (!this.contextCounts[contextType]) {
      this.contextCounts[contextType] = {};
    }

    if (contextType === 'group') {
      if (!this.contextCounts[contextType][groupId]) {
        this.contextCounts[contextType][groupId] = 0;
      }
      this.contextCounts[contextType][groupId]++;
      if (this.contextCounts[contextType][groupId] >= maxContextLength) {
        console.log(`群 ${groupId} 的上下文更新次数达到限制 (${maxContextLength})，已重置计数器。`);
        this.contextCounts[contextType][groupId] = 0;
      }
    } else if (contextType === 'user') {
      if (!this.contextCounts[contextType][groupId]) {
        this.contextCounts[contextType][groupId] = {};
      }
      if (!this.contextCounts[contextType][groupId][userId]) {
        this.contextCounts[contextType][groupId][userId] = 0;
      }
      this.contextCounts[contextType][groupId][userId]++;
      if (this.contextCounts[contextType][groupId][userId] >= maxContextLength) {
        console.log(`用户 ${userId} 在群 ${groupId} 的上下文更新次数达到限制 (${maxContextLength})，已重置计数器。`);
        this.contextCounts[contextType][groupId][userId] = 0;
      }
    }

    this.saveContextCounts();
  }

  async getFormattedContext(groupId) {
    const groupContextFile = path.join(PATHS.groupChatDir, `${groupId}_group_context.json`);
    try {
      if (!fs.existsSync(groupContextFile)) {
        return '';
      }
      const data = await fs.promises.readFile(groupContextFile, 'utf-8');
      let contextArr;
      try {
        contextArr = JSON.parse(data);
        if (!Array.isArray(contextArr)) {
          console.warn(`上下文文件格式不正确，已重置为空数组: ${groupContextFile}`);
          contextArr = [];
        }
      } catch (parseError) {
        console.error(`解析上下文文件失败: ${parseError}`);
        contextArr = [];
      }
      const formatted = contextArr.map(item => `${item.seq} [${item.timestamp || '无时间记录'}]: ${item.message}`).join('\n');
      return formatted;
    } catch (error) {
      console.error(`获取格式化上下文失败: ${error}`);
      return '';
    }
  }
}