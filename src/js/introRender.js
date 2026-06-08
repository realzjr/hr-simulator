/**
 * 引导页渲染 — HR魔法动画 + 性别选择
 * 复用 hrdReviewRender.js 中的 typewriterEffect()
 */

let _introText = '';       // 从 introText.txt 加载的文案
let _introSkipped = false; // 是否已快进

const INTRO_DEFAULT_TEXT =
  '欢迎来到HR模拟器！\n\n' +
  '在这里，你将扮演一名企业HR，亲身体验招聘全流程。\n\n' +
  '准备好了吗？让我们开始吧！';

/**
 * 渲染引导页
 */
function renderIntro() {
  const container = document.getElementById('scene-intro');

  // 烟花粒子HTML（3层：8+8+6=22颗）
  function makeDots(n) {
    let h = '';
    for (let i = 0; i < n; i++) h += '<div class="intro-fw-dot"></div>';
    return h;
  }

  container.innerHTML = `
    <div class="intro-wrap" id="intro-wrap">
      <!-- HR魔法动画区 -->
      <div class="intro-magic-area">
        <div class="intro-hr">🧑‍💼</div>
        <div class="intro-wand">🪄</div>
        <div class="intro-spark"></div>

        <!-- 烟花爆心 -->
        <div class="intro-firework-origin">
          <!-- 光晕 -->
          <div class="intro-fw-glow intro-fw-glow-1"></div>
          <div class="intro-fw-glow intro-fw-glow-2"></div>
          <div class="intro-fw-glow intro-fw-glow-3"></div>
          <!-- 粒子层1（主圈8颗） -->
          <div class="intro-firework-layer intro-fw-layer-1">${makeDots(8)}</div>
          <!-- 粒子层2（副圈8颗，22.5°偏移） -->
          <div class="intro-firework-layer intro-fw-layer-2">${makeDots(8)}</div>
          <!-- 粒子层3（拖尾6颗，旋转） -->
          <div class="intro-firework-layer intro-fw-layer-3">${makeDots(6)}</div>
          <!-- 简历（5封从爆心飞出） -->
          <div class="intro-resume-fly"></div>
          <div class="intro-resume-fly"></div>
          <div class="intro-resume-fly"></div>
          <div class="intro-resume-fly"></div>
          <div class="intro-resume-fly"></div>
        </div>

        <!-- 浓烟（3层） -->
        <div class="intro-smoke intro-smoke-1"></div>
        <div class="intro-smoke intro-smoke-2"></div>
        <div class="intro-smoke intro-smoke-3"></div>
      </div>

      <!-- 信纸 -->
      <div class="intro-letter-wrap" id="intro-letter-wrap">
        <div class="intro-letter-card">
          <div class="intro-letter-title">💼 致未来的HR</div>
          <div class="intro-letter-body" id="intro-letter-body"></div>
        </div>
      </div>

      <!-- 点击提示 -->
      <div class="intro-tap-hint" id="intro-tap-hint">点击任意位置继续</div>

      <!-- 性别选择 -->
      <div class="intro-gender-buttons" id="intro-gender-buttons">
        <button class="intro-gender-btn" id="btn-gender-male">
          <span class="intro-gender-icon">👨‍💼</span>
          <span class="intro-gender-label">我是男生</span>
        </button>
        <button class="intro-gender-btn" id="btn-gender-female">
          <span class="intro-gender-icon">👩‍💼</span>
          <span class="intro-gender-label">我是女生</span>
        </button>
      </div>

      <!-- 风格选择（性别选完后显示） -->
      <div class="intro-style-buttons" id="intro-style-buttons">
        <div class="intro-style-title">选择你的HR风格</div>
        <button class="intro-style-btn" id="btn-style-mature" data-style="mature">
          <span class="intro-style-icon">📚</span>
          <span class="intro-style-label">成熟知性</span>
          <span class="intro-style-desc">沉稳专业，措辞考究</span>
        </button>
        <button class="intro-style-btn" id="btn-style-youthful" data-style="youthful">
          <span class="intro-style-icon">🌟</span>
          <span class="intro-style-label">阳光青春</span>
          <span class="intro-style-desc">活泼直爽，亲和轻松</span>
        </button>
      </div>
    </div>
  `;

  // 加载文案后启动动画
  _loadIntroText().then(text => {
    _introText = text;
    _startIntroAnimation();
  });
}

/**
 * 从 data/introText.txt 加载文案
 */
async function _loadIntroText() {
  try {
    const resp = await fetch('data/introText.txt');
    if (!resp.ok) throw new Error(resp.status);
    const text = await resp.text();
    return text.trim() || INTRO_DEFAULT_TEXT;
  } catch (e) {
    return INTRO_DEFAULT_TEXT;
  }
}

/**
 * 启动动画流程
 */
function _startIntroAnimation() {
  _introSkipped = false;

  // 1秒后展开信纸
  setTimeout(() => {
    const wrap = document.getElementById('intro-letter-wrap');
    if (wrap) wrap.classList.add('open');

    // 再等400ms开始打字机（速度为原来的两倍：15ms/字）
    setTimeout(() => {
      _introTypewriter();
    }, 400);
  }, 1000);

  // 绑定点击快进
  const introWrap = document.getElementById('intro-wrap');
  if (introWrap) {
    introWrap.addEventListener('click', _handleIntroClick);
  }

  // 绑定性别按钮
  const btnMale = document.getElementById('btn-gender-male');
  const btnFemale = document.getElementById('btn-gender-female');
  if (btnMale) btnMale.addEventListener('click', (e) => { e.stopPropagation(); _selectGender('male'); });
  if (btnFemale) btnFemale.addEventListener('click', (e) => { e.stopPropagation(); _selectGender('female'); });
}

/**
 * 打字机效果（15ms/字 — 原来30ms的两倍速度）
 */
function _introTypewriter() {
  typewriterEffect('intro-letter-body', _introText, 15, () => {
    _showGenderButtons();
  });
}

/**
 * 点击快进处理
 */
function _handleIntroClick() {
  if (_introSkipped) return;

  // 如果打字机正在运行，跳过打字机直接显示全文
  if (_activeTypewriterTimer) {
    cancelTypewriter();
    const body = document.getElementById('intro-letter-body');
    if (body) body.innerHTML = simpleMarkdown(_introText);
    _showGenderButtons();
    _introSkipped = true;
    return;
  }

  // 如果信纸还没展开，直接展开并显示全文
  const wrap = document.getElementById('intro-letter-wrap');
  if (wrap && !wrap.classList.contains('open')) {
    wrap.classList.add('open');
    const body = document.getElementById('intro-letter-body');
    if (body) body.innerHTML = simpleMarkdown(_introText);
    _showGenderButtons();
    _introSkipped = true;
  }
}

/**
 * 显示性别选择按钮
 */
function _showGenderButtons() {
  const hint = document.getElementById('intro-tap-hint');
  if (hint) hint.style.display = 'none';

  const buttons = document.getElementById('intro-gender-buttons');
  if (buttons) buttons.classList.add('visible');
}

/**
 * 选择性别 → 显示风格选择
 */
function _selectGender(gender) {
  GameState.playerGender = gender;

  // 隐藏性别按钮，显示风格按钮
  const genderBtns = document.getElementById('intro-gender-buttons');
  if (genderBtns) genderBtns.classList.remove('visible');

  const styleBtns = document.getElementById('intro-style-buttons');
  if (styleBtns) styleBtns.classList.add('visible');

  // 绑定风格按钮
  document.getElementById('btn-style-mature').addEventListener('click', (e) => {
    e.stopPropagation();
    _selectStyle('mature');
  });
  document.getElementById('btn-style-youthful').addEventListener('click', (e) => {
    e.stopPropagation();
    _selectStyle('youthful');
  });
}

/**
 * 选择风格 → 进入游戏
 */
function _selectStyle(style) {
  GameState.hrStyle = GameState.playerGender + '_' + style;
  renderMenu();
  switchScene('menu');
}
