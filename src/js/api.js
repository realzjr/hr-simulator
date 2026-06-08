/**
 * AI API 封装
 * 支持多供应商：DeepSeek、OpenAI、Claude、Gemini、Kimi、智谱 等
 *
 * 每个供应商映射两类模型：
 *   - fast: 快速对话（面试问答、谈薪）
 *   - reasoning: 深度推理（简历生成、HRD来信、周报）
 */

/** API供应商注册表 */
const API_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    icon: '🔮',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: { fast: 'deepseek-v4-flash', reasoning: 'deepseek-v4-flash' },
    noTempModels: [],
    thinking: { reasoning: true, effort: 'high' },
  },
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    models: { fast: 'gpt-4o', reasoning: 'o3' },
    noTempModels: ['o3'],
  },
  claude: {
    name: 'Claude (Anthropic)',
    icon: '🧠',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    models: { fast: 'claude-sonnet-4-6', reasoning: 'claude-opus-4-6' },
    noTempModels: [],
    customFormat: 'anthropic',
  },
  gemini: {
    name: 'Gemini (Google)',
    icon: '💎',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: { fast: 'gemini-3.0-flash', reasoning: 'gemini-3.0-pro' },
    noTempModels: [],
  },
  kimi: {
    name: 'Kimi (月之暗面)',
    icon: '🌙',
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    models: { fast: 'moonshot-v1-auto', reasoning: 'kimi-k2' },
    noTempModels: [],
  },
  zhipu: {
    name: '智谱 GLM',
    icon: '🔬',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: { fast: 'glm-4-plus', reasoning: 'glm-4-long' },
    noTempModels: [],
  },
  custom: {
    name: '自定义（OpenAI兼容）',
    icon: '⚙️',
    baseUrl: '',
    models: { fast: '', reasoning: '' },
    noTempModels: [],
  },
};

/** 游戏日志收集器 */
const GameLog = {
  _entries: [],
  log(type, msg, detail) {
    this._entries.push({
      time: new Date().toLocaleTimeString(),
      type,
      msg,
      detail: detail || '',
    });
  },
  getAll() { return this._entries; },
  getText() {
    return this._entries.map(e =>
      `[${e.time}] [${e.type}] ${e.msg}${e.detail ? '\n  ' + e.detail : ''}`
    ).join('\n');
  },
};

const DeepSeekAPI = {

  /**
   * 获取当前供应商配置
   */
  _getProvider() {
    return API_PROVIDERS[GameState.apiProvider] || API_PROVIDERS.deepseek;
  },

  /**
   * 将内部模型角色映射为实际模型名及是否启用思考模式
   * 返回 { model, role } — role 为 'fast' 或 'reasoning'
   */
  _resolveModel(requestedModel) {
    const provider = this._getProvider();
    if (requestedModel === 'deepseek-reasoner') {
      return { model: provider.models.reasoning || provider.models.fast, role: 'reasoning' };
    }
    return { model: provider.models.fast, role: 'fast' };
  },

  /**
   * 调用 AI API
   * @param {string} prompt
   * @param {object} opts - { model, temperature }
   */
  async chat(prompt, opts = {}) {
    // 本地模式：跳过API调用，返回null让各模块走本地数据
    if (GameState.mode === 'local') {
      console.log('[API] 本地模式，跳过API调用');
      return null;
    }

    const provider = this._getProvider();
    const requestedModel = opts.model || 'deepseek-chat';
    const { model, role } = this._resolveModel(requestedModel);
    const isReasoning = role === 'reasoning';

    const modeLabel = isReasoning && provider.thinking?.reasoning ? `${model}+thinking` : model;
    console.log(`%c[API] 发送请求 (${provider.name}/${modeLabel})`, 'color:blue;font-weight:bold', '长度:', prompt.length);
    GameLog.log('API', `发送请求 (${provider.name}/${modeLabel})`, `prompt长度: ${prompt.length}`);

    // Anthropic Claude 使用不同的请求格式
    if (provider.customFormat === 'anthropic') {
      return this._chatAnthropic(prompt, model, opts);
    }

    // OpenAI兼容格式（DeepSeek、OpenAI、Gemini、Kimi、智谱等）
    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
    };

    // DeepSeek 思考模式：reasoning 角色启用 thinking
    if (isReasoning && provider.thinking?.reasoning) {
      body.thinking = { type: 'enabled' };
      body.reasoning_effort = provider.thinking.effort || 'high';
    }

    const noTemp = (provider.noTempModels || []).includes(model);
    if (!noTemp && !(isReasoning && provider.thinking?.reasoning)) {
      body.temperature = opts.temperature ?? 0.9;
    }

    const timeoutMs = isReasoning ? 90000 : 45000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let fetchUrl = '/api/chat';
      const headers = { 'Content-Type': 'application/json' };

      if (GameState.apiKey) {
        fetchUrl = GameState.apiBaseUrl || provider.baseUrl;
        headers['Authorization'] = `Bearer ${GameState.apiKey}`;
      }

      const resp = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      console.log('%c[API] HTTP状态:', 'color:blue', resp.status);
      const data = await resp.json();

      if (!resp.ok) {
        console.error('[API] 服务端错误:', data.error || data);
        GameLog.log('ERROR', `服务端错误 (${model})`, JSON.stringify(data.error || data).substring(0, 200));
        return null;
      }

      if (!data.choices || !data.choices[0]) {
        console.error('[API] 返回结构异常:', data);
        return null;
      }

      const msg = data.choices[0].message;
      if (msg.reasoning_content) {
        console.log(`%c[API] 思考内容 (${modeLabel})`, 'color:gray', '长度:', msg.reasoning_content.length);
      }
      const content = msg.content;
      console.log(`%c[API] 收到回复 (${modeLabel})`, 'color:green;font-weight:bold', '长度:', content.length);
      GameLog.log('API', `收到回复 (${modeLabel})`, `回复长度: ${content.length}`);
      return content;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.error(`[API] 请求超时 (${timeoutMs / 1000}s)`, model);
        GameLog.log('ERROR', `请求超时 (${model})`, `${timeoutMs / 1000}秒未响应`);
        return null;
      }
      console.error('[API] 请求异常:', e.name, e.message);
      GameLog.log('ERROR', `请求异常 (${model})`, e.message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Anthropic Claude API 专用格式
   */
  async _chatAnthropic(prompt, model, opts) {
    const provider = this._getProvider();
    const isReasoning = model === provider.models.reasoning;
    const timeoutMs = isReasoning ? 90000 : 45000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchUrl = GameState.apiBaseUrl || provider.baseUrl;

      const resp = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': GameState.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts.temperature ?? 0.9,
        }),
        signal: controller.signal,
      });

      const data = await resp.json();
      if (!resp.ok) {
        console.error('[API] Claude错误:', data.error || data);
        GameLog.log('ERROR', `Claude错误 (${model})`, JSON.stringify(data.error || data).substring(0, 200));
        return null;
      }

      const content = data.content && data.content[0] && data.content[0].text;
      if (!content) {
        console.error('[API] Claude返回结构异常:', data);
        return null;
      }

      console.log(`%c[API] 收到回复 (${model})`, 'color:green;font-weight:bold', '长度:', content.length);
      GameLog.log('API', `收到回复 (${model})`, `回复长度: ${content.length}`);
      return content;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.error(`[API] Claude请求超时 (${timeoutMs / 1000}s)`, model);
        GameLog.log('ERROR', `Claude请求超时 (${model})`, `${timeoutMs / 1000}秒未响应`);
        return null;
      }
      console.error('[API] Claude请求异常:', e.name, e.message);
      GameLog.log('ERROR', `Claude请求异常 (${model})`, e.message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * 调用API并解析JSON响应
   * @param {string} prompt
   * @param {object} opts - { model, temperature }
   */
  async chatJSON(prompt, opts = {}) {
    const text = await this.chat(prompt, opts);
    if (!text) return null;
    try {
      let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e1) {
      try {
        const m = text.match(/\[[\s\S]*\]/);
        if (m) return JSON.parse(m[0]);
      } catch (_) {}
      try {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
      } catch (_) {}
      console.error('[API] JSON解析失败:', text.substring(0, 300));
      return null;
    }
  },
};

// 页面加载后自动检测 API 连通性（本地模式跳过）
document.addEventListener('DOMContentLoaded', async () => {
  if (GameState.mode === 'local') {
    console.log('%c[API] 本地模式，跳过连通性检测', 'color:orange;font-weight:bold');
    return;
  }
  // 在线模式连通性检测（仅代理模式）
  if (!GameState.apiKey) {
    console.log('%c[API] 正在检测代理连通性...', 'color:orange;font-weight:bold');
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [{ role: 'user', content: '回复OK' }],
          temperature: 0, max_tokens: 5,
        }),
      });
      const d = await r.json();
      if (d.choices) {
        console.log('%c[API] 连通性正常 ✓', 'color:green;font-weight:bold', d.choices[0].message.content);
      } else {
        console.error('[API] 连通性异常:', d);
      }
    } catch (e) {
      console.error('[API] 连通性检测失败:', e.message);
    }
  }
});
