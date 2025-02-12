import plugin from "../../lib/plugins/plugin.js";
import { BOT_SETTINGS } from '../config/settings.js';
import { ContextManager } from './contextManager.js';
import { MessageHandler } from './messageHandler.js';
import { GroupManager } from './groupManager.js';
import { ApiClient } from './apiClient.js';
import { readJSON, writeJSON } from '../utils/fsUtils.js';
import common from "../../lib/common/common.js";
import { segment } from 'oicq';

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
          reg: '^#lingyu闭嘴(?:\\s+(\\d+))?$',
          fnc: 'muteGroup',
          permission: 'master,admin,owner'
        },
        {
          reg: '^#lingyu说话(?:\\s+(\\d+))?$',
          fnc: 'unmuteGroup',
          permission: 'master,admin,owner'
        },
        {
          reg: '^#lingyu全局闭嘴$',
          fnc: 'muteGlobal',
          permission: 'master'
        },
        {
          reg: '^#lingyu全局说话$',
          fnc: 'unmuteGlobal',
          permission: 'master'
        },
        {
          reg: '^#群上下文清除$',
          fnc: 'clearContext',
          permission: 'master,admin,owner'
        },
        {
          reg: '^#个人上下文清除$',
          fnc: 'UserClearContext'
        },
        {
          reg: '^#个人概要清除$',
          fnc: 'clearUserSummary'
        },
        {
          reg: '^#群概要清除$',
          fnc: 'clearGroupSummary',
          permission: 'master,admin,owner'
        },
        {
          reg: '^#全局清除$',
          fnc: 'globalClear',
          permission: 'master'
        },
        {
          reg: '^#lingyu清理配置(?:\\s+(\\d+))?$',
          fnc: 'clearGroupConfig',
          permission: 'master'
        },
        {
          reg: '^#lingyu群状态$',
          fnc: 'viewGroupStatus',
          permission: 'master'
        },
        {
          reg: '^#lingyu帮助$',
          fnc: 'showHelp'
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
    this.adminQQ = 1253403835;
  }

  loadGlobalConfig() {
    const config = readJSON('data/autobot/global_config.json') || {};
    const defaultConfig = {
      model: 'gemini-2.0-flash',
      MAX_CONTEXT_LENGTH: 20,
      backupModels: ['gemini-2.0-pro-exp-02-05'],
      maxRetries: 2,
      retryDelay: 5000,
      isMuted: false
    };
    return { ...defaultConfig, ...config };
  }

  saveGlobalConfig(config) {
    writeJSON('data/autobot/global_config.json', config);
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

  // 命令处理方法
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

  // ... 其他命令处理方法 ...

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
    const characterSettingPath = this.groupManager.getCharacterSetting(e.group_id);
    const characterSettingContent = await fs.promises.readFile(characterSettingPath, 'utf-8');
    const contextMessages = await this.contextManager.getFormattedContext(e.group_id);
    
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
    return e.user_id === this.adminQQ;
  }
}