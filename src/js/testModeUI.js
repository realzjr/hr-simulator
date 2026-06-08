/**
 * 测试模式UI — 浮动控制面板 + 结算页保存区域
 */

const TestModeUI = {
  _panelEl: null,

  /** 创建并注入浮动控制面板 */
  createPanel() {
    if (this._panelEl) return;

    const panel = document.createElement('div');
    panel.id = 'test-mode-panel';
    panel.className = 'test-mode-panel';
    panel.innerHTML = `
      <div class="test-mode-panel-header">
        <span class="test-mode-panel-title">🧪 测试模式</span>
        <button class="test-mode-panel-toggle" id="test-mode-toggle-btn">−</button>
      </div>
      <div class="test-mode-panel-body" id="test-mode-panel-body">
        <div class="test-mode-section">
          <label>场景跳转</label>
          <div class="test-mode-scene-nav">
            <select id="test-mode-scene-select">
              <option value="resume">筛简历</option>
              <option value="interview">面试</option>
              <option value="feedback">面试反馈</option>
              <option value="negotiation">谈薪</option>
              <option value="hrd-review">HRD评审</option>
              <option value="result">结算</option>
            </select>
            <button class="test-mode-btn" id="test-mode-jump-btn">跳转</button>
          </div>
        </div>
        <div class="test-mode-section">
          <button class="test-mode-btn test-mode-btn-rewind" id="test-mode-rewind-btn" disabled>⏪ 回退</button>
        </div>
        <div class="test-mode-section">
          <label>录制进度</label>
          <div class="test-mode-completeness" id="test-mode-completeness"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    this._panelEl = panel;

    // 折叠/展开
    document.getElementById('test-mode-toggle-btn').addEventListener('click', () => {
      const body = document.getElementById('test-mode-panel-body');
      const btn = document.getElementById('test-mode-toggle-btn');
      body.classList.toggle('collapsed');
      btn.textContent = body.classList.contains('collapsed') ? '+' : '−';
    });

    // 场景跳转
    document.getElementById('test-mode-jump-btn').addEventListener('click', () => {
      const scene = document.getElementById('test-mode-scene-select').value;
      this.jumpToScene(scene);
    });

    // 回退
    document.getElementById('test-mode-rewind-btn').addEventListener('click', () => {
      if (TestMode.restoreSnapshot()) {
        const scene = GameState.currentScene;
        this._rerenderScene(scene);
      }
    });

    this.updateCompleteness();
  },

  /** 移除浮动面板 */
  removePanel() {
    if (this._panelEl) {
      this._panelEl.remove();
      this._panelEl = null;
    }
  },

  /** 场景跳转 */
  jumpToScene(sceneName) {
    // 检查前置条件
    if (sceneName === 'resume' && GameState.candidates.length === 0) {
      alert('请先生成候选人'); return;
    }
    if (['interview', 'feedback', 'negotiation', 'hrd-review'].includes(sceneName) && GameState.passed.length === 0) {
      alert('请先完成简历筛选'); return;
    }

    TestMode.saveSnapshot();

    if (sceneName === 'result') {
      if (typeof calculateResult === 'function') calculateResult();
      switchScene('result');
      if (typeof renderResult === 'function') renderResult();
      return;
    }

    switchScene(sceneName);
    this._rerenderScene(sceneName);
  },

  /** 重新渲染指定场景 */
  _rerenderScene(sceneName) {
    switch (sceneName) {
      case 'resume':
        if (typeof renderResumeCard === 'function') renderResumeCard();
        break;
      case 'interview':
        if (typeof renderInterview === 'function') renderInterview();
        break;
      case 'feedback':
        if (typeof renderFeedback === 'function') renderFeedback();
        break;
      case 'negotiation':
        // 谈薪需要候选人上下文，从当前面试候选人启动
        const idx = GameState.currentInterviewIndex;
        if (idx < GameState.passed.length) {
          if (typeof startNegotiation === 'function') startNegotiation(GameState.passed[idx]);
        }
        break;
      case 'hrd-review':
        if (typeof renderHrdReviewLoading === 'function') renderHrdReviewLoading('📋 HRD正在review你的表现...');
        break;
    }
    this._updateRewindBtn();
  },

  /** 更新回退按钮状态 */
  _updateRewindBtn() {
    const btn = document.getElementById('test-mode-rewind-btn');
    if (btn) btn.disabled = !TestMode.hasSnapshot();
  },

  /** 更新录制进度显示 */
  updateCompleteness() {
    const el = document.getElementById('test-mode-completeness');
    if (!el) return;

    const report = TestMode.checkCompleteness();
    const cats = report.categories;

    const rows = [
      { label: '候选人', data: cats.candidates, fields: ['great', 'mid', 'bad'] },
      { label: '面试题', data: cats.interviewQuestions, fields: ['great', 'mid', 'bad'] },
      { label: '反问', data: cats.counterQuestions, fields: ['great', 'mid', 'bad'] },
      { label: '谈薪', data: cats.negotiations, fields: ['great', 'mid', 'bad'] },
      { label: '周报', data: cats.weeklyReports, fields: ['count'] },
    ];

    let html = '';
    for (const row of rows) {
      const ok = row.data && row.data.complete;
      const dot = ok ? '<span class="tm-dot tm-dot-ok"></span>' : '<span class="tm-dot tm-dot-no"></span>';
      const counts = row.fields.map(f => row.data[f] || 0).join('/');
      html += `<div class="tm-row">${dot}<span class="tm-label">${row.label}</span><span class="tm-count">${counts}</span></div>`;
    }

    // 面试回答（特殊：9组）
    const ia = cats.interviewAnswers || {};
    const iaOk = ia.complete;
    const iaTotal = ['great', 'mid', 'bad'].reduce((sum, t) =>
      sum + ['good', 'mid', 'bad'].reduce((s, q) => s + (ia[`${t}_${q}`] || 0), 0), 0);
    const iaDot = iaOk ? '<span class="tm-dot tm-dot-ok"></span>' : '<span class="tm-dot tm-dot-no"></span>';
    html += `<div class="tm-row">${iaDot}<span class="tm-label">面试答</span><span class="tm-count">${iaTotal}条/9组</span></div>`;

    // HRD来信
    const hl = cats.hrdLetters || {};
    const hlOk = hl.complete;
    const hlTotal = ['great_passed', 'great_failed', 'great_rejected', 'mid_passed', 'mid_failed', 'bad_blocked', 'bad_failed']
      .reduce((s, k) => s + (hl[k] || 0), 0);
    const hlDot = hlOk ? '<span class="tm-dot tm-dot-ok"></span>' : '<span class="tm-dot tm-dot-no"></span>';
    html += `<div class="tm-row">${hlDot}<span class="tm-label">HRD信</span><span class="tm-count">${hlTotal}条/5必需</span></div>`;

    el.innerHTML = html;
    this._updateRewindBtn();
  },

  /** 在结算页渲染保存区域 */
  renderSaveSection(container) {
    const report = TestMode.checkCompleteness();
    const cats = report.categories;

    const section = document.createElement('div');
    section.className = 'test-mode-save-section';

    let tableHTML = '<table class="tm-save-table"><thead><tr><th>类别</th><th>状态</th><th>详情</th></tr></thead><tbody>';

    const addRow = (label, complete, detail) => {
      const icon = complete ? '✅' : '❌';
      tableHTML += `<tr><td>${label}</td><td>${icon}</td><td>${detail}</td></tr>`;
    };

    addRow('候选人', cats.candidates.complete,
      `优质${cats.candidates.great} / 中等${cats.candidates.mid} / 较差${cats.candidates.bad}`);
    addRow('面试问题', cats.interviewQuestions.complete,
      `优${cats.interviewQuestions.great} / 中${cats.interviewQuestions.mid} / 差${cats.interviewQuestions.bad}`);

    const iaCounts = ['great', 'mid', 'bad'].map(t =>
      ['good', 'mid', 'bad'].map(q => cats.interviewAnswers[`${t}_${q}`] || 0).join('/')
    ).join(' | ');
    addRow('面试回答', cats.interviewAnswers.complete, iaCounts);

    addRow('反问环节', cats.counterQuestions.complete,
      `优${cats.counterQuestions.great} / 中${cats.counterQuestions.mid} / 差${cats.counterQuestions.bad}`);
    addRow('谈薪对话', cats.negotiations.complete,
      `优${cats.negotiations.great} / 中${cats.negotiations.mid} / 差${cats.negotiations.bad}`);

    const hlKeys = ['great_passed', 'great_failed', 'great_rejected', 'mid_passed', 'mid_failed', 'bad_blocked', 'bad_failed'];
    const hlDetail = hlKeys.map(k => `${k.replace('_', ' ')}:${cats.hrdLetters[k] || 0}`).join(', ');
    addRow('HRD来信', cats.hrdLetters.complete, hlDetail);

    addRow('周报', cats.weeklyReports.complete, `${cats.weeklyReports.count}条`);

    tableHTML += '</tbody></table>';

    const allOk = report.allComplete;

    section.innerHTML = `
      <div class="tm-save-header">🧪 测试模式 — 录制数据报告</div>
      ${tableHTML}
      <div class="tm-save-status">${allOk ? '✅ 数据完整，可保存为本地数据' : '⚠️ 数据不完整，建议多次游玩补全后再保存'}</div>
      <div class="tm-save-buttons">
        <button class="btn btn-primary" id="btn-tm-save">💾 保存本地数据</button>
        <button class="btn btn-outline" id="btn-tm-export">📥 导出JSON</button>
        <button class="btn btn-outline" id="btn-tm-replay">🔄 再来一局（继续录制）</button>
      </div>
      <div class="tm-save-msg" id="tm-save-msg"></div>
    `;

    container.appendChild(section);

    // 绑定事件
    document.getElementById('btn-tm-save').addEventListener('click', () => {
      const ok = TestMode.saveToLocalStorage();
      const msg = document.getElementById('tm-save-msg');
      msg.textContent = ok ? '✅ 已保存！下次选择本地模式即可使用录制数据。' : '❌ 保存失败';
      msg.className = 'tm-save-msg ' + (ok ? 'tm-save-ok' : 'tm-save-err');
    });

    document.getElementById('btn-tm-export').addEventListener('click', () => {
      TestMode.exportJSON();
    });

    document.getElementById('btn-tm-replay').addEventListener('click', () => {
      // 不清除录制数据，重新开始游戏
      GameState.reset();
      switchScene('menu');
      if (typeof renderMenu === 'function') renderMenu();
    });
  },
};
