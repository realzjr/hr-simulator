/**
 * 简历卡片渲染 — 充实版
 * 展示完整简历内容：教育、多段工作经历、项目、技能、自我评价、求职意向
 */
function renderResumeCard() {
  const container = document.getElementById('scene-resume');
  const idx = GameState.currentResumeIndex;
  const total = GameState.candidates.length;

  if (idx >= total) {
    onResumePhaseEnd();
    return;
  }

  const c = GameState.candidates[idx];

  // 工作经历
  let expHTML = '';
  if (c.experiences && c.experiences.length > 0) {
    expHTML = c.experiences.map(exp => `
      <div class="resume-exp-item">
        <div class="resume-exp-header">
          <span class="resume-exp-role">${exp.role || ''}</span>
          <span class="resume-exp-company">${exp.company || ''}</span>
        </div>
        ${exp.duration ? `<div class="resume-exp-duration">${exp.duration}${exp.years ? ` · ${exp.years}年` : ''}</div>` : (exp.years ? `<div class="resume-exp-duration">${exp.years}年经验</div>` : '')}
        ${exp.duties && exp.duties.length > 0 ? `
          <ul class="resume-exp-duties">
            ${exp.duties.map(d => `<li>${d}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('');
  } else if (c.experience) {
    expHTML = `
      <div class="resume-exp-item">
        <div class="resume-exp-header">
          <span class="resume-exp-role">${c.experience.role}</span>
          <span class="resume-exp-company">${c.experience.company}</span>
        </div>
        <div class="resume-exp-duration">${c.experience.years}年</div>
        <p class="resume-exp-desc">${c.experience.desc}</p>
      </div>
    `;
  }

  // 项目经历
  let projHTML = '';
  if (c.projects && c.projects.length > 0) {
    projHTML = `
      <div class="resume-section-title">项目经历</div>
      ${c.projects.map(p => `
        <div class="resume-proj-item">
          <div class="resume-proj-header">
            <span class="resume-proj-name">${p.name || ''}</span>
            ${p.role ? `<span class="resume-proj-role">${p.role}</span>` : ''}
          </div>
          <p class="resume-proj-desc">${p.desc || ''}</p>
        </div>
      `).join('')}
    `;
  }

  // 自我评价
  let selfIntroHTML = '';
  if (c.selfIntro) {
    selfIntroHTML = `
      <div class="resume-section-title">自我评价</div>
      <p class="resume-self-intro">${c.selfIntro}</p>
    `;
  }

  // 基本信息（置顶显示）
  let basicInfoHTML = '';
  if (c.gender || c.age || c.salary || c.expectation) {
    basicInfoHTML = `
      <div class="resume-basic-info">
        ${c.gender ? `<span class="resume-info-item">👤 性别：${c.gender}</span>` : ''}
        ${c.age ? `<span class="resume-info-item">🎂 年龄：${c.age}岁</span>` : ''}
        ${c.salary ? `<span class="resume-info-item">💰 期望薪资：${c.salary}</span>` : ''}
        ${c.expectation ? `<span class="resume-info-item">📅 到岗时间：${c.expectation}</span>` : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="resume-header">
      <h2>📋 筛选简历</h2>
      <div class="resume-progress">第 ${idx + 1} / ${total} 份</div>
    </div>
    <div class="card resume-card" id="resume-card">
      <div class="resume-top">
        <div class="resume-avatar">
          <img src="${c.avatar}" alt="头像">
        </div>
        <div class="resume-top-info">
          <div class="resume-name">${c.name}</div>
          <div class="resume-edu">${c.education}</div>
          ${c.educationDetail ? `<div class="resume-edu-detail">${c.educationDetail}</div>` : ''}
        </div>
      </div>

      ${basicInfoHTML}

      <div class="resume-section-title">工作经历</div>
      ${expHTML}

      ${projHTML}

      <div class="resume-section-title">专业技能</div>
      <div class="resume-skills">
        ${c.skills.map(s => `<span class="tag">${s}</span>`).join('')}
      </div>

      <div class="resume-section-title">性格特点</div>
      <div class="resume-personality">
        ${c.personalities.map(p => `<span class="tag">${p}</span>`).join('')}
      </div>

      ${selfIntroHTML}
    </div>
    <div class="resume-actions">
      <button class="btn btn-danger" id="btn-reject">✗ 淘汰</button>
      <button class="btn btn-primary" id="btn-pass">✓ 通过</button>
    </div>
  `;

  bindResumeEvents();
}

function onResumePhaseEnd() {
  if (GameState.passed.length === 0) {
    GameState.forcedGameOver = true;
    GameState.forcedGameOverReason = 'no_resume';
    calculateResult();
    switchScene('result');
    renderResult();
  } else {
    GameState.currentInterviewIndex = 0;
    switchScene('interview');
    renderInterview();
  }
}
