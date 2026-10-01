const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const {
  load, save, queryQuestions, getStats, getCategories,
  upsertQuestion, deleteQuestion, clearQuestions,
  getProgress, setProgress, deleteProgress, listProgress,
  createOrder, updateOrder, listOrders, clearOrdersByDevice,
  countQuestions
} = require('./db');
const seedQuestions = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev123';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'client'), { etag: false, lastModified: false, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0'); } }));

function genDeviceId() { return crypto.randomBytes(12).toString('hex'); }

// ========== 种子初始化 ==========
if (countQuestions() === 0) {
  let inserted = 0;
  seedQuestions.forEach(q => { if (upsertQuestion(q).inserted) inserted++; });
  console.log(`[题库通] 已写入种子题 ${inserted} 道`);
}

// ========== 设备 ==========
app.post('/api/device', (req, res) => {
  let device = req.headers['x-device-id'] || req.body.device;
  if (!device) { device = genDeviceId(); setProgress(device, 'meta', 'created', Date.now()); }
  res.json({ device });
});

// ========== 题库查询 ==========
app.get('/api/categories', (req, res) => {
  res.json(getCategories());
});

app.get('/api/questions', (req, res) => {
  const { category, subject, type, hot, limit, offset, random, id__in, difficulty, difficulty__gte, difficulty__lte } = req.query;
  const rows = queryQuestions({ category, subject, type, hot, limit, offset, random, id__in, difficulty, difficulty__gte, difficulty__lte });
  res.json(rows);
});

app.get('/api/questions/:id', (req, res) => {
  const rows = queryQuestions({ id: req.params.id });
  res.json(rows.length > 0 ? rows[0] : null);
});

app.post('/api/questions', (req, res) => {
  const { question, answer, options, analysis, category, subject, type, difficulty, source, hot } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required' });
  const r = upsertQuestion({ question, answer, options, analysis, category, subject, type, difficulty, source, hot });
  res.json(r);
});

app.delete('/api/questions/:id', (req, res) => {
  res.json(deleteQuestion(req.params.id));
});

app.delete('/api/questions', (req, res) => {
  res.json(clearQuestions());
});

// ========== 统计 ==========
app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

// ========== 进度 ==========
app.get('/api/progress/:device', (req, res) => {
  const { device } = req.params;
  if (!device) return res.status(400).json({ error: 'device required' });
  const checkin = getProgress(device, 'checkin', 'data') || { days: [], last: null, streak: 0 };
  const stat = getProgress(device, 'stat', 'main') || { total: 0, correct: 0, wrong: 0, exp: 0, level: 1 };
  const wrongs = listProgress(device, 'wrong') || [];
  const favs = listProgress(device, 'fav') || [];
  res.json({
    stat,
    wrong: wrongs.map(w => ({ id: Number(w.key), ...w.value })),
    fav: favs.map(f => Number(f.key)),
    checkin,
    daily: [],
    subjects: {}
  });
});

app.post('/api/progress/:device', (req, res) => {
  const { device } = req.params;
  const { key, value } = req.body;
  if (!device || !key) return res.status(400).json({ error: 'device and key required' });
  setProgress(device, key, value);
  res.json({ ok: 1 });
});

app.delete('/api/progress/:device', (req, res) => {
  const { device } = req.params;
  const { key } = req.query;
  if (!device) return res.status(400).json({ error: 'device required' });
  if (key) { deleteProgress(device, key); res.json({ ok: 1 }); }
  else { res.json(listProgress(device)); }
});

// ========== 判题 & 统计 ==========
app.post('/api/judge', (req, res) => {
  const { device, answers } = req.body;
  if (!device || !answers || !answers.length) return res.status(400).json({ error: 'device and answers required' });
  const details = [];
  let correct = 0, wrong = 0;
  answers.forEach(({ id, answer }) => {
    const qs = queryQuestions({ id });
    if (!qs.length) return;
    const q = qs[0];
    const ok = q.type === 'fill'
      ? q.answer.split('|').map(s => s.trim().toLowerCase()).includes(String(answer || '').trim().toLowerCase())
      : q.type === 'multi'
        ? (answer || '').split(',').filter(Boolean).sort().join(',') === q.answer.split(',').filter(Boolean).sort().join(',')
        : String(answer || '').trim().toUpperCase() === q.answer.trim().toUpperCase();
    if (ok) correct++; else wrong++;
    details.push({ id: q.id, correct: ok, rightAnswer: q.answer, analysis: q.analysis || '' });
    if (!ok) {
      const exist = getProgress(device, 'wrong', String(q.id));
      setProgress(device, 'wrong', String(q.id), { count: (exist ? exist.count : 0) + 1, lastAnswer: answer || '', time: Date.now() });
    }
  });
  let stat = getProgress(device, 'stat', 'main') || { total: 0, correct: 0, wrong: 0, exp: 0, level: 1 };
  stat.total = (stat.total || 0) + answers.length;
  stat.correct = (stat.correct || 0) + correct;
  stat.wrong = (stat.wrong || 0) + wrong;
  stat.exp = (stat.exp || 0) + correct * 5;
  while (stat.exp >= Math.floor(100 * Math.pow(1.5, (stat.level || 1) - 1))) stat.level = (stat.level || 1) + 1;
  setProgress(device, 'stat', 'main', stat);
  res.json({ correct, wrong, details, stat });
});

// ========== 每日签到 ==========
app.post('/api/checkin/:device', (req, res) => {
  const { device } = req.params;
  if (!device) return res.status(400).json({ error: 'device required' });
  const today = new Date().toDateString();
  const existing = getProgress(device, 'checkin', 'data');
  const data = existing || { days: [], last: null, streak: 0 };
  if (data.last === today) return res.json({ ok: false, msg: '今日已签到' });
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.last === yesterday) { data.streak = (data.streak || 0) + 1; }
  else { data.streak = 1; }
  data.last = today;
  if (!data.days.includes(today)) data.days.push(today);
  setProgress(device, 'checkin', 'data', data);
  const reward = 10 + Math.min(data.streak * 2, 30);
  let stat = getProgress(device, 'stat', 'main') || { total: 0, correct: 0, wrong: 0, exp: 0, level: 1 };
  stat.exp = (stat.exp || 0) + reward;
  while (stat.exp >= Math.floor(100 * Math.pow(1.5, (stat.level || 1) - 1))) stat.level = (stat.level || 1) + 1;
  setProgress(device, 'stat', 'main', stat);
  res.json({ ok: true, reward, streak: data.streak, stat });
});

// ========== 错题管理 ==========
app.post('/api/wrong/:device/:id', (req, res) => {
  const { device, id } = req.params;
  deleteProgress(device, 'wrong', String(id));
  res.json({ ok: true });
});

// ========== 收藏管理 ==========
app.post('/api/fav/:device/:id', (req, res) => {
  const { device, id } = req.params;
  const exist = listProgress(device, 'fav').find(f => f.key === String(id));
  if (exist) { deleteProgress(device, 'fav', String(id)); res.json({ ok: true, fav: false }); }
  else { setProgress(device, 'fav', String(id), { time: Date.now() }); res.json({ ok: true, fav: true }); }
});

// ========== 每日一题 ==========
app.get('/api/daily', (req, res) => {
  const device = req.headers['x-device-id'] || req.query.device;
  const today = new Date().toISOString().slice(0, 10);
  let daily = null;
  if (device) {
    const stored = getProgress(device, 'daily', 'data');
    if (stored && stored.date === today) {
      daily = stored;
    }
  }
  if (!daily) {
    const rows = queryQuestions({ limit: 1, random: true });
    if (rows.length > 0) {
      daily = { date: today, question: rows[0], done: false, answer: null };
      if (device) setProgress(device, 'daily', 'data', daily);
    }
  }
  res.json(daily);
});

function auth(req, res, next) {
  const token = req.headers['authorization'] || req.query.token;
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/api/admin/stats', auth, (req, res) => {
  res.json({ questions: countQuestions(), stat: getStats() });
});

// ========== 导入题目 ==========
app.post('/api/import', auth, (req, res) => {
  const lines = (req.body.content || '').split('\n').filter(l => l.trim());
  let current = null;
  let inserted = 0;
  lines.forEach(line => {
    line = line.trim();
    if (!line) return;
    if (/^\d+[\.、)]\s*/.test(line)) {
      if (current && current.question) { upsertQuestion(current); inserted++; }
      current = { category: current?.category || '未分类', subject: current?.subject || '通用', question: line.replace(/^\d+[\.、)]\s*/, ''), options: [], answer: '', analysis: '', source: 'crawl', hot: 0, difficulty: 1 };
    } else if (/^[A-D][\.、)]\s*/.test(line) && current) {
      current.options.push(line.replace(/^([A-D])[\.、)]\s*/, ''));
    } else if (/^答案[：:]\s*/i.test(line) && current) {
      current.answer = line.replace(/^[^：:]*[：:]\s*/, '');
    } else if (/^解析[：:]\s*/i.test(line) && current) {
      current.analysis = line.replace(/^[^：:]*[：:]\s*/, '');
    } else if (/^分类[：:]/.test(line)) {
      const cat = line.replace(/^[^：:]*[：:]\s*/, '').split('/')[0].trim();
      if (current) current.category = cat;
      else if (cat) { const r = upsertQuestion({ question: '', category: cat, subject: '通用', options: [], answer: '', source: 'crawl' }); }
    }
  });
  if (current && current.question) { upsertQuestion(current); inserted++; }
  res.json({ inserted });
});

// ========== 商品 ==========
const PRODUCTS = [
  { id: 1, name: 'VIP月卡', price: 30, days: 30, desc: '解锁全部题目 + AI答题辅导' },
  { id: 2, name: 'VIP季卡', price: 80, days: 90, desc: '解锁全部题目 + AI答题辅导' },
  { id: 3, name: 'VIP年卡', price: 280, days: 365, desc: '解锁全部题目 + AI答题辅导' },
];
app.get('/api/products', (req, res) => res.json(PRODUCTS));

// ========== 订单 ==========
app.post('/api/orders', (req, res) => {
  const device = req.headers['x-device-id'] || req.body.device;
  const { productId } = req.body;
  if (!device || !productId) return res.status(400).json({ error: 'device and productId required' });
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'product not found' });
  const order = createOrder(device, product);
  res.json(order);
});

app.get('/api/orders/:device', (req, res) => {
  res.json(listOrders(req.params.device));
});

// ========== SPA fallback ==========
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|woff|woff2|ttf|svg)$/)) return next();
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║   🎯 题库通 TikuTong 后端已启动                ║`);
  console.log(`║   http://localhost:${PORT}                            ║`);
  console.log(`║   管理后台: http://localhost:${PORT}/           ║`);
  console.log(`║   管理令牌: ${ADMIN_TOKEN}                                ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});