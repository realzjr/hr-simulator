/**
 * 面试界面渲染 — 面对面场景
 * 每位候选人5轮提问 + 最多2轮候选人提问：
 *   Q1: 固定"简单介绍一下你自己"（单按钮）
 *   Q2-Q3: 从本地题库中各展示3个选项，玩家自由选择
 *   Q4-Q5: AI生成的针对性问题（各3个三选一）
 *   提问: 最多2轮，第1轮好答案→结束，否则→第2轮
 *         两轮都最差→HRD来电质问，2次质问→强制毕业
 */

/** 自动滚动气泡区到底部 */
function scrollBubbleArea() {
  const area = document.getElementById('bubble-area');
  if (area) area.scrollTop = area.scrollHeight;
}

/**
 * 根据 JD 文本关键词识别岗位类别
 * @returns {string[]} 匹配到的标签数组，至少包含 '通用'
 */
function detectJobCategory(jdText) {
  if (!jdText) return ['通用'];
  const t = jdText.toLowerCase();
  const categories = [];
  const rules = {
    '技术': ['后端','前端','开发','工程师','算法','测试','运维','java','go','python','react','vue','node','数据库','架构','devops','全栈','c++','rust','kubernetes','docker','微服务','api','sdk','编程'],
    '产品': ['产品经理','需求分析','prd','用户体验','产品设计','产品运营','ab测试','用户调研','竞品分析','产品规划','功能设计'],
    '设计': ['ui','ux','设计师','视觉','交互','figma','sketch','photoshop','设计规范','平面','插画','动效','品牌'],
    '运营': ['运营','增长','活动策划','内容运营','用户运营','社群','投放','seo','sem','新媒体','私域','直播'],
    '管理': ['项目经理','团队管理','pmp','scrum','敏捷','技术总监','cto','vp','负责人','部门主管'],
  };
  for (const [cat, keywords] of Object.entries(rules)) {
    if (keywords.some(kw => t.includes(kw))) categories.push(cat);
  }
  if (categories.length === 0) categories.push('通用');
  return categories;
}

let _localQuestionPool = [];   // 本地问题池 [{text}]
let _aiQuestions = [];         // AI生成的6个针对性问题（Q4用3个，Q5用3个）
let _currentQuestionIdx = 0;   // 当前轮次 0-4
let _aiQuestionsReady = false;
let _counterQuestionCache = null;
let _pollTimers = [];          // 轮询定时器（中断时统一清除）

/** 面试官回应话术池（默认值，运行时按风格替换） */
const _DEFAULT_INTERVIEWER_RESPONSES = [
  '👌 好的，我了解了',
  '🤔 嗯，有意思',
  '📝 收到，我记下了',
  '💡 明白了，谢谢',
  '👍 不错，继续聊聊',
  '😊 好的，下一个问题',
  '✅ OK，我理解了',
  '🙂 嗯嗯，了解',
];

/** 获取当前风格的面试官回应（按回答质量分档） */
function getInterviewerResponses(quality) {
  const d = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
  const responses = d && d.interviewerResponses;
  if (!responses) return _DEFAULT_INTERVIEWER_RESPONSES;
  // 兼容旧格式（扁平数组）
  if (Array.isArray(responses)) return responses;
  // 新格式：按质量取对应档
  return responses[quality] || responses['mid'] || _DEFAULT_INTERVIEWER_RESPONSES;
}

async function renderInterview() {
  const container = document.getElementById('scene-interview');
  const idx = GameState.currentInterviewIndex;
  const total = GameState.passed.length;

  if (idx >= total) {
    calculateResult();
    switchScene('result');
    renderResult();
    return;
  }

  const c = GameState.passed[idx];

  if (!GameState.interviewDialogs[c.id]) {
    GameState.interviewDialogs[c.id] = [];
  }
  // 本地模式：从 interviewQA 取问题（问答配对，避免错配）
  const _jdIdx = GameState.currentJDIndex;
  const _qaSource = (_jdIdx >= 0 && typeof LOCAL_DATA !== 'undefined' ? LOCAL_DATA[_jdIdx] : null);
  const _qaTier = c.quality >= 7 ? 'great' : c.quality >= 4 ? 'mid' : 'bad';
  const _qaPool = _qaSource && _qaSource.interviewQA && _qaSource.interviewQA[_qaTier];

  if (GameState.mode === 'local' && _qaPool && _qaPool.length >= 6) {
    // 本地模式直接用 interviewQA 的问题
    _localQuestionPool = _qaPool.map(qa => ({ text: qa.q })).sort(() => Math.random() - 0.5);
  } else {
    // 在线模式 / 无QA数据时用通用题库
    const _jobCategories = detectJobCategory(GameState.currentJD);
    const _allQuestions = [
      ...INTERVIEW_QUESTIONS.easy.map(q => ({ text: q.text, tags: q.tags || ['通用'] })),
      ...INTERVIEW_QUESTIONS.medium.map(q => ({ text: q.text, tags: q.tags || ['通用'] })),
    ];
    const matched = _allQuestions.filter(q => q.tags.some(t => _jobCategories.includes(t)));
    const matchedTexts = new Set(matched.map(q => q.text));
    const universal = _allQuestions.filter(q => q.tags.includes('通用') && !matchedTexts.has(q.text));
    let pool = [...matched, ...universal];
    if (pool.length < 6) {
      const poolTexts = new Set(pool.map(q => q.text));
      const rest = _allQuestions.filter(q => !poolTexts.has(q.text));
      pool = [...pool, ...rest];
    }
    _localQuestionPool = pool.sort(() => Math.random() - 0.5);
  }

  _aiQuestions = [];
  _currentQuestionIdx = 0;
  _aiQuestionsReady = false;
  _counterQuestionCache = null;
  _pollTimers.forEach(t => clearInterval(t));
  _pollTimers = [];

  container.innerHTML = `
    <div class="interview-header">
      <h2>🎤 面试环节</h2>
      <div class="interview-progress">👥 候选人 ${idx + 1} / ${total}　·　<span id="question-number">📋 问题 1 / 5</span></div>
    </div>

    <div class="interview-toolbar-bar">
      <div class="toolbar-btn-wrap">
        <button class="toolbar-icon-btn" id="btn-view-candidate-resume" title="查看简历">📄</button>
        <span class="toolbar-tooltip">查看简历</span>
      </div>
      <div class="toolbar-btn-wrap">
        <button class="toolbar-icon-btn" id="btn-skip">⏭</button>
        <span class="toolbar-tooltip">跳过此问题</span>
      </div>
      <div class="toolbar-btn-wrap">
        <button class="toolbar-icon-btn btn-end" id="btn-end-interview">⏹</button>
        <span class="toolbar-tooltip">结束面试</span>
      </div>
    </div>

    <div class="interview-scene">
      <div class="scene-persons">
        <div class="person person-left">
          <div class="interviewer-avatar-large" id="interviewer-avatar">
            <img class="avatar-fade-img${_preloadedAvatars.has(getHRAvatar()) ? ' loaded' : ''}" src="${getHRAvatar()}" alt="面试官" onload="this.classList.add('loaded')">
            <span class="interviewer-badge">HR</span>
          </div>
          <div class="person-label">🧑‍💼 面试官</div>
          <div class="person-name">(你)</div>
        </div>

        <div class="person person-right">
          <div class="candidate-avatar-large" id="candidate-avatar">
            <img class="avatar-fade-img${_preloadedAvatars.has(c.avatar) ? ' loaded' : ''}" src="${c.avatar}" alt="${c.name}" onload="this.classList.add('loaded')">
          </div>
          <div class="person-label">🙋 候选人</div>
          <div class="person-name">${c.name}</div>
        </div>
      </div>
    </div>

    <div class="bubble-area" id="bubble-area">
      <div class="speech-bubble bubble-interviewer" id="bubble-interviewer"></div>
      <div class="speech-bubble bubble-candidate visible" id="bubble-candidate">😊 您好，很高兴参加面试</div>
    </div>

    <div class="response-picker" id="response-picker">
      <div class="response-picker-label">💬 选择你的回应：</div>
      <div class="response-options" id="response-options"></div>
    </div>

    <div class="interview-controls" id="interview-controls">
      <div class="interview-current-question" id="current-question"></div>
    </div>

    <button class="btn btn-primary interview-next-btn" id="btn-next-candidate">
      📋 进入面试反馈 →
    </button>

    <div class="resume-modal-overlay" id="interview-resume-modal-overlay">
      <div class="resume-modal">
        <div class="resume-modal-header">
          <span>📄 ${c.name} 的简历</span>
          <button class="resume-modal-close" id="interview-resume-modal-close">✕</button>
        </div>
        <div class="resume-modal-body">
          ${buildResumeHTML(c)}
        </div>
      </div>
    </div>
  `;

  updateQuestionDisplay();

  // 异步加载AI问题（Q4-Q5用）
  generateAIQuestions(c).then(questions => {
    _aiQuestions = questions;
    _aiQuestionsReady = true;
  });

  // 预加载候选人提问数据
  generateCounterQuestionData(c).then(data => {
    _counterQuestionCache = data;
  });

  bindInterviewEvents(c);
}

/**
 * 更新当前问题显示
 * Q1(idx=0): 固定自我介绍
 * Q2-Q3(idx=1,2): 本地题库三选一
 * Q4-Q5(idx=3,4): AI针对性问题单按钮
 */
function updateQuestionDisplay() {
  const qNum = document.getElementById('question-number');
  const qArea = document.getElementById('current-question');
  if (!qNum || !qArea) return;

  const idx = _currentQuestionIdx;
  qNum.textContent = `📋 问题 ${idx + 1} / 5`;

  if (idx === 0) {
    qArea.innerHTML = `
      <button class="interview-q-btn interview-q-option">💬 简单介绍一下你自己</button>
    `;
  } else if (idx <= 2) {
    // Q2-Q3: 本地题库三选一
    const count = Math.min(3, _localQuestionPool.length);
    if (count === 0) {
      qArea.innerHTML = '<div class="interview-done-msg">暂无更多问题</div>';
      return;
    }
    const options = _localQuestionPool.splice(0, count);
    qArea.innerHTML = `
      <div class="interview-q-choices-label">💡 选择一个问题提问：</div>
      <div class="interview-q-choices">
        ${options.map(q => `<button class="interview-q-btn interview-q-option">💬 ${q.text}</button>`).join('')}
      </div>
    `;
  } else {
    // Q4-Q5: AI针对性问题三选一
    const aiRound = idx - 3; // 0 or 1
    const startIdx = aiRound * 3; // Q4: [0,1,2], Q5: [3,4,5]
    if (_aiQuestionsReady && _aiQuestions[startIdx]) {
      const options = _aiQuestions.slice(startIdx, startIdx + 3).filter(Boolean);
      qArea.innerHTML = `
        <div class="interview-q-choices-label">✨ 选择一个深度问题：</div>
        <div class="interview-q-choices">
          ${options.map(q => `<button class="interview-q-btn interview-q-option ai-question">✨ ${q}</button>`).join('')}
        </div>
      `;
    } else {
      // AI还没返回，显示加载中
      qArea.innerHTML = `
        <div class="interview-q-choices-label">✨ 正在准备深度问题...</div>
        <button class="interview-q-btn interview-q-option loading-text" disabled>⏳ 加载中...</button>
      `;
      // 轮询等待
      const pollTimer = setInterval(() => {
        if (_aiQuestionsReady && _aiQuestions[startIdx]) {
          clearInterval(pollTimer);
          _pollTimers = _pollTimers.filter(t => t !== pollTimer);
          if (_currentQuestionIdx === idx) {
            updateQuestionDisplay();
          }
        }
      }, 300);
      _pollTimers.push(pollTimer);
    }
  }
}

/**
 * 显示面试官回应选择器
 */
function showResponsePicker(candidate, quality) {
  const picker = document.getElementById('response-picker');
  const optionsEl = document.getElementById('response-options');
  if (!picker || !optionsEl) return;

  const pool = getInterviewerResponses(quality || 'mid');
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const options = shuffled.slice(0, 3);

  optionsEl.innerHTML = options.map(text =>
    `<button class="response-option">${text}</button>`
  ).join('');

  picker.classList.add('visible');

  optionsEl.querySelectorAll('.response-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const interviewerBubble = document.getElementById('bubble-interviewer');
      interviewerBubble.textContent = btn.textContent;
      interviewerBubble.classList.add('visible');
      setSpeaking('interviewer');
      scrollBubbleArea();

      // 将面试官回应追加到最后一条对话记录中
      const cId = candidate.id;
      const dialogArr = GameState.interviewDialogs[cId];
      if (dialogArr && dialogArr.length > 0) {
        const last = dialogArr[dialogArr.length - 1];
        if (!last.question.startsWith('【提问')) {
          last.response = btn.textContent;
        }
      }

      picker.classList.remove('visible');

      setTimeout(() => {
        clearSpeaking();
        _currentQuestionIdx++;
        if (_currentQuestionIdx >= 5) {
          finishCandidateInterview();
        } else {
          advanceToNextQuestion(candidate);
        }
      }, 600);
    });
  });
}

function hideResponsePicker() {
  const picker = document.getElementById('response-picker');
  if (picker) picker.classList.remove('visible');
}

function setSpeaking(who) {
  clearSpeaking();
  if (who === 'interviewer') {
    const el = document.getElementById('interviewer-avatar');
    if (el) el.classList.add('speaking');
  } else {
    const el = document.getElementById('candidate-avatar');
    if (el) el.classList.add('speaking');
  }
}

function clearSpeaking() {
  const interviewer = document.getElementById('interviewer-avatar');
  const candidate = document.getElementById('candidate-avatar');
  if (interviewer) interviewer.classList.remove('speaking');
  if (candidate) candidate.classList.remove('speaking');
}

/**
 * 根据候选人quality决定回答质量倾向
 */
function getAnswerQuality(candidate) {
  const q = candidate.quality;
  const r = Math.random();
  if (q >= 7) {
    // 高质量: 70%good, 25%mid, 5%bad
    return r < 0.70 ? 'good' : r < 0.95 ? 'mid' : 'bad';
  } else if (q >= 4) {
    // 中等: 20%good, 60%mid, 20%bad
    return r < 0.20 ? 'good' : r < 0.80 ? 'mid' : 'bad';
  } else {
    // 低质量: 5%good, 25%mid, 70%bad
    return r < 0.05 ? 'good' : r < 0.30 ? 'mid' : 'bad';
  }
}

async function generateAIQuestions(candidate) {
  const fallbacks = [
    '你觉得自己最适合这个岗位的原因是什么？',
    '如果入职后发现工作内容和预期不同，你会怎么做？',
    '能否举一个你解决复杂问题的具体案例？',
    '你怎么看待团队协作中的意见分歧？',
    '你对未来三年的职业规划是什么？',
    '如果项目紧急需要加班，你会如何安排？',
  ];

  // 优先从本地 interviewQA 取问题（问答配对）
  const jdIndex = GameState.currentJDIndex;
  const _iqSource = (jdIndex >= 0 && typeof LOCAL_DATA !== 'undefined' ? LOCAL_DATA[jdIndex] : null);
  if (_iqSource) {
    const tier = candidate.quality >= 7 ? 'great' : candidate.quality >= 4 ? 'mid' : 'bad';
    // 新结构：interviewQA
    const qaPool = _iqSource.interviewQA && _iqSource.interviewQA[tier];
    if (qaPool && qaPool.length >= 6 && GameState.mode === 'local') {
      // 取后6题（前面的已被 _localQuestionPool 用于 Q2-Q3）
      const questions = qaPool.slice(6).map(qa => qa.q);
      if (questions.length >= 6) return questions.slice(0, 6);
      // 不足6题时从整个池子补
      const all = qaPool.map(qa => qa.q);
      while (questions.length < 6 && all.length > questions.length) {
        const extra = all.find(q => !questions.includes(q));
        if (extra) questions.push(extra); else break;
      }
      return questions.slice(0, 6);
    }
    // 兼容旧结构
    const iqData = _iqSource.interviewQuestions;
    if (iqData) {
      const sets = iqData[tier];
      if (sets && sets.length > 0) {
        const chosen = sets[Math.floor(Math.random() * sets.length)];
        if (Array.isArray(chosen) && chosen.length >= 6) {
          if (GameState.mode === 'local') return chosen.slice(0, 6);
        }
      }
    }
  }

  const prompt = PROMPTS.generateInterviewQuestions(candidate, GameState.currentJD);
  try {
    const result = await DeepSeekAPI.chatJSON(prompt);
    if (Array.isArray(result) && result.length >= 6) {
      const questions = result.slice(0, 6);
      return questions;
    }
    if (Array.isArray(result) && result.length >= 2) {
      const arr = [...result];
      while (arr.length < 6) arr.push(fallbacks[arr.length]);
      return arr;
    }
  } catch (e) {}

  // API失败后再尝试本地数据（复用已查找的数据源）
  if (_iqSource) {
    const iqData = _iqSource.interviewQuestions;
    if (iqData) {
      const tier = candidate.quality >= 7 ? 'great' : candidate.quality >= 4 ? 'mid' : 'bad';
      const sets = iqData[tier];
      if (sets && sets.length > 0) {
        const chosen = sets[Math.floor(Math.random() * sets.length)];
        if (Array.isArray(chosen) && chosen.length >= 6) return chosen.slice(0, 6);
      }
    }
  }

  return fallbacks;
}

async function generateCounterQuestionData(candidate) {
  const fallbackData = {
    round1: {
      question: '请问贵公司的团队氛围和加班情况是怎样的？',
      good: '我们团队很注重效率，核心工作时间专注产出，弹性工作制让大家自主安排节奏，上个月还组织了户外团建。',
      mid: '还行吧，看项目忙不忙，团队人都挺好的。',
      bad: '我们这里很拼的，加班是常态，能接受就来，不能就算了。',
      reaction_good: '谢谢！听起来团队氛围很好，我很期待能加入。',
      reaction_mid: '嗯...了解了。那我再问一个问题吧。',
      reaction_bad: '这样啊...我再了解一下其他方面。',
    },
    round2: {
      question: '那公司对新人的培养机制是怎样的？',
      good: '我们有完善的mentor制度，入职前三个月会配一位资深同事一对一带教，还有定期的技术分享和培训预算。',
      mid: '有培训的，入职会安排一下，后面靠自己多学习。',
      bad: '我们招人就是来干活的，不是来学习的，上手快才行。',
      reaction_good: '听起来很完善，谢谢您的介绍。',
      reaction_mid: '好的，我了解了，谢谢。',
      reaction_bad: '这样啊...那我需要再考虑考虑。',
    },
    scolding: '你在候选人提问环节的表现让我非常失望。候选人提出合理问题，你的回答不仅没有展现公司优势，反而态度傲慢、回避问题。这种表现严重损害了公司的雇主品牌形象，候选人可能会在社交平台上分享这次糟糕的面试体验。我需要你认真反思。',
  };

  // 优先从本地数据取JD专属提问（风格版优先 → 通用版 → fallback）
  const jdIndex = GameState.currentJDIndex;
  const _cqSource = (jdIndex >= 0 && typeof LOCAL_DATA !== 'undefined' ? LOCAL_DATA[jdIndex] : null);
  function getLocalCounterQ() {
    if (_cqSource) {
      // 优先取风格版数据
      const styleData = _cqSource.styles && _cqSource.styles[GameState.hrStyle];
      const cqData = (styleData && styleData.counterQuestions) || _cqSource.counterQuestions;
      if (cqData) {
        const tier = candidate.quality >= 7 ? 'great' : candidate.quality >= 4 ? 'mid' : 'bad';
        const sets = cqData[tier];
        if (sets && sets.length > 0) {
          const chosen = sets[Math.floor(Math.random() * sets.length)];
          if (chosen && chosen.round1 && chosen.round2) {
            chosen.scolding = chosen.scolding || fallbackData.scolding;
            chosen.round1.reaction_good = chosen.round1.reaction_good || fallbackData.round1.reaction_good;
            chosen.round1.reaction_mid = chosen.round1.reaction_mid || fallbackData.round1.reaction_mid;
            chosen.round1.reaction_bad = chosen.round1.reaction_bad || fallbackData.round1.reaction_bad;
            chosen.round2.reaction_good = chosen.round2.reaction_good || fallbackData.round2.reaction_good;
            chosen.round2.reaction_mid = chosen.round2.reaction_mid || fallbackData.round2.reaction_mid;
            chosen.round2.reaction_bad = chosen.round2.reaction_bad || fallbackData.round2.reaction_bad;
            return chosen;
          }
        }
      }
    }
    return null;
  }

  // 本地模式直接返回本地数据
  if (GameState.mode === 'local') {
    return getLocalCounterQ() || fallbackData;
  }

  try {
    const prompt = PROMPTS.generateCounterQuestion(candidate, GameState.currentJD);
    const result = await DeepSeekAPI.chatJSON(prompt);
    if (result && result.round1 && result.round2 && result.round1.question && result.round2.question) {
      result.scolding = result.scolding || fallbackData.scolding;
      result.round1.reaction_good = result.round1.reaction_good || fallbackData.round1.reaction_good;
      result.round1.reaction_mid = result.round1.reaction_mid || fallbackData.round1.reaction_mid;
      result.round1.reaction_bad = result.round1.reaction_bad || fallbackData.round1.reaction_bad;
      result.round2.reaction_good = result.round2.reaction_good || fallbackData.round2.reaction_good;
      result.round2.reaction_mid = result.round2.reaction_mid || fallbackData.round2.reaction_mid;
      result.round2.reaction_bad = result.round2.reaction_bad || fallbackData.round2.reaction_bad;
      return result;
    }
  } catch (e) {}

  // API失败降级到本地数据
  return getLocalCounterQ() || fallbackData;
}

function renderCounterQuestion(candidate) {
  const controls = document.getElementById('interview-controls');
  if (!controls) return;

  const data = _counterQuestionCache || null;
  if (!data) {
    // 缓存未加载完成，显示等待状态并轮询
    controls.innerHTML = `<div class="interview-done-msg" style="animation: pulse 1.2s ease-in-out infinite;">⏳ 正在准备候选人提问环节...</div>`;
    const pollTimer = setInterval(() => {
      if (_counterQuestionCache) {
        clearInterval(pollTimer);
        _pollTimers = _pollTimers.filter(t => t !== pollTimer);
        renderCounterQuestion(candidate);
      }
    }, 300);
    _pollTimers.push(pollTimer);
    return;
  }

  let _counterRound = 1;
  let _round1Quality = null;
  let _round2Quality = null;
  let totalBonus = 0;

  function showRound(roundNum) {
    const roundData = roundNum === 1 ? data.round1 : data.round2;

    const candidateBubble = document.getElementById('bubble-candidate');
    candidateBubble.textContent = roundData.question;
    candidateBubble.classList.add('visible');
    setSpeaking('candidate');
    scrollBubbleArea();

    const interviewerBubble = document.getElementById('bubble-interviewer');
    interviewerBubble.classList.remove('visible');
    interviewerBubble.textContent = '';

    const answers = [
      { text: roundData.good, quality: 'good', score: 5 },
      { text: roundData.mid, quality: 'mid', score: 0 },
      { text: roundData.bad, quality: 'bad', score: -5 },
    ].sort(() => Math.random() - 0.5);

    controls.innerHTML = `
      <div class="counter-question-section">
        <div class="counter-question-label">🙋 候选人的提问 第${roundNum}轮</div>
        <div class="counter-answer-label">💬 选择你的回答：</div>
        <div class="counter-answers" id="counter-answers">
          ${answers.map(a => `<button class="counter-answer-btn" data-quality="${a.quality}" data-score="${a.score}">${a.text}</button>`).join('')}
        </div>
      </div>
    `;

    setTimeout(() => clearSpeaking(), 800);

    document.getElementById('counter-answers').addEventListener('click', (e) => {
      const btn = e.target.closest('.counter-answer-btn');
      if (!btn || btn.classList.contains('disabled')) return;

      const quality = btn.dataset.quality;
      const score = parseInt(btn.dataset.score);
      totalBonus += score;

      document.querySelectorAll('.counter-answer-btn').forEach(b => b.classList.add('disabled'));
      btn.classList.add(`selected-${quality}`);

      interviewerBubble.textContent = btn.textContent;
      interviewerBubble.classList.add('visible');
      setSpeaking('interviewer');
      scrollBubbleArea();

      // 记录提问对话到面试录音
      GameState.interviewDialogs[candidate.id].push({
        question: `【提问第${roundNum}轮】${roundData.question}`,
        answer: btn.textContent,
      });

      // 显示本轮得分提示
      const hintClass = quality === 'good' ? 'good' : quality === 'mid' ? 'mid' : 'bad';
      const hintText = quality === 'good' ? '👍 回答得体' : quality === 'mid' ? '😐 回答一般' : '👎 回答不当';
      const section = document.querySelector('.counter-question-section');
      const hint = document.createElement('div');
      hint.className = `counter-score-hint ${hintClass}`;
      hint.textContent = hintText;
      section.appendChild(hint);

      if (roundNum === 1) {
        _round1Quality = quality;
      } else {
        _round2Quality = quality;
      }

      setTimeout(() => {
        clearSpeaking();

        // 显示候选人反应
        const reactionKey = `reaction_${quality}`;
        const reaction = roundData[reactionKey] || '';

        if (reaction) {
          candidateBubble.textContent = reaction;
          candidateBubble.classList.add('visible');
          setSpeaking('candidate');
          scrollBubbleArea();
        }

        setTimeout(() => {
          clearSpeaking();

          if (roundNum === 1 && quality === 'good') {
            // 第一轮好答案 → 候选人满意，不追问
            GameState.counterQuestionBonus[candidate.id] = totalBonus;
            document.getElementById('btn-next-candidate').classList.add('visible');
          } else if (roundNum === 1) {
            // 第一轮中/差 → 进入第二轮
            setTimeout(() => showRound(2), 300);
          } else {
            // 第二轮结束
            GameState.counterQuestionBonus[candidate.id] = totalBonus;

            if (_round1Quality === 'bad' && _round2Quality === 'bad') {
              // 两轮都选了最差 → HRD来电质问
              GameState.scoldingCount++;
              if (GameState.scoldingCount === 1) showForceWarning('⚠️ HRD 对你的面试表现很不满，再犯一次将被强制毕业！');
              setTimeout(() => {
                triggerHrdPhoneCall(candidate, data.scolding);
              }, 500);
            } else {
              document.getElementById('btn-next-candidate').classList.add('visible');
            }
          }
        }, 800);
      }, 600);
    });
  }

  showRound(1);
}
