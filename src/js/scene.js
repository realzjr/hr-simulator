/**
 * 强制毕业预警 toast（首次触发时调用）
 */
function showForceWarning(text) {
  const existing = document.querySelector('.force-warning-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'force-warning-toast';
  el.textContent = text;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

/**
 * 全局定时器注册 — 场景切换时统一清理
 * 各模块通过 registerSceneTimer() 注册 timer ID，switchScene 时自动清除
 */
const _sceneTimers = [];
function registerSceneTimer(timerId) {
  _sceneTimers.push(timerId);
}
function _clearAllSceneTimers() {
  while (_sceneTimers.length > 0) {
    const id = _sceneTimers.pop();
    clearTimeout(id);
    clearInterval(id);
  }
}

/**
 * 场景切换控制器
 */
function switchScene(sceneName) {
  // 统一清理所有已注册的场景定时器
  _clearAllSceneTimers();

  // 离开loading场景时停止tips轮播
  if (GameState.currentScene === 'loading' && sceneName !== 'loading') {
    if (typeof stopTipRotation === 'function') stopTipRotation();
  }
  // 离开interview场景时中断进行中的回答
  if (GameState.currentScene === 'interview' && sceneName !== 'interview') {
    if (typeof interruptOngoing === 'function') interruptOngoing();
  }

  document.querySelectorAll('.scene').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('scene-' + sceneName);
  if (target) {
    target.classList.add('active');
  }
  GameState.currentScene = sceneName;
}
