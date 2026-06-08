/**
 * 结果计算 — 新评分体系 v2
 *
 * 总分 = 简历筛选(20) + 面试反馈(50) + 谈薪(30) = 满分100
 *
 * 详见 SCORING_RULES.md
 */
function calculateResult() {
  const passedCount = GameState.passed.length;
  const allCount = GameState.candidates.length;

  // ── 1. 简历筛选分（0-20）──
  let resumeBase = 15;
  GameState.candidates.forEach(c => {
    const isPassed = GameState.passed.includes(c);
    if (isPassed) {
      if (c.quality >= 7) resumeBase += 5;
      else if (c.quality <= 3) resumeBase -= 3;
    } else {
      if (c.quality <= 3) resumeBase += 3;
      else if (c.quality >= 7) resumeBase -= 3;
    }
  });
  const resumeScore = Math.max(0, Math.min(20, resumeBase));

  // ── 2. 面试反馈分（0-50，取候选人平均）──
  let feedbackTotal = 0;
  let feedbackCount = 0;

  GameState.passed.forEach(c => {
    const fb = GameState.feedbackScores[c.id];
    if (fb) {
      feedbackTotal += fb.score;
      feedbackCount++;
    }
  });

  const feedbackAvgRaw = feedbackCount > 0 ? feedbackTotal / feedbackCount : 0;
  const feedbackScore = Math.max(0, Math.min(50, Math.round(feedbackAvgRaw)));

  // ── 3. 谈薪分（0-30，取进入谈薪的候选人平均）──
  let negoTotal = 0;
  let negoCount = 0;

  GameState.passed.forEach(c => {
    const fb = GameState.feedbackScores[c.id];
    const nego = GameState.negotiationResults[c.id];
    if (!nego) return; // 未进入谈薪

    negoCount++;
    let candidateNegoScore = 0;

    // 3a. Offer接受（10分）
    let offerPts = 5;
    if (nego.accepted) {
      if (c.quality >= 7) offerPts += 5;
      else if (c.quality >= 4) offerPts += 3;
    } else {
      if (c.quality >= 7) offerPts -= 2;
    }
    offerPts = Math.max(0, Math.min(10, offerPts));
    candidateNegoScore += offerPts;

    // 3b. 谈判技巧（15分）— 从negotiationResult.bargainChoices（需要记录）
    // 如果没有记录每轮选择，从willingness间接估算
    let bargainPts = 0;
    if (nego.bargainScores && nego.bargainScores.length > 0) {
      // 精确模式：使用记录的每轮得分
      bargainPts = nego.bargainScores.reduce((s, v) => s + v, 0);
    } else {
      // 估算模式：基于最终意愿度
      const w = nego.willingness || 0;
      if (w >= 80) bargainPts = 13;
      else if (w >= 60) bargainPts = 10;
      else if (w >= 40) bargainPts = 7;
      else if (w >= 20) bargainPts = 4;
      else bargainPts = 2;
    }
    bargainPts = Math.max(0, Math.min(15, bargainPts));
    candidateNegoScore += bargainPts;

    // 3c. 定薪策略（基础3分 + 压价奖励5分，上限10分）
    let salaryPts = 3;
    if (nego.finalSalaryValue !== undefined) {
      const salary = parseSalary(c.salary);
      if (nego.finalSalaryValue < salary.min - 0.01) {
        salaryPts += 5;
      }
    }
    salaryPts = Math.max(0, Math.min(10, salaryPts));
    candidateNegoScore += salaryPts;

    candidateNegoScore = Math.max(0, Math.min(30, candidateNegoScore));
    negoTotal += candidateNegoScore;
  });

  const negoScore = negoCount > 0 ? Math.max(0, Math.min(30, Math.round(negoTotal / negoCount))) : 0;

  // ── 4. 最终得分 ──
  const total = Math.max(0, Math.min(100, resumeScore + feedbackScore + negoScore));

  // ── 5. 称号 ──
  const title = getTitle(total);

  GameState.totalScore = total;
  GameState.grade = title;

  // 保存中间值供结果页展示
  GameState._resumeScore = resumeScore;
  GameState._feedbackScore = feedbackScore;
  GameState._feedbackAvgRaw = Math.round(feedbackAvgRaw);
  GameState._negoScore = negoScore;
}
