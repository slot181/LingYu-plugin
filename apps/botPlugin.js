import plugin from '../../../lib/plugins/plugin.js'
import { BOT_SETTINGS, PATHS, GLOBAL_CONFIG_DEFAULTS, ADMIN_QQ } from '../config/settings.js';
import { ContextManager } from './modules/contextManager.js';
import { MessageHandler } from './modules/messageHandler.js';
import { GroupManager } from './modules/groupManager.js';
import { ApiClient } from './modules/apiClient.js';
import { readJSON, writeJSON } from '../utils/fsUtils.js';
import common from '../../../lib/common/common.js';
import { segment } from 'oicq';
import fs from 'fs';
import { initializeAppConfig } from '../components/Config.js';
initializeAppConfig();

export class LingYuPlugin extends plugin {
  constructor() {
    super({
      name: 'LingYu-Chat',
      dsc: 'LingYu聊天服务',
      event: 'message',
      priority: 99999,
      rule: [
        {
          reg: '^#lingyu设置模型\\s+(.+)$',
          fnc: 'setModel',
          permission: 'master'
        },
        {
          reg: '^#lingyu设置对话轮数\\s+(\\d+)$',
          fnc: 'setConversationRounds',
          permission: 'master'
        },
        {
          reg: '^#lingyu设置概率(?:\\s+(\\d+))?\\s+(0?\\.\\d+|1(?:\\.0+)?)$',
          fnc: 'setProbability',
          permission: 'master,admin,owner'
        },
        {
          reg: '^(?![#\\/])[\\s\\S]*$',
          fnc: 'groupchat'
        }
      ]
    });

    this.contextManager = new ContextManager();
    this.messageHandler = new MessageHandler();
    this.groupManager = new GroupManager();
    this.apiClient = new ApiClient(this.loadGlobalConfig());
  }

  // 加载全局配置
  loadGlobalConfig() {
    const config = readJSON(PATHS.globalConfigPath) || {};
    return { ...GLOBAL_CONFIG_DEFAULTS, ...config };
  }
  
  saveGlobalConfig(config) {
    writeJSON(PATHS.globalConfigPath, config);
  }

  async reply(content, quote = false) {
    if (Array.isArray(content)) {
      for (let part of content) {
        await this.e.reply(part, quote);
        await new Promise(resolve => setTimeout(resolve, BOT_SETTINGS.REPLY_INTERVAL));
      }
    } else {
      await this.e.reply(content, quote);
    }
  }

  async sendReplyWithEffects(processedReply, e) {
    if (!processedReply) return;

    for (let part of processedReply) {
      await e.reply(part, false);
      await new Promise(resolve => setTimeout(resolve, BOT_SETTINGS.REPLY_INTERVAL));
    }

    if (Math.random() < BOT_SETTINGS.IMAGE_PROBABILITY) {
      let random_index = Math.floor(Math.random() * BOT_SETTINGS.imageFiles.length);
      let image_path = `${BOT_SETTINGS.chuoPath}${BOT_SETTINGS.imageFiles[random_index]}`;
      await e.reply(segment.image(`file:///${image_path}`));
    }

    if (Math.random() < BOT_SETTINGS.POKE_PROBABILITY) {
      await e.group.pokeMember(e.sender.user_id);
    }
  }

  // 模型命令处理方法
  async setModel(e) {
    const match = e.msg.match(/^#lingyu设置模型\s+(.+)$/);
    if (!match) return;

    const newModel = match[1].trim();
    const config = this.loadGlobalConfig();
    config.model = newModel;
    this.saveGlobalConfig(config);
    await this.reply(`模型已设置为 ${newModel}`, false);
  }

  async setConversationRounds(e) {
    const match = e.msg.match(/^#lingyu设置对话轮数\s+(\d+)$/);
    if (!match) return;

    const rounds = parseInt(match[1]);
    if (isNaN(rounds) || rounds <= 0) {
      await this.reply('请输入有效的正整数作为对话轮数。', false);
      return;
    }

    const config = this.loadGlobalConfig();
    config.MAX_CONTEXT_LENGTH = rounds;
    this.saveGlobalConfig(config);
    await this.reply(`已将对话轮数设置为 ${rounds}。`, false);
  }

  async setProbability(e) {
    const match = e.msg.match(/^#lingyu设置概率(?:\s+(\d+))?\s+([01](\.\d+)?)$/);
    if (!match) {
      await this.reply('请输入有效的概率值，格式如: #lingyu设置概率 0.99', false);
      return;
    }

    const [, groupId, probabilityStr] = match;
    const probability = parseFloat(probabilityStr);
    const targetGroupId = groupId || e.group_id;

    if (!this.isMaster(e) && groupId) {
      await this.reply('只有master可以为其他群组设置概率', false);
      return;
    }

    this.groupManager.setGroupReplyProbability(targetGroupId, probability);
    await this.reply(`已将群 ${targetGroupId} 的回复概率设置为 ${probability}`, false);
  }

  // Bot对话处理方法
  async groupchat(e) {
    if (!e.isGroup || e.self_id === e.sender.user_id) return false;

    const config = this.loadGlobalConfig();
    if (config.isMuted) return false;

    if (!this.groupManager.isPluginEnabled(e.group_id)) return false;

    const messageId = e.message_id || e.time;
    if (this.messageHandler.isMessageProcessed(messageId)) return false;

    const processedMessage = this.messageHandler.processMessage(e);
    const containsKeyword = this.messageHandler.containsKeyword(processedMessage, e.sender.card || e.sender.nickname);
    
    await this.contextManager.updateContext(e.group_id, processedMessage);

    if (containsKeyword || Math.random() < this.groupManager.getReplyProbability(e.group_id)) {
      if (this.groupManager.isInCooldown(e.group_id)) return false;

      await this.contextManager.updateUserContext(e.group_id, e.sender.user_id, processedMessage);

      try {
        const reply = await this.generateAndProcessReply(e);
        if (reply) {
          await this.sendReplyWithEffects(reply, e);
          this.groupManager.updateLastReplyTime(e.group_id);
        }
      } catch (error) {
        console.error('处理群聊消息时出错:', error);
      }
    }

    this.messageHandler.markMessageAsProcessed(messageId);
    return false;
  }

  async generateAndProcessReply(e) {
    const imageBase64 = await this.processImage(e);
    const prompt = await this.buildPrompt(e);
    const reply = await this.apiClient.sendMessage(prompt, imageBase64);
    
    if (!reply) return null;

    console.log('AI原始回复:', reply);
    const cleanedReply = this.cleanReply(reply);
    
    await this.updateContexts(e.group_id, e.sender.user_id, cleanedReply);
    return await this.messageHandler.processReply(cleanedReply, e.group_id, this.bot);
  }

  async processImage(e) {
    const imgUrls = await this.messageHandler.getImg(e);
    if (!imgUrls?.length) return null;

    try {
      const response = await fetch(imgUrls[0]);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    } catch (error) {
      console.error('处理图片时出错:', error);
      return null;
    }
  }

  async buildPrompt(e) {
    const groupId = e.group_id || '读取群组ID失败';
    const characterSettingPath = this.groupManager.getCharacterSetting(groupId);
    let characterSettingContent = '';
    try {
      characterSettingContent = await fs.promises.readFile(characterSettingPath, 'utf-8');
    } catch (error) {
      console.error("读取角色设定失败", error);
      characterSettingContent = '默认AI助手';
    }
    const contextMessages = await this.contextManager.getFormattedContext(groupId);
    
    return `${characterSettingContent}\n\n${contextMessages}\n\n${this.messageHandler.processMessage(e)}`;
  }

  cleanReply(reply) {
    return reply
      .replace(/^.*\(AI\):\s*/, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
      .replace(/```[\s\S]*?```/g, '');
  }

  async updateContexts(groupId, userId, reply) {
    await this.contextManager.updateContext(groupId, reply, true);
    await this.contextManager.updateUserContext(groupId, userId, reply, true);
  }

  isMaster(e) {
    return e.sender && e.sender.user_id === ADMIN_QQ;
  }
}