/**
 * 候选人生成器
 * 支持本地数据池生成 和 DeepSeek AI 逐份生成
 *
 * 模型选择：
 *   简历生成 → deepseek-reasoner（深度推理，生成丰富内容）
 *   对话/问题 → deepseek-chat（快速响应）
 */
const CandidateFactory = (() => {
  let _idCounter = 0;
  let _malePool = [];
  let _femalePool = [];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** 根据性别从对应头像池中取一个不重复的头像 */
  function pickAvatar(gender) {
    if (gender === '女') {
      if (_femalePool.length === 0) _femalePool = [...AVATAR_FEMALE].sort(() => Math.random() - 0.5);
      return _femalePool.pop();
    } else {
      if (_malePool.length === 0) _malePool = [...AVATAR_MALE].sort(() => Math.random() - 0.5);
      return _malePool.pop();
    }
  }

  function pickN(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  /**
   * 按总数分配质量档位
   * 5档：great(8-10) / great_mid(7-8) / mid(4-6) / mid_bad(2-3) / bad(1-3)
   * 增加过渡带人才，模拟真实情况
   */
  function getQualityTiers(count) {
    const tiers = [];
    if (count <= 2) {
      tiers.push('great', 'bad');
    } else if (count === 3) {
      tiers.push('great', 'mid', 'bad');
    } else if (count === 4) {
      tiers.push('great', 'great_mid', 'mid_bad', 'bad');
    } else if (count === 5) {
      tiers.push('great', 'great_mid', 'mid', 'mid_bad', 'bad');
    } else if (count === 6) {
      tiers.push('great', 'great_mid', 'mid', 'mid', 'mid_bad', 'bad');
    } else if (count === 7) {
      tiers.push('great', 'great_mid', 'mid', 'mid', 'mid_bad', 'bad', 'bad');
    } else {
      tiers.push('great', 'great', 'great_mid', 'mid', 'mid', 'mid_bad', 'bad', 'bad');
    }
    return tiers.slice(0, count).sort(() => Math.random() - 0.5);
  }

  /** 本地生成一个候选人（fallback） */
  function create() {
    const exp = pick(EXPERIENCES);
    const skills = pickN(SKILLS, 2 + Math.floor(Math.random() * 2));
    const personalities = pickN(PERSONALITIES, 2);
    const education = pick(EDUCATIONS);

    let quality = 5;
    if (exp.years >= 4) quality += 2;
    else if (exp.years <= 1) quality -= 2;
    if (education.includes('野鸡')) quality -= 2;
    if (education.includes('清华') || education.includes('北大')) quality += 1;
    if (personalities.includes('容易摸鱼')) quality -= 1;
    if (personalities.includes('自驱力强')) quality += 1;
    quality = Math.max(1, Math.min(10, quality));

    const gender = Math.random() < 0.5 ? '男' : '女';
    // 根据工作年限推算年龄：22（本科毕业）+ 工作年限 + 随机浮动
    const age = 22 + (exp.years || 0) + Math.floor(Math.random() * 4);
    return {
      id: 'c' + (++_idCounter),
      name: pick(NAMES),
      gender,
      age,
      avatar: pickAvatar(gender),
      education,
      educationDetail: '',
      experience: exp,
      experiences: [{ company: exp.company, role: exp.role, duration: '', years: exp.years, duties: [exp.desc] }],
      projects: [],
      skills,
      personalities,
      selfIntro: '',
      expectation: '',
      salary: '',
      salaryReasons: [],
      styleProfile: '',
      quality,
      idealStars: generateIdealStars(quality),
    };
  }

  /** 本地批量生成（fallback用） */
  function createBatch(count) {
    _idCounter = 0;
    _malePool = [];
    _femalePool = [];
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push(create());
    }
    // 打乱顺序
    return list.sort(() => Math.random() - 0.5);
  }

  /**
   * 硬筛选：检查候选人数据是否达到最低质量标准
   * 返回 { pass: boolean, reason: string }
   */
  function validateCandidate(c) {
    if (!c.name || c.name.length < 2) return { pass: false, reason: '缺少姓名' };
    if (!c.education) return { pass: false, reason: '缺少教育背景' };

    // 至少有一段工作经历且包含公司+职位+职责
    const exps = c.experiences || (c.experience ? [c.experience] : []);
    if (exps.length === 0) return { pass: false, reason: '缺少工作经历' };
    const mainExp = exps[0];
    if (!mainExp.company || !mainExp.role) return { pass: false, reason: '工作经历不完整（缺公司或职位）' };
    const duties = mainExp.duties || (mainExp.desc ? [mainExp.desc] : []);
    if (duties.length === 0 || (duties[0] && duties[0].length < 6)) {
      return { pass: false, reason: '工作职责描述过短' };
    }

    // 技能不能为空
    if (!Array.isArray(c.skills) || c.skills.length === 0) return { pass: false, reason: '缺少技能标签' };

    // selfIntro 若存在需有最低长度
    if (c.selfIntro && c.selfIntro.length < 8) return { pass: false, reason: '自我评价过短' };

    return { pass: true, reason: '' };
  }

  /**
   * 根据quality生成各维度的随机理想星级（0-5，半星精度）
   * quality 直接决定三维度总半星数，不会出现低quality满星或高quality低星
   *
   * quality 10 → 总和 14.5-15（接近全满）
   * quality 9  → 总和 13-14.5
   * quality 8  → 总和 11.5-13
   * quality 7  → 总和 10-12
   * quality 5-6 → 总和 7-10
   * quality 3-4 → 总和 4-7
   * quality 1-2 → 总和 1-4
   */
  function generateIdealStars(quality) {
    // quality 映射到半星总和范围 [min, max]（单位：半星，即 0.5 步长）
    // 内部用半星数计算（0-30），最后除以2得到星级
    let halfMin, halfMax;
    if (quality >= 10) { halfMin = 29; halfMax = 30; }      // 14.5-15
    else if (quality === 9) { halfMin = 26; halfMax = 29; }  // 13-14.5
    else if (quality === 8) { halfMin = 23; halfMax = 26; }  // 11.5-13
    else if (quality === 7) { halfMin = 20; halfMax = 24; }  // 10-12
    else if (quality === 6) { halfMin = 17; halfMax = 21; }  // 8.5-10.5
    else if (quality === 5) { halfMin = 14; halfMax = 18; }  // 7-9
    else if (quality === 4) { halfMin = 10; halfMax = 14; }  // 5-7
    else if (quality === 3) { halfMin = 7; halfMax = 11; }   // 3.5-5.5
    else if (quality === 2) { halfMin = 4; halfMax = 8; }    // 2-4
    else { halfMin = 1; halfMax = 4; }                        // 0.5-2

    const totalHalf = halfMin + Math.floor(Math.random() * (halfMax - halfMin + 1));

    // 随机分配到3个维度（每维度 0-10 半星，即 0-5 星）
    function randomSplit(total, n) {
      const result = new Array(n).fill(0);
      let remaining = total;
      for (let i = 0; i < n - 1; i++) {
        const maxVal = Math.min(10, remaining - (n - 1 - i) * 0);
        const minVal = Math.max(0, remaining - (n - 1 - i) * 10);
        result[i] = minVal + Math.floor(Math.random() * (maxVal - minVal + 1));
        remaining -= result[i];
      }
      result[n - 1] = Math.max(0, Math.min(10, remaining));
      return result;
    }

    const halves = randomSplit(totalHalf, 3);
    const [fit, potential, value] = halves.map(h => h / 2);

    // 打乱维度顺序（避免总是前面偏高）
    const stars = [fit, potential, value].sort(() => Math.random() - 0.5);

    return { fit: stars[0], potential: stars[1], value: stars[2] };
  }

  /**
   * 将AI返回的JSON对象转为标准候选人对象
   */
  function normalizeCandidate(c) {
    const experiences = Array.isArray(c.experiences) && c.experiences.length > 0
      ? c.experiences
      : (c.experience ? [{
          company: c.experience.company,
          role: c.experience.role,
          duration: '',
          years: c.experience.years,
          duties: [c.experience.desc],
        }] : []);

    const mainExp = experiences[0] || {};
    const experience = {
      company: mainExp.company || '未知公司',
      role: mainExp.role || '未知职位',
      years: mainExp.years || 0,
      desc: (mainExp.duties && mainExp.duties[0]) || c.experience?.desc || '',
    };

    const quality = (typeof c.quality === 'number') ? Math.max(1, Math.min(10, c.quality)) : 5;
    const gender = c.gender === '女' ? '女' : '男';
    // AI 返回的 age；若缺失则根据工作年限推算
    const totalYears = (experiences[0] && experiences[0].years) || 0;
    const age = (typeof c.age === 'number' && c.age >= 18 && c.age <= 65)
      ? c.age
      : 22 + totalYears + Math.floor(Math.random() * 4);

    return {
      id: 'c' + (++_idCounter),
      name: c.name || pick(NAMES),
      gender,
      age,
      avatar: pickAvatar(gender),
      education: c.education || pick(EDUCATIONS),
      educationDetail: c.educationDetail || '',
      experience,
      experiences,
      projects: Array.isArray(c.projects) ? c.projects : [],
      skills: Array.isArray(c.skills) ? c.skills : pickN(SKILLS, 3),
      personalities: Array.isArray(c.personalities) ? c.personalities : pickN(PERSONALITIES, 2),
      selfIntro: c.selfIntro || '',
      expectation: c.expectation || '',
      salary: c.salary || '',
      salaryReasons: Array.isArray(c.salaryReasons) ? c.salaryReasons : [],
      styleProfile: c.styleProfile || '',
      quality,
      idealStars: generateIdealStars(quality),
    };
  }

  /**
   * 尝试生成单个候选人（含硬筛选 + 自动重试1次）
   * @returns {{ candidate: object|null, error: string }}
   */
  async function generateOne(jd, tier, existingNames, index, count, onProgress) {
    const tierLabel = { great: '优质', great_mid: '中上', mid: '普通', mid_bad: '中下', bad: '奇葩' }[tier] || tier;
    const MAX_ATTEMPTS = 2; // 自动重试1次

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const label = attempt > 1 ? `（自动重试）` : '';
      if (onProgress) onProgress(index, count, `正在生成第 ${index}/${count} 份简历${label}...`);

      try {
        const prompt = PROMPTS.generateSingleResume(jd, tier, existingNames);
        const result = await DeepSeekAPI.chatJSON(prompt, { model: 'deepseek-reasoner' });

        let raw = null;
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          raw = result;
        } else if (Array.isArray(result) && result.length > 0) {
          raw = result[0];
        }

        if (!raw) {
          if (attempt < MAX_ATTEMPTS) { console.warn(`[候选人工厂] 第${index}份AI返回空，重试中...`); continue; }
          return { candidate: null, error: `第${index}份简历：生成结果为空` };
        }

        // 硬筛选
        const check = validateCandidate(raw);
        if (!check.pass) {
          console.warn(`[候选人工厂] 第${index}份硬筛选不通过: ${check.reason}`, raw);
          if (attempt < MAX_ATTEMPTS) continue;
          return { candidate: null, error: `第${index}份简历生成失败：质量不达标` };
        }

        const candidate = normalizeCandidate(raw);
        console.log(`[候选人工厂] 第${index}份简历生成成功:`, candidate.name, `(quality: ${candidate.quality})`);
        return { candidate, error: '' };

      } catch (e) {
        console.error(`[候选人工厂] 第${index}份简历 attempt ${attempt} 异常:`, e.message);
        if (attempt < MAX_ATTEMPTS) continue;
        return { candidate: null, error: `第${index}份简历生成失败：${e.message}` };
      }
    }
    return { candidate: null, error: `第${index}份简历生成失败` };
  }

  /**
   * 通过 DeepSeek Reasoner 生成候选人（并发度=2）
   * @param {string} jd - 岗位描述
   * @param {number} count - 生成数量
   * @param {function} onProgress - 进度回调 (current, total, status)
   * @returns {Promise<{candidates: Array, failedSlots: Array, errors: string[]}>}
   */
  /**
   * 从本地数据中按质量档选取候选人
   * tier映射：great→great, great_mid→great, mid→mid, mid_bad→bad, bad→bad
   */
  function pickLocalCandidate(jdData, tier, usedNames) {
    const tierMap = { great: 'great', great_mid: 'great_mid', mid: 'mid', mid_bad: 'mid_bad', bad: 'bad' };
    let tierKey = tierMap[tier] || 'mid';
    let pool = jdData.candidates[tierKey];

    // 如果该档没有数据，尝试相邻档
    if (!pool || pool.length === 0) {
      const fallbackOrder = { great_mid: ['great', 'mid'], mid_bad: ['bad', 'mid'], mid: ['great_mid', 'mid_bad'] };
      const tryKeys = fallbackOrder[tierKey] || ['mid', 'great', 'bad'];
      for (const k of tryKeys) {
        if (jdData.candidates[k] && jdData.candidates[k].length > 0) {
          pool = jdData.candidates[k];
          break;
        }
      }
    }

    if (!pool || pool.length === 0) return null;

    // 优先选未使用过名字的候选人
    const unused = pool.filter(c => !usedNames.includes(c.name));
    const src = unused.length > 0 ? unused : pool;
    const raw = src[Math.floor(Math.random() * src.length)];

    // 深拷贝
    return JSON.parse(JSON.stringify(raw));
  }

  async function createBatchSequential(jd, count, onProgress) {
    _idCounter = 0;
    _malePool = [];
    _femalePool = [];

    // ===== 本地模式：瞬间返回预设候选人（用户录制数据优先） =====
    if (GameState.mode === 'local' && GameState.currentJDIndex >= 0) {
      const jdData = (typeof LOCAL_DATA !== 'undefined' ? LOCAL_DATA[GameState.currentJDIndex] : null);
      if (jdData && jdData.candidates) {
        const tiers = getQualityTiers(count);
        const candidates = [];
        const usedNames = [];
        let completed = 0;

        for (const tier of tiers) {
          const raw = pickLocalCandidate(jdData, tier, usedNames);
          if (raw) {
            const candidate = normalizeCandidate(raw);
            usedNames.push(candidate.name);
            candidates.push(candidate);
          } else {
            // fallback到本地随机生成
            candidates.push(create());
          }
          completed++;
          if (onProgress) onProgress(completed, count, null, candidates.length);
        }

        const shuffled = candidates.sort(() => Math.random() - 0.5);
        return { candidates: shuffled, failedSlots: [], errors: [] };
      }
    }

    const tiers = getQualityTiers(count);
    const candidates = [];
    const failedSlots = [];
    const errors = [];
    const existingNames = [];
    let completed = 0;

    const CONCURRENCY = 2;

    // 按并发度分批执行
    for (let i = 0; i < count; i += CONCURRENCY) {
      const batch = [];
      for (let j = i; j < Math.min(i + CONCURRENCY, count); j++) {
        batch.push({ index: j, tier: tiers[j] });
      }

      const results = await Promise.all(batch.map(({ index, tier }) =>
        generateOne(jd, tier, existingNames, index + 1, count, null)
      ));

      results.forEach((result, batchIdx) => {
        completed++;
        const slotIndex = i + batchIdx;
        if (result.candidate) {
          existingNames.push(result.candidate.name);
          candidates.push(result.candidate);
        } else {
          errors.push(result.error);
          failedSlots.push({ index: slotIndex + 1, tier: tiers[slotIndex] });
        }
      });

      // 每批完成后通报进度（含就绪数量）
      if (onProgress) onProgress(completed, count, null, candidates.length);
    }

    const shuffled = candidates.sort(() => Math.random() - 0.5);
    return { candidates: shuffled, failedSlots, errors };
  }

  /**
   * 重试单个失败槽位
   * @returns {{ candidate: object|null, error: string }}
   */
  async function retryOne(jd, tier, existingNames, index, onProgress) {
    return await generateOne(jd, tier, existingNames, index, '?', onProgress);
  }

  // 保留旧接口的兼容
  async function createBatchFromAI(jd, count) {
    const { candidates } = await createBatchSequential(jd, count, null);
    return candidates;
  }

  return { create, createBatch, createBatchFromAI, createBatchSequential, retryOne, normalizeCandidate };
})();
