/**
 * HRD评审转场场景
 * 包含：等待动画 → 信纸展开 → 打字机效果 → 回复按钮
 * 复用于绩效周报
 */

/**
 * 当前活跃的打字机定时器（用于中断）
 */
let _activeTypewriterTimer = null;

/**
 * 取消正在运行的打字机效果
 */
function cancelTypewriter() {
  if (_activeTypewriterTimer) {
    clearInterval(_activeTypewriterTimer);
    _activeTypewriterTimer = null;
  }
}

/**
 * 简易 Markdown → HTML 转换（支持 **粗体**、*斜体*、换行）
 */
function simpleMarkdown(text) {
  let html = text;
  // 转义 HTML 特殊字符
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // **粗体**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // *斜体*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return html;
}

/**
 * 打字机效果
 * @param {string} elementId - 目标元素ID
 * @param {string} text - 要显示的文字
 * @param {number} speed - 每字符间隔(ms)
 * @param {Function} onComplete - 完成回调
 */
function typewriterEffect(elementId, text, speed, onComplete) {
  const el = document.getElementById(elementId);
  if (!el) return;

  cancelTypewriter();

  // 预处理：去除打字过程中不需要的 markdown 标记字符，保存原始文本用于最终渲染
  const _rawText = text;
  // 打字时显示纯文本（去掉 ** 等标记）
  const displayText = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');

  el.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  el.appendChild(cursor);

  let _finished = false;
  function finishNow() {
    if (_finished) return;
    _finished = true;
    cancelTypewriter();
    if (cursor.parentNode) cursor.remove();
    el.innerHTML = simpleMarkdown(_rawText);
    if (onComplete) onComplete();
  }

  // 点击信纸可跳过打字机
  const card = el.closest('.hrd-letter-card');
  if (card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function _skip() {
      card.removeEventListener('click', _skip);
      card.style.cursor = '';
      finishNow();
    });
  }

  let i = 0;
  _activeTypewriterTimer = setInterval(() => {
    if (i < displayText.length) {
      const textNode = document.createTextNode(displayText[i]);
      el.insertBefore(textNode, cursor);
      i++;
    } else {
      clearInterval(_activeTypewriterTimer);
      _activeTypewriterTimer = null;
      const finishDelay = setTimeout(() => {
        // 移除点击跳过（自然完成时也清理）
        if (card) card.style.cursor = '';
        finishNow();
      }, 600);
      registerSceneTimer(finishDelay);
    }
  }, speed);
  registerSceneTimer(_activeTypewriterTimer);
}

/**
 * 渲染HRD评审等待状态（独立等候场景）
 */
function renderHrdReviewLoading(text) {
  const container = document.getElementById('scene-hrd-review');
  container.innerHTML = `
    <div class="hrd-review-loading">
      <div class="hrd-loading-animation">
        <div class="hrd-floating-paper"></div>
        <div class="hrd-floating-paper"></div>
        <div class="hrd-floating-paper"></div>
        <div class="hrd-envelope-icon"></div>
        <div class="hrd-pen">🖊️</div>
      </div>
      <div class="hrd-review-loading-text">${text || '📋 HRD正在review你的表现<span class="hrd-loading-dots"></span>'}</div>
    </div>

    <div class="hrd-letter-envelope" id="hrd-envelope">
      <div class="hrd-letter-card" style="position:relative;">
        <div class="hrd-letter-card-header">📩 来自HRD的一封信</div>
        <button class="hrd-compare-toggle" id="hrd-compare-toggle" style="display:none;">📊 评分对比</button>
        <div class="hrd-compare-popover" id="hrd-compare-popover"></div>
        <div class="hrd-letter-typewriter" id="hrd-typewriter"></div>
        <div class="hrd-letter-score" id="hrd-review-score"></div>
      </div>
    </div>

    <div class="hrd-reply-buttons" id="hrd-reply-buttons"></div>
    <div class="hrd-player-reply" id="hrd-player-reply"></div>
    <button class="btn btn-primary hrd-continue-btn" id="hrd-continue-btn">👉 继续</button>
  `;
}

/**
 * 根据得分随机获取回复文案（分3档：40+好/30-40中/30以下差）
 * 返回 { texts: string[], tier: 'good'|'mid'|'bad' }
 */
function getReplyOptions(score) {
  const d = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
  if (score >= 40) {
    return {
      tier: 'good',
      texts: (d && d.hrdReplyGood) || [
        '谢谢HRD的认可，我会再接再厉！💪',
        '感谢肯定！下一位候选人我也全力以赴',
        '收到好评，信心倍增！',
        '多谢鼓励，继续加油 🎉',
      ],
    };
  } else if (score >= 30) {
    return {
      tier: 'mid',
      texts: (d && d.hrdReplyMid) || [
        '收到，我会注意改进',
        '感谢指导，下次更仔细',
        '好的，吸取经验了',
        '了解了，我再注意下',
      ],
    };
  } else {
    return {
      tier: 'bad',
      texts: (d && d.hrdReplyBad) || [
        '抱歉，我下次一定做好 😣',
        '谢谢HRD的提醒，反省中…',
        '我认真反思，下次改进',
        '对不起，辜负了HRD的期望',
      ],
    };
  }
}

/**
 * 渲染HRD来信（信纸展开 + 打字机 + 回复按钮）
 */
/**
 * 将星级数值转为显示字符串（支持0星）
 */
function starDisplay(n) {
  if (n <= 0) {
    return '<span class="star-display">' + '<span class="star-empty">☆</span>'.repeat(5) + '</span>';
  }
  const full = Math.floor(n);
  const hasHalf = (n - full) >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  let html = '<span class="star-display">';
  html += '<span class="star-full">★</span>'.repeat(full);
  if (hasHalf) html += '<span class="star-half-wrap"><span class="star-half-bg">☆</span><span class="star-half-fg">★</span></span>';
  html += '<span class="star-empty">☆</span>'.repeat(Math.max(0, empty));
  html += '</span>';
  return html;
}

/**
 * Emoji弹射动效 — 不同得分档对应不同emoji
 * @param {HTMLElement} btnEl - 按钮元素
 * @param {string} tier - 'good' | 'mid' | 'bad' | 'neutral'
 */
function _burstEmoji(btnEl, tier) {
  const emojiSets = {
    good: ['💪', '💪', '✨', '🔥'],
    mid:  ['📝', '📝', '✏️', '📋'],
    bad:  ['🙇', '🙇', '🙇‍♂️', '🙇‍♀️'],
    neutral: ['👍', '👍', '✨', '💬'],
  };
  const emojis = emojiSets[tier] || emojiSets.neutral;
  const count = 5;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'heart-burst';
    el.textContent = emojis[i % emojis.length];
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 30 + Math.random() * 35;
    el.style.setProperty('--hx', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--hy', `${Math.sin(angle) * dist - 15}px`);
    el.style.setProperty('--hr', `${(Math.random() - 0.5) * 40}deg`);
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.animationDelay = `${i * 0.12}s`;
    btnEl.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

/** 兼容旧调用 */
function _burstHearts(btnEl) { _burstEmoji(btnEl, 'neutral'); }

/**
 * 集中检测所有提前毕业条件
 * 返回 reason 字符串（命中）或 null（未命中）
 */
function checkForcedGameOver() {
  if (GameState.scoldingCount >= 2) return 'scolding';
  if (GameState.offerRejectCount >= 2) return 'offer_rejected';
  if (GameState.talentLostCount >= 2) return 'talent_lost';
  if (GameState.hrdWarningCount >= 2) return 'hrd_warning';
  return null;
}

function renderHrdLetter(text, score, candidate) {
  // 隐藏loading
  const loadingEl = document.querySelector('.hrd-review-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  // 展开信纸
  const envelope = document.getElementById('hrd-envelope');
  if (envelope) {
    registerSceneTimer(setTimeout(() => envelope.classList.add('open'), 100));
  }

  // 打字机效果（15ms/字，加快一倍）
  registerSceneTimer(setTimeout(() => {
    typewriterEffect('hrd-typewriter', text, 15, () => {
      // 显示得分
      const scoreEl = document.getElementById('hrd-review-score');
      if (scoreEl) {
        scoreEl.textContent = `本轮面试得分：${score} / 50`;
        scoreEl.classList.add('visible');
      }

      // 显示评分对比按钮（在信件右上角）
      const fb = GameState.feedbackScores[candidate.id];
      if (fb && candidate) {
        const ideal = candidate.idealStars || { fit: 3, potential: 3, value: 3 };
        const toggleBtn = document.getElementById('hrd-compare-toggle');
        const popover = document.getElementById('hrd-compare-popover');
        if (toggleBtn && popover) {
          function compareRow(label, playerStar, idealStar) {
            const diff = Math.abs(playerStar - idealStar);
            const cls = diff === 0 ? 'match' : diff <= 1 ? 'close' : 'off';
            const txt = diff === 0 ? '精准' : playerStar > idealStar ? '偏高' : '偏低';
            return `
              <div class="rating-compare-row">
                <span class="rating-compare-label">${label}</span>
                <span class="rating-compare-diff ${cls}">${txt}</span>
                <div class="rating-compare-stars-line">
                  <span class="rating-compare-stars">你 ${starDisplay(playerStar)}</span>
                  <span class="rating-compare-stars actual">实际 ${starDisplay(idealStar)}</span>
                </div>
              </div>`;
          }
          popover.innerHTML = `
            <div class="rating-compare-title">📊 评分对比</div>
            ${compareRow('适配程度', fb.fit, ideal.fit)}
            ${compareRow('发展潜力', fb.potential, ideal.potential)}
            ${compareRow('性价比', fb.value, ideal.value)}
          `;
          toggleBtn.style.display = '';
          toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popover.classList.toggle('visible');
          });
          // 点击其他地方关闭（绑定在 envelope 容器上，随 innerHTML 替换自动销毁）
          envelope.addEventListener('click', (e) => {
            if (!e.target.closest('#hrd-compare-toggle')) {
              popover.classList.remove('visible');
            }
          });
        }
      }

      // 显示回复按钮（依据得分分档，展示2个选项）
      const replyContainer = document.getElementById('hrd-reply-buttons');
      const replyOpts = getReplyOptions(score);
      const shuffled = replyOpts.texts.sort(() => Math.random() - 0.5);
      const replyTier = replyOpts.tier;
      const replyChoices = shuffled.slice(0, 2);
      replyContainer.innerHTML = replyChoices.map(t =>
        `<button class="hrd-reply-btn" data-reply="${t}" data-tier="${replyTier}">${t}</button>`
      ).join('');
      replyContainer.classList.add('visible');

      // 绑定回复按钮事件
      replyContainer.querySelectorAll('.hrd-reply-btn').forEach(btn => btn.addEventListener('click', function() {
        // emoji弹射动效（按分档匹配）
        _burstEmoji(this, this.dataset.tier || 'neutral');
        this.classList.add('selected');

        // 显示玩家回复气泡
        const replyBubble = document.getElementById('hrd-player-reply');
        replyBubble.textContent = this.dataset.reply;
        replyBubble.classList.add('visible');

        // 隐藏回复按钮，显示继续按钮（等emoji动画播完）
        registerSceneTimer(setTimeout(() => {
          replyContainer.classList.remove('visible');
          const continueBtn = document.getElementById('hrd-continue-btn');
          continueBtn.classList.add('visible');

          const idx = GameState.currentInterviewIndex;
          const total = GameState.passed.length;
          const isLast = (idx + 1 >= total);

          continueBtn.textContent = isLast ? '📊 继续' : '👉 下一位候选人 →';

          continueBtn.onclick = () => {
            continueBtn.disabled = true;

            // 集中检测所有提前毕业条件
            const forceReason = checkForcedGameOver();
            if (forceReason) {
              GameState.forcedGameOver = true;
              GameState.forcedGameOverReason = forceReason;
              calculateResult();
              switchScene('result');
              renderResult();
              return;
            }

            if (isLast) {
              // 检查是否所有候选人都未通过面试（无人进入谈薪）
              if (Object.keys(GameState.negotiationResults).length === 0) {
                GameState.forcedGameOver = true;
                GameState.forcedGameOverReason = 'all_failed';
                calculateResult();
                switchScene('result');
                renderResult();
                return;
              }
              renderWeeklyReportFlow();
            } else {
              GameState.currentInterviewIndex++;
              switchScene('interview');
              renderInterview();
            }
          };
        }, 1200));
      }));
    });
  }, 500)); // 等信纸展开（0.4s transition → 0.5s delay）
}

/**
 * 绩效周报流程
 */
async function renderWeeklyReportFlow() {
  const container = document.getElementById('scene-hrd-review');
  container.innerHTML = `
    <div class="hrd-review-loading">
      <div class="hrd-loading-animation">
        <div class="hrd-floating-paper"></div>
        <div class="hrd-floating-paper"></div>
        <div class="hrd-floating-paper"></div>
        <div class="hrd-envelope-icon"></div>
        <div class="hrd-pen">🖊️</div>
      </div>
      <div class="hrd-review-loading-text">📊 HRD正在撰写绩效周报<span class="hrd-loading-dots"></span></div>
    </div>

    <div class="hrd-letter-envelope" id="hrd-envelope">
      <div class="hrd-letter-card">
        <div class="hrd-letter-card-header">📊 绩效周报</div>
        <div class="hrd-letter-typewriter" id="hrd-typewriter"></div>
      </div>
    </div>

    <div class="hrd-reply-buttons" id="hrd-reply-buttons"></div>
    <div class="hrd-player-reply" id="hrd-player-reply"></div>
    <button class="btn btn-primary hrd-continue-btn" id="hrd-continue-btn">📊 查看最终结果 →</button>
  `;

  // 优先使用预加载的周报（最后一位HRD信时已并行启动）
  let report = '';

  // 本地模式：从本地模板生成周报
  if (GameState.mode === 'local' && GameState.currentJDIndex >= 0) {
    report = getLocalWeeklyReport();
  } else {
    try {
      if (GameState._weeklyReportPromise) {
        report = await GameState._weeklyReportPromise;
        GameState._weeklyReportPromise = null;
      } else {
        const prompt = PROMPTS.generateWeeklyReport(
          GameState.currentJD,
          GameState.candidates,
          GameState.feedbackScores,
          GameState.passed
        );
        report = await DeepSeekAPI.chat(prompt, { model: 'deepseek-reasoner' });
      }
    } catch (e) {
      console.error('[绩效周报] AI生成失败:', e);
    }
  }

  if (!report) {
    report = generateFallbackWeeklyReport();
  }

  GameState.weeklyReport = report;

  // 隐藏loading
  const loadingEl = document.querySelector('.hrd-review-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  // 展开信纸
  const envelope = document.getElementById('hrd-envelope');
  if (envelope) {
    registerSceneTimer(setTimeout(() => envelope.classList.add('open'), 100));
  }

  // 打字机效果（15ms/字）→ 完成后显示回复按钮
  registerSceneTimer(setTimeout(() => {
    typewriterEffect('hrd-typewriter', report, 15, () => {
      // 显示回复按钮
      const replyContainer = document.getElementById('hrd-reply-buttons');
      if (replyContainer) {
        const _wd = typeof HR_DIALOGUE !== 'undefined' && HR_DIALOGUE[GameState.hrStyle];
        const weeklyReplies = (_wd && _wd.weeklyReportReplies) || [
          '收到，感谢HRD的点评！辛苦了',
          '好的，我会继续加油的',
          '谢谢总结，下周继续努力',
          '了解了，我会注意改进',
        ];
        const shuffled = weeklyReplies.sort(() => Math.random() - 0.5);
        const replyChoices = shuffled.slice(0, 2);
        replyContainer.innerHTML = replyChoices.map(t =>
          `<button class="hrd-reply-btn" data-reply="${t}">${t}</button>`
        ).join('');
        replyContainer.classList.add('visible');

        replyContainer.querySelectorAll('.hrd-reply-btn').forEach(btn => btn.addEventListener('click', function() {
          _burstEmoji(this, 'neutral');
          this.classList.add('selected');

          const replyBubble = document.getElementById('hrd-player-reply');
          if (replyBubble) {
            replyBubble.textContent = this.dataset.reply;
            replyBubble.classList.add('visible');
          }

          registerSceneTimer(setTimeout(() => {
            replyContainer.classList.remove('visible');
            const continueBtn = document.getElementById('hrd-continue-btn');
            if (continueBtn) {
              continueBtn.textContent = '📊 查看最终结果 →';
              continueBtn.classList.add('visible');
              continueBtn.onclick = () => {
                continueBtn.disabled = true;
                calculateResult();
                switchScene('result');
                renderResult();
              };
            }
          }, 1200));
        }));
      }
    });
  }, 500));
}

/**
 * HRD来电质问场景（两轮提问都选最差时触发）
 */
function renderHrdPhoneCall(scoldingText, candidate) {
  const container = document.getElementById('scene-hrd-review');
  container.innerHTML = `
    <div class="hrd-phone-call-scene">
      <div class="phone-ring-animation">
        <div class="phone-icon">📱</div>
        <div class="phone-ring-wave"></div>
        <div class="phone-ring-wave delay"></div>
      </div>
      <div class="phone-caller-name">📞 HRD 来电...</div>
    </div>

    <div class="hrd-letter-envelope" id="hrd-envelope">
      <div class="hrd-letter-card" style="border-left-color: #ef4444;">
        <div class="hrd-letter-card-header" style="color: #ef4444;">📞 HRD的质问</div>
        <div class="hrd-letter-typewriter" id="hrd-typewriter"></div>
      </div>
    </div>

    <button class="btn btn-primary hrd-continue-btn" id="hrd-continue-btn">😔 知错了...</button>
  `;

  // 电话铃声动画 2.5s 后接通
  registerSceneTimer(setTimeout(() => {
    const phoneScene = document.querySelector('.hrd-phone-call-scene');
    if (phoneScene) phoneScene.classList.add('connected');

    // 展开信纸
    const envelope = document.getElementById('hrd-envelope');
    if (envelope) {
      registerSceneTimer(setTimeout(() => envelope.classList.add('open'), 300));
    }

    // 打字机效果
    registerSceneTimer(setTimeout(() => {
      typewriterEffect('hrd-typewriter', scoldingText, 15, () => {
        const continueBtn = document.getElementById('hrd-continue-btn');
        continueBtn.classList.add('visible');

        continueBtn.onclick = () => {
          continueBtn.disabled = true;
          // 继续正常流程：进入反馈页（提前毕业检测统一在HRD来信后进行）
          switchScene('feedback');
          renderFeedback();
        };
      });
    }, 500));
  }, 2500));
}

/**
 * 从本地数据模板生成周报
 */
function getLocalWeeklyReport() {
  const jdIndex = GameState.currentJDIndex;
  const source = (jdIndex >= 0 && typeof LOCAL_DATA !== 'undefined' ? LOCAL_DATA[jdIndex] : null);
  if (!source) return null;

  const wrData = source.weeklyReports;
  if (!wrData || wrData.length === 0) return null;

  const template = wrData[Math.floor(Math.random() * wrData.length)];

  const total = GameState.candidates.length;
  const interviewed = GameState.passed.length;
  const scores = Object.values(GameState.feedbackScores);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, fb) => s + fb.score, 0) / scores.length)
    : 0;
  const offersAccepted = scores.filter(fb => fb.offerGiven && !fb.offerRejected).length;
  const offersRejected = scores.filter(fb => fb.offerRejected).length;
  const passed = scores.filter(fb => fb.offerGiven || fb.interviewFailed === false).length;

  return template
    .replace(/\{total\}/g, total)
    .replace(/\{interviewed\}/g, interviewed)
    .replace(/\{passed\}/g, passed)
    .replace(/\{avgScore\}/g, avgScore)
    .replace(/\{offersAccepted\}/g, offersAccepted)
    .replace(/\{offersRejected\}/g, offersRejected);
}

/**
 * AI不可用时的fallback周报
 */
function generateFallbackWeeklyReport() {
  const total = GameState.candidates.length;
  const interviewed = GameState.passed.length;
  const scores = Object.values(GameState.feedbackScores);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, fb) => s + fb.score, 0) / scores.length)
    : 0;
  const offersAccepted = scores.filter(fb => fb.offerGiven && !fb.offerRejected).length;
  const offersRejected = scores.filter(fb => fb.offerRejected).length;
  const interviewFailed = scores.filter(fb => fb.interviewFailed).length;

  let negoText = '';
  if (offersRejected > 0) {
    negoText = `\n有${offersRejected}位候选人拒绝了Offer，建议反思谈薪策略是否合理。`;
  }

  return `本周招聘工作总结：

共收到${total}份简历，筛选${interviewed}人进入面试环节。其中${offersAccepted}人接受Offer，${offersRejected}人拒绝Offer，${interviewFailed}人面试未通过。${negoText}

面试评价平均得分${avgScore}分。${avgScore >= 35 ? '整体表现优秀，对候选人的判断较为准确。' : avgScore >= 25 ? '整体表现中规中矩，部分候选人的评估存在偏差，建议加强对简历细节的关注。' : '评估准确度有较大提升空间，建议多从候选人的实际经历出发进行判断。'}

请继续保持专业态度，期待下周更好的表现。

—— 你的HRD`;
}
