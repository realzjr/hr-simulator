/**
 * 全局游戏状态
 */
const GameState = {
  // 模式设置（跨局保留，reset不清除）
  mode: 'local',               // 'local' | 'online'
  apiKey: '',                  // 用户输入的API Key（在线模式直连用）
  apiBaseUrl: '',              // 自定义API地址（可选，仅自定义provider时用）
  apiProvider: 'deepseek',     // 选中的API供应商ID
  currentJDIndex: -1,          // 选中的预设JD下标（0/1/2），自定义为-1

  currentScene: 'menu',        // menu | loading | resume | interview | feedback | hrd-review | result
  currentJD: '',               // 当前使用的职位描述
  candidates: [],              // 本轮所有候选人
  passed: [],                  // 通过简历筛选的候选人
  currentResumeIndex: 0,       // 当前简历索引
  currentInterviewIndex: 0,    // 当前面试候选人索引
  interviewDialogs: {},        // { candidateId: [{question, answer}, ...] }
  feedbackScores: {},          // { candidateId: {fit, potential, value, offerGiven, score, hrdLetter} }
  counterQuestionBonus: {},    // { candidateId: +5|0|-5 }
  negotiationResults: {},      // { candidateId: { accepted, finalSalary, willingness } }
  questionsAsked: {},          // { candidateId: [questionId, ...] }
  scoldingCount: 0,            // HRD质问次数（2次强制结束游戏）
  offerRejectCount: 0,         // Offer被拒次数（2次强制毕业 → "预算铁公鸡"）
  talentLostCount: 0,          // 优质候选人被放走次数（2次强制毕业 → "面试终结者"）
  hrdWarningCount: 0,          // HRD私下警告次数（2次强制毕业 → "底线橡皮筋"）
  forcedGameOver: false,       // 是否被强制毕业
  forcedGameOverReason: '',    // 'scolding' | 'offer_rejected' | 'talent_lost'
  totalScore: 0,
  grade: '',                   // 称号
  weeklyReport: '',            // 绩效周报文本
  playerGender: '',            // 'male' | 'female'（引导页选择，reset不清除）
  hrStyle: '',                 // 'male_mature' | 'male_youthful' | 'female_mature' | 'female_youthful'（引导页选择，reset不清除）

  reset() {
    this.currentScene = 'menu';
    this.currentJDIndex = -1;
    this.currentJD = '';
    this.candidates = [];
    this.passed = [];
    this.currentResumeIndex = 0;
    this.currentInterviewIndex = 0;
    this.interviewDialogs = {};
    this.feedbackScores = {};
    this.counterQuestionBonus = {};
    this.negotiationResults = {};
    this.questionsAsked = {};
    this.scoldingCount = 0;
    this.offerRejectCount = 0;
    this.talentLostCount = 0;
    this.hrdWarningCount = 0;
    this.forcedGameOver = false;
    this.forcedGameOverReason = '';
    this.totalScore = 0;
    this.grade = '';
    this.weeklyReport = '';
    this._negoDialoguePromise = null;
    this._weeklyReportPromise = null;
  },
};

/** 根据玩家性别返回对应HR头像路径 */
function getHRAvatar() {
  return GameState.playerGender === 'female' ? HR_AVATAR_FEMALE : HR_AVATAR_MALE;
}
