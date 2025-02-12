import path from 'path';
const cwd = process.cwd();

export const API_CONFIG = {
  apiUrl: 'https://api.stonecoks.vip/v1/chat/completions',
  apiKey: 'sk-gKRl8Y0MyM4suN8j9KuR7q2ukPtEng8h2h0DFNbYrRrnvX3f'
};

export const BOT_SETTINGS = {
  REPLY_INTERVAL: 3000,
  IMAGE_PROBABILITY: 0.00,
  POKE_PROBABILITY: 0.15,
  AI_NAME: "清风影"
};

export const AI_NAMES = {
  AI_DISPLAY_NAME: `${BOT_SETTINGS.AI_NAME}(AI)`,
  KEYWORDS: [BOT_SETTINGS.AI_NAME, "莉娜"]
};

export const PATHS = {
  configDir: path.join(cwd, 'data/lingyu'),
  dataDir: path.join(cwd, 'data/lingyu', 'data'),
  groupChatDir: path.join(cwd, 'data/lingyu', 'data', 'group_chat'),
  userChatDir: path.join(cwd, 'data/lingyu', 'data', 'user_chat'),
  promptsDir: path.join(cwd, 'data/lingyu', 'prompts'),
  globalConfigPath: path.join(cwd, 'data/lingyu', 'global_config.json'),
  groupConfigPath: path.join(cwd, 'data/lingyu', 'group_config.json'),
  contextCountsPath: path.join(cwd, 'data/lingyu', 'context_counts.json'),
  chuoPath: '/root/TRSS_AllBot/TRSS-Yunzai/resources/image1/',
  imageFiles: ['1.gif','2.gif','3.gif','4.gif','5.gif','6.gif','7.gif','8.gif','9.gif','10.gif','11.gif','12.gif','13.gif','14.gif','15.gif','16.gif']
};

export const GLOBAL_CONFIG_DEFAULTS = {
  model: 'gemini-2.0-flash',
  MAX_CONTEXT_LENGTH: 20,
  backupModels: ['gemini-2.0-pro-exp-02-05'],
  maxRetries: 2,
  retryDelay: 5000,
  isMuted: false
};