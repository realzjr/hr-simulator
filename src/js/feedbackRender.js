/**
 * 面试反馈表渲染
 * 面试结束后进入此场景，展示三维度评分 + 回顾面试录音（可折叠）
 */

/**
 * 生成单个维度的半星评分行HTML
 * 分数: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5
 */
function renderDimensionRow(dim, label, desc) {
  // 生成半星按钮：每个整数星位有左半(n-0.5)和右半(n)两个点击区
  let starsHTML = `<button class="dim-star dim-star-zero" data-dim="${dim}" data-score="0">✕</button>`;
  for (let n = 1; n <= 5; n++) {
    starsHTML += `<span class="dim-star-group" data-dim="${dim}">` +
      `<button class="dim-star dim-star-half-left" data-dim="${dim}" data-score="${n - 0.5}" title="${n - 0.5}星"></button>` +
      `<button class="dim-star dim-star-half-right" data-dim="${dim}" data-score="${n}" title="${n}星"></button>` +
      `</span>`;
  }
  return `
    <div class="rating-dimension" data-dim="${dim}">
      <div>
        <div class="dimension-label">${label}</div>
        <div class="dimension-desc">${desc}</div>
      </div>
      <div class="dimension-stars">${starsHTML}</div>
    </div>`;
}

function renderFeedback() {
  const container = document.getElementById('scene-feedback');
  const idx = GameState.currentInterviewIndex;
  const total = GameState.passed.length;
  const c = GameState.passed[idx];
  const dialogs = GameState.interviewDialogs[c.id] || [];

  // 对话录音HTML（区分面试问答和候选人提问环节）
  let dialogHTML = '';
  if (dialogs.length === 0) {
    dialogHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;font-size:13px;">（未进行任何问答）</div>';
  } else {
    const regularDialogs = dialogs.filter(d => !d.question.startsWith('【提问'));
    const counterDialogs = dialogs.filter(d => d.question.startsWith('【提问'));

    const mdRender = typeof simpleMarkdown === 'function' ? simpleMarkdown : escapeHTML;
    dialogHTML = regularDialogs.map(d => `
      <div class="dialog-turn">
        <div class="dialog-q">${escapeHTML(d.question)}</div>
        <div class="dialog-a">${mdRender(d.answer)}</div>
        ${d.response ? `<div class="dialog-response">${escapeHTML(d.response)}</div>` : ''}
      </div>
    `).join('');

    if (counterDialogs.length > 0) {
      dialogHTML += `<div class="dialog-section-divider">🙋 候选人提问环节</div>`;
      dialogHTML += counterDialogs.map(d => `
        <div class="dialog-turn dialog-turn-counter">
          <div class="dialog-q dialog-q-counter">${escapeHTML(d.question.replace(/^【提问第\d+轮】/, ''))}</div>
          <div class="dialog-a dialog-a-counter">${mdRender(d.answer)}</div>
        </div>
      `).join('');
    }
  }

  container.innerHTML = `
    <div class="feedback-title-wrap">
      <div class="feedback-resume-icon-wrap">
        <button class="toolbar-icon-btn feedback-resume-icon" id="btn-view-resume" title="查看候选人简历">📄</button>
        <div class="feedback-resume-tooltip">查看 ${c.name} 的简历</div>
      </div>
      <div class="feedback-title">📋 面试反馈表 — ${c.name}</div>
      <div class="feedback-toolbar-right">
        <div class="feedback-btn-tooltip-wrap">
          <button class="toolbar-icon-btn feedback-review-btn" id="btn-review-interview" title="回顾面试录音">📋</button>
          <div class="feedback-btn-tooltip">回顾面试录音</div>
        </div>
        <div class="feedback-btn-tooltip-wrap">
          <button class="toolbar-icon-btn feedback-close-btn" id="btn-fake-close" title="关闭">✕</button>
          <div class="feedback-btn-tooltip">关闭</div>
        </div>
      </div>
    </div>

    <div class="recording-section collapsed" id="recording-section">
      <div class="recording-label">
        <span class="recording-dot"></span>
        🎙️ 面试录音
      </div>
      <div class="dialog-replay">
        ${dialogHTML}
      </div>
    </div>

    <div class="card feedback-rating-section">
      <h3>⭐ 候选人评价</h3>

      ${renderDimensionRow('fit', '🎯 适配程度', '与岗位JD的匹配度')}
      ${renderDimensionRow('potential', '🌱 发展潜力', '成长空间和学习能力')}
      ${renderDimensionRow('value', '💰 性价比', '能力水平与期望薪资是否匹配')}
    </div>

    <button class="btn btn-primary feedback-submit-btn" id="btn-submit-feedback">📤 提交评价</button>

    <div class="feedback-decision-overlay" id="feedback-decision-overlay">
      <div class="feedback-decision-card">
        <div class="feedback-decision-title">面试结果</div>
        <div class="feedback-decision-desc">请决定是否让该候选人通过面试</div>
        <div class="feedback-decision-buttons">
          <button class="btn feedback-decision-pass" id="btn-decision-pass">✓ 通过面试</button>
          <button class="btn feedback-decision-fail" id="btn-decision-fail">✗ 不通过</button>
        </div>
      </div>
    </div>

    <div class="resume-modal-overlay" id="resume-modal-overlay">
      <div class="resume-modal">
        <div class="resume-modal-header">
          <span>📄 ${c.name} 的简历</span>
          <button class="resume-modal-close" id="resume-modal-close">✕</button>
        </div>
        <div class="resume-modal-body">
          ${buildResumeHTML(c)}
        </div>
      </div>
    </div>

    <div class="rating-tutorial-overlay" id="rating-tutorial-overlay">
      <div class="rating-tutorial-card">
        <div class="rating-tutorial-title">💡 如何打星</div>
        <div class="rating-tutorial-body">
          <p class="rating-tutorial-hint">点击星星的<strong>左半边</strong>为半星，<strong>右半边</strong>为整星</p>
          <div class="rating-tutorial-demo">
            <div class="rating-tutorial-demo-stars" id="tutorial-demo-stars"></div>
            <div class="rating-tutorial-demo-label" id="tutorial-demo-label"></div>
          </div>
          <p class="rating-tutorial-note">评价完成后提交，HRD会根据你的判断给出反馈</p>
        </div>
        <button class="btn btn-primary rating-tutorial-close" id="rating-tutorial-close">👍 知道了</button>
      </div>
    </div>

    <div class="colleague-popup-overlay" id="colleague-popup-overlay">
      <div class="colleague-popup">
        <div class="colleague-popup-header">
          <span class="colleague-avatar" id="colleague-popup-avatar">👩‍💻</span>
          <span class="colleague-name" id="colleague-popup-name">急招同事</span>
          <span class="colleague-badge" id="colleague-popup-badge">紧急</span>
        </div>
        <div class="colleague-popup-body" id="colleague-popup-body"></div>
        <button class="btn colleague-popup-close" id="colleague-popup-close">😭 好的好的，我马上写！</button>
      </div>
    </div>
  `;

  bindFeedbackEvents(c);
}

/**
 * 构建简历HTML（复用于模态窗口）
 */
function buildResumeHTML(c) {
  let expHTML = '';
  if (c.experiences && c.experiences.length > 0) {
    expHTML = c.experiences.map(exp => `
      <div class="resume-exp-item">
        <div class="resume-exp-header">
          <span class="resume-exp-role">${exp.role || ''}</span>
          <span class="resume-exp-company">${exp.company || ''}</span>
        </div>
        ${exp.duration ? `<div class="resume-exp-duration">${exp.duration}${exp.years ? ` · ${exp.years}年` : ''}</div>` : (exp.years ? `<div class="resume-exp-duration">${exp.years}年经验</div>` : '')}
        ${exp.duties && exp.duties.length > 0 ? `<ul class="resume-exp-duties">${exp.duties.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
      </div>
    `).join('');
  } else if (c.experience) {
    expHTML = `
      <div class="resume-exp-item">
        <div class="resume-exp-header">
          <span class="resume-exp-role">${c.experience.role}</span>
          <span class="resume-exp-company">${c.experience.company}</span>
        </div>
        <div class="resume-exp-duration">${c.experience.years}年</div>
        <p class="resume-exp-desc">${c.experience.desc}</p>
      </div>
    `;
  }

  let projHTML = '';
  if (c.projects && c.projects.length > 0) {
    projHTML = `
      <div class="resume-section-title">项目经历</div>
      ${c.projects.map(p => `
        <div class="resume-proj-item">
          <div class="resume-proj-header">
            <span class="resume-proj-name">${p.name || ''}</span>
            ${p.role ? `<span class="resume-proj-role">${p.role}</span>` : ''}
          </div>
          <p class="resume-proj-desc">${p.desc || ''}</p>
        </div>
      `).join('')}
    `;
  }

  return `
    <div class="resume-top">
      <div class="resume-avatar"><img src="${c.avatar}" alt="头像"></div>
      <div class="resume-top-info">
        <div class="resume-name">${c.name}</div>
        <div class="resume-edu">${c.education}</div>
        ${c.educationDetail ? `<div class="resume-edu-detail">${c.educationDetail}</div>` : ''}
      </div>
    </div>
    <div class="resume-basic-info">
      ${c.gender ? `<span class="resume-info-item">👤 性别：${c.gender}</span>` : ''}
      ${c.age ? `<span class="resume-info-item">🎂 年龄：${c.age}岁</span>` : ''}
      ${c.salary ? `<span class="resume-info-item">💰 期望薪资：${c.salary}</span>` : ''}
      ${c.expectation ? `<span class="resume-info-item">📅 到岗时间：${c.expectation}</span>` : ''}
    </div>
    <div class="resume-section-title">工作经历</div>
    ${expHTML}
    ${projHTML}
    <div class="resume-section-title">专业技能</div>
    <div class="resume-skills">${c.skills.map(s => `<span class="tag">${s}</span>`).join('')}</div>
    <div class="resume-section-title">性格特点</div>
    <div class="resume-personality">${c.personalities.map(p => `<span class="tag">${p}</span>`).join('')}</div>
    ${c.selfIntro ? `<div class="resume-section-title">自我评价</div><p class="resume-self-intro">${c.selfIntro}</p>` : ''}
  `;
}

/**
 * HTML转义
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
