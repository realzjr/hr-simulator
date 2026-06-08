/**
 * 面试反馈表逻辑
 * 三维度打分 + 通过/不通过决策 + AI生成HRD来信
 */

const _feedbackRatings = { fit: -1, potential: -1, value: -1 };

/**
 * 更新半星高亮显示
 * @param {string} dim - 维度名
 * @param {number} score - 分数 (0, 0.5, 1, 1.5, ... 5)
 */
function updateStarDisplay(dim, score) {
  // 0星✕按钮
  const zeroBtn = document.querySelector(`.dim-star-zero[data-dim="${dim}"]`);
  if (zeroBtn) zeroBtn.classList.toggle('active', score === 0);

  // 各星组
  document.querySelectorAll(`.dim-star-group[data-dim="${dim}"]`).forEach(group => {
    const leftBtn = group.querySelector('.dim-star-half-left');
    const starVal = parseFloat(leftBtn.dataset.score) + 0.5; // 整数星值
    const halfVal = parseFloat(leftBtn.dataset.score); // 半星值

    group.classList.remove('half-active', 'full-active');
    if (score >= starVal) {
      group.classList.add('full-active');
    } else if (score >= halfVal) {
      group.classList.add('half-active');
    }
  });
}

/**
 * 评分教程弹窗 — 首次进入点评时展示
 */
function showRatingTutorial() {
  const overlay = document.getElementById('rating-tutorial-overlay');
  if (!overlay) return;
  overlay.classList.add('visible');

  // 构建演示星星
  const demoStars = document.getElementById('tutorial-demo-stars');
  const demoLabel = document.getElementById('tutorial-demo-label');
  if (!demoStars) return;

  demoStars.innerHTML = '';
  for (let n = 1; n <= 1; n++) {
    const group = document.createElement('span');
    group.className = 'dim-star-group tutorial-demo-star';
    group.dataset.star = n;
    demoStars.appendChild(group);
  }

  // 动画序列：仅演示半星和整星
  const sequence = [
    { score: 0.5, label: '半星 — 点击星星左半边' },
    { score: 1, label: '整星 — 点击星星右半边' },
  ];

  let step = 0;
  function updateDemo(score) {
    demoStars.querySelectorAll('.tutorial-demo-star').forEach(g => {
      const n = parseInt(g.dataset.star);
      g.classList.remove('half-active', 'full-active');
      if (score >= n) g.classList.add('full-active');
      else if (score >= n - 0.5) g.classList.add('half-active');
    });
  }

  function nextStep() {
    if (step >= sequence.length) { step = 0; }
    const s = sequence[step];
    updateDemo(s.score);
    if (demoLabel) demoLabel.textContent = s.label;

    // 高亮正在点击的区域
    const targetStar = Math.ceil(s.score);
    const isHalf = s.score % 1 !== 0;
    demoStars.querySelectorAll('.tutorial-demo-star').forEach(g => {
      g.classList.remove('tutorial-pulse-left', 'tutorial-pulse-right');
    });
    const targetGroup = demoStars.querySelector(`.tutorial-demo-star[data-star="${targetStar}"]`);
    if (targetGroup) {
      targetGroup.classList.add(isHalf ? 'tutorial-pulse-left' : 'tutorial-pulse-right');
    }

    step++;
  }

  nextStep();
  const timer = setInterval(nextStep, 1500);

  // 关闭按钮
  const closeBtn = document.getElementById('rating-tutorial-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearInterval(timer);
      overlay.classList.remove('visible');
      localStorage.setItem('hr_rating_tutorial_done', '1');
    });
  }
  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      clearInterval(timer);
      overlay.classList.remove('visible');
      localStorage.setItem('hr_rating_tutorial_done', '1');
    }
  });
}

function bindFeedbackEvents(candidate) {
  // 重置评分状态（-1 = 未评分，0-5 = 已评分）
  _feedbackRatings.fit = -1;
  _feedbackRatings.potential = -1;
  _feedbackRatings.value = -1;

  // 首次进入点评教程
  if (!localStorage.getItem('hr_rating_tutorial_done')) {
    showRatingTutorial();
  }

  // 半星点击（含0星✕）
  document.querySelectorAll('.dim-star-zero').forEach(btn => {
    btn.addEventListener('click', () => {
      const dim = btn.dataset.dim;
      _feedbackRatings[dim] = 0;
      updateStarDisplay(dim, 0);
    });
  });

  document.querySelectorAll('.dim-star-half-left, .dim-star-half-right').forEach(btn => {
    btn.addEventListener('click', () => {
      const dim = btn.dataset.dim;
      const score = parseFloat(btn.dataset.score);
      _feedbackRatings[dim] = score;
      updateStarDisplay(dim, score);
    });
  });

  // 查看简历按钮
  document.getElementById('btn-view-resume').addEventListener('click', () => {
    document.getElementById('resume-modal-overlay').classList.add('visible');
  });
  document.getElementById('resume-modal-close').addEventListener('click', () => {
    document.getElementById('resume-modal-overlay').classList.remove('visible');
  });
  document.getElementById('resume-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove('visible');
    }
  });

  // 回顾面试按钮（展开/折叠录音区域）
  document.getElementById('btn-review-interview').addEventListener('click', () => {
    const section = document.getElementById('recording-section');
    section.classList.toggle('collapsed');
  });

  // 假关闭按钮（弹出同事催促弹窗，随机选取，5次后禁用）
  const _defaultColleagueMessages = [
    { avatar: '👩‍💻', name: '急招同事', badge: '紧急', text: '记得写面评，不然业务会以为你是老板关系户！🔥' },
    { avatar: '🧑‍🎓', name: '实习生小弟', badge: '实习生', text: '前辈！催到你面评我就能转正了，帮帮忙！😭' },
    { avatar: '👩‍🏫', name: '招聘同事', badge: '招聘组', text: '候选人刷了三天咱官网了，再不出结果人家要报警了。' },
    { avatar: '🧑‍💻', name: '用人经理', badge: '求助', text: '面评再不写我就默认你觉得候选人完美，直接发offer了😭' },
    { avatar: '🧑‍🎓', name: '实习生小妹', badge: '实习生', text: '前辈！候选人问进度我说「正在走高层审批」，配合一下！🙏' },
    { avatar: '👩‍⚕️', name: '行政姐姐', badge: '行政', text: '亲～写完面评请你喝奶茶，不写的话奶茶我自己喝了🧋' },
    { avatar: '👨‍🔧', name: '隔壁工位同事', badge: '技术部', text: '面评不写是有bug吗？要不要我帮你debug一下？🤖' },
    { avatar: '🐱', name: '公司猫橘总', badge: '吉祥物', text: '喵～（翻译：面评再不写，今晚加班只有我陪你了。）🐾' },
  ];
  const _hrd = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
  const _colleagueMessages = (_hrd && _hrd.colleagueMessages) || _defaultColleagueMessages;
  let _fakeCloseCount = 0;
  const _usedMsgIndices = [];
  const fakeCloseBtn = document.getElementById('btn-fake-close');

  fakeCloseBtn.addEventListener('click', () => {
    _fakeCloseCount++;

    if (_fakeCloseCount >= 5) {
      // 第5次点击后禁用
      fakeCloseBtn.disabled = true;
      fakeCloseBtn.classList.add('fake-close-disabled');
      // 更新tooltip
      const tooltip = fakeCloseBtn.closest('.feedback-btn-tooltip-wrap');
      if (tooltip) {
        const tip = tooltip.querySelector('.feedback-btn-tooltip');
        if (tip) tip.textContent = '算了算了，还是保住工作要紧！';
      }
      return;
    }

    // 随机选取一条未用过的消息（用完则重新打乱）
    if (_usedMsgIndices.length >= _colleagueMessages.length) {
      _usedMsgIndices.length = 0;
    }
    const available = _colleagueMessages.map((_, i) => i).filter(i => !_usedMsgIndices.includes(i));
    const pick = available[Math.floor(Math.random() * available.length)];
    _usedMsgIndices.push(pick);
    const msg = _colleagueMessages[pick];

    const overlay = document.getElementById('colleague-popup-overlay');
    const avatarEl = document.getElementById('colleague-popup-avatar');
    const nameEl = document.getElementById('colleague-popup-name');
    const badgeEl = document.getElementById('colleague-popup-badge');
    const body = document.getElementById('colleague-popup-body');
    if (avatarEl) avatarEl.textContent = msg.avatar;
    if (nameEl) nameEl.textContent = msg.name;
    if (badgeEl) badgeEl.textContent = msg.badge;
    body.textContent = msg.text;

    overlay.classList.add('visible');
  });
  document.getElementById('colleague-popup-close').addEventListener('click', () => {
    document.getElementById('colleague-popup-overlay').classList.remove('visible');
  });
  document.getElementById('colleague-popup-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove('visible');
    }
  });

  // 提交按钮
  document.getElementById('btn-submit-feedback').addEventListener('click', () => {
    handleSubmitFeedback(candidate);
  });
}

/**
 * 提交反馈 → 弹出通过/不通过选择
 */
function handleSubmitFeedback(candidate) {
  const { fit, potential, value } = _feedbackRatings;

  // 验证：三个维度都必须打分
  if (fit === -1 || potential === -1 || value === -1) {
    alert('请为三个维度都打分后再提交');
    return;
  }

  // 禁用提交按钮
  const submitBtn = document.getElementById('btn-submit-feedback');
  submitBtn.disabled = true;

  // 弹出通过/不通过决策面板
  const overlay = document.getElementById('feedback-decision-overlay');
  overlay.classList.add('visible');

  // 通过面试（用 onclick 替代 addEventListener 避免重复绑定）
  document.getElementById('btn-decision-pass').onclick = () => {
    overlay.classList.remove('visible');
    proceedWithDecision(candidate, true);
  };

  // 不通过
  document.getElementById('btn-decision-fail').onclick = () => {
    overlay.classList.remove('visible');
    proceedWithDecision(candidate, false);
  };
}

/**
 * 处理通过/不通过决策
 */
async function proceedWithDecision(candidate, passed, fromHrdWarning) {
  const { fit, potential, value } = _feedbackRatings;

  if (passed) {
    // 检查是否通过了低质候选人 → HRD警告
    if (candidate.quality <= 3) {
      // 通过低质候选人 → HRD警告弹窗 → 跳过谈薪
      GameState.hrdWarningCount++;
      if (GameState.hrdWarningCount === 1) showForceWarning('⚠️ HRD 的耐心快到极限了，再推一次不合格候选人就毕业！');
      GameState.feedbackScores[candidate.id] = {
        fit, potential, value, offerGiven: false, hrdWarning: true,
        interviewFailed: false, offerRejected: false, score: 0, hrdLetter: '',
      };

      showHrdWarningPopup(candidate);
      return;
    }

    // 通过面试 → 进入谈薪
    // 先暂存评分（offerGiven待谈薪结果决定）
    GameState.feedbackScores[candidate.id] = {
      fit, potential, value, offerGiven: false, offerRejected: false,
      interviewFailed: false, hrdWarning: false, score: 0, hrdLetter: '',
    };

    // 提前触发AI对话生成（不等进入谈薪场景）
    GameState._negoDialoguePromise = generateNegotiationDialogue(candidate);

    // 进入谈薪场景
    startNegotiation(candidate);
  } else {
    // 不通过 → 直接进HRD Review
    const offerGiven = false;
    const isHrdBlocked = !!fromHrdWarning;

    // 优质候选人被不通过 → 计为人才流失
    if (!isHrdBlocked && candidate.quality >= 7) {
      GameState.talentLostCount++;
      if (GameState.talentLostCount === 1) showForceWarning('⚠️ 又放走了一位优质候选人！再来一次将被强制毕业！');
    }

    switchScene('hrd-review');
    renderHrdReviewLoading('📋 HRD正在review你的表现...');

    GameState.feedbackScores[candidate.id] = {
      fit, potential, value, offerGiven, offerRejected: false,
      interviewFailed: !isHrdBlocked,
      hrdWarning: isHrdBlocked,
      score: 0, hrdLetter: '',
    };

    const score = calculateFeedbackScore(candidate, fit, potential, value, offerGiven, isHrdBlocked);
    GameState.feedbackScores[candidate.id].score = score;

    const idx = GameState.currentInterviewIndex;
    const isLast = (idx + 1 >= GameState.passed.length);

    const negoCtx = isHrdBlocked ? { hrdWarning: true } : { interviewFailed: true };
    const dialogs = GameState.interviewDialogs[candidate.id] || [];

    let hrdPromise;
    if (GameState.mode === 'local' && GameState.currentJDIndex >= 0) {
      const localLetter = getLocalHrdLetter(candidate, fit, potential, value, offerGiven, negoCtx);
      hrdPromise = Promise.resolve(localLetter);
    } else {
      hrdPromise = DeepSeekAPI.chat(
        PROMPTS.generateHRDLetter(candidate, GameState.currentJD, dialogs, { fit, potential, value }, offerGiven, negoCtx),
        { model: 'deepseek-reasoner' }
      ).catch(() => null);
    }

    if (isLast) {
      if (GameState.mode !== 'local') {
        const reportPrompt = PROMPTS.generateWeeklyReport(
          GameState.currentJD,
          GameState.candidates,
          GameState.feedbackScores,
          GameState.passed
        );
        GameState._weeklyReportPromise = DeepSeekAPI.chat(reportPrompt, { model: 'deepseek-reasoner' }).catch(() => null);
      }
    }

    let hrdLetter = await hrdPromise;
    if (!hrdLetter) {
      hrdLetter = generateFallbackLetter(candidate, fit, potential, value, offerGiven, score);
    }

    GameState.feedbackScores[candidate.id].hrdLetter = hrdLetter;

    renderHrdLetter(hrdLetter, score, candidate);
  }
}

/**
 * HRD警告弹窗 — 通过低质候选人时触发
 */
/** HRD私下警告的随机回复按钮文案 */
const _defaultHrdWarningReplies = [
  '👌 好的，听您的',
  '🙏 明白了，我再想想',
  '😅 收到，差点看走眼了',
  '🫡 了解，我撤回决定',
  '😓 您说得对，是我草率了',
];
function _getHrdWarningReplies() {
  const d = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
  return (d && d.hrdWarningReplies) || _defaultHrdWarningReplies;
}

function showHrdWarningPopup(candidate) {
  const overlay = document.getElementById('feedback-decision-overlay');
  overlay.classList.remove('visible');

  const _warningReplies = _getHrdWarningReplies();
  const replyText = _warningReplies[Math.floor(Math.random() * _warningReplies.length)];

  const container = document.getElementById('scene-feedback');

  // 先清理旧的
  const existingWarning = document.getElementById('hrd-warning-overlay');
  if (existingWarning) existingWarning.remove();

  // 第一阶段：转场动画
  const transitionHTML = `
    <div class="hrd-warning-overlay visible" id="hrd-warning-overlay">
      <div class="hrd-whisper-transition" id="hrd-whisper-transition">
        <div class="hrd-whisper-emoji-wrap">
          <div class="hrd-whisper-emoji">🤫</div>
          <div class="hrd-whisper-ripple"></div>
          <div class="hrd-whisper-ripple delay"></div>
        </div>
        <div class="hrd-whisper-text">HRD私下找你有话说</div>
        <div class="hrd-whisper-dots"><span>.</span><span>.</span><span>.</span></div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', transitionHTML);

  // 第二阶段：2.2s后切换为消息卡片
  registerSceneTimer(setTimeout(() => {
    const transitionEl = document.getElementById('hrd-whisper-transition');
    if (transitionEl) {
      transitionEl.classList.add('fade-out');
    }

    registerSceneTimer(setTimeout(() => {
      const overlayEl = document.getElementById('hrd-warning-overlay');
      if (!overlayEl) return;

      overlayEl.innerHTML = `
        <div class="hrd-warning-card">
          <div class="hrd-warning-badge">🔒 私密消息</div>
          <div class="hrd-warning-sender">
            <span class="hrd-warning-sender-avatar">🙊</span>
            <span class="hrd-warning-sender-info">
              <span class="hrd-warning-sender-name">HRD</span>
              <span class="hrd-warning-sender-tag">悄悄话</span>
            </span>
          </div>
          <div class="hrd-warning-body">
            我私下跟你说，这位候选人我看了资料，综合素质确实不太行。强行通过对团队不好，对ta也不公平。这个人就别勉强了，咱们看下一位吧。
          </div>
          <div class="hrd-warning-buttons">
            <button class="btn btn-primary hrd-warning-btn-cancel" id="btn-hrd-warning-cancel">${replyText}</button>
          </div>
        </div>
      `;

      // 只有同意选项 → 按不通过处理（保留hrdWarning标记）
      document.getElementById('btn-hrd-warning-cancel').addEventListener('click', async () => {
        document.getElementById('hrd-warning-overlay').remove();
        proceedWithDecision(candidate, false, true);
      });
    }, 400));
  }, 2200));
}

/**
 * 谈薪结束后进入HRD Review（由negotiationLogic调用）
 */
async function enterHrdReviewAfterNegotiation(candidate, offerGiven, negotiationResult) {
  const scores = GameState.feedbackScores[candidate.id] || { fit: 3, potential: 3, value: 3 };
  const { fit, potential, value } = scores;

  // 区分：offer被拒绝 vs 候选人接受
  const offerRejected = !offerGiven;

  // 仅优质候选人（quality >= 7）谈崩才累计失败次数
  if (offerRejected && candidate.quality >= 7) {
    GameState.offerRejectCount++;
    if (GameState.offerRejectCount === 1) showForceWarning('⚠️ 优质候选人又拒了 Offer！再失败一次将被强制毕业！');
  }

  GameState.feedbackScores[candidate.id] = {
    ...GameState.feedbackScores[candidate.id],
    offerGiven, offerRejected, interviewFailed: false, hrdWarning: false,
    negotiationResult,
  };

  const score = calculateFeedbackScore(candidate, fit, potential, value, true, false);

  switchScene('hrd-review');
  renderHrdReviewLoading('📋 HRD正在review你的表现...');

  const idx = GameState.currentInterviewIndex;
  const isLast = (idx + 1 >= GameState.passed.length);

  const negoCtx = {
    offerRejected,
    finalSalary: negotiationResult ? negotiationResult.finalSalary : '',
    willingness: negotiationResult ? negotiationResult.willingness : 0,
  };

  const dialogs = GameState.interviewDialogs[candidate.id] || [];

  let hrdPromise;
  if (GameState.mode === 'local' && GameState.currentJDIndex >= 0) {
    const localLetter = getLocalHrdLetter(candidate, fit, potential, value, offerGiven, negoCtx);
    hrdPromise = Promise.resolve(localLetter);
  } else {
    hrdPromise = DeepSeekAPI.chat(
      PROMPTS.generateHRDLetter(candidate, GameState.currentJD, dialogs, { fit, potential, value }, offerGiven, negoCtx),
      { model: 'deepseek-reasoner' }
    ).catch(() => null);
  }

  if (isLast) {
    GameState.feedbackScores[candidate.id].score = score;

    if (GameState.mode !== 'local') {
      const reportPrompt = PROMPTS.generateWeeklyReport(
        GameState.currentJD,
        GameState.candidates,
        GameState.feedbackScores,
        GameState.passed
      );
      GameState._weeklyReportPromise = DeepSeekAPI.chat(reportPrompt, { model: 'deepseek-reasoner' }).catch(() => null);
    }
  }

  let hrdLetter = await hrdPromise;
  if (!hrdLetter) {
    hrdLetter = generateFallbackLetter(candidate, fit, potential, value, offerGiven, score);
  }

  GameState.feedbackScores[candidate.id] = {
    ...GameState.feedbackScores[candidate.id],
    score, hrdLetter,
  };

  renderHrdLetter(hrdLetter, score, candidate);
}

/**
 * 计算单位候选人面试反馈得分（满分50）
 *
 * A. 三维度评分（30分，每维度10分）
 *    半星精度，每差0.5星扣2分，最低0
 *
 * B. 通过/不通过决策（20分，基础10，上限15，下限0）
 *    优质通过+10, 优质不通过-5
 *    普通通过+5, 普通不通过0
 *    低质通过-5, 低质不通过+5
 *
 * C. 候选人提问环节：好回答+5, HRD质问-5
 */
function calculateFeedbackScore(candidate, fit, potential, value, offerGiven, hrdBlocked) {
  const q = candidate.quality;
  const ideal = candidate.idealStars || { fit: 3, potential: 3, value: 3 };

  // A. 三维度评分（30分）
  function dimScore(playerStar, idealStar) {
    const diff = Math.abs(playerStar - idealStar);
    // 每差0.5星扣2分，满分10
    const pts = Math.max(0, 10 - Math.round(diff * 2) * 2);
    return pts;
  }

  const ratingScore = dimScore(fit, ideal.fit) + dimScore(potential, ideal.potential) + dimScore(value, ideal.value);

  // B. 通过/不通过决策（20分，base 10）
  let decisionBase = 10;
  if (q >= 7) {
    decisionBase += offerGiven ? 10 : -5;
  } else if (q >= 4) {
    decisionBase += offerGiven ? 5 : 0;
  } else {
    // 低质候选人：主动不通过 +5（正确判断），试图通过被HRD拦截 -5（错误判断）
    if (hrdBlocked) {
      decisionBase += -5;
    } else {
      decisionBase += offerGiven ? -5 : 5;
    }
  }
  const decisionScore = Math.max(0, Math.min(15, decisionBase));

  // C. 候选人提问环节附加（初始5分，好+5，差-5，范围-5~10）
  const bonus = GameState.counterQuestionBonus[candidate.id] || 0;
  const counterScore = Math.max(-5, Math.min(10, 5 + bonus));

  return Math.max(0, Math.min(50, ratingScore + decisionScore + counterScore));
}

/**
 * 从本地数据获取HRD来信模板并填充占位符
 */
function getLocalHrdLetter(candidate, fit, potential, value, offerGiven, negoCtx) {
  const jdIndex = GameState.currentJDIndex;
  const source = (jdIndex >= 0 && typeof LOCAL_DATA !== 'undefined' ? LOCAL_DATA[jdIndex] : null);
  if (!source) return null;

  const hrdData = source.hrdLetters;
  if (!hrdData) return null;

  // 根据候选人质量和场景选模板
  const q = candidate.quality;
  let sceneKey;
  if (q >= 7) {
    if (offerGiven) sceneKey = 'great_passed';
    else if (negoCtx && negoCtx.offerRejected) sceneKey = 'great_rejected';
    else sceneKey = 'great_failed';
  } else if (q >= 4) {
    if (offerGiven) sceneKey = 'mid_passed';
    else if (negoCtx && negoCtx.offerRejected) sceneKey = 'mid_rejected';
    else sceneKey = 'mid_failed';
  } else {
    sceneKey = (negoCtx && negoCtx.hrdWarning) ? 'bad_blocked' : 'bad_failed';
  }

  const templates = hrdData[sceneKey];
  if (!templates || templates.length === 0) return null;

  let template = templates[Math.floor(Math.random() * templates.length)];

  // 填充占位符
  const ideal = candidate.idealStars || { fit: 3, potential: 3, value: 3 };
  const fitDiff = Math.abs(fit - ideal.fit);
  const potDiff = Math.abs(potential - ideal.potential);
  const valDiff = Math.abs(value - ideal.value);
  const fitAssess = '适配程度：' + (fitDiff <= 0.5 ? '判断精准' : fitDiff <= 1.5 ? '略有偏差' : '偏差较大');
  const potentialAssess = '发展潜力：' + (potDiff <= 0.5 ? '判断精准' : potDiff <= 1.5 ? '略有偏差' : '偏差较大');
  const valueAssess = '性价比：' + (valDiff <= 0.5 ? '判断精准' : valDiff <= 1.5 ? '略有偏差' : '偏差较大');
  const avg = ((fit + potential + value) / 3).toFixed(1);

  template = template
    .replace(/\{name\}/g, candidate.name)
    .replace(/\{score\}/g, avg)
    .replace(/\{fitAssess\}/g, fitAssess)
    .replace(/\{potentialAssess\}/g, potentialAssess)
    .replace(/\{valueAssess\}/g, valueAssess);

  return template;
}

/**
 * AI不可用时的fallback来信
 */
function generateFallbackLetter(candidate, fit, potential, value, offerGiven, score) {
  const avg = ((fit + potential + value) / 3).toFixed(1);
  const qualityLabel = candidate.quality >= 7 ? 'A级' : candidate.quality >= 4 ? 'B级' : 'C级';
  const offerText = offerGiven ? '发放了Offer' : '未发放Offer';

  return `亲爱的面试官：

感谢你对${candidate.name}的面试评价。你给出的综合评分为${avg}星，${offerText}。

经评估，该候选人综合评级为「${qualityLabel}」。

你的评价得分为${score}分（满分50）。${score >= 40 ? '非常精准的判断，继续保持！' : score >= 25 ? '整体判断方向正确，还有提升空间。' : '建议多关注候选人的实际表现细节。'}

—— HRD`;
}
