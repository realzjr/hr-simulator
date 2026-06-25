/**
 * 主菜单渲染与交互
 */
function renderMenu() {
  const container = document.getElementById('scene-menu');

  const templateOptions = JOB_TEMPLATES.map((t, i) =>
    `<option value="${i}">${t.title}</option>`
  ).join('');

  function renderKeywordGroup(label, key) {
    const tags = JD_KEYWORDS[key].filter(k => k).map(k =>
      `<span class="jd-keyword-tag" data-kw="${k}">${k}</span>`
    ).join('');
    return `<div class="jd-kw-group"><span class="jd-kw-label">${label}</span>${tags}</div>`;
  }

  // 从localStorage恢复记住的API配置
  const savedApiKey = localStorage.getItem('hr_sim_api_key');
  const savedApiBase = localStorage.getItem('hr_sim_api_base');
  const savedProvider = localStorage.getItem('hr_sim_api_provider');
  if (savedApiKey) {
    GameState.apiKey = savedApiKey;
    GameState.apiBaseUrl = savedApiBase || '';
    // 迁移已删除的供应商
    let provider = savedProvider || 'deepseek';
    if (provider === 'qwen' || provider === 'grok') provider = 'deepseek';
    GameState.apiProvider = provider;
    GameState.mode = 'online';
    // 恢复自定义模型名
    if (provider === 'custom') {
      const savedFast = localStorage.getItem('hr_sim_custom_fast');
      const savedReasoning = localStorage.getItem('hr_sim_custom_reasoning');
      if (savedFast) API_PROVIDERS.custom.models.fast = savedFast;
      if (savedReasoning) API_PROVIDERS.custom.models.reasoning = savedReasoning;
    }
  }

  const isLocal = GameState.mode === 'local';

  container.innerHTML = `
    <div class="menu-icon">💼</div>
    <div>
      <div class="menu-title">HR 模拟器</div>
      <div class="menu-subtitle">🌟 成为最强人力资源官</div>
    </div>

    <div class="menu-profile-bar" id="menu-profile-bar">
      <span class="menu-profile-info" id="menu-profile-info"></span>
      <button class="menu-profile-change" id="menu-profile-change">✏️ 重新选择</button>
    </div>

    <div class="mode-toggle-section">
      <div class="mode-toggle">
        <button class="mode-btn ${isLocal ? 'active' : ''}" data-mode="local">📱 本地模式</button>
        <button class="mode-btn ${!isLocal ? 'active' : ''}" data-mode="online">🌐 在线模式</button>
      </div>
      <div class="mode-hint" id="mode-hint">${isLocal ? '无需联网，使用预设文案，即开即玩' : '已连接API，AI实时生成内容'}</div>
    </div>

    <div class="api-modal-overlay" id="api-modal-overlay">
      <div class="api-modal">
        <div class="api-modal-header">🤖 选择AI模型</div>
        <label>模型供应商</label>
        <div class="api-provider-grid" id="api-provider-grid">
          ${Object.entries(API_PROVIDERS).map(([id, p]) => `
            <button class="api-provider-btn${id === 'custom' ? ' api-provider-btn-wide' : ''}${GameState.apiProvider === id ? ' active' : ''}" data-provider="${id}">
              <span class="api-provider-icon">${p.icon}</span>
              <span class="api-provider-name">${p.name}</span>
            </button>
          `).join('')}
        </div>
        <div class="api-custom-fields" id="api-custom-fields" style="display:none;">
          <label>API 地址</label>
          <input type="text" id="api-base-input" placeholder="https://your-api.com/v1/chat/completions" value="${GameState.apiBaseUrl || ''}">
          <label>快速模型名称</label>
          <input type="text" id="api-custom-fast-model" placeholder="如 gpt-4o、deepseek-chat">
          <label>推理模型名称</label>
          <input type="text" id="api-custom-reasoning-model" placeholder="如 o3、deepseek-reasoner">
        </div>
        <label>API Key</label>
        <input type="password" id="api-key-input" placeholder="输入API Key" value="${GameState.apiKey || ''}">
        <div class="api-model-hint" id="api-model-hint"></div>
        <div class="api-modal-check">
          <input type="checkbox" id="api-remember" ${savedApiKey ? 'checked' : ''}> <label for="api-remember">记住配置</label>
        </div>
        <div class="api-modal-footer">
          <button class="btn btn-outline" id="api-modal-cancel">取消</button>
          <button class="btn btn-primary" id="api-modal-confirm">✅ 确认</button>
        </div>
      </div>
    </div>

    <div class="menu-jd-section">
      <label class="menu-jd-label">📌 选择预设岗位</label>
      <select class="menu-jd-select" id="jd-select">
        <option value="" disabled selected>${isLocal ? '— 请选择岗位 —' : '— 选择模板或用下方随机生成 —'}</option>
        ${templateOptions}
      </select>

      <label class="menu-jd-label" id="jd-divider" style="margin-top:14px;${isLocal ? 'display:none;' : ''}">✨ 用关键词随机生成JD</label>

      <div class="jd-keywords-panel" id="jd-keywords-panel" ${isLocal ? 'style="display:none"' : ''}>
        ${renderKeywordGroup('行业', '行业')}
        ${renderKeywordGroup('岗位', '岗位类型')}
        ${renderKeywordGroup('经验', '经验要求')}
        ${renderKeywordGroup('特殊', '特殊要求')}
      </div>
      <div class="jd-kw-custom-row" id="jd-kw-custom-row" ${isLocal ? 'style="display:none"' : ''}>
        <input type="text" class="jd-kw-input" id="jd-custom-kw" placeholder="也可输入自定义关键词，如：懂茶道的程序员">
      </div>
      <div class="jd-generate-row" id="jd-generate-row" ${isLocal ? 'style="display:none"' : ''}>
        <button class="btn btn-outline jd-generate-btn" id="btn-generate-jd-fun" data-style="fun">🎭 趣味版</button>
        <button class="btn btn-outline jd-generate-btn" id="btn-generate-jd-serious" data-style="serious">📋 严肃版</button>
      </div>

      <label class="menu-jd-label" id="jd-textarea-label" style="margin-top:12px;${isLocal ? 'display:none' : ''}">📝 职位描述（可手动编辑）</label>
      <textarea class="menu-jd-textarea" id="jd-textarea" rows="7" placeholder="选择模板、生成JD、或直接手写..." style="${isLocal ? 'display:none' : ''}"></textarea>
      <div class="menu-jd-preview" id="jd-preview" style="${isLocal ? '' : 'display:none'}"></div>

      <div class="menu-count-section">
        <label class="menu-jd-label">👥 候选人数量</label>
        <div class="count-picker">
          <button class="count-btn" data-delta="-1">−</button>
          <span class="count-value" id="count-value">3</span>
          <button class="count-btn" data-delta="+1">+</button>
        </div>
        <div class="count-hint">可选 1 ~ 5 人，推荐 2 ~ 3 人</div>
      </div>
    </div>

    <button class="btn btn-primary menu-start-btn" id="btn-start">🚀 开始招聘</button>
    <div class="menu-status" id="menu-status"></div>
    <div class="menu-progress-bar-wrap" id="menu-progress-bar-wrap" style="display:none;">
      <div class="menu-progress-bar">
        <div class="menu-progress-fill" id="menu-progress-fill"></div>
      </div>
      <div class="menu-progress-text" id="menu-progress-text"></div>
    </div>
    <div class="menu-errors" id="menu-errors"></div>
  `;

  // ===== 模式切换逻辑 =====
  function applyModeUI(mode) {
    const isLocal = mode === 'local';
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    const hint = document.getElementById('mode-hint');
    if (hint) hint.textContent = isLocal ? '无需联网，使用预设文案，即开即玩' : '已连接API，AI实时生成内容';

    // 在线模式专属组件：关键词面板、生成按钮、分隔线
    const onlineOnly = ['jd-divider', 'jd-keywords-panel', 'jd-kw-custom-row', 'jd-generate-row'];
    onlineOnly.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = isLocal ? 'none' : '';
    });

    // textarea + label vs 只读预览
    const textarea = document.getElementById('jd-textarea');
    const preview = document.getElementById('jd-preview');
    const textareaLabel = document.getElementById('jd-textarea-label');
    if (isLocal) {
      textarea.style.display = 'none';
      if (textareaLabel) textareaLabel.style.display = 'none';
      if (preview) {
        preview.style.display = '';
        preview.textContent = textarea.value || '';
      }
    } else {
      textarea.style.display = '';
      if (textareaLabel) { textareaLabel.style.display = ''; textareaLabel.style.marginTop = '12px'; }
      if (preview) preview.style.display = 'none';
    }

    // select 提示文字
    const select = document.getElementById('jd-select');
    if (select && select.options[0]) {
      select.options[0].textContent = isLocal ? '— 请选择岗位 —' : '— 选择模板或用下方随机生成 —';
    }

  }

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === 'local') {
        GameState.mode = 'local';
        applyModeUI('local');
      } else {
        // 在线模式：弹出API Key配置弹窗
        document.getElementById('api-modal-overlay').classList.add('visible');
      }
    });
  });

  // ===== API 弹窗逻辑 =====

  // 供应商选择
  let _selectedProvider = GameState.apiProvider || 'deepseek';

  function updateProviderUI() {
    document.querySelectorAll('.api-provider-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.provider === _selectedProvider);
    });
    const p = API_PROVIDERS[_selectedProvider];
    const hint = document.getElementById('api-model-hint');
    const customFields = document.getElementById('api-custom-fields');
    if (_selectedProvider === 'custom') {
      customFields.style.display = '';
      hint.textContent = '需要填写 API地址、快速模型、推理模型 和 API Key';
    } else {
      customFields.style.display = 'none';
      hint.textContent = `快速模型: ${p.models.fast} | 推理模型: ${p.models.reasoning}`;
    }
  }

  document.querySelectorAll('.api-provider-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedProvider = btn.dataset.provider;
      updateProviderUI();
    });
  });
  updateProviderUI();

  document.getElementById('api-modal-cancel').addEventListener('click', () => {
    document.getElementById('api-modal-overlay').classList.remove('visible');
    if (!GameState.apiKey) {
      GameState.mode = 'local';
      applyModeUI('local');
    }
  });

  document.getElementById('api-modal-confirm').addEventListener('click', () => {
    const keyInput = document.getElementById('api-key-input');
    const remember = document.getElementById('api-remember').checked;
    const key = keyInput.value.trim();

    if (!key) {
      keyInput.style.borderColor = '#ef4444';
      keyInput.placeholder = '请输入API Key';
      setTimeout(() => { keyInput.style.borderColor = ''; }, 1500);
      return;
    }

    GameState.apiKey = key;
    GameState.apiProvider = _selectedProvider;
    if (_selectedProvider === 'custom') {
      const baseInput = document.getElementById('api-base-input');
      GameState.apiBaseUrl = baseInput.value.trim();
      // 保存自定义模型名到 API_PROVIDERS.custom
      const fastModel = document.getElementById('api-custom-fast-model').value.trim();
      const reasonModel = document.getElementById('api-custom-reasoning-model').value.trim();
      API_PROVIDERS.custom.models.fast = fastModel || 'gpt-4o';
      API_PROVIDERS.custom.models.reasoning = reasonModel || fastModel || 'gpt-4o';
    } else {
      GameState.apiBaseUrl = '';
    }
    GameState.mode = 'online';

    if (remember) {
      localStorage.setItem('hr_sim_api_key', key);
      localStorage.setItem('hr_sim_api_base', GameState.apiBaseUrl);
      localStorage.setItem('hr_sim_api_provider', GameState.apiProvider);
      if (_selectedProvider === 'custom') {
        localStorage.setItem('hr_sim_custom_fast', API_PROVIDERS.custom.models.fast);
        localStorage.setItem('hr_sim_custom_reasoning', API_PROVIDERS.custom.models.reasoning);
      }
    } else {
      localStorage.removeItem('hr_sim_api_key');
      localStorage.removeItem('hr_sim_api_base');
      localStorage.removeItem('hr_sim_api_provider');
      localStorage.removeItem('hr_sim_custom_fast');
      localStorage.removeItem('hr_sim_custom_reasoning');
    }

    document.getElementById('api-modal-overlay').classList.remove('visible');
    applyModeUI('online');
  });

  // 点击遮罩关闭弹窗
  document.getElementById('api-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('api-modal-overlay').classList.remove('visible');
      if (!GameState.apiKey) {
        GameState.mode = 'local';
        applyModeUI('local');
      }
    }
  });

  // ===== 预设岗位选择（追踪 currentJDIndex） =====
  document.getElementById('jd-select').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val !== '') {
      GameState.currentJDIndex = parseInt(val);
      const jdText = JOB_TEMPLATES[GameState.currentJDIndex].description;
      document.getElementById('jd-textarea').value = jdText;
      // 同步只读预览
      const preview = document.getElementById('jd-preview');
      if (preview) preview.textContent = jdText;
    }
  });

  // 关键词点击
  document.querySelectorAll('.jd-keyword-tag').forEach(tag => {
    tag.addEventListener('click', () => tag.classList.toggle('selected'));
  });

  // 候选人数量加减
  let _candidateCount = 3;
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.delta);
      _candidateCount = Math.max(1, Math.min(5, _candidateCount + delta));
      document.getElementById('count-value').textContent = _candidateCount;
    });
  });

  // 存取数量的getter
  container._getCandidateCount = () => _candidateCount;

  document.getElementById('btn-generate-jd-fun').addEventListener('click', () => generateJD('fun'));
  document.getElementById('btn-generate-jd-serious').addEventListener('click', () => generateJD('serious'));
  document.getElementById('btn-start').addEventListener('click', startGame);

  // ===== HR角色信息栏 =====
  const profileInfo = document.getElementById('menu-profile-info');
  const profileBar = document.getElementById('menu-profile-bar');
  if (profileInfo && GameState.hrStyle) {
    const styleLabels = {
      male_mature: '👨‍💼 成熟知性',
      male_youthful: '👨‍💼 阳光青春',
      female_mature: '👩‍💼 成熟知性',
      female_youthful: '👩‍💼 阳光青春',
    };
    profileInfo.textContent = styleLabels[GameState.hrStyle] || '';
    profileBar.style.display = '';
  } else if (profileBar) {
    profileBar.style.display = 'none';
  }
  document.getElementById('menu-profile-change').addEventListener('click', () => {
    GameState.playerGender = '';
    GameState.hrStyle = '';
    renderIntro();
    switchScene('intro');
  });

}

/** 状态显示辅助 */
function showStatus(msg) {
  const el = document.getElementById('menu-status');
  if (el) el.textContent = msg;
  console.log('[菜单]', msg);
}

function showProgressBar(current, total, text) {
  const wrap = document.getElementById('menu-progress-bar-wrap');
  const fill = document.getElementById('menu-progress-fill');
  const textEl = document.getElementById('menu-progress-text');
  if (!wrap) return;
  wrap.style.display = 'block';
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  fill.style.width = pct + '%';
  textEl.textContent = text || `${current} / ${total}`;
}

function hideProgressBar() {
  const wrap = document.getElementById('menu-progress-bar-wrap');
  if (wrap) wrap.style.display = 'none';
}

function showErrors(errors) {
  const el = document.getElementById('menu-errors');
  if (!el || errors.length === 0) return;
  el.innerHTML = `
    <div class="menu-error-box">
      <div class="menu-error-title">⚠️ 生成过程中出现问题：</div>
      ${errors.map(e => `<div class="menu-error-item">• ${e}</div>`).join('')}
      <div class="menu-error-hint">部分简历已用本地数据替代，游戏仍可正常进行</div>
    </div>
  `;
}

/**
 * 用选中的关键词 + 自定义输入，调AI生成JD
 */
async function generateJD(style) {
  // 本地模式不允许生成JD
  if (GameState.mode === 'local') {
    showStatus('本地模式请使用预设岗位');
    return;
  }

  const btnFun = document.getElementById('btn-generate-jd-fun');
  const btnSerious = document.getElementById('btn-generate-jd-serious');
  const textarea = document.getElementById('jd-textarea');

  const selected = [];
  document.querySelectorAll('.jd-keyword-tag.selected').forEach(tag => {
    selected.push(tag.dataset.kw);
  });
  const customKw = document.getElementById('jd-custom-kw').value.trim();
  if (customKw) selected.push(customKw);

  if (selected.length === 0) {
    showStatus('请至少选择一个关键词或输入自定义关键词');
    return;
  }

  btnFun.disabled = true;
  btnSerious.disabled = true;
  const activeBtn = style === 'serious' ? btnSerious : btnFun;
  const origText = activeBtn.textContent;
  activeBtn.textContent = '⏳ 生成中...';
  showStatus('⏳ 正在生成职位描述...');

  // 生成JD意味着自定义内容，currentJDIndex设为-1
  GameState.currentJDIndex = -1;

  try {
    const prompt = PROMPTS.generateJD(selected.join('、'), style);
    console.log('[生成JD] prompt已构建，正在调用API...');
    const result = await DeepSeekAPI.chat(prompt);

    btnFun.disabled = false;
    btnSerious.disabled = false;
    activeBtn.textContent = origText;

    if (result) {
      textarea.value = result;
      showStatus('✅ JD生成完成，可继续编辑后开始招聘');
    } else {
      showStatus('❌ 生成失败，返回为空。请检查网络连接或打开控制台查看日志');
    }
  } catch (e) {
    btnFun.disabled = false;
    btnSerious.disabled = false;
    activeBtn.textContent = origText;
    showStatus('❌ 发生异常：' + e.message);
    console.error('[生成JD] 异常:', e);
  }
}

/**
 * 开始游戏
 */
async function startGame() {
  const btn = document.getElementById('btn-start');
  const jd = document.getElementById('jd-textarea').value.trim();
  const container = document.getElementById('scene-menu');
  const count = container._getCandidateCount ? container._getCandidateCount() : 6;

  if (!jd) {
    showStatus(GameState.mode === 'local' ? '请先选择一个预设岗位' : '请先填写职位描述（选模板/生成/手写均可）');
    return;
  }

  const savedJDIndex = GameState.currentJDIndex;
  GameState.reset();
  GameState.currentJDIndex = savedJDIndex;
  GameState.currentJD = jd;

  // 本地模式：按需加载JD数据
  if (GameState.mode === 'local' && savedJDIndex >= 0) {
    try { await LDS.load(savedJDIndex); } catch(e) { console.warn('数据加载失败:', e); }
  }

  // 切换到加载场景
  switchScene('loading');
  renderLoadingScene();
  showLoadingProgress(0, count, 0);

  try {
    const { candidates, failedSlots, errors } = await CandidateFactory.createBatchSequential(
      jd,
      count,
      (current, total, statusText, readyCount) => {
        showLoadingProgress(current, total, readyCount !== undefined ? readyCount : null);
      }
    );

    GameState.candidates = candidates;

    if (failedSlots.length > 0) {
      // 有失败项：显示错误 + 重试/跳过按钮
      showLoadingErrors(errors);
      await handleFailedSlots(jd, candidates, failedSlots);
      return; // 后续由按钮回调驱动
    }
  } catch (e) {
    console.error('AI生成全部失败:', e);
    // 全部异常：显示重试整体的按钮
    showLoadingErrors([`整体生成异常：${e.message}`]);
    showLoadingRetryActions(count, () => startGame(), () => {}, 0);
    return;
  }

  proceedToResume();
}

/**
 * 处理部分失败的槽位：展示重试/跳过按钮
 */
function handleFailedSlots(jd, candidates, failedSlots) {
  return new Promise(resolve => {
    showLoadingRetryActions(
      failedSlots.length,
      // 重试回调
      async () => {
        const existingNames = candidates.map(c => c.name);
        let stillFailed = [];

        for (let i = 0; i < failedSlots.length; i++) {
          const slot = failedSlots[i];
          showLoadingProgress(i, failedSlots.length, candidates.length);
          const progressText = document.getElementById('loading-progress-text');
          if (progressText) progressText.textContent = `重试中……（${i + 1}/${failedSlots.length}）`;

          const { candidate, error } = await CandidateFactory.retryOne(
            jd, slot.tier, existingNames, slot.index, null
          );

          if (candidate) {
            existingNames.push(candidate.name);
            candidates.push(candidate);
          } else {
            stillFailed.push(slot);
          }
        }

        GameState.candidates = candidates.sort(() => Math.random() - 0.5);

        if (stillFailed.length > 0) {
          // 仍有失败：再次展示按钮
          showLoadingErrors(stillFailed.map(s => `第${s.index}份简历仍然生成失败`));
          handleFailedSlots(jd, GameState.candidates, stillFailed);
        } else {
          proceedToResume();
        }
        resolve();
      },
      // 跳过回调
      () => {
        GameState.candidates = candidates.sort(() => Math.random() - 0.5);
        proceedToResume();
        resolve();
      },
      candidates.length
    );
  });
}

/**
 * 进入简历筛选环节
 */
function proceedToResume() {
  GameState.currentResumeIndex = 0;
  GameState.passed = [];
  switchScene('resume');
  renderResumeCard();
}
