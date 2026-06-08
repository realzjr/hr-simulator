/**
 * 测试模式核心控制器
 * 在线模式下录制所有AI回答，保存为本地数据供离线使用
 */

const TestMode = {
  active: false,
  jdIndex: -1,

  /** 录制数据（结构与 LOCAL_DATA[n] 一致） */
  recorded: null,

  /** 状态快照栈 */
  _snapshots: [],

  /** 初始化/重置录制器 */
  init(jdIndex) {
    this.active = true;
    this.jdIndex = jdIndex;
    this.recorded = {
      candidates: { great: [], great_mid: [], mid: [], mid_bad: [], bad: [] },
      interviewQuestions: { great: [], mid: [], bad: [] },
      interviewAnswers: {
        great: { good: [], mid: [], bad: [] },
        mid: { good: [], mid: [], bad: [] },
        bad: { good: [], mid: [], bad: [] },
      },
      counterQuestions: { great: [], mid: [], bad: [] },
      negotiations: { great: [], mid: [], bad: [] },
      hrdLetters: {
        great_passed: [], great_failed: [], great_rejected: [],
        mid_passed: [], mid_failed: [],
        bad_blocked: [], bad_failed: [],
      },
      weeklyReports: [],
    };
    this._snapshots = [];
  },

  /** 停用测试模式 */
  deactivate() {
    this.active = false;
    this._snapshots = [];
    if (typeof TestModeUI !== 'undefined' && TestModeUI.removePanel) {
      TestModeUI.removePanel();
    }
  },

  // ── 质量分档工具 ──

  /** candidate.quality → 5档候选人tier */
  getCandidateTier(quality) {
    if (quality >= 8) return 'great';
    if (quality >= 7) return 'great_mid';
    if (quality >= 4) return 'mid';
    if (quality >= 2) return 'mid_bad';
    return 'bad';
  },

  /** candidate.quality → 3档通用tier */
  getTier3(quality) {
    if (quality >= 7) return 'great';
    if (quality >= 4) return 'mid';
    return 'bad';
  },

  // ── 7个录制方法 ──

  /** 1. 录制候选人（去除运行时字段id/avatar） */
  recordCandidate(candidate) {
    if (!this.active || !this.recorded) return;
    const tier = this.getCandidateTier(candidate.quality);
    const copy = JSON.parse(JSON.stringify(candidate));
    delete copy.id;
    delete copy.avatar;
    delete copy.idealStars; // 运行时由 generateIdealStars() 生成
    this.recorded.candidates[tier].push(copy);
    console.log(`[TestMode] 录制候选人 ${candidate.name} (${tier})`);
    this._updateUI();
  },

  /** 2. 录制面试问题 */
  recordInterviewQuestions(candidateQuality, questions) {
    if (!this.active || !this.recorded) return;
    const tier = this.getTier3(candidateQuality);
    this.recorded.interviewQuestions[tier].push([...questions]);
    console.log(`[TestMode] 录制面试问题 (${tier})`, questions.length, '题');
    this._updateUI();
  },

  /** 3. 录制面试回答 */
  recordInterviewAnswer(candidateQuality, quality, answerText) {
    if (!this.active || !this.recorded) return;
    const tier = this.getTier3(candidateQuality);
    this.recorded.interviewAnswers[tier][quality].push(answerText);
    console.log(`[TestMode] 录制面试回答 (${tier}/${quality})`);
    this._updateUI();
  },

  /** 4. 录制反问环节数据 */
  recordCounterQuestion(candidateQuality, data) {
    if (!this.active || !this.recorded) return;
    const tier = this.getTier3(candidateQuality);
    this.recorded.counterQuestions[tier].push(JSON.parse(JSON.stringify(data)));
    console.log(`[TestMode] 录制反问数据 (${tier})`);
    this._updateUI();
  },

  /** 5. 录制谈薪对话（名字模板化为{name}） */
  recordNegotiation(candidateQuality, candidateName, dialogueObj) {
    if (!this.active || !this.recorded || !dialogueObj) return;
    const tier = this.getTier3(candidateQuality);
    const str = JSON.stringify(dialogueObj);
    // 将候选人姓名替换为 {name} 占位符
    const escaped = candidateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const templatized = str.replace(new RegExp(escaped, 'g'), '{name}');
    this.recorded.negotiations[tier].push(JSON.parse(templatized));
    console.log(`[TestMode] 录制谈薪对话 (${tier})，名字已模板化`);
    this._updateUI();
  },

  /** 6. 录制HRD来信（名字和评分模板化） */
  recordHrdLetter(sceneKey, letterText, candidate, scores) {
    if (!this.active || !this.recorded || !letterText) return;
    let text = letterText;
    // 模板化候选人姓名
    if (candidate && candidate.name) {
      const escaped = candidate.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(escaped, 'g'), '{name}');
    }
    // 模板化评分（用平均分占位）
    if (scores) {
      const avg = ((scores.fit + scores.potential + scores.value) / 3).toFixed(1);
      text = text.replace(new RegExp(avg.replace('.', '\\.'), 'g'), '{score}');
    }
    this.recorded.hrdLetters[sceneKey].push(text);
    console.log(`[TestMode] 录制HRD来信 (${sceneKey})`);
    this._updateUI();
  },

  /** 7. 录制周报（统计数据模板化） */
  recordWeeklyReport(reportText) {
    if (!this.active || !this.recorded || !reportText) return;
    let text = reportText;
    // 模板化统计数据
    const total = GameState.candidates.length;
    const interviewed = GameState.passed.length;
    const scores = Object.values(GameState.feedbackScores);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((s, fb) => s + fb.score, 0) / scores.length)
      : 0;
    const offersAccepted = scores.filter(fb => fb.offerGiven && !fb.offerRejected).length;
    const offersRejected = scores.filter(fb => fb.offerRejected).length;
    const passed = scores.filter(fb => fb.offerGiven || fb.interviewFailed === false).length;

    text = text.replace(new RegExp(String(total), 'g'), '{total}');
    text = text.replace(new RegExp(String(interviewed), 'g'), '{interviewed}');
    // 注意替换顺序：先替换较长的数字
    if (avgScore > 0) text = text.replace(new RegExp(String(avgScore), 'g'), '{avgScore}');
    text = text.replace(new RegExp(String(offersAccepted), 'g'), '{offersAccepted}');
    text = text.replace(new RegExp(String(offersRejected), 'g'), '{offersRejected}');

    this.recorded.weeklyReports.push(text);
    console.log('[TestMode] 录制周报');
    this._updateUI();
  },

  // ── 完整性检查 ──

  checkCompleteness() {
    const r = this.recorded;
    if (!r) return { allComplete: false, categories: {} };

    const cats = {};

    // 候选人：great + mid + bad 必需
    cats.candidates = {
      great: r.candidates.great.length + r.candidates.great_mid.length,
      mid: r.candidates.mid.length + r.candidates.mid_bad.length,
      bad: r.candidates.bad.length,
      complete: (r.candidates.great.length + r.candidates.great_mid.length) > 0
        && (r.candidates.mid.length + r.candidates.mid_bad.length) > 0
        && r.candidates.bad.length > 0,
    };

    // 面试问题
    cats.interviewQuestions = {
      great: r.interviewQuestions.great.length,
      mid: r.interviewQuestions.mid.length,
      bad: r.interviewQuestions.bad.length,
      complete: r.interviewQuestions.great.length > 0 && r.interviewQuestions.mid.length > 0 && r.interviewQuestions.bad.length > 0,
    };

    // 面试回答：3 tier × 3 quality
    cats.interviewAnswers = { complete: true };
    for (const tier of ['great', 'mid', 'bad']) {
      for (const q of ['good', 'mid', 'bad']) {
        const count = r.interviewAnswers[tier][q].length;
        cats.interviewAnswers[`${tier}_${q}`] = count;
        if (count === 0) cats.interviewAnswers.complete = false;
      }
    }

    // 反问环节
    cats.counterQuestions = {
      great: r.counterQuestions.great.length,
      mid: r.counterQuestions.mid.length,
      bad: r.counterQuestions.bad.length,
      complete: r.counterQuestions.great.length > 0 && r.counterQuestions.mid.length > 0 && r.counterQuestions.bad.length > 0,
    };

    // 谈薪
    cats.negotiations = {
      great: r.negotiations.great.length,
      mid: r.negotiations.mid.length,
      bad: r.negotiations.bad.length,
      complete: r.negotiations.great.length > 0 && r.negotiations.mid.length > 0 && r.negotiations.bad.length > 0,
    };

    // HRD来信：5个必需场景
    const required = ['great_passed', 'great_failed', 'mid_passed', 'mid_failed', 'bad_failed'];
    cats.hrdLetters = { complete: true };
    for (const key of required) {
      cats.hrdLetters[key] = r.hrdLetters[key].length;
      if (r.hrdLetters[key].length === 0) cats.hrdLetters.complete = false;
    }
    cats.hrdLetters.great_rejected = r.hrdLetters.great_rejected.length;
    cats.hrdLetters.bad_blocked = r.hrdLetters.bad_blocked.length;

    // 周报
    cats.weeklyReports = {
      count: r.weeklyReports.length,
      complete: r.weeklyReports.length > 0,
    };

    const allComplete = Object.values(cats).every(c => c.complete !== false);

    return { allComplete, categories: cats };
  },

  // ── 状态快照（支持回退） ──

  saveSnapshot() {
    const snap = JSON.parse(JSON.stringify({
      feedbackScores: GameState.feedbackScores,
      counterQuestionBonus: GameState.counterQuestionBonus,
      negotiationResults: GameState.negotiationResults,
      interviewDialogs: GameState.interviewDialogs,
      scoldingCount: GameState.scoldingCount,
      offerRejectCount: GameState.offerRejectCount,
      talentLostCount: GameState.talentLostCount,
      currentInterviewIndex: GameState.currentInterviewIndex,
      currentResumeIndex: GameState.currentResumeIndex,
      currentScene: GameState.currentScene,
    }));
    this._snapshots.push(snap);
    // 最多保留10个快照
    if (this._snapshots.length > 10) this._snapshots.shift();
  },

  restoreSnapshot() {
    if (this._snapshots.length === 0) return false;
    const snap = this._snapshots.pop();
    Object.assign(GameState, JSON.parse(JSON.stringify(snap)));
    return true;
  },

  hasSnapshot() {
    return this._snapshots.length > 0;
  },

  // ── 保存/加载 ──

  /** 保存录制数据到 localStorage（与已有数据合并） */
  saveToLocalStorage() {
    if (!this.recorded || this.jdIndex < 0) return false;
    const key = `hr_sim_local_data_${this.jdIndex}`;
    let existing = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) existing = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    const merged = existing ? this._mergeData(existing, this.recorded) : JSON.parse(JSON.stringify(this.recorded));
    localStorage.setItem(key, JSON.stringify(merged));
    console.log(`[TestMode] 数据已保存到 localStorage (JD ${this.jdIndex})`);
    return true;
  },

  /** 导出录制数据为JSON文件下载 */
  exportJSON() {
    if (!this.recorded) return;
    const blob = new Blob([JSON.stringify(this.recorded, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr_sim_local_data_jd${this.jdIndex}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** 从 localStorage 获取用户保存的本地数据（优先于 LOCAL_DATA） */
  getUserLocalData(jdIndex) {
    const key = `hr_sim_local_data_${jdIndex}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  },

  // ── 内部工具 ──

  /** 合并两份录制数据（数组拼接） */
  _mergeData(a, b) {
    const result = JSON.parse(JSON.stringify(a));

    // 合并 candidates（5档）
    for (const tier of ['great', 'great_mid', 'mid', 'mid_bad', 'bad']) {
      if (b.candidates[tier]) {
        result.candidates[tier] = (result.candidates[tier] || []).concat(b.candidates[tier]);
      }
    }

    // 合并 interviewQuestions（3档）
    for (const tier of ['great', 'mid', 'bad']) {
      if (b.interviewQuestions[tier]) {
        result.interviewQuestions[tier] = (result.interviewQuestions[tier] || []).concat(b.interviewQuestions[tier]);
      }
    }

    // 合并 interviewAnswers（3档×3质量）
    for (const tier of ['great', 'mid', 'bad']) {
      for (const q of ['good', 'mid', 'bad']) {
        if (b.interviewAnswers[tier] && b.interviewAnswers[tier][q]) {
          if (!result.interviewAnswers[tier]) result.interviewAnswers[tier] = {};
          result.interviewAnswers[tier][q] = (result.interviewAnswers[tier][q] || []).concat(b.interviewAnswers[tier][q]);
        }
      }
    }

    // 合并 counterQuestions（3档）
    for (const tier of ['great', 'mid', 'bad']) {
      if (b.counterQuestions[tier]) {
        result.counterQuestions[tier] = (result.counterQuestions[tier] || []).concat(b.counterQuestions[tier]);
      }
    }

    // 合并 negotiations（3档）
    for (const tier of ['great', 'mid', 'bad']) {
      if (b.negotiations[tier]) {
        result.negotiations[tier] = (result.negotiations[tier] || []).concat(b.negotiations[tier]);
      }
    }

    // 合并 hrdLetters（7场景）
    for (const key of Object.keys(b.hrdLetters || {})) {
      if (b.hrdLetters[key]) {
        result.hrdLetters[key] = (result.hrdLetters[key] || []).concat(b.hrdLetters[key]);
      }
    }

    // 合并 weeklyReports
    if (b.weeklyReports) {
      result.weeklyReports = (result.weeklyReports || []).concat(b.weeklyReports);
    }

    return result;
  },

  /** 通知UI更新 */
  _updateUI() {
    if (typeof TestModeUI !== 'undefined' && TestModeUI.updateCompleteness) {
      TestModeUI.updateCompleteness();
    }
  },
};
