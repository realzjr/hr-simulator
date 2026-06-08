#!/bin/bash
# HR模拟器 — 打包前预检脚本
# 用法: ./pre-build-check.sh
# 退出码: 0=全部通过  1=存在致命错误

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
GAME="$DIR/game"
APK_WWW="$DIR/apk-build/www"

FATAL=0
WARN=0

pass() { echo "  [✓] $1"; }
fail() { echo "  [✗] $1"; FATAL=$((FATAL+1)); }
warn() { echo "  [!] $1"; WARN=$((WARN+1)); }
detail() { echo "      $1"; }

echo ""
echo "  🔍 HR模拟器 打包前检查"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ═══════════════════════════════════════
# 第一层：语法检查（致命级）
# ═══════════════════════════════════════
syntax_ok=0
syntax_fail=0
syntax_errors=""

for f in "$GAME"/data/*.js "$GAME"/js/*.js; do
  if ! err=$(node --check "$f" 2>&1); then
    syntax_fail=$((syntax_fail+1))
    rel="${f#$DIR/}"
    syntax_errors="$syntax_errors\n      $rel: $err"
  else
    syntax_ok=$((syntax_ok+1))
  fi
done

total=$((syntax_ok + syntax_fail))
if [ $syntax_fail -eq 0 ]; then
  pass "语法检查 — $total 个文件全部通过"
else
  fail "语法检查 — $syntax_fail 个文件有语法错误"
  echo -e "$syntax_errors"
fi

# ═══════════════════════════════════════
# 第二层：关键全局变量（致命级）
# ═══════════════════════════════════════
globals_result=$(node -e "
// 模拟浏览器全局环境
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ctx = vm.createContext({
  console, setTimeout, setInterval, clearTimeout, clearInterval,
  Math, Date, JSON, Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  Map, Set, Promise, RegExp, Error, TypeError,
  document: { addEventListener() {} },
  window: {},
  fetch: () => Promise.resolve(),
});

const dataDir = path.join('$GAME', 'data');
const jsDir = path.join('$GAME', 'js');

// 按 index.html 顺序加载 data 文件
const dataFiles = [
  'names.js','skills.js','experiences.js','educations.js','personalities.js',
  'interviewQuestions.js','hrTips.js','evaluations.js','jobTemplates.js',
  'prompts.js','localData.js','hrDialogue.js'
];
function loadFile(p, name) {
  try {
    let code = fs.readFileSync(p, 'utf8');
    // vm.runInContext 中 const/let 不挂到 context，需替换为 var
    code = code.replace(/^(const|let) /gm, 'var ');
    vm.runInContext(code, ctx, {filename: name});
  } catch(e) { /* 语法错误已在第一层捕获 */ }
}
for (const f of dataFiles) { loadFile(path.join(dataDir, f), f); }

// 加载 state.js
loadFile(path.join(jsDir, 'state.js'), 'state.js');

// 检查全局变量
const checks = [];
const ok = (name) => checks.push({name, ok:true});
const ng = (name, reason) => checks.push({name, ok:false, reason});

if (typeof ctx.LOCAL_DATA === 'object' && ctx.LOCAL_DATA !== null && [0,1,2].every(i => ctx.LOCAL_DATA[i])) ok('LOCAL_DATA');
else ng('LOCAL_DATA', '缺失或不含 key 0/1/2');

if (typeof ctx.HR_DIALOGUE === 'object' && ctx.HR_DIALOGUE !== null &&
    ['male_mature','male_youthful','female_mature','female_youthful'].every(k => ctx.HR_DIALOGUE[k]))
  ok('HR_DIALOGUE');
else ng('HR_DIALOGUE', '缺失或不含 4 种风格');

if (typeof ctx.PROMPTS === 'object' && ctx.PROMPTS !== null && typeof ctx.PROMPTS.generateInterviewAnswer === 'function')
  ok('PROMPTS');
else ng('PROMPTS', '缺失或缺少 generateInterviewAnswer');

if (typeof ctx.GameState === 'object' && ctx.GameState !== null && typeof ctx.GameState.reset === 'function')
  ok('GameState');
else ng('GameState', '缺失或缺少 reset()');

if (Array.isArray(ctx.NAMES) && ctx.NAMES.length > 0) ok('NAMES');
else ng('NAMES', '缺失或为空');

if (Array.isArray(ctx.SKILLS) && ctx.SKILLS.length > 0) ok('SKILLS');
else ng('SKILLS', '缺失或为空');

console.log(JSON.stringify(checks));
" 2>/dev/null || echo '[]')

globals_pass=$(echo "$globals_result" | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const pass=d.filter(c=>c.ok).length;
  const fails=d.filter(c=>!c.ok);
  if(fails.length===0) console.log('PASS|'+pass);
  else console.log('FAIL|'+fails.map(f=>f.name+': '+f.reason).join('\\n      '));
")

if [[ "$globals_pass" == PASS* ]]; then
  count="${globals_pass#PASS|}"
  pass "全局变量 — LOCAL_DATA, HR_DIALOGUE, PROMPTS 等 $count 项正常"
else
  msg="${globals_pass#FAIL|}"
  fail "全局变量 — 部分变量异常"
  echo -e "      $msg"
fi

# ═══════════════════════════════════════
# 第三层：数据结构完整性（致命级）
# ═══════════════════════════════════════
struct_result=$(node -e "
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ctx = vm.createContext({
  console, setTimeout, setInterval, clearTimeout, clearInterval,
  Math, Date, JSON, Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  Map, Set, Promise, RegExp, Error, TypeError,
  document: { addEventListener() {} }, window: {}, fetch: () => Promise.resolve(),
});

const dataDir = path.join('$GAME', 'data');
const dataFiles = [
  'names.js','skills.js','experiences.js','educations.js','personalities.js',
  'interviewQuestions.js','hrTips.js','evaluations.js','jobTemplates.js',
  'prompts.js','localData.js','hrDialogue.js'
];
for (const f of dataFiles) {
  try {
    let code = fs.readFileSync(path.join(dataDir, f), 'utf8');
    code = code.replace(/^(const|let) /gm, 'var ');
    vm.runInContext(code, ctx, {filename:f});
  } catch(e) {}
}

const errors = [];

// LOCAL_DATA 结构
for (let i = 0; i < 3; i++) {
  const d = ctx.LOCAL_DATA && ctx.LOCAL_DATA[i];
  if (!d) { errors.push('LOCAL_DATA['+i+'] 不存在'); continue; }
  if (!d.candidates) { errors.push('LOCAL_DATA['+i+'].candidates 缺失'); continue; }
  const c = d.candidates;
  for (const tier of ['great','mid','bad']) {
    if (!Array.isArray(c[tier]) || c[tier].length === 0)
      errors.push('LOCAL_DATA['+i+'].candidates.'+tier+' 为空或缺失');
  }
  if (!d.interviewQuestions) errors.push('LOCAL_DATA['+i+'].interviewQuestions 缺失');
  if (!d.interviewAnswers) errors.push('LOCAL_DATA['+i+'].interviewAnswers 缺失');
  // 新 interviewQA 结构检查
  const qa = d.interviewQA;
  if (!qa) { errors.push('LOCAL_DATA['+i+'].interviewQA 缺失'); }
  else {
    for (const tier of ['great','mid','bad']) {
      const pool = qa[tier];
      if (!Array.isArray(pool) || pool.length < 10)
        errors.push('LOCAL_DATA['+i+'].interviewQA.'+tier+' 不足 10 组');
      else {
        for (let j = 0; j < pool.length; j++) {
          const p = pool[j];
          if (!p.q || !p.good || !p.mid || !p.bad)
            errors.push('LOCAL_DATA['+i+'].interviewQA.'+tier+'['+j+'] 缺少 q/good/mid/bad 字段');
        }
      }
    }
  }
}

// HR_DIALOGUE 结构
const styles = ['male_mature','male_youthful','female_mature','female_youthful'];
for (const s of styles) {
  const d = ctx.HR_DIALOGUE && ctx.HR_DIALOGUE[s];
  if (!d) { errors.push('HR_DIALOGUE.'+s+' 缺失'); continue; }
  const r = d.interviewerResponses;
  if (!r || typeof r !== 'object') {
    errors.push('HR_DIALOGUE.'+s+'.interviewerResponses 缺失');
    continue;
  }
  if (Array.isArray(r)) {
    errors.push('HR_DIALOGUE.'+s+'.interviewerResponses 仍为扁平数组，应为 {good,mid,bad}');
    continue;
  }
  for (const q of ['good','mid','bad']) {
    if (!Array.isArray(r[q]) || r[q].length < 3)
      errors.push('HR_DIALOGUE.'+s+'.interviewerResponses.'+q+' 不足 3 条');
  }
}

if (errors.length === 0) console.log('PASS|3 组 JD 数据完整，HR 对话分档正常');
else console.log('FAIL|' + errors.join('\\n      '));
" 2>/dev/null || echo 'FAIL|node 执行失败')

if [[ "$struct_result" == PASS* ]]; then
  msg="${struct_result#PASS|}"
  pass "数据结构 — $msg"
else
  msg="${struct_result#FAIL|}"
  fail "数据结构 — 完整性校验失败"
  echo -e "      $msg"
fi

# ═══════════════════════════════════════
# 第四层：开发/打包环境同步（警告级）
# ═══════════════════════════════════════
sync_diff=0
sync_total=0
sync_details=""

if [ -d "$APK_WWW" ]; then
  while IFS= read -r rel; do
    # 跳过开发环境独有文件
    [[ "$rel" == "./apikey.txt" || "$rel" == "./server.py" ]] && continue

    if [ -f "$APK_WWW/$rel" ]; then
      sync_total=$((sync_total+1))
      # 跳过 index.html（两边本来就不同）
      [[ "$rel" == "./index.html" ]] && continue
      if ! diff -q "$GAME/$rel" "$APK_WWW/$rel" > /dev/null 2>&1; then
        sync_diff=$((sync_diff+1))
        sync_details="$sync_details\n      ${rel} 内容不一致"
      fi
    fi
  done < <(cd "$GAME" && find . -type f | sort)

  # 检查 APK 独有关键文件
  if [ ! -f "$APK_WWW/js/apk-config.js" ]; then
    sync_diff=$((sync_diff+1))
    sync_details="$sync_details\n      apk-build/www/js/apk-config.js 缺失（可能被 rsync 删除）"
  fi
  for lib in html2canvas.min.js qrcode.min.js; do
    if [ ! -f "$APK_WWW/lib/$lib" ]; then
      sync_diff=$((sync_diff+1))
      sync_details="$sync_details\n      apk-build/www/lib/$lib 缺失"
    fi
  done

  if [ $sync_diff -eq 0 ]; then
    pass "环境同步 — game/ 与 apk-build/www/ 共 $sync_total 个文件一致"
  else
    warn "环境同步 — 发现 $sync_diff 处不一致"
    echo -e "$sync_details"
  fi
else
  warn "环境同步 — apk-build/www/ 目录不存在，跳过"
fi

# ═══════════════════════════════════════
# 第五层：编码安全（警告级）
# ═══════════════════════════════════════
curly_files=""
curly_count=0

for f in "$GAME"/data/*.js "$GAME"/js/*.js; do
  # 检查弯引号 U+201C U+201D U+2018 U+2019
  if grep -Pn '[\x{201c}\x{201d}\x{2018}\x{2019}]' "$f" > /dev/null 2>&1; then
    rel="${f#$DIR/}"
    lines=$(grep -Pn '[\x{201c}\x{201d}\x{2018}\x{2019}]' "$f" | head -5)
    curly_files="$curly_files\n      $rel"
    while IFS= read -r line; do
      curly_files="$curly_files\n        $line"
    done <<< "$lines"
    curly_count=$((curly_count+1))
  fi
done

if [ $curly_count -eq 0 ]; then
  pass "编码安全 — 未发现异常 Unicode 引号"
else
  warn "编码安全 — $curly_count 个文件含弯引号（可能导致语法错误）"
  echo -e "$curly_files"
fi

# ═══════════════════════════════════════
# 第六层：资源完整性（警告级）
# ═══════════════════════════════════════
avatar_missing=0
avatar_details=""

for i in $(seq 1 32); do
  if [ ! -f "$GAME/avatars/avatar${i}.svg" ]; then
    avatar_missing=$((avatar_missing+1))
    avatar_details="$avatar_details\n      avatar${i}.svg 缺失"
  fi
done
for hr in hr_male.svg hr_female.svg; do
  if [ ! -f "$GAME/avatars/$hr" ]; then
    avatar_missing=$((avatar_missing+1))
    avatar_details="$avatar_details\n      $hr 缺失"
  fi
done

if [ $avatar_missing -eq 0 ]; then
  pass "资源完整 — 34 个头像文件齐全"
else
  warn "资源完整 — $avatar_missing 个头像缺失"
  echo -e "$avatar_details"
fi

# ═══════════════════════════════════════
# 汇总
# ═══════════════════════════════════════
echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FATAL -gt 0 ]; then
  echo "  ❌ 存在 $FATAL 个致命错误，请修复后重试"
  [ $WARN -gt 0 ] && echo "  ⚠️  另有 $WARN 个警告"
  echo ""
  exit 1
elif [ $WARN -gt 0 ]; then
  echo "  ⚠️  全部功能检查通过，但有 $WARN 个警告建议处理"
  echo ""
  exit 0
else
  echo "  ✅ 全部通过，可以打包！"
  echo ""
  exit 0
fi
