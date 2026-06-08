/**
 * 简历交互逻辑（通过/淘汰按钮事件）
 */
let _resumeBusy = false;

function bindResumeEvents() {
  document.getElementById('btn-reject').addEventListener('click', () => handleResume(false));
  document.getElementById('btn-pass').addEventListener('click', () => handleResume(true));
}

function handleResume(passed) {
  if (_resumeBusy) return;
  _resumeBusy = true;

  const card = document.getElementById('resume-card');
  const candidate = GameState.candidates[GameState.currentResumeIndex];

  // 添加滑动动画
  card.classList.add(passed ? 'slide-right' : 'slide-left');

  if (passed) {
    GameState.passed.push(candidate);
  }

  setTimeout(() => {
    GameState.currentResumeIndex++;
    _resumeBusy = false;
    renderResumeCard();
  }, 300);
}
