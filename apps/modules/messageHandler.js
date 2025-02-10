import { AI_NAMES } from '../../config/settings.js';

export class MessageHandler {
  constructor() {
    this.processedMessages = new Set();
    setInterval(() => {
      this.processedMessages.clear();
    }, 3600000); // 每小时清理一次
  }

  processMessageContent(e, message) {
    let processedContent = '';
    for (let msg of message) {
      if (msg && typeof msg === 'object') {
        switch (msg.type) {
          case 'text':
            processedContent += msg.text;
            break;
          case 'image':
            processedContent += '[图片]';
            break;
          case 'face':
            processedContent += `[表情:${msg.id}]`;
            break;
          case 'at':
            if (msg.qq) {
              const member = e.group.pickMember(Number(msg.qq));
              if (member) {
                const atNickname = member.card || member.nickname;
                processedContent += `[@${atNickname}]`;
              } else {
                console.warn(`无法获取被@用户的昵称，QQ号: ${msg.qq}`);
                processedContent += '[@未知用户]';
              }
            } else {
              console.warn('at消息中缺少qq字段');
              processedContent += '[@未知用户]';
            }
            break;
          case 'file':
            processedContent += `[文件:${msg.name}]`;
            break;
          case 'video':
            processedContent += '[视频]';
            break;
          default:
            processedContent += `[${msg.type}]`;
        }
      } else {
        console.warn(`不正确的消息条目格式: ${JSON.stringify(msg)}`);
      }
    }
    return processedContent.trim();
  }

  processMessage(e) {
    const nickname = e.sender.card || e.sender.nickname;
    const userId = e.sender.user_id;
    const messageContent = this.processMessageContent(e, e.message);
    return `${nickname}(${userId}): ${messageContent}`;
  }

  containsKeyword(message, nickname) {
    const messageWithoutNickname = message.replace(nickname, '').trim();
    const contains = AI_NAMES.KEYWORDS.some(keyword => 
      messageWithoutNickname.toLowerCase().includes(keyword.toLowerCase())
    );
    if (contains) {
      console.log(`检测到关键词: ${messageWithoutNickname}`);
    }
    return contains;
  }

  async getImg(e) {
    if (e.at && !e.source) {
      e.img = [`https://q1.qlogo.cn/g?b=qq&s=0&nk=${e.at}`];
    }
    if (e.source) {
      let reply;
      let seq = e.isGroup ? e.source.seq : e.source.time;
      if (e.adapter === 'shamrock') {
        seq = e.source.message_id;
      }
      if (e.isGroup) {
        reply = (await e.group.getChatHistory(seq, 1)).pop()?.message;
      } else {
        reply = (await e.friend.getChatHistory(seq, 1)).pop()?.message;
      }
      if (reply) {
        let i = [];
        for (let val of reply) {
          if (val.type === 'image') {
            i.push(val.url);
          }
        }
        e.img = i;
      }
    }
    return e.img;
  }

  isMessageProcessed(messageId) {
    return this.processedMessages.has(messageId);
  }

  markMessageAsProcessed(messageId) {
    this.processedMessages.add(messageId);
  }

  async processReply(reply, groupId, bot) {
    let parts = reply.split('[SEP]');
    let processedParts = [];

    for (let part of parts) {
      part = part.trim();
      if (part !== "") {
        let processedPart = [];
        let textParts = part.split(/(\[@[^\]]+\])/);
        for (let textPart of textParts) {
          if (textPart.startsWith('[@') && textPart.endsWith(']')) {
            let userName = textPart.slice(2, -1);
            let userId = await this.findUserIdByNickname(userName, groupId, bot);
            if (userId) {
              processedPart.push({ type: 'at', qq: userId }, ' ');
            } else {
              processedPart.push(`@${userName} `);
            }
          } else if (textPart.trim() !== '') {
            processedPart.push(textPart.trim());
          }
        }
        if (processedPart.length > 0) {
          processedParts.push(processedPart);
        }
      }
    }

    return processedParts;
  }

  async findUserIdByNickname(nickname, groupId, bot) {
    try {
      let memberList = await bot.getGroupMemberList(groupId);
      console.log('搜索用户:', nickname);
      for (let member of memberList) {
        if (member.card === nickname || member.nickname === nickname) {
          console.log('找到用户:', member);
          return member.user_id;
        }
      }
      console.log('未找到用户:', nickname);
      return null;
    } catch (error) {
      console.error('查找用户ID时出错:', error);
      return null;
    }
  }
}