#!/usr/bin/env python3
"""
自动生成 localData.js —— 通过 DeepSeek API 批量生成 HR模拟器 离线数据

用法：
    python3 generate_data.py          # 生成全部3个岗位
    python3 generate_data.py --jd 0   # 只生成第1个岗位
    python3 generate_data.py --jd 1   # 只生成第2个岗位
"""

import argparse
import json
import os
import re
import sys
import time

# ─── 配置 ───────────────────────────────────────────────

API_URL = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-chat"
MAX_RETRIES = 3
DELAY = 0.5  # 秒，调用间延迟

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APIKEY_PATH = os.path.join(SCRIPT_DIR, "apikey.txt")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "src", "data", "localData.js")

# ─── JD 模板 ────────────────────────────────────────────

JOB_TEMPLATES = [
    {
        "title": "后端开发工程师",
        "description": """岗位：后端开发工程师
职责：
- 负责服务端核心业务逻辑开发与维护
- 设计和优化数据库方案，保障系统高可用
- 参与技术方案评审与代码审查
要求：
- 熟悉 Java/Go/Python 至少一门后端语言
- 了解 MySQL、Redis 等常用中间件
- 有高并发系统经验优先
- 良好的沟通能力和团队协作精神""",
    },
    {
        "title": "产品经理",
        "description": """岗位：产品经理
职责：
- 负责产品需求分析、功能设计与原型输出
- 跟踪产品数据，持续优化用户体验
- 协调研发、设计、运营等跨部门协作
要求：
- 2年以上互联网产品经验
- 熟练使用 Figma、Axure 等原型工具
- 具备数据分析能力，善于从数据中发现问题
- 优秀的沟通表达和项目推动能力""",
    },
    {
        "title": "UI设计师",
        "description": """岗位：UI设计师
职责：
- 负责产品界面视觉设计，输出高质量设计稿
- 建立和维护设计规范与组件库
- 与产品经理、前端工程师紧密配合，确保设计落地
要求：
- 熟练使用 Figma、Sketch、Photoshop 等设计工具
- 具备良好的审美和色彩感知能力
- 了解基本的前端实现原理
- 有作品集展示优先""",
    },
]

# ─── 提示词（复用 prompts.js 逻辑）──────────────────────

TIER_DESC = {
    "great": '''"大神简历"（quality 8-10）：
   - 大厂或知名企业经历、顶尖院校背景
   - 量化成就突出（"DAU提升40%"、"营收增长200万"）
   - 技能高度匹配JD，项目描述详实有深度
   - 自我评价自信专业''',
    "great_mid": '''"中上简历"（quality 7-8）——有明显长板但也有短板的偏科型人才：
   - 某方面能力很强（如技术很扎实/学历很好/行业经验丰富），但其他维度一般
   - 可能：名校毕业但工作经历一般 / 大厂经验但转行不久 / 技术强但管理经验为零
   - 简历有亮点但不全面，性价比或稳定性可能存疑
   - 要让面试官需要权衡和纠结''',
    "mid": '''"普通简历"（quality 4-6）：
   - 二线公司、普通院校
   - 描述笼统（"参与了XX项目"、"协助完成XX"）
   - 技能基本对口但亮点不多，项目平淡
   - 自我评价中规中矩''',
    "mid_bad": '''"中下简历"（quality 2-3）——看似有点基础但存在明显问题的人：
   - 某一项还过得去但整体较弱（如有相关经历但工作时间很短/频繁跳槽/技能写了很多但都是"了解"级别）
   - 简历有一定格式但内容水分较大
   - 比纯奇葩好一点，但低于普通水平，容易让面试官犹豫''',
    "bad": '''"奇葩简历"（quality 1-3）：
   - 专业驴头不对马嘴、工作经历离奇（开奶茶店/直播带货/游戏代练等）
   - 简历注水明显、跨行乱投
   - 技能搞笑（"王者荣耀最强王者"、"吃辣冠军"）
   - 自我评价奇特甚至离谱''',
}

QUALITY_DESC = {
    "good": """【优秀回答】条理清晰，有深度，引用具体数据和案例。
   - 自信但不傲慢，逻辑严密
   - 主动关联岗位需求，展现深刻理解
   - 用STAR法则结构化回答（情境→任务→行动→结果）""",
    "mid": """【普通回答】方向基本正确但笼统，缺乏亮点。
   - 没有具体数据支撑，说了等于没说
   - 回答浮于表面，像是背模板
   - 有时会偏题或废话较多""",
    "bad": """【糟糕回答】明显准备不足，暴露短板。
   - 答非所问或严重跑题
   - 态度随意，如"嗯……这个我不太清楚"、"还行吧"
   - 可能暴露不靠谱的一面（迟到找借口、抱怨前公司等）
   - 说话结构混乱，前后矛盾""",
}


def build_resume_prompt(jd, tier, existing_names):
    names_note = ""
    if existing_names:
        names_note = f"\n已有候选人姓名：{'、'.join(existing_names)}。请避免重复。"

    return f"""# 角色
你是"HR模拟器"游戏的简历生成引擎。请根据岗位JD，虚构一份完整的求职简历。

# 岗位JD
{jd}

# 本份简历的定位
{TIER_DESC.get(tier, TIER_DESC['mid'])}
{names_note}

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
{{
  "gender": "男或女",
  "name": "姓名（须与gender匹配）",
  "education": "学校 - 专业（学位）",
  "educationDetail": "在校荣誉、GPA等补充信息",
  "experiences": [
    {{
      "company": "公司名",
      "role": "职位",
      "duration": "2021.06 - 2023.08",
      "years": 2,
      "duties": ["职责描述1（含具体成果）", "职责描述2", "职责描述3"]
    }}
  ],
  "projects": [
    {{
      "name": "项目名称",
      "role": "担任角色",
      "desc": "项目详细描述，包含具体贡献和量化成果（2-3句话）"
    }}
  ],
  "skills": ["技能1（熟练）", "技能2（精通）", "技能3（了解）"],
  "personalities": ["特点1", "特点2", "特点3"],
  "selfIntro": "2-3句话的自我评价",
  "expectation": "可在X周内到岗",
  "salary": "XX-XXK（必须有具体数字）",
  "salaryReasons": ["降薪理由1", "降薪理由2", "降薪理由3"],
  "quality": 数字1到10,
  "styleProfile": "该候选人说话风格描述（50-80字，不出现在简历中）"
}}

兼容字段experience取experiences第一项简写：
  "experience": {{"company":"公司","role":"职位","years":数字,"desc":"一句话概括"}}

所有字段都要认真填写，不要敷衍留空。简历整体应有500-1000字。"""


def build_interview_questions_prompt(candidate, jd):
    exp = candidate.get("experience", {})
    return f"""你是一个资深面试官。根据以下候选人简历和岗位要求，生成6个有针对性的深度面试问题。

候选人简历：
- 姓名：{candidate['name']}
- 学历：{candidate['education']}
- 工作经历：{exp.get('company','')} {exp.get('role','')}（{exp.get('years',0)}年）— {exp.get('desc','')}
- 技能：{'、'.join(candidate.get('skills',[]))}
- 性格：{'、'.join(candidate.get('personalities',[]))}

岗位要求：
{jd}

要求：
1. 6个问题要针对该候选人的具体背景，挖掘简历中的关键细节
2. 前3个偏技术/专业能力，后3个偏综合素质/情景假设
3. 每个问题不超过30字
4. 直接输出JSON数组，如：["问题1","问题2","问题3","问题4","问题5","问题6"]，不要其他文字"""


def build_counter_question_prompt(candidate, jd):
    exp = candidate.get("experience", {})
    return f"""你是求职者"{candidate['name']}"，面试接近尾声，面试官问你"你有什么想了解的吗？"。
请生成两轮反问的完整数据。

# 你的简历
- 学历：{candidate['education']}
- 经历：{exp.get('company','')} {exp.get('role','')}
- 期望：{candidate.get('expectation', '面议')}
{'- 说话风格：' + candidate['styleProfile'] if candidate.get('styleProfile') else ''}

# 岗位JD
{jd}

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
如果两轮都选了最差回答，HRD会打电话来质问面试官。请生成一段HRD质问话术（80-120字），语气严厉但专业，批评面试官在候选人反问环节表现极差，损害了公司形象。

5. 每个回答30-50字，每个候选人反应20-30字

# 输出格式
直接输出JSON，不要其他文字：
{{
  "round1": {{
    "question": "候选人第一个问题",
    "good": "好回答",
    "mid": "中回答",
    "bad": "差回答",
    "reaction_good": "候选人对好回答的满意反应",
    "reaction_mid": "候选人对中回答的反应（继续追问）",
    "reaction_bad": "候选人对差回答的反应（继续追问）"
  }},
  "round2": {{
    "question": "候选人第二个问题",
    "good": "好回答",
    "mid": "中回答",
    "bad": "差回答",
    "reaction_good": "候选人对好回答的反应",
    "reaction_mid": "候选人对中回答的反应",
    "reaction_bad": "候选人对差回答的不满反应"
  }},
  "scolding": "HRD的质问话术"
}}"""


def build_negotiation_prompt(candidate, jd):
    exp = candidate.get("experience", {})
    salary_reasons = "、".join(candidate.get("salaryReasons", [])) or "职业发展、平台机会、团队氛围"

    return f"""你是"HR模拟器"游戏的对话生成引擎。候选人已通过面试，进入薪资谈判环节。请生成完整的谈薪对话数据。

# 候选人信息
- 姓名：{candidate['name']}
- 学历：{candidate['education']}
- 工作经历：{exp.get('company','')} {exp.get('role','')}（{exp.get('years',0)}年）
- 期望薪资：{candidate.get('salary', '面议')}
- 性格：{'、'.join(candidate.get('personalities',[]))}
{'- 说话风格：' + candidate['styleProfile'] if candidate.get('styleProfile') else ''}
- 可能接受降薪的理由：{salary_reasons}

# 岗位JD
{jd}

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
{{
  "candidate_greeting_reply": "候选人收到好消息后的感谢回复（20-30字）",
  "rounds": [
    {{
      "options": [
        {{ "label": "选项按钮文字（6-10字）", "type": "perfect", "hr_says": "HR的话（30-50字）", "candidate_reply": "候选人回复（20-40字）" }},
        {{ "label": "选项按钮文字", "type": "close", "hr_says": "HR的话", "candidate_reply": "候选人回复" }},
        {{ "label": "选项按钮文字", "type": "irrelevant", "hr_says": "HR的话", "candidate_reply": "候选人回复" }},
        {{ "label": "选项按钮文字", "type": "negative", "hr_says": "HR的话", "candidate_reply": "候选人回复" }}
      ]
    }},
    {{ "options": [ ...同上4个... ] }},
    {{ "options": [ ...同上4个... ] }}
  ],
  "final_accept": "候选人接受offer的回复（20-40字）",
  "final_reject": "候选人婉拒offer的回复（30-50字）",
  "hr_blessing": "HR祝福语（20-30字）",
  "hr_regret": "HR遗憾回复（20-30字）"
}}

注意：
1. 对话要贴合候选人性格特点，口语化自然
2. 4个选项的type必须按 perfect/close/irrelevant/negative 顺序排列
3. 每轮4个选项应打乱排列，不要让玩家轻易猜出哪个最优
4. **长度控制**：同一轮4个选项的hr_says长度必须接近（都在30-40字），不要让好选项明显更长、差选项明显更短，否则玩家一眼就能猜出答案
5. **避免重复**：3轮共12个选项的label和hr_says必须各不相同，即使话题角度类似也要用完全不同的表述方式和切入点，不能出现相似的句式或雷同的内容"""


def build_hrd_letter_prompt(jd, scenario, jd_title):
    """生成 HRD 信件模板的 prompt。scenario 是场景类型。"""
    scenario_desc = {
        "great_passed": "优质候选人（quality 8-10）通过面试并接受了offer。面试官评价基本准确，决策合理。",
        "great_failed": "优质候选人（quality 8-10）面试中表现不佳或面试官评价偏低，未通过面试。这是一个遗憾的结果，可能是面试官眼光问题。",
        "great_rejected": "优质候选人（quality 8-10）通过面试但在谈薪环节拒绝了offer。面试官在谈薪环节表现不佳。",
        "mid_passed": "普通候选人（quality 4-6）通过面试并接受了offer。面试官评价基本准确，给予培养型录用。",
        "mid_failed": "普通候选人（quality 4-6）未通过面试。面试官正确识别了候选人的不足。",
        "bad_blocked": "低质候选人（quality 1-3）面试官试图强行通过，被HRD紧急拦截纠正。这是面试官判断严重失误，必须严厉批评。",
        "bad_failed": "低质候选人（quality 1-3）未通过面试。面试官正确识别了候选人的问题。",
    }

    return f"""你是一家公司的HRD（人力资源总监），请为"{jd_title}"岗位的面试结果生成一封模板信件。

# 场景
{scenario_desc[scenario]}

# 岗位JD
{jd}

# 信件要求
1. 以"HR你好："开头
2. 开头包含候选人名字占位符 {{name}} 和综合评分占位符 {{score}}
3. 必须包含三个评估维度的占位符，每个单独一行：
   - {{fitAssess}}（岗位匹配度评估）
   - {{potentialAssess}}（发展潜力评估）
   - {{valueAssess}}（性价比评估）
4. 根据场景写出对面试官决策的评价和对候选人的总结
5. {'如果是 bad_blocked 场景：严厉批评面试官试图强行通过低质候选人的严重失误' if scenario == 'bad_blocked' else '语气专业且有温度'}
6. 结尾给出建议（推进offer / 不予录用 / 纳入人才库等）
7. 不要使用markdown格式（**加粗**、#标题等），直接输出纯文本
8. 全文200-280字
9. 不要以"—— 你的HRD"结尾（信件模板不需要签名）

# 输出
直接输出信件文本，不要加任何前缀或代码块标记。信件中的候选人名字用 {{name}} 代替，评分用 {{score}} 代替。"""


# ─── API 调用 ───────────────────────────────────────────

def read_api_key():
    try:
        with open(APIKEY_PATH, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"错误：未找到 {APIKEY_PATH}，请先创建 apikey.txt")
        sys.exit(1)


def call_api(api_key, prompt, temperature=0.7):
    """调用 DeepSeek API，返回原始文本响应。"""
    import urllib.request
    import urllib.error

    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": 4096,
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    resp = urllib.request.urlopen(req, timeout=120)
    data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


def call_api_json(api_key, prompt, temperature=0.7):
    """调用 API 并解析 JSON，失败重试最多 MAX_RETRIES 次。"""
    for attempt in range(MAX_RETRIES):
        try:
            raw = call_api(api_key, prompt, temperature)
            # 去掉可能的 markdown 代码块包裹
            cleaned = raw
            if cleaned.startswith("```"):
                # 去掉 ```json 或 ``` 开头
                first_nl = cleaned.index("\n")
                cleaned = cleaned[first_nl + 1:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            return json.loads(cleaned)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"    JSON解析失败(第{attempt+1}次)：{e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
            else:
                print(f"    原始响应：{raw[:200]}...")
                raise
    return None


def call_api_text(api_key, prompt, temperature=0.7):
    """调用 API 并返回纯文本，失败重试。"""
    for attempt in range(MAX_RETRIES):
        try:
            raw = call_api(api_key, prompt, temperature)
            if raw:
                return raw
        except Exception as e:
            print(f"    调用失败(第{attempt+1}次)：{e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
            else:
                raise
    return ""


# ─── 数据生成 ───────────────────────────────────────────

def make_experience_shorthand(candidate):
    """从 experiences 数组构造 experience 简写字段。"""
    exps = candidate.get("experiences", [])
    if not exps:
        return {"company": "", "role": "", "years": 0, "desc": ""}
    first = exps[0]
    duties = first.get("duties", [])
    desc = duties[0] if duties else ""
    return {
        "company": first.get("company", ""),
        "role": first.get("role", ""),
        "years": first.get("years", 0),
        "desc": desc,
    }


def post_process_candidate(raw, tier):
    """后处理候选人数据：补充缺失字段。"""
    # 确保 experience 简写存在
    if "experience" not in raw:
        raw["experience"] = make_experience_shorthand(raw)

    # 补充 projects 的 description/highlights 兼容
    for p in raw.get("projects", []):
        if "description" not in p and "desc" in p:
            p["description"] = p["desc"]
        if "highlights" not in p:
            p["highlights"] = [p.get("desc", p.get("description", ""))]

    # 补充 highlights / redFlags
    if "highlights" not in raw:
        raw["highlights"] = []
    if "redFlags" not in raw:
        raw["redFlags"] = []

    # 补充 age（如果缺失，根据经验年限估算）
    if "age" not in raw:
        total_years = sum(e.get("years", 0) for e in raw.get("experiences", []))
        raw["age"] = int(22 + total_years + 2)  # 粗略估算

    return raw


def generate_candidates(api_key, jd, jd_idx):
    """生成一个岗位的全部候选人。"""
    tier_counts = [
        ("great", 2),
        ("great_mid", 1),
        ("mid", 1),
        ("mid_bad", 1),
        ("bad", 1),
    ]

    candidates = {}
    existing_names = []
    call_num = 0
    total_calls = sum(c for _, c in tier_counts)

    for tier, count in tier_counts:
        tier_list = []
        for i in range(count):
            call_num += 1
            print(f"  [candidates {call_num}/{total_calls}] 生成 {tier} 候选人...")
            prompt = build_resume_prompt(jd, tier, existing_names)
            raw = call_api_json(api_key, prompt, temperature=0.9)
            raw = post_process_candidate(raw, tier)
            existing_names.append(raw["name"])
            tier_list.append(raw)
            time.sleep(DELAY)
        candidates[tier] = tier_list

    return candidates


def generate_interview_questions(api_key, jd, candidates, jd_idx):
    """生成面试问题。great/mid/bad 各2套。"""
    questions = {}
    tier_map = {"great": "great", "mid": "mid", "bad": "bad"}

    # 从候选人中选取代表
    reps = {}
    for tier_key in ["great", "mid", "bad"]:
        if tier_key == "great":
            reps[tier_key] = candidates.get("great", candidates.get("great_mid", [{}]))
        elif tier_key == "mid":
            reps[tier_key] = candidates.get("mid", candidates.get("mid_bad", [{}]))
        else:
            reps[tier_key] = candidates.get("bad", [{}])

    call_num = 0
    total_calls = 6

    for tier_key in ["great", "mid", "bad"]:
        sets = []
        rep_list = reps[tier_key]
        for i in range(2):
            call_num += 1
            print(f"  [interviewQuestions {call_num}/{total_calls}] 生成 {tier_key} 第{i+1}套...")
            # 循环使用候选人
            cand = rep_list[i % len(rep_list)] if rep_list else {}
            prompt = build_interview_questions_prompt(cand, jd)
            result = call_api_json(api_key, prompt)
            sets.append(result)
            time.sleep(DELAY)
        questions[tier_key] = sets

    return questions


def build_batch_answer_prompt(candidate, jd, questions, quality):
    """一次性生成多条面试回答的 prompt（减少 API 调用次数）。"""
    exp_details = ""
    for e in candidate.get("experiences", []):
        duties_str = "；".join(e.get("duties", []))
        exp_details += f"{e['company']} {e['role']}（{e.get('duration', str(e.get('years', 0)) + '年')}）：{duties_str}\n  "

    proj_details = ""
    for p in candidate.get("projects", []):
        proj_details += f"{p['name']}（{p.get('role', '参与者')}）：{p.get('desc', p.get('description', ''))}\n  "

    exp = candidate.get("experience", {})
    exp_fallback = f"{exp.get('company','')} {exp.get('role','')}（{exp.get('years',0)}年）— {exp.get('desc','')}"

    style_section = ""
    if candidate.get("styleProfile"):
        style_section = (
            "\n# 你的说话风格\n"
            + candidate["styleProfile"]
            + '\n注意：按上述风格说话，但回答质量必须严格按照下方\u201c回答质量定位\u201d来，风格不改变回答好坏。'
        )

    q_list_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))

    return f"""你是求职者"{candidate['name']}"，正在参加面试。你必须严格基于自己的简历内容来回答。

# 你的完整简历
- 学历：{candidate['education']}{('（' + candidate['educationDetail'] + '）') if candidate.get('educationDetail') else ''}
- 工作经历：
  {exp_details.strip() or exp_fallback}
- 项目经历：
  {proj_details.strip() or '（无）'}
- 技能：{'、'.join(candidate.get('skills',[]))}
- 性格特点：{'、'.join(candidate.get('personalities',[]))}
{'- 自我评价：' + candidate['selfIntro'] if candidate.get('selfIntro') else ''}
{style_section}

# 面试岗位
{jd}

# 面试官的问题（共{len(questions)}个）
{q_list_text}

# 回答质量定位
{QUALITY_DESC[quality]}

# 回答要求
1. 对上面每个问题分别生成一条回答
2. 严格按照上述质量定位来回答，质量差异必须明显
3. 必须基于简历中的经历，不能瞎编
4. 绝对不能反问面试官
5. 每条回答60-120字，第一人称口语化
6. 不要使用markdown格式

# 输出格式
直接输出JSON数组，每个元素是一条回答文本：
["回答1", "回答2", ...]
不要其他文字。"""


def generate_interview_answers(api_key, jd, candidates, interview_questions, jd_idx):
    """生成面试回答。3 tier × 3 quality × 2 批 = 18 次 API 调用。"""
    answers = {}

    # 选取代表候选人
    reps = {}
    for tier_key in ["great", "mid", "bad"]:
        if tier_key == "great":
            pool = candidates.get("great", []) + candidates.get("great_mid", [])
        elif tier_key == "mid":
            pool = candidates.get("mid", []) + candidates.get("mid_bad", [])
        else:
            pool = candidates.get("bad", [])
        reps[tier_key] = pool[0] if pool else {}

    call_num = 0
    total_calls = 18

    for tier_key in ["great", "mid", "bad"]:
        cand = reps[tier_key]
        q_sets = interview_questions.get(tier_key, [[]])

        tier_answers = {}
        for quality in ["good", "mid", "bad"]:
            quality_answers = []
            for i in range(2):
                call_num += 1
                # 用第 i 套问题（或循环）
                q_list = q_sets[i % len(q_sets)] if q_sets else []
                # 取前3个或后3个问题
                if i == 0:
                    batch_qs = q_list[:3] if len(q_list) >= 3 else q_list or ["请介绍一下自己"]
                else:
                    batch_qs = q_list[3:6] if len(q_list) >= 6 else q_list[:3] if q_list else ["请介绍一下自己"]

                print(f"  [interviewAnswers {call_num}/{total_calls}] 生成 {tier_key}/{quality} 第{i+1}批（{len(batch_qs)}条）...")
                prompt = build_batch_answer_prompt(cand, jd, batch_qs, quality)
                result = call_api_json(api_key, prompt)

                if isinstance(result, list):
                    quality_answers.extend(result)
                else:
                    quality_answers.append(str(result))
                time.sleep(DELAY)

            tier_answers[quality] = quality_answers
        answers[tier_key] = tier_answers

    return answers


def generate_counter_questions(api_key, jd, candidates, jd_idx):
    """生成反问环节数据。great/mid/bad 各2个场景。"""
    counter_qs = {}

    reps = {}
    for tier_key in ["great", "mid", "bad"]:
        if tier_key == "great":
            pool = candidates.get("great", []) + candidates.get("great_mid", [])
        elif tier_key == "mid":
            pool = candidates.get("mid", []) + candidates.get("mid_bad", [])
        else:
            pool = candidates.get("bad", [])
        reps[tier_key] = pool

    call_num = 0
    total_calls = 6

    for tier_key in ["great", "mid", "bad"]:
        scenarios = []
        pool = reps[tier_key]
        for i in range(2):
            call_num += 1
            print(f"  [counterQuestions {call_num}/{total_calls}] 生成 {tier_key} 第{i+1}个...")
            cand = pool[i % len(pool)] if pool else {}
            prompt = build_counter_question_prompt(cand, jd)
            result = call_api_json(api_key, prompt)
            scenarios.append(result)
            time.sleep(DELAY)
        counter_qs[tier_key] = scenarios

    return counter_qs


def generate_negotiations(api_key, jd, candidates, jd_idx):
    """生成谈薪对话。great/mid/bad 各2段。生成后将候选人名替换为 {name}。"""
    negotiations = {}

    reps = {}
    for tier_key in ["great", "mid", "bad"]:
        if tier_key == "great":
            pool = candidates.get("great", []) + candidates.get("great_mid", [])
        elif tier_key == "mid":
            pool = candidates.get("mid", []) + candidates.get("mid_bad", [])
        else:
            pool = candidates.get("bad", [])
        reps[tier_key] = pool

    call_num = 0
    total_calls = 6

    for tier_key in ["great", "mid", "bad"]:
        dialogues = []
        pool = reps[tier_key]
        for i in range(2):
            call_num += 1
            print(f"  [negotiations {call_num}/{total_calls}] 生成 {tier_key} 第{i+1}段...")
            cand = pool[i % len(pool)] if pool else {}
            prompt = build_negotiation_prompt(cand, jd)
            result = call_api_json(api_key, prompt)

            # 将候选人名替换为 {name}
            cand_name = cand.get("name", "")
            if cand_name:
                result_str = json.dumps(result, ensure_ascii=False)
                result_str = result_str.replace(cand_name, "{name}")
                result = json.loads(result_str)

            dialogues.append(result)
            time.sleep(DELAY)
        negotiations[tier_key] = dialogues

    return negotiations


def generate_hrd_letters(api_key, jd, jd_idx, jd_title):
    """生成 HRD 信件模板。7个场景各2封 = 14次调用。"""
    scenarios = [
        "great_passed", "great_failed", "great_rejected",
        "mid_passed", "mid_failed",
        "bad_blocked", "bad_failed",
    ]

    letters = {}
    call_num = 0
    total_calls = 14

    for scenario in scenarios:
        letter_list = []
        for i in range(2):
            call_num += 1
            print(f"  [hrdLetters {call_num}/{total_calls}] 生成 {scenario} 第{i+1}封...")
            prompt = build_hrd_letter_prompt(jd, scenario, jd_title)
            text = call_api_text(api_key, prompt, temperature=0.7)
            # 清理可能的markdown包裹
            text = text.strip()
            if text.startswith("```"):
                first_nl = text.index("\n")
                text = text[first_nl + 1:]
            if text.endswith("```"):
                text = text[:-3].strip()
            letter_list.append(text)
            time.sleep(DELAY)
        letters[scenario] = letter_list

    return letters


# ─── 输出 ───────────────────────────────────────────────

def js_serialize(obj, indent=2):
    """将 Python 对象序列化为 JS 风格的字符串。"""
    return json.dumps(obj, ensure_ascii=False, indent=indent)


def build_output(all_data):
    """构建完整的 localData.js 内容。"""
    lines = [
        "/**",
        " * 本地数据库 — 3个预设JD的全量离线数据",
        " * 结构：LOCAL_DATA[jdIndex] = { candidates, interviewQuestions, interviewAnswers, counterQuestions, negotiations, hrdLetters, weeklyReports }",
        " * 由 generate_data.py 自动生成",
        " */",
        "const LOCAL_DATA = {",
    ]

    jd_indices = sorted(all_data.keys())
    for idx, jd_idx in enumerate(jd_indices):
        data = all_data[jd_idx]
        # 序列化整个岗位数据
        jd_json = json.dumps(data, ensure_ascii=False, indent=2)
        lines.append(f"  {jd_idx}: {jd_json}" + ("," if idx < len(jd_indices) - 1 else ""))

    lines.append("};")
    return "\n".join(lines)


# ─── 主流程 ─────────────────────────────────────────────

def generate_one_jd(api_key, jd_idx):
    """为一个岗位生成全部数据。"""
    jd_info = JOB_TEMPLATES[jd_idx]
    jd = jd_info["description"]
    jd_title = jd_info["title"]
    total_jds = 3

    print(f"\n{'='*60}")
    print(f"[岗位{jd_idx+1}/{total_jds}] {jd_title}")
    print(f"{'='*60}")

    # ① candidates
    print("\n--- ① 生成候选人简历 ---")
    candidates = generate_candidates(api_key, jd, jd_idx)

    # ② interviewQuestions
    print("\n--- ② 生成面试问题 ---")
    interview_questions = generate_interview_questions(api_key, jd, candidates, jd_idx)

    # ③ interviewAnswers
    print("\n--- ③ 生成面试回答 ---")
    interview_answers = generate_interview_answers(api_key, jd, candidates, interview_questions, jd_idx)

    # ④ counterQuestions
    print("\n--- ④ 生成反问环节 ---")
    counter_questions = generate_counter_questions(api_key, jd, candidates, jd_idx)

    # ⑤ negotiations
    print("\n--- ⑤ 生成谈薪对话 ---")
    negotiations = generate_negotiations(api_key, jd, candidates, jd_idx)

    # ⑥ hrdLetters
    print("\n--- ⑥ 生成HRD信件 ---")
    hrd_letters = generate_hrd_letters(api_key, jd, jd_idx, jd_title)

    # ⑦ weeklyReports — 输出空数组
    print("\n--- ⑦ weeklyReports（跳过，输出空数组）---")
    weekly_reports = []

    return {
        "candidates": candidates,
        "interviewQuestions": interview_questions,
        "interviewAnswers": interview_answers,
        "counterQuestions": counter_questions,
        "negotiations": negotiations,
        "hrdLetters": hrd_letters,
        "weeklyReports": weekly_reports,
    }


def main():
    parser = argparse.ArgumentParser(description="通过 DeepSeek API 生成 localData.js")
    parser.add_argument("--jd", type=int, default=None,
                        help="只生成指定岗位（0/1/2），不指定则生成全部")
    args = parser.parse_args()

    api_key = read_api_key()
    print(f"API Key: {api_key[:8]}...{api_key[-4:]}")

    # 确定要生成的岗位
    if args.jd is not None:
        if args.jd < 0 or args.jd >= len(JOB_TEMPLATES):
            print(f"错误：--jd 参数必须在 0-{len(JOB_TEMPLATES)-1} 之间")
            sys.exit(1)
        jd_indices = [args.jd]
    else:
        jd_indices = list(range(len(JOB_TEMPLATES)))

    # 如果只生成部分岗位，先读取已有数据
    all_data = {}
    if args.jd is not None and os.path.exists(OUTPUT_PATH):
        print(f"读取已有 localData.js 以保留其他岗位数据...")
        all_data = load_existing_data(OUTPUT_PATH)

    # 生成
    start_time = time.time()
    for jd_idx in jd_indices:
        all_data[jd_idx] = generate_one_jd(api_key, jd_idx)

    # 写入
    print(f"\n{'='*60}")
    print(f"写入 {OUTPUT_PATH}...")
    output = build_output(all_data)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(output)

    elapsed = time.time() - start_time
    print(f"完成！耗时 {elapsed:.0f} 秒")
    print(f"文件已写入：{OUTPUT_PATH}")


def load_existing_data(path):
    """从已有的 localData.js 中解析数据。

    使用 Node.js 来解析 JS 对象（最可靠的方式）。
    如果 Node 不可用，则尝试 JSON 解析。
    """
    import subprocess

    try:
        # 方法1：用 Node.js 执行 JS 并输出 JSON
        # 将 const 替换为 var 以便 eval 后可访问
        node_script = (
            "const fs = require('fs');"
            f"let code = fs.readFileSync('{path}', 'utf8');"
            "code = code.replace(/^const /gm, 'var ');"
            "eval(code);"
            "process.stdout.write(JSON.stringify(LOCAL_DATA));"
        )
        result = subprocess.run(
            ["node", "-e", node_script],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout.strip())
            return {int(k): v for k, v in data.items()}
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass  # Node not available, try JSON fallback
    except Exception as e:
        pass

    try:
        # 方法2：如果是本脚本生成的文件（JSON格式key），直接解析
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        start = content.index("{")
        end = content.rindex("};")
        json_str = content[start:end + 1]
        data = json.loads(json_str)
        return {int(k): v for k, v in data.items()}
    except Exception as e:
        print(f"警告：无法解析已有 localData.js（{e}），将重新生成全部数据")
        return {}


if __name__ == "__main__":
    main()
