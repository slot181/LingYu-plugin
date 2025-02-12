import fetch from 'node-fetch';
import { API_CONFIG } from '../../config/settings.js';

export class ApiClient {
  constructor(globalConfig) {
    this.globalConfig = globalConfig;
  }

  async sendMessage(prompt, imageBase64 = null) {
    const models = [this.globalConfig.model, ...this.globalConfig.backupModels];
    const maxRetries = this.globalConfig.maxRetries;
    const retryDelay = this.globalConfig.retryDelay;

    for (let i = 0; i <= maxRetries; i++) {
      const model = models[i] || models[0];
      const content = this.buildMessageContent(prompt, imageBase64);
      const options = this.buildRequestOptions(model, content);

      try {
        const response = await fetch(API_CONFIG.apiUrl, options);
        const responseData = await response.text();
        const result = await this.handleResponse(response, responseData, model, i);
        
        if (result) {
          return result;
        }

        if (response.status === 429) {
          console.log('请求过多，等待后重试');
          await new Promise(resolve => setTimeout(resolve, retryDelay * 2));
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } catch (error) {
        console.error(`请求模型 ${model} 时发生错误:`, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    }

    console.error('所有模型尝试均失败');
    return '抱歉，我现在遇到了一些问题，请稍后再试。';
  }

  buildMessageContent(prompt, imageBase64) {
    let content = [
      {
        type: "text",
        text: prompt
      }
    ];

    if (imageBase64) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`
        }
      });
    }

    return content;
  }

  buildRequestOptions(model, content) {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: content
          }
        ],
        temperature: 0.99,
        top_p: 0.95,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        max_tokens: 2000
      }),
    };
  }

  async handleResponse(response, responseData, model, retryCount) {
    let data;
    try {
      data = JSON.parse(responseData);
    } catch (parseError) {
      console.error('解析响应数据失败:', parseError);
      console.error('原始响应数据:', responseData);
      return null;
    }

    if (!response.ok || data.error) {
      const errorMessage = data.error?.message || `HTTP错误: ${response.status}`;
      console.error(`模型 ${model} 请求失败:`, errorMessage);
      
      if (data.error?.code === 500 && data.error?.message.includes("No candidates returned")) {
        console.log(`模型 ${model} 未返回候选项，尝试下一个模型`);
        return null;
      }
      return null;
    }

    if (data?.choices?.[0]?.message?.content) {
      if (retryCount > 0) {
        console.log(`使用备用模型 ${model} 成功回复`);
      }
      return data.choices[0].message.content;
    } else {
      console.error('API返回的数据结构不完整:', JSON.stringify(data, null, 2));
      return null;
    }
  }
}