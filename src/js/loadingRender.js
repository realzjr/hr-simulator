/**
 * 简历收集加载场景渲染
 */
let _tipRotationTimer = null;

function renderLoadingScene() {
  const container = document.getElementById('scene-loading');
  container.innerHTML = `
    <div class="loading-scene-wrap">
      <div class="loading-tip-banner" id="loading-tip-banner">
        <div class="tip-content" id="tip-content"></div>
      </div>

      <div class="loading-animation-area">
        <div class="flying-resume"></div>
        <div class="flying-resume"></div>
        <div class="flying-resume"></div>
        <div class="flying-resume"></div>
        <div class="flying-resume"></div>
        <div class="recruiter">
          <div class="android-robot">
            <div class="robot-antenna"></div>
            <div class="robot-head">
              <div class="robot-eye robot-eye-left"></div>
              <div class="robot-eye robot-eye-right"></div>
            </div>
            <div class="robot-body">
              <div class="robot-arm robot-arm-left"></div>
              <div class="robot-arm robot-arm-right"></div>
              <div class="robot-torso"></div>
            </div>
            <div class="robot-legs">
              <div class="robot-leg robot-leg-left"></div>
              <div class="robot-leg robot-leg-right"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="loading-hint">
        <span>📄</span>
        <span>正在收集候选人简历</span>
      </div>

      <div class="loading-progress-wrap">
        <div class="loading-progress-bar">
          <div class="loading-progress-fill" id="loading-progress-fill"></div>
        </div>
        <div class="loading-progress-text" id="loading-progress-text">准备中...</div>
      </div>

      <div class="loading-errors" id="loading-errors"></div>
      <div class="loading-actions" id="loading-actions"></div>
    </div>
  `;

  startTipRotation();
}

/**
 * 启动HR小知识轮播
 */
function startTipRotation() {
  stopTipRotation();

  if (typeof HR_TIPS === 'undefined' || HR_TIPS.length === 0) return;

  const el = document.getElementById('tip-content');
  if (!el) return;

  // 打乱顺序
  const shuffled = [...HR_TIPS].sort(() => Math.random() - 0.5);
  let idx = 0;

  function showTip() {
    const tip = shuffled[idx % shuffled.length];
    // 先淡出
    el.classList.remove('tip-visible');
    el.classList.add('tip-exiting');

    setTimeout(() => {
      el.innerHTML = `<span class="tip-icon">${tip.icon}</span><span class="tip-text">${tip.text}</span>`;
      el.classList.remove('tip-exiting');
      // 触发重排后淡入
      void el.offsetWidth;
      el.classList.add('tip-visible');
      idx++;
    }, 400);
  }

  // 立即显示第一条
  const tip = shuffled[0];
  el.innerHTML = `<span class="tip-icon">${tip.icon}</span><span class="tip-text">${tip.text}</span>`;
  el.classList.add('tip-visible');
  idx = 1;

  _tipRotationTimer = setInterval(showTip, 5000);
}

/**
 * 停止HR小知识轮播
 */
function stopTipRotation() {
  if (_tipRotationTimer) {
    clearInterval(_tipRotationTimer);
    _tipRotationTimer = null;
  }
}

/**
 * 更新加载场景的进度条
 * @param {number} current - 当前正在处理的序号
 * @param {number} total - 总数
 * @param {number} readyCount - 已成功就绪的份数（可选）
 */
function showLoadingProgress(current, total, readyCount) {
  const fill = document.getElementById('loading-progress-fill');
  const textEl = document.getElementById('loading-progress-text');
  if (!fill || !textEl) return;

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  fill.style.width = pct + '%';

  if (readyCount === undefined || readyCount === null) {
    // 初始状态或未传递就绪数
    if (current <= 0) {
      textEl.textContent = 'HR投放JD中……';
    } else {
      textEl.textContent = 'HR投放JD中……';
    }
  } else if (readyCount === 0) {
    textEl.textContent = 'HR投放JD中……';
  } else if (current < total) {
    textEl.textContent = `${readyCount} 份简历已就绪，继续收集中……`;
  } else {
    textEl.textContent = `${readyCount} 份简历已就绪`;
  }
}

/**
 * 在加载场景显示错误信息
 */
function showLoadingErrors(errors) {
  const el = document.getElementById('loading-errors');
  if (!el || errors.length === 0) return;
  el.innerHTML = `
    <div class="loading-error-box">
      <div class="loading-error-title">⚠️ 以下简历未能生成：</div>
      ${errors.map(e => `<div class="loading-error-item">• ${e}</div>`).join('')}
    </div>
  `;
}

/**
 * 显示失败后的操作按钮（重试 / 跳过）
 * @param {number} failedCount - 失败数量
 * @param {function} onRetry - 点击重试回调
 * @param {function} onSkip - 点击跳过回调
 * @param {number} successCount - 已成功数量
 */
function showLoadingRetryActions(failedCount, onRetry, onSkip, successCount) {
  const el = document.getElementById('loading-actions');
  if (!el) return;

  stopTipRotation();

  // 隐藏动画和进度条
  const hint = document.querySelector('.loading-hint');
  const progress = document.querySelector('.loading-progress-wrap');
  if (hint) hint.textContent = `📄 ${successCount} 份简历已就绪，${failedCount} 份生成失败`;

  // 隐藏tips
  const tipBanner = document.getElementById('loading-tip-banner');
  if (tipBanner) tipBanner.style.display = 'none';

  const canSkip = successCount >= 1; // 至少1人才能跳过

  el.innerHTML = `
    <button class="btn btn-primary loading-retry-btn" id="btn-loading-retry">🔄 重试失败的 ${failedCount} 份简历</button>
    ${canSkip
      ? `<button class="btn btn-secondary loading-skip-btn" id="btn-loading-skip">⏭️ 跳过，用 ${successCount} 份简历继续</button>`
      : `<div class="loading-skip-hint">至少需要 1 份简历才能开始游戏</div>`
    }
  `;

  document.getElementById('btn-loading-retry').addEventListener('click', () => {
    el.innerHTML = '';
    if (tipBanner) tipBanner.style.display = '';
    startTipRotation();
    onRetry();
  });

  if (canSkip) {
    document.getElementById('btn-loading-skip').addEventListener('click', () => {
      onSkip();
    });
  }
}
