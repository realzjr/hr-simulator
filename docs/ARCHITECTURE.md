# HR模拟器 - 架构文档

## 设计思路
纯前端HTML/CSS/JS游戏，无构建工具，无框架依赖。通过 `<script>` 标签按顺序加载，全局变量通信。

## 架构决策
- **无模块化打包**：面向简单场景，script标签加载，全局命名空间
- **数据与逻辑完全分离**：所有可修改内容（数据池、AI提示词、JD模板、关键词）集中在 `data/` 目录，逻辑代码只引用不硬编码
- **场景模式**：通过 `.scene.active` CSS类切换页面，单页应用模式

## 文件依赖关系
```
index.html
  ├── data/*.js              ← 纯数据 + 提示词，无依赖，随时可改
  ├── avatars/avatarList.js
  ├── js/api.js              ← DeepSeek API封装
  ├── js/state.js
  ├── js/scene.js
  ├── js/candidateFactory.js ← 引用 PROMPTS.generateResumes()
  ├── js/menu.js             ← 引用 PROMPTS.generateJD()
  ├── js/resumeRender.js
  ├── js/resumeInteract.js
  ├── js/interviewRender.js  ← 引用 PROMPTS.generateInterviewQuestion()
  ├── js/interviewLogic.js   ← 引用 PROMPTS.generateInterviewAnswer()
  ├── js/resultLogic.js
  ├── js/resultRender.js
  └── js/main.js
```

## 可修改内容速查

修改数据或提示词 **只需编辑 `data/` 目录下对应文件**，无需动任何逻辑代码：

| 要改什么 | 去哪改 |
|----------|--------|
| AI提示词（生成JD/简历/问题/回答） | `data/prompts.js` |
| JD预设模板 & 关键词池 | `data/jobTemplates.js` |
| 姓名池 | `data/names.js` |
| 技能池 | `data/skills.js` |
| 工作经历池 | `data/experiences.js` |
| 学历池 | `data/educations.js` |
| 性格特点池 | `data/personalities.js` |
| 面试问题池 | `data/interviewQuestions.js` |
| 面试回答池（本地fallback） | `data/interviewAnswers.js` |
| HR等级评价文案 | `data/evaluations.js` |
| 头像 | `avatars/` 目录 + `avatars/avatarList.js` |

## 扩展约定
- 新增数据：在对应 `data/` 文件的数组/对象中追加
- 修改提示词：编辑 `data/prompts.js` 中对应函数的模板字符串
- 新增头像：放SVG到 `avatars/`，在 `avatarList.js` 注册
- 新增场景：在 `index.html` 加 scene div，`js/scene.js` 中支持新名称
- 命名规范：数据常量全大写，函数camelCase，CSS用BEM-like命名
