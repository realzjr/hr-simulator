/**
 * 生成QR码 data URL（使用 qrcode-generator 库）
 */
function _generateQRDataUrl(text, cellSize) {
  if (typeof qrcode !== 'function') return '';
  try {
    const qr = qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(cellSize || 3, 0);
  } catch (e) {
    console.warn('[QR] 生成失败:', e);
    return '';
  }
}

/**
 * 结果页渲染 — 称号体系 + 候选人反馈摘要
 */
function renderResult() {
  const container = document.getElementById('scene-result');

  // 强制毕业特殊结算
  if (GameState.forcedGameOver) {
    renderForcedGameOver(container);
    return;
  }

  const { totalScore, grade, passed, candidates } = GameState;
  const evalText = EVALUATIONS[grade] || '感谢参与！';

  // 称号对应的样式class
  const titleColorMap = {
    '首席人才官': 'title-legendary',
    '资深HR总监': 'title-expert',
    '高级HR经理': 'title-senior',
    'HR专员': 'title-normal',
    '实习HR': 'title-junior',
    '前台临时工': 'title-intern',
  };
  const titleClass = titleColorMap[grade] || 'title-normal';

  // 候选人反馈摘要
  let candidateCardsHTML = '';
  if (passed.length > 0) {
    candidateCardsHTML = `
      <div class="card result-candidates">
        <h3>📋 面试反馈摘要</h3>
        ${passed.map(c => {
          const fb = GameState.feedbackScores[c.id];
          const qualityLabel = c.quality >= 7 ? 'A级' : c.quality >= 4 ? 'B级' : 'C级';
          const qualityClass = c.quality >= 7 ? 'quality-good' : c.quality >= 4 ? 'quality-mid' : 'quality-bad';

          if (!fb) {
            return `
              <div class="result-candidate-card">
                <div class="rcc-header">
                  <img src="${c.avatar}" alt="">
                  <span class="rcc-name">${c.name}</span>
                  <span class="result-hired-quality ${qualityClass}">${qualityLabel}（${c.quality}/10）</span>
                </div>
                <div class="rcc-detail">（未完成面试反馈）</div>
              </div>
            `;
          }

          // 确定Offer状态文案和样式
          let offerStatusText, offerStatusClass;
          if (fb.interviewFailed) {
            offerStatusText = '✗ 面试不通过';
            offerStatusClass = 'offer-no';
          } else if (fb.hrdWarning) {
            offerStatusText = '⚠ HRD警告（风险候选人）';
            offerStatusClass = 'offer-warning';
          } else if (fb.offerRejected) {
            offerStatusText = '✗ Offer被拒绝';
            offerStatusClass = 'offer-rejected';
          } else if (fb.offerGiven) {
            offerStatusText = '✓ Offer已接受';
            offerStatusClass = 'offer-yes';
          } else {
            offerStatusText = '✗ 未发Offer';
            offerStatusClass = 'offer-no';
          }

          return `
            <div class="result-candidate-card">
              <div class="rcc-header">
                <img src="${c.avatar}" alt="">
                <span class="rcc-name">${c.name}</span>
                <span class="result-hired-quality ${qualityClass}">${qualityLabel}</span>
              </div>
              <div class="rcc-ratings">
                <span>适配 ${starDisplay(fb.fit)}</span>
                <span>潜力 ${starDisplay(fb.potential)}</span>
                <span>性价比 ${starDisplay(fb.value)}</span>
              </div>
              <div class="rcc-offer ${offerStatusClass}">
                ${offerStatusText}
              </div>
              <div class="rcc-score">得分：${fb.score}/50</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 被淘汰的候选人
  const rejected = candidates.filter(c => !passed.includes(c));
  let rejectedHTML = '';
  if (rejected.length > 0) {
    rejectedHTML = `
      <div class="card result-missed">
        <h3>🗂️ 简历筛选淘汰</h3>
        ${rejected.map(c => {
          const qualityLabel = c.quality >= 7 ? 'A级' : c.quality >= 4 ? 'B级' : 'C级';
          const qualityClass = c.quality >= 7 ? 'quality-good' : c.quality >= 4 ? 'quality-mid' : 'quality-bad';
          const icon = c.quality >= 7 ? '😢' : c.quality <= 3 ? '👍' : '';
          return `
            <div class="result-missed-item">
              <img src="${c.avatar}" alt="">
              <span>${c.name} ${icon}</span>
              <span class="result-hired-quality ${qualityClass}">${qualityLabel}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="result-title">📊 招聘报告</div>
    <div class="result-title-badge ${titleClass}">${grade}</div>
    <div class="result-eval">${evalText}</div>
    <div class="card result-stats">
      <div>
        <div class="result-stat-num">${candidates.length}</div>
        <div class="result-stat-label">📄 简历总数</div>
      </div>
      <div>
        <div class="result-stat-num">${passed.length}</div>
        <div class="result-stat-label">🎤 面试人数</div>
      </div>
      <div>
        <div class="result-stat-num">${totalScore}</div>
        <div class="result-stat-label">🏅 最终得分</div>
      </div>
    </div>
    <div class="card result-score-breakdown">
      <h3>📊 得分构成</h3>
      <div class="score-bar-row">
        <span class="score-bar-label">📄 简历筛选</span>
        <div class="score-bar"><div class="score-bar-fill" style="width:${(GameState._resumeScore || 0) / 20 * 100}%"></div></div>
        <span class="score-bar-num">${GameState._resumeScore || 0}/20</span>
      </div>
      <div class="score-bar-row">
        <span class="score-bar-label">🎤 面试评价</span>
        <div class="score-bar"><div class="score-bar-fill" style="width:${(GameState._feedbackScore || 0) / 50 * 100}%"></div></div>
        <span class="score-bar-num">${GameState._feedbackScore || 0}/50</span>
      </div>
      <div class="score-bar-row">
        <span class="score-bar-label">💰 薪资谈判</span>
        <div class="score-bar"><div class="score-bar-fill" style="width:${(GameState._negoScore || 0) / 30 * 100}%"></div></div>
        <span class="score-bar-num">${GameState._negoScore || 0}/30</span>
      </div>
    </div>
    ${GameState.weeklyReport ? `
    <button class="btn btn-outline result-weekly-report-btn" id="btn-view-weekly-report">📊 回看绩效周报</button>
    <div class="log-viewer-overlay" id="weekly-report-overlay">
      <div class="log-viewer">
        <div class="log-viewer-header">
          <span>📊 绩效周报</span>
          <button class="log-viewer-close" id="weekly-report-close">✕</button>
        </div>
        <div class="log-viewer-body" style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.8;">${GameState.weeklyReport}</div>
      </div>
    </div>
    ` : ''}
    ${candidateCardsHTML}
    ${rejectedHTML}
    <div class="card result-scoring-rules">
      <h3>💡 得分小贴士</h3>
      <ul>
        <li>筛简历时擦亮眼睛，别放走大鱼也别捞起烂虾</li>
        <li>面试评分越贴近候选人真实水平，HRD越满意</li>
        <li>候选人的提问别敷衍，用心回答有加分</li>
        <li>谈薪时了解对方在意什么，比一味压价更有效</li>
      </ul>
    </div>
    <button class="btn btn-outline result-share-btn" id="btn-share-card">📤 生成分享卡片</button>
    <button class="btn btn-primary result-restart-btn" id="btn-restart">🔄 再来一轮</button>

    <div class="result-feedback-section">
      <button class="result-feedback-btn" id="btn-bug-feedback">🐛 有bug？点击反馈</button>
    </div>

    <div class="share-card-overlay" id="share-card-overlay">
      <div class="share-card-modal">
        <div class="share-card-header">
          <span>📤 分享卡片</span>
          <button class="log-viewer-close" id="share-card-close">✕</button>
        </div>
        <div class="share-card-body">
          <div class="share-card" id="share-card-content">
            <div class="share-card-deco share-card-deco-tl">💼</div>
            <div class="share-card-deco share-card-deco-tr">📋</div>
            <div class="share-card-deco share-card-deco-bl">🎯</div>
            <div class="share-card-deco share-card-deco-br">🏆</div>
            <div class="share-card-top">
              <div class="share-card-title">🧑‍💼 HR模拟器</div>
              <div class="share-card-subtitle">— 我的招聘成绩单 —</div>
            </div>
            <div class="share-card-divider"></div>
            <div class="share-card-badge ${titleClass}">${grade}</div>
            <div class="share-card-score">${totalScore}<span class="share-card-score-unit"> 分</span></div>
            <div class="share-card-stats-row">
              <div class="share-card-stat">
                <div class="share-card-stat-num">📄 ${candidates.length}</div>
                <div class="share-card-stat-label">简历总数</div>
              </div>
              <div class="share-card-stat-divider"></div>
              <div class="share-card-stat">
                <div class="share-card-stat-num">🎤 ${passed.length}</div>
                <div class="share-card-stat-label">面试人数</div>
              </div>
              <div class="share-card-stat-divider"></div>
              <div class="share-card-stat">
                <div class="share-card-stat-num">🏅 ${totalScore}</div>
                <div class="share-card-stat-label">最终得分</div>
              </div>
            </div>
            <div class="share-card-qr-section">
              <img class="share-card-qr" id="share-card-qr-1" alt="QR">
              <div class="share-card-qr-hint">扫码来挑战</div>
            </div>
            <div class="share-card-footer">✨ 来试试你能拿什么称号？✨</div>
          </div>
        </div>
        <div class="share-card-actions">
          <button class="btn btn-primary" id="btn-save-card">📥 保存卡片</button>
        </div>
      </div>
    </div>

    <div class="log-viewer-overlay" id="log-viewer-overlay">
      <div class="log-viewer">
        <div class="log-viewer-header">
          <span>📋 完整游戏日志</span>
          <button class="log-viewer-close" id="log-viewer-close">✕</button>
        </div>
        <div class="log-viewer-actions">
          <button class="btn btn-outline log-copy-btn" id="btn-copy-log">📋 复制日志</button>
        </div>
        <pre class="log-viewer-body" id="log-viewer-body"></pre>
      </div>
    </div>
  `;

  document.getElementById('btn-restart').addEventListener('click', () => {
    GameState.reset();
    switchScene('menu');
    renderMenu();
  });

  // 绩效周报弹窗
  const weeklyBtn = document.getElementById('btn-view-weekly-report');
  if (weeklyBtn) {
    weeklyBtn.addEventListener('click', () => {
      document.getElementById('weekly-report-overlay').classList.add('visible');
    });
    document.getElementById('weekly-report-close').addEventListener('click', () => {
      document.getElementById('weekly-report-overlay').classList.remove('visible');
    });
    document.getElementById('weekly-report-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
    });
  }

  // 分享卡片按钮
  document.getElementById('btn-share-card').addEventListener('click', () => {
    // 生成QR码
    const qrImg = document.getElementById('share-card-qr-1');
    if (qrImg && !qrImg.src) {
      const url = _generateQRDataUrl(window.location.href.split('?')[0], 3);
      if (url) { qrImg.src = url; }
      else { const sec = qrImg.closest('.share-card-qr-section'); if (sec) sec.style.display = 'none'; }
    }
    document.getElementById('share-card-overlay').classList.add('visible');
  });
  document.getElementById('share-card-close').addEventListener('click', () => {
    document.getElementById('share-card-overlay').classList.remove('visible');
  });
  document.getElementById('share-card-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
  });
  document.getElementById('btn-save-card').addEventListener('click', () => {
    const card = document.getElementById('share-card-content');
    if (window.html2canvas) {
      html2canvas(card, { scale: 2, backgroundColor: null }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'HR模拟器-成绩单.png';
        link.href = canvas.toDataURL();
        link.click();
      }).catch(() => {
        alert('卡片生成失败，请直接截图保存~');
      });
    } else {
      alert('请截图保存此卡片进行分享~');
    }
  });

  // Bug反馈按钮 → 打开日志查看器
  document.getElementById('btn-bug-feedback').addEventListener('click', () => {
    const overlay = document.getElementById('log-viewer-overlay');
    const body = document.getElementById('log-viewer-body');

    // 汇总日志
    let logText = '=== HR模拟器 游戏日志 ===\n';
    logText += `时间: ${new Date().toLocaleString()}\n`;
    logText += `最终得分: ${GameState.totalScore} / 称号: ${GameState.grade}\n`;
    logText += `候选人数: ${GameState.candidates.length} / 面试: ${GameState.passed.length}\n`;
    logText += `\n--- 候选人信息 ---\n`;
    GameState.candidates.forEach(c => {
      const fb = GameState.feedbackScores[c.id];
      const passed = GameState.passed.includes(c);
      logText += `${c.name} (quality:${c.quality}) ${passed ? '通过' : '淘汰'}`;
      if (fb) {
        const status = fb.interviewFailed ? '面试不通过' : fb.hrdWarning ? 'HRD警告' : fb.offerRejected ? 'Offer被拒' : fb.offerGiven ? 'Offer接受' : '未发Offer';
        logText += ` 适配:${fb.fit} 潜力:${fb.potential} 性价比:${fb.value} 状态:${status} 得分:${fb.score}`;
      }
      logText += '\n';
    });
    logText += `\n--- API调用日志 ---\n`;
    logText += GameLog.getText() || '（无日志）';

    body.textContent = logText;
    overlay.classList.add('visible');
  });

  document.getElementById('log-viewer-close').addEventListener('click', () => {
    document.getElementById('log-viewer-overlay').classList.remove('visible');
  });

  document.getElementById('log-viewer-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
  });

  document.getElementById('btn-copy-log').addEventListener('click', () => {
    const text = document.getElementById('log-viewer-body').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-log');
      btn.textContent = '✅ 已复制';
      setTimeout(() => btn.textContent = '📋 复制日志', 2000);
    });
  });

}

/**
 * 强制毕业结算页
 * 4种场景：no_resume / all_failed / scolding / mistakes
 */
function renderForcedGameOver(container) {
  const interviewedCount = GameState.currentInterviewIndex + 1;
  const reason = GameState.forcedGameOverReason || 'scolding';
  const { totalScore } = GameState;

  // 4种场景配置：大字称号 + 小字"提前毕业" + 说明文案 + 统计
  const scenarioMap = {
    no_resume: {
      title: '简历碎纸机',
      evalText: `所有简历都被你筛掉了，一个面试机会都没给出去。<br>
        你确定你是来招人的，不是来当碎纸机的？<br><br>
        共收到 ${GameState.candidates.length} 份简历，通过数：0。<br>
        也许下次可以放宽一下标准，给候选人一个展示的机会。`,
      thirdStatNum: GameState.candidates.length,
      thirdStatLabel: '📄 全部淘汰',
    },
    all_failed: {
      title: '人才绝缘体',
      evalText: `面试了所有候选人，但没有一位最终拿到Offer进入谈薪环节。<br>
        是标准太高，还是眼光太毒？总之，一个人都没招到。<br><br>
        面试了 ${interviewedCount} 位候选人，进入谈薪数：0。<br>
        记住：招聘的目标是招到合适的人，而不是淘汰所有人。`,
      thirdStatNum: interviewedCount,
      thirdStatLabel: '🎤 全军覆没',
    },
    scolding: {
      title: '风评避雷针',
      evalText: `因为在候选人提问环节连续表现不佳，HRD对你的能力产生了严重质疑。<br>
        你已被提前"毕业"，结束了这段短暂的HR生涯。<br><br>
        面试了 ${interviewedCount} 位候选人后，你的HR旅程被迫终止。<br>
        也许下次可以更用心地对待每一位候选人的提问。`,
      thirdStatNum: GameState.scoldingCount,
      thirdStatLabel: '📞 被质问',
    },
    offer_rejected: {
      title: '预算铁公鸡',
      evalText: `连续在谈薪环节把候选人谈崩了，Offer一发一个拒。<br>
        HRD怀疑你是不是对手公司派来的卧底，决定提前结束你的面试官资格。<br><br>
        面试了 ${interviewedCount} 位候选人后，你的HR旅程被迫终止。<br>
        记住：谈薪是一门艺术，不是讨价还价的菜市场。`,
      thirdStatNum: GameState.offerRejectCount,
      thirdStatLabel: '💸 Offer被拒',
    },
    talent_lost: {
      title: '面试终结者',
      evalText: `连续把优质候选人判定不通过，让人才从眼前白白溜走。<br>
        HRD认为你还需要更多历练，决定提前结束你的面试官资格。<br><br>
        面试了 ${interviewedCount} 位候选人后，你的HR旅程被迫终止。<br>
        记住：识人善用是HR的核心能力，好苗子可遇不可求。`,
      thirdStatNum: GameState.talentLostCount,
      thirdStatLabel: '💔 人才流失',
    },
    hrd_warning: {
      title: '底线橡皮筋',
      evalText: `连续把明显不合格的候选人往上推，每次都要HRD亲自出面拦截。<br>
        HRD怀疑你的判断力是否还在线，决定提前结束你的面试官资格。<br><br>
        面试了 ${interviewedCount} 位候选人后，你的HR旅程被迫终止。<br>
        记住：通过不合格的人，对团队和候选人都是不负责任的。`,
      thirdStatNum: GameState.hrdWarningCount,
      thirdStatLabel: '🙊 被HRD拦截',
    },
  };

  const scenario = scenarioMap[reason] || scenarioMap.scolding;
  const { title: forceTitle, evalText, thirdStatNum, thirdStatLabel } = scenario;

  // 构建候选人数据展示
  const { passed, candidates } = GameState;
  const rejected = candidates.filter(c => !passed.includes(c));

  // 已面试的候选人（有feedbackScores记录）
  const interviewedCandidates = passed.slice(0, interviewedCount);
  // 未处理的候选人（通过了简历筛选但未来得及面试）
  const unprocessedCandidates = passed.slice(interviewedCount);

  let interviewedHTML = '';
  if (interviewedCandidates.length > 0) {
    interviewedHTML = `
      <div class="card result-candidates">
        <h3>📋 已面试候选人</h3>
        ${interviewedCandidates.map(c => {
          const fb = GameState.feedbackScores[c.id];
          const qualityLabel = c.quality >= 7 ? 'A级' : c.quality >= 4 ? 'B级' : 'C级';
          const qualityClass = c.quality >= 7 ? 'quality-good' : c.quality >= 4 ? 'quality-mid' : 'quality-bad';

          if (!fb) {
            return `
              <div class="result-candidate-card">
                <div class="rcc-header">
                  <img src="${c.avatar}" alt="">
                  <span class="rcc-name">${c.name}</span>
                  <span class="result-hired-quality ${qualityClass}">${qualityLabel}</span>
                </div>
                <div class="rcc-detail">（未完成面试反馈）</div>
              </div>
            `;
          }

          let offerStatusText, offerStatusClass;
          if (fb.interviewFailed) {
            offerStatusText = '✗ 面试不通过';
            offerStatusClass = 'offer-no';
          } else if (fb.hrdWarning) {
            offerStatusText = '⚠ HRD警告（风险候选人）';
            offerStatusClass = 'offer-warning';
          } else if (fb.offerRejected) {
            offerStatusText = '✗ Offer被拒绝';
            offerStatusClass = 'offer-rejected';
          } else if (fb.offerGiven) {
            offerStatusText = '✓ Offer已接受';
            offerStatusClass = 'offer-yes';
          } else {
            offerStatusText = '✗ 未发Offer';
            offerStatusClass = 'offer-no';
          }

          return `
            <div class="result-candidate-card">
              <div class="rcc-header">
                <img src="${c.avatar}" alt="">
                <span class="rcc-name">${c.name}</span>
                <span class="result-hired-quality ${qualityClass}">${qualityLabel}</span>
              </div>
              <div class="rcc-ratings">
                <span>适配 ${starDisplay(fb.fit)}</span>
                <span>潜力 ${starDisplay(fb.potential)}</span>
                <span>性价比 ${starDisplay(fb.value)}</span>
              </div>
              <div class="rcc-offer ${offerStatusClass}">
                ${offerStatusText}
              </div>
              ${fb.score ? `<div class="rcc-score">得分：${fb.score}/50</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  let unprocessedHTML = '';
  if (unprocessedCandidates.length > 0) {
    unprocessedHTML = `
      <div class="card result-missed">
        <h3>⏸️ 未处理候选人</h3>
        ${unprocessedCandidates.map(c => {
          const qualityLabel = c.quality >= 7 ? 'A级' : c.quality >= 4 ? 'B级' : 'C级';
          const qualityClass = c.quality >= 7 ? 'quality-good' : c.quality >= 4 ? 'quality-mid' : 'quality-bad';
          return `
            <div class="result-missed-item">
              <img src="${c.avatar}" alt="">
              <span>${c.name}（已通过简历筛选）</span>
              <span class="result-hired-quality ${qualityClass}">${qualityLabel}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  let rejectedHTML = '';
  if (rejected.length > 0) {
    rejectedHTML = `
      <div class="card result-missed">
        <h3>🗂️ 简历筛选淘汰</h3>
        ${rejected.map(c => {
          const qualityLabel = c.quality >= 7 ? 'A级' : c.quality >= 4 ? 'B级' : 'C级';
          const qualityClass = c.quality >= 7 ? 'quality-good' : c.quality >= 4 ? 'quality-mid' : 'quality-bad';
          const icon = c.quality >= 7 ? '😢' : c.quality <= 3 ? '👍' : '';
          return `
            <div class="result-missed-item">
              <img src="${c.avatar}" alt="">
              <span>${c.name} ${icon}</span>
              <span class="result-hired-quality ${qualityClass}">${qualityLabel}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="result-title">💼 招聘报告</div>
    <div class="result-title-badge title-graduated">${forceTitle}</div>
    <div class="result-eval">${evalText}</div>
    <div class="card result-stats">
      <div>
        <div class="result-stat-num">${GameState.candidates.length}</div>
        <div class="result-stat-label">📄 简历总数</div>
      </div>
      <div>
        <div class="result-stat-num">${reason === 'no_resume' ? 0 : interviewedCount}</div>
        <div class="result-stat-label">🎤 ${reason === 'no_resume' ? '面试人数' : '已面试'}</div>
      </div>
      <div>
        <div class="result-stat-num result-stat-graduated">提前毕业</div>
        <div class="result-stat-label">${thirdStatLabel} ×${thirdStatNum}</div>
      </div>
    </div>
    ${(GameState._resumeScore !== undefined || GameState._feedbackScore !== undefined || GameState._negoScore !== undefined) ? `
    <div class="card result-score-breakdown">
      <h3>📊 得分构成</h3>
      <div class="score-bar-row">
        <span class="score-bar-label">📄 简历筛选</span>
        <div class="score-bar"><div class="score-bar-fill" style="width:${(GameState._resumeScore || 0) / 20 * 100}%"></div></div>
        <span class="score-bar-num">${GameState._resumeScore || 0}/20</span>
      </div>
      <div class="score-bar-row">
        <span class="score-bar-label">🎤 面试评价</span>
        <div class="score-bar"><div class="score-bar-fill" style="width:${(GameState._feedbackScore || 0) / 50 * 100}%"></div></div>
        <span class="score-bar-num">${GameState._feedbackScore || 0}/50</span>
      </div>
      <div class="score-bar-row">
        <span class="score-bar-label">💰 薪资谈判</span>
        <div class="score-bar"><div class="score-bar-fill" style="width:${(GameState._negoScore || 0) / 30 * 100}%"></div></div>
        <span class="score-bar-num">${GameState._negoScore || 0}/30</span>
      </div>
    </div>
    ` : ''}
    ${interviewedHTML}
    ${unprocessedHTML}
    ${rejectedHTML}
    <button class="btn btn-outline result-share-btn" id="btn-share-card">📤 生成分享卡片</button>
    <button class="btn btn-primary result-restart-btn" id="btn-restart">🔄 重生一次，我定要做个好HR</button>

    <div class="result-feedback-section">
      <button class="result-feedback-btn" id="btn-bug-feedback">🐛 有bug？点击反馈</button>
    </div>

    <div class="share-card-overlay" id="share-card-overlay">
      <div class="share-card-modal">
        <div class="share-card-header">
          <span>📤 分享卡片</span>
          <button class="log-viewer-close" id="share-card-close">✕</button>
        </div>
        <div class="share-card-body">
          <div class="share-card" id="share-card-content">
            <div class="share-card-deco share-card-deco-tl">💼</div>
            <div class="share-card-deco share-card-deco-tr">📋</div>
            <div class="share-card-deco share-card-deco-bl">🎯</div>
            <div class="share-card-deco share-card-deco-br">💔</div>
            <div class="share-card-top">
              <div class="share-card-title">🤦 HR模拟器</div>
              <div class="share-card-subtitle">— 我的招聘成绩单 —</div>
            </div>
            <div class="share-card-divider"></div>
            <div class="share-card-badge title-graduated">${forceTitle}</div>
            <div class="share-card-score share-card-graduated">提前毕业</div>
            <div class="share-card-stats-row">
              <div class="share-card-stat">
                <div class="share-card-stat-num">📄 ${GameState.candidates.length}</div>
                <div class="share-card-stat-label">简历总数</div>
              </div>
              <div class="share-card-stat-divider"></div>
              <div class="share-card-stat">
                <div class="share-card-stat-num">🎤 ${reason === 'no_resume' ? 0 : interviewedCount}</div>
                <div class="share-card-stat-label">${reason === 'no_resume' ? '面试人数' : '已面试'}</div>
              </div>
              <div class="share-card-stat-divider"></div>
              <div class="share-card-stat">
                <div class="share-card-stat-num">${thirdStatNum}</div>
                <div class="share-card-stat-label">${thirdStatLabel}</div>
              </div>
            </div>
            <div class="share-card-qr-section">
              <img class="share-card-qr" id="share-card-qr-2" alt="QR">
              <div class="share-card-qr-hint">扫码来挑战</div>
            </div>
            <div class="share-card-footer">✨ 来试试你能拿什么称号？✨</div>
          </div>
        </div>
        <div class="share-card-actions">
          <button class="btn btn-primary" id="btn-save-card">📥 保存卡片</button>
        </div>
      </div>
    </div>

    <div class="log-viewer-overlay" id="log-viewer-overlay">
      <div class="log-viewer">
        <div class="log-viewer-header">
          <span>📋 完整游戏日志</span>
          <button class="log-viewer-close" id="log-viewer-close">✕</button>
        </div>
        <div class="log-viewer-actions">
          <button class="btn btn-outline log-copy-btn" id="btn-copy-log">📋 复制日志</button>
        </div>
        <pre class="log-viewer-body" id="log-viewer-body"></pre>
      </div>
    </div>
  `;

  document.getElementById('btn-restart').addEventListener('click', () => {
    GameState.reset();
    switchScene('menu');
    renderMenu();
  });

  // 分享卡片
  document.getElementById('btn-share-card').addEventListener('click', () => {
    const qrImg = document.getElementById('share-card-qr-2');
    if (qrImg && !qrImg.src) {
      const url = _generateQRDataUrl(window.location.href.split('?')[0], 3);
      if (url) { qrImg.src = url; }
      else { const sec = qrImg.closest('.share-card-qr-section'); if (sec) sec.style.display = 'none'; }
    }
    document.getElementById('share-card-overlay').classList.add('visible');
  });
  document.getElementById('share-card-close').addEventListener('click', () => {
    document.getElementById('share-card-overlay').classList.remove('visible');
  });
  document.getElementById('share-card-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
  });
  document.getElementById('btn-save-card').addEventListener('click', () => {
    const card = document.getElementById('share-card-content');
    if (window.html2canvas) {
      html2canvas(card, { scale: 2, backgroundColor: null }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'HR模拟器-成绩单.png';
        link.href = canvas.toDataURL();
        link.click();
      }).catch(() => {
        alert('卡片生成失败，请直接截图保存~');
      });
    } else {
      alert('请截图保存此卡片进行分享~');
    }
  });

  // Bug反馈按钮
  document.getElementById('btn-bug-feedback').addEventListener('click', () => {
    const overlay = document.getElementById('log-viewer-overlay');
    const body = document.getElementById('log-viewer-body');

    let logText = '=== HR模拟器 游戏日志（强制毕业）===\n';
    logText += `时间: ${new Date().toLocaleString()}\n`;
    const reasonLabel = { no_resume: '简历全部淘汰', all_failed: '候选人全军覆没', scolding: 'HRD质问', offer_rejected: 'Offer被拒', talent_lost: '人才流失' };
    logText += `毕业原因: ${reasonLabel[reason] || reason}\n`;
    logText += `被质问: ${GameState.scoldingCount} / Offer被拒: ${GameState.offerRejectCount} / 人才流失: ${GameState.talentLostCount} / 被HRD拦截: ${GameState.hrdWarningCount}\n`;
    logText += `候选人数: ${GameState.candidates.length} / 已面试: ${interviewedCount}\n`;
    logText += `\n--- API调用日志 ---\n`;
    logText += GameLog.getText() || '（无日志）';

    body.textContent = logText;
    overlay.classList.add('visible');
  });

  document.getElementById('log-viewer-close').addEventListener('click', () => {
    document.getElementById('log-viewer-overlay').classList.remove('visible');
  });

  document.getElementById('log-viewer-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
  });

  document.getElementById('btn-copy-log').addEventListener('click', () => {
    const text = document.getElementById('log-viewer-body').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-log');
      btn.textContent = '✅ 已复制';
      setTimeout(() => btn.textContent = '📋 复制日志', 2000);
    });
  });

}
