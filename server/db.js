const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DATA_FILE = path.join(DB_DIR, 'db.json');

// 考试分类配置：5 大类，每类下多个考试，每个考试含多个科目
const EXAM_GROUPS = [
  {
    id: 'access',
    name: '准入类职业资格',
    desc: '热门 · 全部需考试',
    icon: '🎓',
    color: '#667eea',
    exams: [
      { name: '教师资格证（小学）', subjects: ['综合素质', '教育教学知识与能力'] },
      { name: '教师资格证（中学）', subjects: ['综合素质', '教育知识与能力', '学科知识与教学能力'] },
      { name: '法律职业资格（法考）', subjects: ['客观题卷一', '客观题卷二'] },
      { name: '一级建造师', subjects: ['建设工程经济', '建设工程法规及相关知识', '建设工程项目管理', '专业工程管理与实务'] },
      { name: '二级建造师', subjects: ['建设工程施工管理', '建设工程法规及相关知识', '专业工程管理与实务'] },
      { name: '一级造价工程师', subjects: ['建设工程造价管理', '建设工程计价', '建设工程技术与计量', '建设工程造价案例分析'] },
      { name: '二级造价工程师', subjects: ['建设工程造价管理基础知识', '建设工程计量与计价实务'] },
      { name: '一级注册消防工程师', subjects: ['消防安全技术实务', '消防安全技术综合能力', '消防安全案例分析'] },
      { name: '执业药师（药学）', subjects: ['药学专业知识（一）', '药学专业知识（二）', '药事管理与法规', '药学综合知识与技能'] },
      { name: '执业药师（中药学）', subjects: ['中药学专业知识（一）', '中药学专业知识（二）', '药事管理与法规', '中药学综合知识与技能'] },
      { name: '注册会计师 CPA', subjects: ['会计', '审计', '财务成本管理', '公司战略与风险管理', '经济法', '税法'] },
      { name: '护士执业资格', subjects: ['专业实务', '实践能力'] },
      { name: '医师资格（临床）', subjects: ['基础医学综合', '医学人文综合', '临床医学综合', '预防医学综合'] },
      { name: '导游资格证', subjects: ['政策与法律法规', '导游业务', '全国导游基础知识', '地方导游基础知识'] },
      { name: '注册安全工程师', subjects: ['安全生产法律法规', '安全生产管理', '安全生产技术基础', '安全生产专业实务'] },
      { name: '二级注册消防工程师', subjects: ['消防安全技术综合能力', '消防安全案例分析'] }
    ]
  },
  {
    id: 'level',
    name: '水平评价类职业资格',
    desc: '高频 · 全部需考试',
    icon: '📊',
    color: '#f59e0b',
    exams: [
      { name: '初级会计职称', subjects: ['初级会计实务', '经济法基础'] },
      { name: '中级会计职称', subjects: ['中级会计实务', '财务管理', '经济法'] },
      { name: '高级会计职称', subjects: ['高级会计实务'] },
      { name: '初级经济师（人力）', subjects: ['经济基础知识', '人力资源管理专业知识与实务'] },
      { name: '初级经济师（工商）', subjects: ['经济基础知识', '工商管理专业知识与实务'] },
      { name: '中级经济师（人力）', subjects: ['经济基础知识', '人力资源管理专业知识与实务'] },
      { name: '中级经济师（工商）', subjects: ['经济基础知识', '工商管理专业知识与实务'] },
      { name: '税务师', subjects: ['税法（一）', '税法（二）', '涉税服务相关法律', '财务与会计', '涉税服务实务'] },
      { name: '审计师（初级）', subjects: ['审计专业相关知识', '审计理论与实务'] },
      { name: '审计师（中级）', subjects: ['审计专业相关知识', '审计理论与实务'] },
      { name: '资产评估师', subjects: ['资产评估基础', '资产评估相关知识', '资产评估实务（一）', '资产评估实务（二）'] },
      { name: '房地产估价师', subjects: ['房地产估价基本制度与政策', '房地产估价理论与方法', '房地产开发经营与管理', '房地产估价案例与分析'] },
      { name: '软考：系统集成项目管理工程师', subjects: ['系统集成项目管理基础知识', '系统集成项目管理应用技术'] },
      { name: '软考：信息系统项目管理师', subjects: ['信息系统项目管理综合知识', '信息系统项目管理案例分析', '信息系统项目管理论文'] }
    ]
  },
  {
    id: 'lang',
    name: '语言 & 计算机',
    desc: '全部需要参加统考',
    icon: '💻',
    color: '#10b981',
    exams: [
      { name: '全国计算机一级', subjects: ['计算机基础及MS Office应用'] },
      { name: '全国计算机二级 Office', subjects: ['MS Office高级应用'] },
      { name: '全国计算机二级 C 语言', subjects: ['C语言程序设计'] },
      { name: 'PETS-3（公共英语三级）', subjects: ['笔试', '口试'] },
      { name: '大学英语四级 CET4', subjects: ['听力', '阅读理解', '写作翻译'] },
      { name: '大学英语六级 CET6', subjects: ['听力', '阅读理解', '写作翻译'] }
    ]
  },
  {
    id: 'special',
    name: '特种 & 特种设备上岗证',
    desc: '理论 + 实操',
    icon: '🛠️',
    color: '#ef4444',
    exams: [
      { name: '叉车司机 N1', subjects: ['安全基础知识', '专业知识'] },
      { name: '低压电工作业', subjects: ['电工基础知识', '安全操作技术'] },
      { name: '高压电工作业', subjects: ['高压电气安全', '安全操作技术'] },
      { name: '熔化焊接与热切割（焊工）', subjects: ['焊接安全技术', '焊接操作技术'] },
      { name: '登高架设作业', subjects: ['高处作业安全', '登高架设操作'] },
      { name: '高处安装维护拆除作业', subjects: ['高处作业安全技术', '操作技能'] },
      { name: '电梯修理 T', subjects: ['电梯安全技术', '电梯修理操作'] },
      { name: '起重机指挥 Q1', subjects: ['起重指挥安全', '指挥操作'] },
      { name: '起重机司机 Q2', subjects: ['起重司机安全', '司机操作'] },
      { name: '特种设备安全管理 A', subjects: ['特种设备安全管理'] },
      { name: '气瓶充装 P', subjects: ['气瓶充装安全', '充装操作'] }
    ]
  },
  {
    id: 'skill',
    name: '人社职业技能等级证',
    desc: '理论 + 实操',
    icon: '🧰',
    color: '#8b5cf6',
    exams: [
      { name: '育婴员', subjects: ['婴幼儿生活照料', '婴幼儿保健与护理'] },
      { name: '保育员', subjects: ['学前教育基础知识', '保育工作技能'] },
      { name: '养老护理员', subjects: ['老年人生活照料', '老年人护理技能'] },
      { name: '汽车维修工', subjects: ['汽车构造与维修', '维修操作技能'] },
      { name: '中式烹调师', subjects: ['烹饪原料知识', '烹调操作技能'] },
      { name: '中式面点师', subjects: ['面点制作工艺', '面点操作技能'] },
      { name: '家政服务员', subjects: ['家庭服务基础知识', '家庭服务技能'] },
      { name: '钳工', subjects: ['钳工工艺学', '钳工操作技能'] },
      { name: '数控车工', subjects: ['数控车床编程与操作', '数控操作技能'] },
      { name: '起重装卸机械操作工', subjects: ['起重装卸机械操作', '操作技能'] }
    ]
  }
];

let cache = null;
function load() {
  if (cache) return cache;
  if (!fs.existsSync(DATA_FILE)) {
    cache = { questions: [], progress: [], orders: [], nextQId: 1, nextOId: 1 };
    save();
  } else {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return cache;
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function queryQuestions({ category, subject, type, hot, limit, offset, random, id, id__in, difficulty, difficulty__gte, difficulty__lte } = {}) {
  const db = load();
  let arr = db.questions.slice();
  if (id) arr = arr.filter(q => q.id === Number(id));
  if (id__in != null) { const idSet = new Set(String(id__in).split(',').map(Number)); arr = arr.filter(q => idSet.has(q.id)); }
  if (category && category !== 'all') arr = arr.filter(q => q.category === category);
  if (subject && subject !== 'all') arr = arr.filter(q => q.subject === subject);
  if (type && type !== 'all') arr = arr.filter(q => q.type === type);
  if (hot === 1 || hot === '1') arr = arr.filter(q => q.hot === 1);
  if (difficulty != null) arr = arr.filter(q => q.difficulty === Number(difficulty));
  if (difficulty__gte != null) arr = arr.filter(q => q.difficulty >= Number(difficulty__gte));
  if (difficulty__lte != null) arr = arr.filter(q => q.difficulty <= Number(difficulty__lte));
  if (random === 1 || random === '1') {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  } else {
    arr.sort((a, b) => a.id - b.id);
  }
  const start = offset || 0;
  if (limit) arr = arr.slice(start, start + Number(limit));
  return arr.map(q => ({ ...q }));
}

function getStats() {
  const db = load();
  const total = db.questions.length;
  const byCat = {}; const byType = {}; const bySource = {};
  db.questions.forEach(q => {
    byCat[q.category] = (byCat[q.category] || 0) + 1;
    byType[q.type] = (byType[q.type] || 0) + 1;
    bySource[q.source] = (bySource[q.source] || 0) + 1;
  });
  return { total, byCat: Object.entries(byCat).map(([category, c]) => ({ category, c })), byType: Object.entries(byType).map(([type, c]) => ({ type, c })), bySource: Object.entries(bySource).map(([source, c]) => ({ source, c })) };
}

function getCategories() {
  const db = load();
  // 统计每个 category+subject 的题目数和热点数
  const stats = {};
  const catSubjects = {};
  db.questions.forEach(q => {
    const key = q.category + '||' + (q.subject || '');
    if (!stats[key]) stats[key] = { total: 0, hot: 0 };
    stats[key].total++;
    if (q.hot) stats[key].hot++;
    if (!catSubjects[q.category]) catSubjects[q.category] = new Set();
    catSubjects[q.category].add(q.subject || '通用');
  });
  const knownCats = new Set();
  EXAM_GROUPS.forEach(g => g.exams.forEach(e => knownCats.add(e.name)));
  const customExams = [];
  Object.keys(catSubjects).forEach(cat => {
    if (knownCats.has(cat)) return;
    const subs = [...catSubjects[cat]];
    const subjects = subs.map(s => {
      const key = cat + '||' + s;
      return { name: s, total: (stats[key] && stats[key].total) || 0, hot_count: (stats[key] && stats[key].hot) || 0 };
    });
    const total = subjects.reduce((sum, s) => sum + s.total, 0);
    const hot_count = subjects.reduce((sum, s) => sum + s.hot_count, 0);
    customExams.push({ category: cat, subjects, subject_count: subjects.length, total, hot_count });
  });
  const groups = EXAM_GROUPS.map(g => ({
    id: g.id, name: g.name, desc: g.desc, icon: g.icon, color: g.color,
    exams: g.exams.map(e => {
      const subjects = e.subjects.map(s => {
        const key = e.name + '||' + s;
        return { name: s, total: (stats[key] && stats[key].total) || 0, hot_count: (stats[key] && stats[key].hot) || 0 };
      });
      const total = subjects.reduce((sum, s) => sum + s.total, 0);
      const hot_count = subjects.reduce((sum, s) => sum + s.hot_count, 0);
      return { category: e.name, subjects, subject_count: subjects.length, total, hot_count };
    })
  }));
  if (customExams.length) {
    groups.push({ id: 'custom', name: '自定义题库', desc: '导入的题目', icon: '📂', color: '#64748b', exams: customExams });
  }
  return groups;
}

function upsertQuestion(q) {
  const db = load();
  if (!q.fingerprint) {
    const crypto = require('crypto');
    const fpStr = [q.category || '', q.subject || '', q.question || '', q.answer || ''].join('||');
    q.fingerprint = crypto.createHash('md5').update(fpStr).digest('hex');
  }
  const existing = db.questions.find(x => x.fingerprint === q.fingerprint);
  if (existing) {
    Object.assign(existing, q);
    save();
    return { id: existing.id, inserted: false };
  }
  const id = db.nextQId++;
  db.questions.push({
    id, category: q.category, subject: q.subject || '通用', type: q.type,
    question: q.question, options: q.options || null, answer: q.answer,
    analysis: q.analysis || '', hot: q.hot ? 1 : 0, difficulty: q.difficulty || 1,
    source: q.source || 'seed', fingerprint: q.fingerprint,
    created_at: Math.floor(Date.now() / 1000)
  });
  save();
  return { id, inserted: true };
}

function deleteQuestion(id) {
  const db = load();
  db.questions = db.questions.filter(q => q.id !== Number(id));
  const qid = String(id);
  db.progress = db.progress.filter(p => {
    if (p.kind === 'wrong' && p.key === qid) return false;
    if (p.kind === 'fav' && p.key === qid) return false;
    return true;
  });
  save();
}

function clearQuestions(category) {
  const db = load();
  const removed = new Set();
  db.questions.forEach(q => {
    const isRemoved = category === 'all'
      ? q.source !== 'seed'
      : (q.category === category && q.source !== 'seed');
    if (isRemoved) removed.add(String(q.id));
  });
  if (category === 'all') {
    db.questions = db.questions.filter(q => q.source === 'seed');
  } else {
    db.questions = db.questions.filter(q => !(q.category === category && q.source !== 'seed'));
  }
  db.progress = db.progress.filter(p => {
    if ((p.kind === 'wrong' || p.kind === 'fav') && removed.has(p.key)) return false;
    return true;
  });
  save();
}

function getProgress(device, kind, key) {
  const db = load();
  const row = db.progress.find(p => p.device === device && p.kind === kind && p.key === String(key));
  return row ? JSON.parse(row.value) : null;
}

function setProgress(device, kind, key, value) {
  const db = load();
  const k = String(key);
  const row = db.progress.find(p => p.device === device && p.kind === kind && p.key === k);
  const now = Math.floor(Date.now() / 1000);
  if (row) { row.value = JSON.stringify(value); row.updated_at = now; }
  else { db.progress.push({ device, kind, key: k, value: JSON.stringify(value), updated_at: now }); }
  save();
}

function deleteProgress(device, kind, key) {
  const db = load();
  db.progress = db.progress.filter(p => !(p.device === device && p.kind === kind && p.key === String(key)));
  save();
}

function listProgress(device, kind) {
  const db = load();
  return db.progress.filter(p => p.device === device && p.kind === kind).map(p => ({ ...p, value: JSON.parse(p.value) }));
}

function createOrder(device, productId, amount) {
  const db = load();
  const id = db.nextOId++;
  const order = { id, device, product_id: productId, amount, status: 'pending', created_at: Math.floor(Date.now() / 1000) };
  db.orders.push(order);
  save();
  return order;
}

function updateOrder(id, status) {
  const db = load();
  const o = db.orders.find(x => x.id === Number(id));
  if (o) { o.status = status; save(); }
}

function listOrders(device) {
  const db = load();
  return db.orders.filter(o => o.device === device).sort((a, b) => b.id - a.id);
}

function clearOrdersByDevice(device) {
  const db = load();
  db.orders = db.orders.filter(o => o.device !== device);
  save();
}

function countQuestions() { return load().questions.length; }

module.exports = {
  load, save,
  queryQuestions, getStats, getCategories,
  upsertQuestion, deleteQuestion, clearQuestions,
  getProgress, setProgress, deleteProgress, listProgress,
  createOrder, updateOrder, listOrders, clearOrdersByDevice,
  countQuestions
};