/**
 * ========================================
 *  所有 AI 提示词集中管理
 * ========================================
 *
 *  修改提示词只需编辑本文件，无需动逻辑代码。
 *  每个函数接收动态参数，返回完整 prompt 字符串。
 */

/** HR风格描述（在线模式注入 prompt） */
const HR_STYLE_DESC = {
  male_mature: '这位HR是成熟稳重的资深男性，说话沉稳专业，措辞考究，逻辑清晰，偶尔引经据典。',
  male_youthful: '这位HR是年轻阳光的男性，说话直爽活泼，偶尔用流行语和比喻，亲和轻松。',
  female_mature: '这位HR是温婉知性的资深女性，说话细腻优雅，善于洞察，措辞温暖但有深度。',
  female_youthful: '这位HR是元气满满的年轻女性，说话活泼开朗，热情直接，用语年轻化。',
};

function _getHrStylePrompt() {
  const desc = HR_STYLE_DESC[GameState.hrStyle];
  return desc ? `\n# HR面试官的说话风格\n${desc}\n注意：HR的所有对话都必须严格符合这个说话风格。\n` : '';
}

const PROMPTS = {

  // ──────────────────────────────────
  // 1. 生成JD（根据关键词）
  //    调用位置：menu.js → generateJD()
  //    参数：keywords - 逗号分隔的关键词字符串
  // ──────────────────────────────────
  generateJD(keywords, style) {
    const styleGuide = style === 'serious'
      ? '2. 风格严谨正式，用词专业规范，像真实招聘网站上的JD'
      : '2. 风格轻松活泼，可以带幽默感和网络用语，让人会心一笑';

    return `你是一个HR，请根据以下关键词生成一份招聘JD（职位描述）。

关键词：${keywords}

要求：
1. 包含岗位名称、职责（3-4条）、要求（3-4条）
${styleGuide}
3. 直接输出JD文本，不要加标题、不要用markdown格式
4. 控制在150字以内`;
  },

  // ──────────────────────────────────
  // 2. 批量生成候选人简历
  //    调用位置：candidateFactory.js → createBatchFromAI()
  //    参数：jd - 职位描述全文, count - 生成人数
  // ──────────────────────────────────
  generateResumes(jd, count) {
    // 保留旧方法签名，实际由 generateSingleResume 替代
    return this.generateSingleResume(jd, 'mid', []);
  },

  /**
   * 生成单份简历的prompt
   * @param {string} jd - 岗位JD
   * @param {string} tier - 'great'|'mid'|'bad' 质量档位
   * @param {string[]} existingNames - 已有姓名，避免重复
   */
  generateSingleResume(jd, tier, existingNames) {
    const tierDesc = {
      great: `"优质候选人"（quality 8-10）——相对于该岗位而言非常优秀的人：
   - 经历和能力明显超出岗位要求，是该岗位能吸引到的最好水平
   - 技能高度匹配JD，有实际成果和量化数据支撑
   - 自我评价自信专业
   - 重要：候选人水平要与岗位档次匹配。高端技术岗的优质候选人可以是大厂/名校背景；但如果岗位本身门槛较低（如店员、客服、助理），优质候选人应该是同类岗位中经验丰富、态度认真、有相关从业经验的人，而不是名校硕士或大厂高管——那样的人不会来应聘这类岗位。薪资期望也要合理匹配岗位市场水平`,
      great_mid: `"中上候选人"（quality 7-8）——有明显长板但也有短板的偏科型人才：
   - 某方面能力较强，但其他维度一般
   - 简历有亮点但不全面，性价比或稳定性可能存疑
   - 要让面试官需要权衡和纠结
   - 重要：长板和短板都要相对于该岗位的要求来定义，能力层级和薪资期望要与岗位市场水平匹配`,
      mid: `"普通候选人"（quality 4-6）——相对于该岗位而言中规中矩的人：
   - 能力基本对口但亮点不多
   - 描述笼统（"参与了XX项目"、"协助完成XX"）
   - 自我评价中规中矩
   - 重要：能力和薪资要与岗位市场水平匹配`,
      mid_bad: `"中下候选人"（quality 2-3）——看似有点基础但存在明显问题的人：
   - 某一项还过得去但整体较弱（如有相关经历但工作时间很短/频繁跳槽/技能写了很多但都是"了解"级别）
   - 简历有一定格式但内容水分较大
   - 比纯奇葩好一点，但低于该岗位的普通水平`,
      bad: `"不匹配候选人"（quality 1-3）——明显不适合该岗位的人：
   - 专业或经历与岗位要求明显不符、跨行乱投
   - 简历注水明显，技能与岗位无关
   - 自我评价奇特甚至离谱`,
    };

    const namesNote = existingNames.length > 0
      ? `\n已有候选人姓名：${existingNames.join('、')}。请避免重复。`
      : '';

    return `# 角色
你是"HR模拟器"游戏的简历生成引擎。请根据岗位JD，虚构一份完整的求职简历。

# 岗位JD
${jd}

# 本份简历的定位
${tierDesc[tier] || tierDesc.mid}
${namesNote}

# 生成要求
1. **内容必须丰富、要素齐全**：
   - 完整的教育背景（学校、专业、学位、在校荣誉/GPA）
   - 2-3段工作经历，每段有公司名、职位、时间段、3-4条具体职责和成果描述
   - 项目经历1-2个，含项目名、角色、具体贡献和量化成果
   - 技能清单（5-8项，含熟练程度）
   - 性格特点（2-3个）
   - 自我评价（2-3句，体现性格特点）
   - 求职意向（到岗时间）

2. **性别**：随机为男或女，姓名必须与性别匹配（男性用男性常见名，女性用女性常见名）

3. **薪资**：必须包含明确的数字范围，如"10-12K"、"15-20K"、"25-30K×15薪"等，绝对不可写"面议"或模糊表述。薪资应与候选人资质档位匹配

4. **降薪理由**：额外生成3条可能让该候选人愿意降薪的合理理由（如"急需跳槽离开现公司""所在城市生活成本较低""看重平台发展机会"等），这些理由不会写进简历中

5. **说话风格**（styleProfile）：额外生成一段50-80字的说话风格描述，不出现在简历正文中，仅供后续对话使用。描述该候选人面试时的语气特征、口头禅、用词习惯、表达结构偏好、紧张时的表现等。与personalities呼应但聚焦于"怎么说话"。不同档位风格应有差异：优质候选人自信有条理，低质候选人可能语无伦次或过于随意

# 输出格式
直接输出一个JSON对象（不是数组），不要任何其他文字、不要markdown代码块标记。
{
  "gender": "男或女",
  "name": "姓名（须与gender匹配）",
  "age": 数字（根据学历和工作年限合理推算，本科毕业约22岁起算）,
  "education": "学校 - 专业（学位）",
  "educationDetail": "在校荣誉、GPA等补充信息",
  "experiences": [
    {
      "company": "公司名",
      "role": "职位",
      "duration": "2021.06 - 2023.08",
      "years": 2,
      "duties": ["职责描述1（含具体成果）", "职责描述2", "职责描述3"]
    }
  ],
  "projects": [
    {
      "name": "项目名称",
      "role": "担任角色",
      "desc": "项目详细描述，包含具体贡献和量化成果（2-3句话）"
    }
  ],
  "skills": ["技能1（熟练）", "技能2（精通）", "技能3（了解）"],
  "personalities": ["特点1", "特点2", "特点3"],
  "selfIntro": "2-3句话的自我评价",
  "expectation": "可在X周内到岗",
  "salary": "XX-XXK（必须有具体数字）",
  "salaryReasons": ["降薪理由1", "降薪理由2", "降薪理由3"],
  "quality": 数字1到10,
  "styleProfile": "该候选人说话风格描述（50-80字，不出现在简历中）"
}

兼容字段experience取experiences第一项简写：
  "experience": {"company":"公司","role":"职位","years":数字,"desc":"一句话概括"}

所有字段都要认真填写，不要敷衍留空。简历整体应有500-1000字。`;
  },

  // ──────────────────────────────────
  // 3. 生成针对候选人的定制面试问题（2个）
  //    调用位置：interviewRender.js → generateAIQuestions()
  //    参数：candidate - 候选人对象, jd - 职位描述
  // ──────────────────────────────────
  generateInterviewQuestions(candidate, jd) {
    return `你是一个资深面试官。根据以下候选人简历和岗位要求，生成6个有针对性的深度面试问题。

候选人简历：
- 姓名：${candidate.name}
- 年龄：${candidate.age || '未知'}岁
- 学历：${candidate.education}
- 工作经历：${candidate.experience.company} ${candidate.experience.role}（${candidate.experience.years}年）— ${candidate.experience.desc}
- 技能：${candidate.skills.join('、')}
- 性格：${candidate.personalities.join('、')}

岗位要求：
${jd}

要求：
1. 6个问题要针对该候选人的具体背景，挖掘简历中的关键细节
2. 前3个偏技术/专业能力，后3个偏综合素质/情景假设
3. 每个问题不超过30字
4. 直接输出JSON数组，如：["问题1","问题2","问题3","问题4","问题5","问题6"]，不要其他文字`;
  },

  // ──────────────────────────────────
  // 4. 生成面试回答
  //    调用位置：interviewLogic.js → generateAIAnswer()
  //    参数：candidate - 候选人对象, jd - 职位描述,
  //          question - 问题文本, quality - 'good'|'mid'|'bad'
  // ──────────────────────────────────
  generateInterviewAnswer(candidate, jd, question, quality) {
    const qualityDesc = {
      good: `【优秀回答】条理清晰，有深度，引用具体数据和案例。
   - 自信但不傲慢，逻辑严密
   - 主动关联岗位需求，展现深刻理解
   - 用STAR法则结构化回答（情境→任务→行动→结果）`,
      mid: `【普通回答】方向基本正确但笼统，缺乏亮点。
   - 没有具体数据支撑，说了等于没说
   - 回答浮于表面，像是背模板
   - 有时会偏题或废话较多`,
      bad: `【糟糕回答】明显准备不足，暴露短板。
   - 答非所问或严重跑题
   - 态度随意，如"嗯……这个我不太清楚"、"还行吧"
   - 可能暴露不靠谱的一面（迟到找借口、抱怨前公司等）
   - 说话结构混乱，前后矛盾`,
    };

    const expDetails = (candidate.experiences || []).map(e =>
      `${e.company} ${e.role}（${e.duration || e.years + '年'}）：${(e.duties || []).join('；')}`
    ).join('\n  ');
    const projDetails = (candidate.projects || []).map(p =>
      `${p.name}（${p.role || '参与者'}）：${p.desc}`
    ).join('\n  ');

    return `你是求职者"${candidate.name}"，正在参加面试。你必须严格基于自己的简历内容来回答。

# 你的完整简历
- 年龄：${candidate.age || '未知'}岁
- 学历：${candidate.education}${candidate.educationDetail ? '（' + candidate.educationDetail + '）' : ''}
- 工作经历：
  ${expDetails || candidate.experience.company + ' ' + candidate.experience.role + '（' + candidate.experience.years + '年）— ' + candidate.experience.desc}
- 项目经历：
  ${projDetails || '（无）'}
- 技能：${candidate.skills.join('、')}
- 性格特点：${candidate.personalities.join('、')}
${candidate.selfIntro ? '- 自我评价：' + candidate.selfIntro : ''}
- 期望薪资：${candidate.salary || '未填写'}
${candidate.expectation ? '- 求职意向：' + candidate.expectation : ''}
${candidate.styleProfile ? '\n# 你的说话风格\n' + candidate.styleProfile + '\n注意：按上述风格说话，但回答质量必须严格按照下方"回答质量定位"来，风格不改变回答好坏。' : ''}

# 面试岗位
${jd}

# 面试官的问题
"${question}"

# 回答质量定位
${qualityDesc[quality]}

# 回答要求
1. 严格按照上述质量定位来回答，质量差异必须明显
2. 必须基于简历中的经历，不能瞎编
3. 绝对不能向面试官提问
4. 字数60-120字，第一人称口语化
5. 直接输出回答内容，不加引号或前缀
6. 不要使用markdown格式，直接输出纯文本
7. 当问题涉及薪资、待遇、期望时，必须引用简历中的具体薪资数字回答（如"我的期望是15-20K"），绝不可含糊说"面议"或"看情况"`;
  },

  // ──────────────────────────────────
  // 5. 面试回答备用文案（AI不可用时的fallback）
  // ──────────────────────────────────
  answerFallbacks: {
    good: '在我上一段工作中，我主导了核心业务模块的重构，通过优化架构使系统响应时间降低了40%，同时带领3人小组按期交付了两个季度的OKR目标。我认为这些经验让我能快速适应贵司的工作节奏。',
    mid: '之前在公司做过类似的工作，虽然规模没那么大，但基本流程我都比较熟悉。我觉得自己学习能力还可以，上手应该不会太慢。',
    bad: '说实话这方面我了解得不太多，之前的工作跟这个方向不太一样。不过我觉得我人比较踏实，愿意从头学起，就是可能需要一点时间适应。',
  },

  // ──────────────────────────────────
  // 6. 生成候选人提问（面试结束后）
  //    调用位置：interviewLogic.js → startCounterQuestion()
  //    参数：candidate - 候选人对象, jd - 职位描述
  // ──────────────────────────────────
  generateCounterQuestion(candidate, jd) {
    return `你是求职者"${candidate.name}"，面试接近尾声，面试官问你"你有什么想了解的吗？"。
请生成两轮提问的完整数据。
${_getHrStylePrompt()}
# 你的简历
- 年龄：${candidate.age || '未知'}岁
- 学历：${candidate.education}
- 经历：${candidate.experience.company} ${candidate.experience.role}
- 期望：${candidate.expectation || '面议'}
${candidate.styleProfile ? '- 说话风格：' + candidate.styleProfile : ''}

# 岗位JD
${jd}

# 要求
候选人的提问和反应要贴合其说话风格和性格特点。

## 第一轮
1. 候选人提一个关于薪资福利、工作强度、团队氛围、发展空间、承诺兑现等方向的问题
2. 好回答：体现HR沟通艺术——巧妙回应敏感问题，自然展现公司亮点，让候选人对公司更有好感
3. 中回答：含糊敷衍，没有实质性信息
4. 差回答：态度傲慢或画大饼空头支票，让人不舒服
5. 候选人对好回答的反应：表示满意并夸赞（如"谢谢！听起来贵司氛围很好，我很期待"），此时不再追问
6. 候选人对中/差回答的反应：委婉表达不满但继续追问第二个问题

## 第二轮（候选人第一轮未满意时触发）
1. 候选人换一个方向提出第二个问题
2. 三种回答同第一轮标准
3. 候选人对好/中回答的反应：表示了解
4. 候选人对差回答的反应：明显不满的话（如"这样啊...那我需要再考虑考虑"）

## HRD质问文本
如果两轮都选了最差回答，HRD会打电话来质问面试官。请生成一段HRD质问话术（80-120字），语气严厉但专业，批评面试官在候选人提问环节表现极差，损害了公司形象。

5. 每个回答30-50字，每个候选人反应20-30字

# 输出格式
直接输出JSON，不要其他文字：
{
  "round1": {
    "question": "候选人第一个问题",
    "good": "好回答",
    "mid": "中回答",
    "bad": "差回答",
    "reaction_good": "候选人对好回答的满意反应",
    "reaction_mid": "候选人对中回答的反应（继续追问）",
    "reaction_bad": "候选人对差回答的反应（继续追问）"
  },
  "round2": {
    "question": "候选人第二个问题",
    "good": "好回答",
    "mid": "中回答",
    "bad": "差回答",
    "reaction_good": "候选人对好回答的反应",
    "reaction_mid": "候选人对中回答的反应",
    "reaction_bad": "候选人对差回答的不满反应"
  },
  "scolding": "HRD的质问话术"
}`;
  },

  // ──────────────────────────────────
  // 7. 生成谈薪环节对话
  //    调用位置：negotiationLogic.js → generateNegotiationDialogue()
  //    参数：candidate - 候选人对象, jd - 职位描述
  // ──────────────────────────────────
  generateNegotiationDialogue(candidate, jd) {
    const salaryReasons = (candidate.salaryReasons || []).join('、') || '职业发展、平台机会、团队氛围';

    return `你是"HR模拟器"游戏的对话生成引擎。候选人已通过面试，进入薪资谈判环节。请生成完整的谈薪对话数据。
${_getHrStylePrompt()}
# 候选人信息
- 姓名：${candidate.name}
- 年龄：${candidate.age || '未知'}岁
- 学历：${candidate.education}
- 工作经历：${candidate.experience.company} ${candidate.experience.role}（${candidate.experience.years}年）
- 期望薪资：${candidate.salary || '面议'}
- 性格：${candidate.personalities.join('、')}
${candidate.styleProfile ? '- 说话风格：' + candidate.styleProfile : ''}
- 可能接受降薪的理由：${salaryReasons}

# 岗位JD
${jd}

# 生成要求
生成3轮谈判对话。每轮有4个选项供HR选择，分别对应：
- perfect（完美命中）：精准击中候选人在意的点，大幅提升意愿
- close（擦边）：有一定说服力，小幅提升意愿
- irrelevant（无关）：说了等于没说，无效果
- negative（负面）：HR自以为是福利/卖点、但候选人并不在意甚至反感的内容。例如"每周末组织团建活动""公司有健身打卡奖励""办公室有免费零食柜（晚上9点后开放）""弹性工作制（核心工作时间9:00-21:00）"等。注意：不要写成明显攻击性或施压性的话（如"offer不会一直保留""不接受就算了"），而是那种HR觉得是加分项、候选人却觉得是减分项的内容

每轮的4个选项应围绕候选人可能降薪的理由展开，话题依次递进：
- 第1轮：围绕职业发展和平台价值
- 第2轮：围绕团队文化和工作环境
- 第3轮：围绕福利待遇和长期回报

# 输出格式
直接输出JSON，不要其他文字：
{
  "candidate_greeting_reply": "候选人收到好消息后的感谢回复（20-30字）",
  "rounds": [
    {
      "options": [
        { "label": "选项按钮文字（6-10字）", "type": "perfect", "hr_says": "HR的话（30-50字）", "candidate_reply": "候选人回复（20-40字）" },
        { "label": "选项按钮文字", "type": "close", "hr_says": "HR的话", "candidate_reply": "候选人回复" },
        { "label": "选项按钮文字", "type": "irrelevant", "hr_says": "HR的话", "candidate_reply": "候选人回复" },
        { "label": "选项按钮文字", "type": "negative", "hr_says": "HR的话", "candidate_reply": "候选人回复" }
      ]
    },
    { "options": [ ...同上4个... ] },
    { "options": [ ...同上4个... ] }
  ],
  "final_accept": "候选人接受offer的回复（20-40字）",
  "final_reject": "候选人婉拒offer的回复（30-50字）",
  "hr_blessing": "HR祝福语（20-30字）",
  "hr_regret": "HR遗憾回复（20-30字）"
}

注意：
1. 对话要贴合候选人性格特点，口语化自然
2. 4个选项的type必须按 perfect/close/irrelevant/negative 顺序排列
3. 每轮4个选项应打乱排列，不要让玩家轻易猜出哪个最优
4. **长度控制**：同一轮4个选项的hr_says长度必须接近（都在30-40字），不要让好选项明显更长、差选项明显更短，否则玩家一眼就能猜出答案
5. **避免重复**：3轮共12个选项的label和hr_says必须各不相同，即使话题角度类似也要用完全不同的表述方式和切入点，不能出现相似的句式或雷同的内容`;
  },

  // ──────────────────────────────────
  // 8. 生成HRD来信（面试反馈后）
  //    调用位置：feedbackLogic.js → proceedWithDecision() / enterHrdReviewAfterNegotiation()
  //    参数：candidate, jd, dialogs, ratings{fit,potential,value}, offerGiven
  // ──────────────────────────────────

  generateHRDLetter(candidate, jd, dialogs, ratings, offerGiven, negoContext) {
    const dialogText = dialogs.map((d, i) =>
      `Q${i + 1}: ${d.question}\nA${i + 1}: ${d.answer}`
    ).join('\n');

    const ctx = negoContext || {};
    let decisionText = '';
    if (ctx.interviewFailed) {
      decisionText = '面试官判定不通过（未进入谈薪）';
    } else if (ctx.hrdWarning) {
      decisionText = '面试官试图通过该低质候选人，被HRD警告后跳过了谈薪';
    } else if (ctx.offerRejected) {
      decisionText = `进入谈薪但候选人拒绝了Offer（最终薪资：${ctx.finalSalary || '未知'}，接受意愿：${ctx.willingness || 0}%）`;
    } else if (offerGiven) {
      decisionText = `候选人接受了Offer（最终薪资：${ctx.finalSalary || '未知'}，接受意愿：${ctx.willingness || 0}%）`;
    } else {
      decisionText = '未发放Offer';
    }

    const ideal = candidate.idealStars || { fit: 3, potential: 3, value: 3 };
    function diffWord(d) {
      if (d <= 0.5) return '精准';
      if (d <= 1) return '略有偏差';
      if (d <= 2) return '偏差较大';
      return '严重偏离';
    }
    function dirWord(player, actual) {
      const d = player - actual;
      if (Math.abs(d) <= 0.5) return '精准';
      return d > 0 ? '偏高' : '偏低';
    }
    const fitDiff = Math.abs(ratings.fit - ideal.fit);
    const potDiff = Math.abs(ratings.potential - ideal.potential);
    const valDiff = Math.abs(ratings.value - ideal.value);

    return `你是一家公司的HRD（人力资源总监），一位面试官刚刚完成了对候选人的面试并提交了反馈。请你写一封简短的回信，评价这位面试官的表现。

# 候选人信息
- 姓名：${candidate.name}
- 年龄：${candidate.age || '未知'}岁
- 学历：${candidate.education}
- 工作经历：${candidate.experience.company} ${candidate.experience.role}（${candidate.experience.years}年）— ${candidate.experience.desc}
- 技能：${candidate.skills.join('、')}
- 性格：${candidate.personalities.join('、')}
- 真实质量评分：${candidate.quality}/10（${candidate.quality >= 7 ? '优质候选人' : candidate.quality >= 4 ? '普通候选人' : '低质候选人'}）

# 岗位JD
${jd}

# 面试对话记录
${dialogText || '（面试官未提问）'}

# 面试官各维度评价偏差
- 适配程度：${dirWord(ratings.fit, ideal.fit)}（${diffWord(fitDiff)}）——候选人与岗位JD的匹配度
- 发展潜力：${dirWord(ratings.potential, ideal.potential)}（${diffWord(potDiff)}）——候选人的成长空间和学习能力
- 性价比：${dirWord(ratings.value, ideal.value)}（${diffWord(valDiff)}）——候选人期望薪资与其能力水平是否匹配（注意：这里只看候选人简历上的期望薪资区间与其综合能力的匹配度，与后续谈薪环节无关）
- 决策结果：${decisionText}

# 写信要求
1. 以"亲爱的面试官："开头
2. 必须逐个维度点评：对适配程度、发展潜力、性价比三个维度分别给出评价，用"精准/略高/略低/偏差较大/严重偏离"等程度词描述，不要写具体分数。如果某个维度偏差较大或严重偏离，必须明确批评。注意：性价比维度仅讨论候选人期望薪资与其能力是否匹配，不要与谈薪环节的表现混为一谈
3. 如有谈薪环节，单独点评谈薪表现：${ctx.hrdWarning ? '本次面试官试图强行通过一个低质候选人，被你（HRD）紧急拦截纠正，这是严重的判断失误，必须严厉批评' : ctx.interviewFailed ? (candidate.quality >= 7 ? '面试官将一位优质候选人判定不通过，这可能是严重的人才流失，需要明确质疑面试官的判断力' : '面试官主动判定不通过，这是面试官的决策，需要客观评价是否合理') : ctx.offerRejected ? '面试官通过了该候选人并进入谈薪，但最终谈崩导致候选人拒绝Offer，需要单独分析谈薪策略是否得当' : '单独评价谈薪环节的表现'}
5. 语气专业且有温度，该表扬就表扬，该批评就直接批评
6. 最后揭示候选人的真实质量等级
7. 以"—— 你的HRD"结尾
8. 只讨论实际发生的事情，不要提及未发生的情况
9. 全文不超过280字，直接输出信件内容，不要加标题
10. 不要使用markdown格式（如**加粗**、#标题等），直接输出纯文本
11. 文中不要使用"星"这个字来描述评分，用"分"代替`;
  },

  // ──────────────────────────────────
  // 9. 生成绩效周报
  //    调用位置：hrdReviewRender.js → renderWeeklyReportFlow()
  //    参数：jd, candidates, feedbackScores, passed
  // ──────────────────────────────────
  generateWeeklyReport(jd, candidates, feedbackScores, passed) {
    const candidateSummaries = passed.map(c => {
      const fb = feedbackScores[c.id];
      if (!fb) return `- ${c.name}（质量${c.quality}/10）：未完成反馈`;

      let statusText = '';
      if (fb.hrdWarning) {
        statusText = '⚠️面试官试图强行通过，被HRD拦截纠正（判断严重失误）';
      } else if (fb.interviewFailed) {
        statusText = '面试官主动判定不通过';
      } else if (fb.offerRejected) {
        const nego = fb.negotiationResult;
        statusText = `Offer被拒绝（薪资${nego ? nego.finalSalary : '未知'}，意愿${nego ? nego.willingness : 0}%）`;
      } else if (fb.offerGiven) {
        const nego = fb.negotiationResult;
        statusText = `已接受Offer（薪资${nego ? nego.finalSalary : '未知'}）`;
      } else {
        statusText = '未发Offer';
      }

      return `- ${c.name}（质量${c.quality}/10）：适配${fb.fit}分 潜力${fb.potential}分 性价比${fb.value}分（满分5） → ${statusText}`;
    }).join('\n');

    const rejected = candidates.filter(c => !passed.includes(c));
    const rejectedSummary = rejected.map(c =>
      `- ${c.name}（质量${c.quality}/10）：简历阶段淘汰`
    ).join('\n');

    // 仅当存在被HRD拦截的情况时，才加入相关批评指令
    const hasHrdBlock = passed.some(c => feedbackScores[c.id] && feedbackScores[c.id].hrdWarning);
    const hrdBlockRule = hasHrdBlock
      ? `\n6. 必须严肃批评"试图强行通过，被HRD拦截纠正"的情况——这代表面试官判断严重失误，试图让不合格候选人通过面试，是被上级发现并紧急叫停的，与"面试官主动判定不通过"（正确决策）性质完全不同，必须重点批评`
      : '';

    return `你是一家公司的HRD（人力资源总监），请根据本周面试官的招聘表现撰写一份绩效周报。

# 岗位JD
${jd}

# 候选人总览
共${candidates.length}人，进入面试${passed.length}人

## 面试候选人
${candidateSummaries || '（无）'}

## 简历筛选淘汰
${rejectedSummary || '（无）'}

# 写报告要求
1. 以绩效周报的口吻撰写，专业正式
2. 分析面试官的简历筛选眼光（是否正确放行优质、拒绝低质）
3. 分析面试官的面试评价准确性（各维度评分是否贴近候选人真实质量）
4. 分析面试官的谈薪表现（是否成功留住优质人才、是否合理控制薪资）
5. 对Offer被拒绝的情况给予评价（是否谈判策略有误）${hrdBlockRule}
6. 给出1-2条具体改进建议
7. 最后给出一句总评
8. 只讨论实际发生的事情，不要提及未发生的情况
9. 全文300字左右，直接输出内容，不要加标题
10. 以"—— 你的HRD"结尾
11. 不要使用markdown格式（如**加粗**、#标题等），直接输出纯文本
12. 文中不要使用"星"这个字来描述评分，用"分"代替`;
  },

};
