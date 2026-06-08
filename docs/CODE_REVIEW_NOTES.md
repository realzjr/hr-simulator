# HR模拟器 — Code Review 备忘录

> 本文档记录**设计意图中的行为**和**已排查确认无需修复的模式**，  
> 防止后续 review 时将正常设计误判为 bug。每次 review 后更新。

---

## 一、故意设计（看起来像 bug 但不是）

### 1. Tutorial 只生成 1 颗星 (`feedbackLogic.js:47`)
```js
for (let n = 1; n <= 1; n++) { ... }
```
- **设计意图**：教程只需演示"半星/整星"两种点击方式，1 颗星足够
- 动画序列只有 `[0.5, 1]` 两步，不需要 5 颗星

### 2. `_localQuestionPool.splice(0, count)` 破坏性消费问题池 (`interviewRender.js:235`)
- **设计意图**：每次取出的问题不再放回，防止同一问题重复出现
- 问题池在每位候选人面试开始时重新构建，不会跨候选人累积

### 3. Event listener 在 feedback 场景不会堆叠
- `renderFeedback()` 用 `container.innerHTML = ...` 完全重建 DOM
- 旧元素上的 listener 随 DOM 销毁被 GC，新 listener 绑定到新元素
- **仅适用于 feedback 场景**，其他场景需要单独确认

### 4. API 调用顺序：先 API 再 local fallback (`interviewLogic.js:147-152`)
- 看起来本地模式会白跑一次 API 调用
- **实际**：`api.js:113` 在本地模式直接 `return null`，无网络开销
- 在线模式则优先用 AI 生成，API 失败才 fallback 到本地数据

### 5. `_pollTimers` 跨文件引用 (`interviewLogic.js:46` ← `interviewRender.js:44`)
- 声明在 `interviewRender.js`，使用在 `interviewLogic.js`
- 因为两个文件都通过 `<script>` 加载，`let` 在模块顶层实际是全局的
- 这是该项目"零框架全局变量通信"架构的一部分，不要改成 import/export

### 6. 候选人质量分档阈值 (`quality >= 7` → great, `>= 4` → mid, `< 4` → bad)
- 出现在 `interviewLogic.js`, `interviewRender.js`, `feedbackLogic.js` 等多处
- **与 `candidateFactory.js` 生成逻辑一致**：本地模式按 2 高(q=8-9) + 2 中(q=4-6) + 1 低(q=1-3) 抽取
- 分界线故意放在 7 和 4，不要改成 5

### 7. `proceedWithDecision` 用 `onclick =` 而非 `addEventListener` (`feedbackLogic.js:250,256`)
- **设计意图**：决策按钮每次只需一个 handler，`onclick =` 自动覆盖旧 handler
- 避免 `addEventListener` 堆叠多个 handler 的风险

### 8. HRD 评分中低质量候选人的计分逻辑 (`feedbackLogic.js:551-556`)
- `hrdBlocked` → -5 分（HRD 替你挡了，但你没自己识别出来，扣分）
- `offerGiven && !hrdBlocked` → -5 分（你给了不该给的 offer）
- `!offerGiven` → +5 分（你正确拒绝了低质量候选人）
- **设计意图**：鼓励玩家主动做正确判断，不能依赖 HRD 兜底

---

## 二、已修复的历史 Bug（留档避免回退）

### v1.4 修复

| 位置 | Bug | 修复方式 |
|------|-----|---------|
| `interviewLogic.js:123-126` | Q&A 子串匹配过于宽松，短问题误匹配 | 精确匹配优先 + 子串匹配要求≥8字 |
| `interviewLogic.js:195` | `finishCandidateInterview` 无空值防御 | 加 `if (!candidate) return` |
| `feedbackLogic.js:447` | `enterHrdReviewAfterNegotiation` 解构可能为 undefined 的对象 | 加默认值兜底 |
| `hrdReviewRender.js` 多处 | HRD 信件/周报定时器未注册到场景清理系统 | 全部用 `registerSceneTimer()` 包装 |
| `interviewLogic.js` + `interviewRender.js` | 本地模式问答错配（问题和回答来自不同数据源，无映射关系） | 新增 `interviewQA` 问答绑定结构 |

### v1.3 及更早修复

| 位置 | Bug | 修复方式 |
|------|-----|---------|
| `build.gradle` | versionCode/versionName 从未更新，安卓显示 1.0 | 每次发版必须递增 versionCode |
| `hrDialogue.js` | 同事消息过长、含阴阳词汇、不够幽默 | 多轮迭代至短小精悍 + 真人语感 |

---

## 三、Review 时需关注的风险区域

### 定时器管理
- **必须用 `registerSceneTimer()` 注册** 所有 `setTimeout` / `setInterval`
- 否则场景切换后定时器继续执行，操作已不存在的 DOM
- `interviewLogic.js` 有自己的 `_scrollTimer` 管理逻辑（在 `interruptOngoing` 中清理）

### 数据结构变更
- `localData.js` 现有三套面试数据结构（按优先级）：
  1. `interviewQA[tier]` — 新的问答绑定结构（12 对 × 3 档 × 3 JD = 108 组）
  2. `interviewAnswers[tier][quality]` — 旧的分离式回答池（兼容保留）
  3. `PROMPTS.answerFallbacks[quality]` — 终极兜底
- 新增数据必须同步更新 `pre-build-check.sh` 的验证逻辑

### APK 同步
- `game/` → `apk-build/www/` 分目录 rsync，**不能用 `--delete`**
- `apk-config.js` 和 `index.html` 是 APK 专有文件，同步前备份恢复
- 每次发版更新 `build.gradle` 的 `versionCode`（+1）和 `versionName`

### 谈薪场景定时器
- `negotiationLogic.js` 的 `setTimeout` 未注册到 `registerSceneTimer`
- 目前无问题（用户主动交互驱动，场景切换时 DOM 已重建）
- 但如果未来加入自动化逻辑，需要补注册

---

## 四、架构约束提醒

- **零框架零构建**：不能引入 npm 包或模块系统，所有 JS 通过 `<script>` 顺序加载
- **全局变量通信**：`GameState`, `LOCAL_DATA`, `HR_DIALOGUE` 等都是全局的，这是设计选择
- **本地/在线双模式**：每个 AI 调用点都有本地 fallback，`api.js` 在本地模式直接返回 null
- **DeepSeek 优先**：在线模式默认 DeepSeek API，支持 OpenAI/Claude 兼容接口切换
