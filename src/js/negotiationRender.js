/**
 * 谈薪场景 — 手机聊天框 UI 渲染
 */

/**
 * 渲染谈薪场景主框架
 */
function renderNegotiation(candidate) {
  const container = document.getElementById('scene-negotiation');
  container.innerHTML = `
    <div class="nego-phone">
      <div class="nego-header">
        <div class="nego-header-left">
          <img class="nego-header-avatar" src="${candidate.avatar}" alt="">
          <div class="nego-header-info">
            <div class="nego-header-name">与 ${candidate.name} 通话中</div>
            <div class="nego-header-status">📞 语音通话</div>
          </div>
        </div>
        <button class="nego-header-resume" id="nego-view-resume">📄简历</button>
      </div>

      <div class="nego-messages" id="nego-messages"></div>

      <div class="nego-willingness" id="nego-willingness" style="display:none;">
        <div class="nego-willingness-label">
          <span>候选人接受意愿 <span class="nego-willingness-help">(?)<span class="nego-willingness-tooltip">反映候选人对当前Offer的接受意愿，受薪资水平和谈判表现影响</span></span></span>
          <span class="nego-willingness-value" id="nego-willingness-text">0%</span>
        </div>
        <div class="nego-willingness-bar">
          <div class="nego-willingness-fill" id="nego-willingness-fill" style="width:0%"></div>
        </div>
      </div>

      <div class="nego-options" id="nego-options" style="display:none;">
        <div class="nego-options-grid" id="nego-options-grid"></div>
        <div class="nego-final-hint" id="nego-final-hint" style="display:none;"></div>
      </div>
    </div>

    <div class="resume-modal-overlay" id="nego-resume-modal-overlay">
      <div class="resume-modal">
        <div class="resume-modal-header">
          <span>📄 ${candidate.name} 的简历</span>
          <button class="resume-modal-close" id="nego-resume-modal-close">✕</button>
        </div>
        <div class="resume-modal-body">
          ${buildResumeHTML(candidate)}
        </div>
      </div>
    </div>
  `;

  // 简历模态绑定
  document.getElementById('nego-view-resume').addEventListener('click', () => {
    document.getElementById('nego-resume-modal-overlay').classList.add('visible');
  });
  document.getElementById('nego-resume-modal-close').addEventListener('click', () => {
    document.getElementById('nego-resume-modal-overlay').classList.remove('visible');
  });
  document.getElementById('nego-resume-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove('visible');
    }
  });
}

/**
 * 添加消息气泡
 * @param {'left'|'right'|'system'} side
 * @param {string} text
 * @param {string} avatar - 头像URL
 * @param {object} opts - { thinking: bool }
 */
function addNegoMessage(side, text, avatar, opts = {}) {
  const container = document.getElementById('nego-messages');
  if (!container) return;

  if (side === 'system') {
    const div = document.createElement('div');
    div.className = 'nego-system-msg';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  const div = document.createElement('div');
  div.className = `nego-msg nego-msg-${side}${opts.thinking ? ' nego-msg-thinking' : ''}`;

  const avatarImg = avatar ? `<img class="nego-msg-avatar" src="${avatar}" alt="">` : '';
  const parsedText = typeof simpleMarkdown === 'function' ? simpleMarkdown(text) : text;
  const bubbleContent = opts.thinking
    ? `${parsedText}<span class="thinking-dots"></span>`
    : parsedText;

  div.innerHTML = `
    ${avatarImg}
    <div class="nego-msg-bubble">${bubbleContent}</div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

/**
 * 更新意愿进度条
 */
function updateWillingness(value) {
  const bar = document.getElementById('nego-willingness');
  const fill = document.getElementById('nego-willingness-fill');
  const text = document.getElementById('nego-willingness-text');
  if (!bar || !fill || !text) return;

  bar.style.display = '';
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  text.textContent = clamped + '%';
  fill.style.width = clamped + '%';

  // 颜色
  fill.className = 'nego-willingness-fill';
  if (clamped >= 60) fill.classList.add('willingness-high');
  else if (clamped >= 30) fill.classList.add('willingness-mid');
  else fill.classList.add('willingness-low');
}

/**
 * 显示选项按钮
 * @param {Array<{label: string, value: any}>} options
 * @param {Function} onSelect - callback(selectedOption)
 */
function showNegoOptions(options, onSelect) {
  const optionsArea = document.getElementById('nego-options');
  const grid = document.getElementById('nego-options-grid');
  if (!optionsArea || !grid) return;

  optionsArea.style.display = '';
  grid.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'nego-option-btn';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      // 禁用所有按钮
      grid.querySelectorAll('.nego-option-btn').forEach(b => {
        b.disabled = true;
      });
      btn.classList.add('selected');
      onSelect(opt);
    });
    grid.appendChild(btn);
  });
}

/**
 * 隐藏选项区域
 */
function hideNegoOptions() {
  const optionsArea = document.getElementById('nego-options');
  if (optionsArea) optionsArea.style.display = 'none';
}

/**
 * 显示最终定薪提示
 */
function showNegoHint(text) {
  const hint = document.getElementById('nego-final-hint');
  if (hint) {
    hint.textContent = text;
    hint.style.display = '';
  }
}
