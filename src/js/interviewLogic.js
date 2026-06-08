/**
 * 面试逻辑 — 面对面场景交互
 * 支持即时中断（跳过/结束可随时生效）
 */
let _answerBusy = false;
let _answerGen = 0;
let _scrollTimer = null;

function bindInterviewEvents(candidate) {
  document.getElementById('current-question').addEventListener('click', (e) => {
    const btn = e.target.closest('.interview-q-option');
    if (btn) handleQuestionClick(btn, candidate);
  });

  document.getElementById('btn-skip').addEventListener('click', () => {
    handleSkipQuestion(candidate);
  });

  document.getElementById('btn-end-interview').addEventListener('click', () => {
    handleEndInterview(candidate);
  });

  document.getElementById('btn-next-candidate').addEventListener('click', function () {
    this.disabled = true;
    switchScene('feedback');
    renderFeedback();
  });

  // 查看简历按钮
  document.getElementById('btn-view-candidate-resume').addEventListener('click', () => {
    document.getElementById('interview-resume-modal-overlay').classList.add('visible');
  });
  document.getElementById('interview-resume-modal-close').addEventListener('click', () => {
    document.getElementById('interview-resume-modal-overlay').classList.remove('visible');
  });
  document.getElementById('interview-resume-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove('visible');
    }
  });
}

function interruptOngoing() {
  cancelTypewriter();
  if (_scrollTimer) { clearInterval(_scrollTimer); _scrollTimer = null; }
  _pollTimers.forEach(t => clearInterval(t));
  _pollTimers = [];
  _answerBusy = false;
  _answerGen++;
  hideResponsePicker();
  clearSpeaking();
}

/**
 * 点击问题 → 隐藏问题区 → 面试官气泡 → AI回答 → 回应选择器
 */
async function handleQuestionClick(btn, candidate) {
  if (btn.classList.contains('asked') || _answerBusy) return;
  _answerBusy = true;
  const myGen = ++_answerGen;

  document.querySelectorAll('.interview-q-option').forEach(b => b.classList.add('asked'));

  const questionText = btn.textContent;

  // 问出后隐藏问题区
  const qArea = document.getElementById('current-question');
  if (qArea) qArea.style.display = 'none';

  // 面试官气泡
  const interviewerBubble = document.getElementById('bubble-interviewer');
  interviewerBubble.textContent = questionText;
  interviewerBubble.classList.add('visible');
  setSpeaking('interviewer');
  scrollBubbleArea();

  // 候选人思考中
  const candidateBubble = document.getElementById('bubble-candidate');
  candidateBubble.innerHTML = '<span class="bubble-thinking">思考中...</span>';
  candidateBubble.classList.add('visible');
  scrollBubbleArea();

  // 根据候选人quality决定回答质量
  const quality = getAnswerQuality(candidate);

  setTimeout(() => clearSpeaking(), 500);

  const answerText = await generateAIAnswer(candidate, questionText, quality);

  if (myGen !== _answerGen) return;

  GameState.interviewDialogs[candidate.id].push({
    question: questionText,
    answer: answerText,
  });

  setSpeaking('candidate');

  // 打字过程中持续滚动气泡区
  _scrollTimer = setInterval(() => scrollBubbleArea(), 150);
  typewriterEffect('bubble-candidate', answerText, 20, () => {
    clearInterval(_scrollTimer);
    _scrollTimer = null;
    scrollBubbleArea();
    _answerBusy = false;
    clearSpeaking();
    showResponsePicker(candidate, quality);
  });
}

async function generateAIAnswer(candidate, question, quality) {
  // 从本地 interviewQA 按问题文本匹配回答
  function getLocalAnswer() {
    const jdIndex = GameState.currentJDIndex;
    const source = (jdIndex >= 0 && typeof LOCAL_DATA !== 'undefined' ? LOCAL_DATA[jdIndex] : null);
    if (!source) return null;
    const tier = candidate.quality >= 7 ? 'great' : candidate.quality >= 4 ? 'mid' : 'bad';

    // 优先：新 interviewQA 结构（问答配对）
    const qaPool = source.interviewQA && source.interviewQA[tier];
    if (qaPool && qaPool.length > 0) {
      // 去掉问题前的 emoji 前缀再匹配
      const cleanQ = question.replace(/^[💬✨\s]+/, '').trim();
      // 精确匹配 → 包含匹配（短问题需≥8字才做子串匹配，防止误匹配）
      const match = qaPool.find(qa => qa.q === cleanQ)
        || qaPool.find(qa => cleanQ.length >= 8 && (cleanQ.includes(qa.q) || qa.q.includes(cleanQ)));
      if (match && match[quality]) return match[quality];
      // 未匹配到具体问题时随机取一条（兜底）
      const fallback = qaPool[Math.floor(Math.random() * qaPool.length)];
      if (fallback && fallback[quality]) return fallback[quality];
    }

    // 兼容旧 interviewAnswers 结构
    const iaData = source.interviewAnswers;
    if (iaData) {
      const tierData = iaData[tier];
      if (tierData && tierData[quality]) {
        const pool = tierData[quality];
        if (pool && pool.length > 0) {
          return pool[Math.floor(Math.random() * pool.length)];
        }
      }
    }
    return null;
  }

  const prompt = PROMPTS.generateInterviewAnswer(candidate, GameState.currentJD, question, quality);
  const result = await DeepSeekAPI.chat(prompt);
  if (result) {
    return result;
  }

  // API返回null（含本地模式），优先取本地JD专属数据
  return getLocalAnswer() || PROMPTS.answerFallbacks[quality];
}

function handleSkipQuestion(candidate) {
  interruptOngoing();
  _currentQuestionIdx++;

  const interviewerBubble = document.getElementById('bubble-interviewer');
  interviewerBubble.classList.remove('visible');
  interviewerBubble.textContent = '';
  const candidateBubble = document.getElementById('bubble-candidate');
  candidateBubble.textContent = '...';

  if (_currentQuestionIdx >= 5) {
    finishCandidateInterview();
  } else {
    advanceToNextQuestion(candidate);
  }
}

function handleEndInterview(candidate) {
  interruptOngoing();
  finishCandidateInterview();
}

function advanceToNextQuestion(candidate) {
  const interviewerBubble = document.getElementById('bubble-interviewer');
  interviewerBubble.classList.remove('visible');
  interviewerBubble.textContent = '';

  const candidateBubble = document.getElementById('bubble-candidate');
  candidateBubble.textContent = '...';

  // 重新显示问题区
  const qArea = document.getElementById('current-question');
  if (qArea) qArea.style.display = '';

  updateQuestionDisplay();
}

function finishCandidateInterview() {
  const candidate = GameState.passed[GameState.currentInterviewIndex];
  if (!candidate) return;

  // 保留工具栏，重新绑定为提问阶段的行为
  const skipBtn = document.getElementById('btn-skip');
  const endBtn = document.getElementById('btn-end-interview');

  // 提问阶段的跳过/结束逻辑
  function skipCounterQuestion() {
    interruptOngoing();

    // 清除候选人气泡（可能已显示了反问）
    const candidateBubble = document.getElementById('bubble-candidate');
    candidateBubble.classList.remove('visible');
    candidateBubble.textContent = '';

    // HR对话框出现告辞的话
    const interviewerBubble = document.getElementById('bubble-interviewer');
    const d = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
    interviewerBubble.textContent = (d && d.counterSkipLine) || '不好意思啊，稍后有个会我先走了';
    interviewerBubble.classList.add('visible');
    setSpeaking('interviewer');
    scrollBubbleArea();

    // 隐藏问题选项
    const controls = document.getElementById('interview-controls');
    if (controls) controls.innerHTML = '';

    // 视作普通回答，附加分为0
    GameState.counterQuestionBonus[candidate.id] = 0;

    setTimeout(() => {
      clearSpeaking();
      document.getElementById('btn-next-candidate').classList.add('visible');
    }, 800);
  }

  if (skipBtn) {
    skipBtn.onclick = skipCounterQuestion;
    // 更新tooltip
    const tooltip = skipBtn.closest('.toolbar-btn-wrap');
    if (tooltip) {
      const tip = tooltip.querySelector('.toolbar-tooltip');
      if (tip) tip.textContent = '跳过提问';
    }
  }
  if (endBtn) {
    endBtn.onclick = skipCounterQuestion;
  }

  const qNum = document.getElementById('question-number');
  if (qNum) qNum.textContent = '🙋 候选人提问环节';

  // 重新显示问题区（用于提问内容）
  const qArea = document.getElementById('current-question');
  if (qArea) qArea.style.display = '';

  const interviewerBubble = document.getElementById('bubble-interviewer');
  const d = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
  interviewerBubble.textContent = (d && d.counterIntroLine) || '你有什么想问我的吗？';
  interviewerBubble.classList.add('visible');
  setSpeaking('interviewer');
  scrollBubbleArea();

  setTimeout(() => clearSpeaking(), 600);

  renderCounterQuestion(candidate);
}

/**
 * HRD来电质问（两轮提问都选了最差答案时触发）
 */
function triggerHrdPhoneCall(candidate, scoldingText) {
  // 切换到HRD评审场景，用电话动效
  switchScene('hrd-review');
  renderHrdPhoneCall(scoldingText, candidate);
}
