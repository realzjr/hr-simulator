/**
 * 谈薪逻辑
 * 开价 → 3轮博弈 → 最终定薪 → 概率判定
 */

/**
 * 解析薪资字符串
 * "15-20K" → { min: 15, max: 20, unit: 'K' }
 * "25-30K×15薪" → { min: 25, max: 30, unit: 'K×15薪' }
 */
function parseSalary(salaryStr) {
  if (!salaryStr) return { min: 10, max: 15, unit: 'K' };
  const str = String(salaryStr).trim();
  // 匹配 "数字-数字" 后跟单位
  const m = str.match(/(\d+(?:\.\d+)?)\s*[-~到]\s*(\d+(?:\.\d+)?)\s*(.*)/);
  if (m) {
    return {
      min: parseFloat(m[1]),
      max: parseFloat(m[2]),
      unit: m[3] || 'K',
    };
  }
  // fallback: 单数字
  const single = str.match(/(\d+(?:\.\d+)?)\s*(.*)/);
  if (single) {
    const v = parseFloat(single[1]);
    return { min: v * 0.8, max: v, unit: single[2] || 'K' };
  }
  return { min: 10, max: 15, unit: 'K' };
}

/**
 * 格式化薪资数值
 */
function formatSalary(value, unit) {
  const v = Math.round(value * 10) / 10;
  // 如果是整数就不显示小数
  const display = v % 1 === 0 ? v.toString() : v.toFixed(1);
  return display + unit;
}

// 谈薪状态
let _negoState = null;

/**
 * 启动谈薪流程
 */
function startNegotiation(candidate) {
  const salary = parseSalary(candidate.salary);
  const mid = (salary.min + salary.max) / 2;
  const low80 = Math.round(salary.min * 0.8 * 10) / 10;

  // 面试好感度加成
  const bonus = GameState.counterQuestionBonus[candidate.id] || 0;
  let willingnessBonus = 0;
  if (bonus > 0) willingnessBonus = 10;
  else if (bonus < 0) willingnessBonus = -5;

  _negoState = {
    candidate,
    salary,
    currentRound: 0,        // 0=开价, 1-3=博弈, 4=最终定薪
    willingness: 0,
    initialOffer: 0,        // 第一回合选择的薪资
    willingnessBonus,
    dialogueData: null,     // AI生成的对话数据
    hrAvatar: getHRAvatar(),
    bargainScores: [],      // 每轮谈判得分记录
  };

  switchScene('negotiation');
  renderNegotiation(candidate);

  // 开始对话
  startNegoConversation();
}

/**
 * 开始对话 — 复用预加载的AI生成，同时显示开场白
 */
async function startNegoConversation() {
  const state = _negoState;
  const c = state.candidate;

  // 显示系统消息
  addNegoMessage('system', '📞 电话已接通');

  // 复用预加载的AI promise（由feedbackLogic提前触发），如果没有则现场发起
  const aiPromise = GameState._negoDialoguePromise || generateNegotiationDialogue(c);
  GameState._negoDialoguePromise = null;

  // HR开场白（按风格选文案，不等AI）
  const _d = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
  const _opening = (_d && _d.negoOpening) || [
    `${c.name}你好！恭喜你通过了我们的面试，表现非常出色。`,
    `接下来我们聊聊薪资待遇的事情，希望能达成共识。`,
  ];
  await delay(600);
  addNegoMessage('right', _opening[0].replace(/\{name\}/g, c.name), state.hrAvatar);

  await delay(800);
  addNegoMessage('right', _opening[1].replace(/\{name\}/g, c.name), state.hrAvatar);

  // 候选人回复（等AI，如果还没好显示思考中状态栏）
  await delay(500);

  // 显示"候选人正在思考中…"状态栏
  addNegoMessage('system', '💭 候选人正在思考中……');
  let thinkingBubble = addNegoMessage('left', '思考中', c.avatar, { thinking: true });

  const dialogueData = await aiPromise;
  state.dialogueData = dialogueData;

  // 移除思考气泡
  if (thinkingBubble && thinkingBubble.parentNode) {
    thinkingBubble.parentNode.removeChild(thinkingBubble);
  }
  // 移除思考中系统消息（最后一个system msg）
  const msgs = document.getElementById('nego-messages');
  if (msgs) {
    const systemMsgs = msgs.querySelectorAll('.nego-system-msg');
    const lastSys = systemMsgs[systemMsgs.length - 1];
    if (lastSys && lastSys.textContent.includes('思考中')) {
      lastSys.parentNode.removeChild(lastSys);
    }
  }

  if (dialogueData && dialogueData.candidate_greeting_reply) {
    addNegoMessage('left', dialogueData.candidate_greeting_reply, c.avatar);
  } else {
    addNegoMessage('left', '谢谢！很高兴收到好消息，我也很期待能加入贵公司。', c.avatar);
  }

  // 进入第一回合：开价
  await delay(600);
  showOpeningOffers();
}

/**
 * 从本地数据获取谈薪对话
 */
function getLocalNegotiationDialogue(candidate) {
  const jdIndex = GameState.currentJDIndex;
  const source = (jdIndex >= 0 && typeof LOCAL_DATA !== 'undefined' ? LOCAL_DATA[jdIndex] : null);
  if (source) {
    const tier = candidate.quality >= 7 ? 'great' : candidate.quality >= 4 ? 'mid' : 'bad';
    // 优先取风格版数据
    const styleData = source.styles && source.styles[GameState.hrStyle];
    const negoData = (styleData && styleData.negotiations) || source.negotiations;
    const sets = negoData && negoData[tier];
    if (sets && sets.length > 0) {
      const chosen = sets[Math.floor(Math.random() * sets.length)];
      // 还原 {name} 占位符为实际候选人姓名
      const str = JSON.stringify(chosen);
      return JSON.parse(str.replace(/\{name\}/g, candidate.name));
    }
  }
  return null;
}

/**
 * 校验谈薪对话数据完整性
 * 返回 { valid: bool, reason: string }
 */
function validateNegotiationData(data) {
  if (!data || !data.rounds || !Array.isArray(data.rounds)) {
    return { valid: false, reason: 'rounds 缺失或非数组' };
  }
  if (data.rounds.length < 3) {
    return { valid: false, reason: `rounds 只有 ${data.rounds.length} 轮，需要3轮` };
  }

  // 检查每轮结构
  for (let i = 0; i < 3; i++) {
    const r = data.rounds[i];
    if (!r || !r.options || !Array.isArray(r.options) || r.options.length < 4) {
      return { valid: false, reason: `第${i + 1}轮 options 不足4个` };
    }
    const types = r.options.map(o => o.type);
    for (const t of ['perfect', 'close', 'irrelevant', 'negative']) {
      if (!types.includes(t)) {
        return { valid: false, reason: `第${i + 1}轮缺少 type="${t}"` };
      }
    }
    for (const opt of r.options) {
      if (!opt.label || !opt.hr_says || !opt.candidate_reply) {
        return { valid: false, reason: `第${i + 1}轮选项字段不完整` };
      }
    }
  }

  // 检查轮间内容是否重复（用 label 集合判断）
  const roundLabels = data.rounds.map(r => r.options.map(o => o.label).sort().join('|'));
  if (roundLabels[0] === roundLabels[1] || roundLabels[1] === roundLabels[2] || roundLabels[0] === roundLabels[2]) {
    return { valid: false, reason: '存在两轮选项完全相同' };
  }

  return { valid: true, reason: '' };
}

/**
 * 生成AI对话（含校验和重试）
 */
async function generateNegotiationDialogue(candidate) {
  // 本地模式直接返回本地数据
  if (GameState.mode === 'local') {
    return getLocalNegotiationDialogue(candidate);
  }

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prompt = PROMPTS.generateNegotiationDialogue(candidate, GameState.currentJD);
      const data = await DeepSeekAPI.chatJSON(prompt, { model: 'deepseek-chat' });
      if (!data) {
        console.warn(`[谈薪] 第${attempt + 1}次尝试：API返回空数据`);
        continue;
      }

      const check = validateNegotiationData(data);
      if (!check.valid) {
        console.warn(`[谈薪] 第${attempt + 1}次尝试数据校验失败: ${check.reason}`);
        continue;
      }

      return data;
    } catch (e) {
      console.error(`[谈薪] 第${attempt + 1}次尝试异常:`, e);
    }
  }

  console.warn('[谈薪] AI生成全部失败，降级到本地数据');
  // API失败降级到本地数据
  return getLocalNegotiationDialogue(candidate);
}

/**
 * 第一回合：开价
 */
function showOpeningOffers() {
  const state = _negoState;
  const s = state.salary;
  const mid = Math.round((s.min + s.max) / 2 * 10) / 10;
  const low80 = Math.round(s.min * 0.8 * 10) / 10;

  addNegoMessage('system', '💰 请选择开出的薪资');

  const options = [
    { label: `${formatSalary(s.max, s.unit)}（上限）`, value: s.max, willingness: 90 },
    { label: `${formatSalary(mid, s.unit)}（中值）`, value: mid, willingness: 70 },
    { label: `${formatSalary(s.min, s.unit)}（下限）`, value: s.min, willingness: 50 },
    { label: `${formatSalary(low80, s.unit)}（压价）`, value: low80, willingness: 30 },
  ];

  showNegoOptions(options, (selected) => {
    state.initialOffer = selected.value;
    state.willingness = selected.willingness + state.willingnessBonus;
    state.willingness = Math.max(0, Math.min(100, state.willingness));
    state.currentRound = 1;

    // HR说出薪资
    addNegoMessage('right',
      `经过综合评估，我们给你的薪资是 ${formatSalary(selected.value, state.salary.unit)}，你觉得怎么样？`,
      state.hrAvatar
    );

    // 显示意愿条
    updateWillingness(state.willingness);
    hideNegoOptions();

    // 候选人反应
    setTimeout(() => {
      const w = state.willingness;
      let reaction;
      if (w >= 80) reaction = '这个薪资我比较满意，基本符合我的预期。';
      else if (w >= 60) reaction = '嗯...这个数字还可以，不过我还想再聊聊。';
      else if (w >= 40) reaction = '说实话这个薪资比我预期要低一些，我需要考虑考虑。';
      else reaction = '这个薪资跟我的期望差距挺大的，我可能需要慎重考虑了。';

      addNegoMessage('left', reaction, state.candidate.avatar);

      // 进入博弈轮
      setTimeout(() => startBargainRound(1), 800);
    }, 800);
  });
}

/**
 * 博弈轮（1-3轮）
 */
function startBargainRound(roundNum) {
  const state = _negoState;
  const dd = state.dialogueData;

  if (roundNum > 3) {
    // 进入最终定薪
    startFinalOffer();
    return;
  }

  addNegoMessage('system', `第${roundNum}轮谈判`);

  // 使用AI生成的对话数据
  const roundData = dd && dd.rounds && dd.rounds[roundNum - 1];

  if (roundData && roundData.options && roundData.options.length >= 4) {
    // AI数据可用
    const options = roundData.options.map(opt => {
      let willDelta = 0;
      if (opt.type === 'perfect') willDelta = 20;
      else if (opt.type === 'close') willDelta = 10;
      else if (opt.type === 'irrelevant') willDelta = 0;
      else if (opt.type === 'negative') willDelta = -10;

      return {
        label: opt.label,
        hr_says: opt.hr_says,
        candidate_reply: opt.candidate_reply,
        willDelta,
        type: opt.type,
      };
    });

    showNegoOptions(options, (selected) => {
      handleBargainChoice(selected, roundNum);
    });
  } else {
    // 每轮独立的 Fallback 选项
    const fallbackRounds = [
      // 第1轮：职业发展
      [
        { label: '聊晋升通道', hr_says: '我们有清晰的晋升体系，表现优秀的同事一年内就有机会升职加薪，你来了也一样。', candidate_reply: '有明确晋升路径确实很重要，这点很吸引我。', willDelta: 20, type: 'perfect' },
        { label: '介绍培训资源', hr_says: '公司每季度有外部培训预算，还有内部技术分享会，成长机会很多。', candidate_reply: '有学习机会挺好的。', willDelta: 10, type: 'close' },
        { label: '谈公司愿景', hr_says: '我们公司未来三年有很大的发展规划，行业前景非常广阔。', candidate_reply: '嗯，我了解了。', willDelta: 0, type: 'irrelevant' },
        { label: '强调加班文化', hr_says: '我们团队都很拼，经常自发加班到很晚，这种氛围特别能锻炼人！', candidate_reply: '自发加班？这个...我还是希望有正常的工作生活平衡。', willDelta: -10, type: 'negative' },
      ],
      // 第2轮：团队文化
      [
        { label: '介绍团队leader', hr_says: '你未来的直属leader是业内资深人士，很多同事都是冲着跟他学东西才来的。', candidate_reply: '能跟优秀的人共事是我很看重的，这太好了。', willDelta: 20, type: 'perfect' },
        { label: '聊工作氛围', hr_says: '团队氛围很融洽，大家协作顺畅，有问题随时沟通，不搞办公室政治。', candidate_reply: '听起来还不错。', willDelta: 10, type: 'close' },
        { label: '介绍公司规模', hr_says: '我们公司现在有500多人，在行业里也算中等偏上的规模了。', candidate_reply: '哦，好的。', willDelta: 0, type: 'irrelevant' },
        { label: '强调团建福利', hr_says: '我们每周末都组织团建活动，爬山、密室、聚餐轮着来，团队凝聚力特别强！', candidate_reply: '每周末都有团建？我周末一般想休息...', willDelta: -10, type: 'negative' },
      ],
      // 第3轮：福利待遇
      [
        { label: '聊年终奖', hr_says: '我们年终奖不是固定的，绩效好的话能拿到3-4个月，去年团队平均发了3个月。', candidate_reply: '这个年终奖力度确实不错，整体收入还是很有竞争力的。', willDelta: 20, type: 'perfect' },
        { label: '提弹性工作', hr_says: '我们支持弹性工作时间，不强制打卡，完成任务就好。', candidate_reply: '弹性工作确实是个加分项。', willDelta: 10, type: 'close' },
        { label: '提下午茶', hr_says: '公司每周三有下午茶，零食水果随便吃，大家都挺开心的。', candidate_reply: '嗯...好的，谢谢。', willDelta: 0, type: 'irrelevant' },
        { label: '提健身打卡奖', hr_says: '公司有健身打卡奖励计划，每天打卡还能额外拿补贴，晚上9点后健身房免费开放！', candidate_reply: '晚上9点后？那岂不是默认9点才下班...', willDelta: -10, type: 'negative' },
      ],
    ];

    const options = fallbackRounds[roundNum - 1] || fallbackRounds[0];
    showNegoOptions(options, (selected) => {
      handleBargainChoice(selected, roundNum);
    });
  }
}

/**
 * 处理博弈选择
 */
function handleBargainChoice(selected, roundNum) {
  const state = _negoState;

  hideNegoOptions();

  // 记录本轮谈判得分
  let roundScore = 0;
  if (selected.type === 'perfect') roundScore = 5;
  else if (selected.type === 'close') roundScore = 3;
  else if (selected.type === 'irrelevant') roundScore = 2;
  else roundScore = 0;
  state.bargainScores.push(roundScore);

  // HR发言
  addNegoMessage('right', selected.hr_says, state.hrAvatar);

  // 更新意愿
  state.willingness = Math.max(0, Math.min(100, state.willingness + selected.willDelta));
  updateWillingness(state.willingness);

  // 候选人回复
  setTimeout(() => {
    addNegoMessage('left', selected.candidate_reply, state.candidate.avatar);

    // 下一轮
    setTimeout(() => startBargainRound(roundNum + 1), 800);
  }, 800);
}

/**
 * 最终定薪回合
 */
function startFinalOffer() {
  const state = _negoState;
  const s = state.salary;
  const initial = state.initialOffer;

  addNegoMessage('system', '💼 最终定薪 — 你可以选择最终薪资');

  // 生成选项：从初始开价开始，每档提升到下一个锚点
  const anchors = [];
  const low80 = Math.round(s.min * 0.8 * 10) / 10;
  const mid = Math.round((s.min + s.max) / 2 * 10) / 10;
  const values = [low80, s.min, mid, s.max];

  // 只保留 >= 初始开价的选项
  const available = values.filter(v => v >= initial - 0.01);

  // 确保至少有初始开价
  if (available.length === 0 || available[0] > initial + 0.01) {
    available.unshift(initial);
  }

  // 去重
  const unique = [...new Set(available.map(v => Math.round(v * 10) / 10))];

  const options = unique.map((v, i) => {
    const boostSteps = i; // 每提升一档 +15%
    let hint = '';
    if (boostSteps === 0) hint = '（维持原价）';
    else if (boostSteps === 1) hint = '（小幅提升意愿度）';
    else if (boostSteps === 2) hint = '（中幅提升意愿度）';
    else hint = '（大幅提升意愿度）';

    return {
      label: `${formatSalary(v, s.unit)} ${hint}`,
      value: v,
      willBoost: boostSteps * 15,
    };
  });

  showNegoHint('提升薪资可以增加候选人接受意愿');

  showNegoOptions(options, (selected) => {
    handleFinalOffer(selected);
  });
}

/**
 * 处理最终定薪
 */
function handleFinalOffer(selected) {
  const state = _negoState;

  hideNegoOptions();

  // 更新意愿
  state.willingness = Math.max(0, Math.min(100, state.willingness + selected.willBoost));
  updateWillingness(state.willingness);

  const finalSalary = formatSalary(selected.value, state.salary.unit);

  // HR宣布最终薪资
  addNegoMessage('right',
    `经过沟通，最终薪资定为 ${finalSalary}。希望我们能达成合作！`,
    state.hrAvatar
  );

  // 概率判定
  setTimeout(() => {
    const accepted = Math.random() * 100 < state.willingness;
    showNegotiationResult(accepted, finalSalary, selected.value);
  }, 1200);
}

/**
 * 显示谈薪结果
 */
function showNegotiationResult(accepted, finalSalaryStr, finalSalaryValue) {
  const state = _negoState;
  const c = state.candidate;
  const dd = state.dialogueData;

  if (accepted) {
    // 候选人接受
    const acceptText = (dd && dd.final_accept) || '经过考虑，我接受这个offer！期待和大家一起共事。';
    addNegoMessage('left', acceptText, c.avatar);

    setTimeout(() => {
      const _hd = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
      const blessingText = (dd && dd.hr_blessing) || (_hd && _hd.negoBlessing) || '太好了！欢迎加入我们团队，期待你的精彩表现！';
      addNegoMessage('right', blessingText, state.hrAvatar);

      addNegoMessage('system', '🎉 候选人接受了Offer！');

      // 保存结果
      finishNegotiation(true, finalSalaryStr, finalSalaryValue);
    }, 800);
  } else {
    // 候选人拒绝
    const rejectText = (dd && dd.final_reject) || '非常感谢贵公司的认可，但薪资方面和我的预期还是有些差距，我可能需要再考虑其他机会。';
    addNegoMessage('left', rejectText, c.avatar);

    setTimeout(() => {
      const _hd2 = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
      const regretText = (dd && dd.hr_regret) || (_hd2 && _hd2.negoRegret) || '很遗憾没能达成合作，祝你找到满意的工作。';
      addNegoMessage('right', regretText, state.hrAvatar);

      addNegoMessage('system', '😔 候选人拒绝了Offer');

      // 保存结果
      finishNegotiation(false, finalSalaryStr, finalSalaryValue);
    }, 800);
  }
}

/**
 * 谈薪完成，进入HRD Review
 */
function finishNegotiation(accepted, finalSalaryStr, finalSalaryValue) {
  const state = _negoState;
  const c = state.candidate;

  const negotiationResult = {
    accepted,
    finalSalary: finalSalaryStr,
    finalSalaryValue,
    willingness: state.willingness,
    bargainScores: state.bargainScores || [],
  };

  // 存入GameState
  GameState.negotiationResults[c.id] = negotiationResult;
  GameState.feedbackScores[c.id].offerGiven = accepted;
  GameState.feedbackScores[c.id].offerRejected = !accepted;
  GameState.feedbackScores[c.id].negotiationResult = negotiationResult;

  // 如果拒绝，扣分效果在calculateFeedbackScore中体现（offerGiven=false对高质量候选人扣分）

  // 显示继续按钮
  const optionsArea = document.getElementById('nego-options');
  if (optionsArea) {
    optionsArea.style.display = '';
    const grid = document.getElementById('nego-options-grid');
    grid.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'nego-option-btn';
    btn.style.gridColumn = '1 / -1';
    btn.textContent = '👉 继续';
    btn.addEventListener('click', () => {
      btn.disabled = true;
      enterHrdReviewAfterNegotiation(c, accepted, negotiationResult);
    });
    grid.appendChild(btn);
  }
}

/**
 * 工具：延迟
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
