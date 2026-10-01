const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

const API = '';

const app = createApp({
  setup() {
    // ============ 基础状态 ============
    const page = ref('home');
    const pageStack = ref(['home']);
    const deviceId = ref('');
    const showAdmin = ref(false);
    const darkMode = ref(localStorage.getItem('tiku_dark') === '1');
    const soundOn = ref(localStorage.getItem('tiku_sound') !== '0');
    const loading = ref(false);

    watch(darkMode, v => {
      localStorage.setItem('tiku_dark', v ? '1' : '0');
      document.documentElement.classList.toggle('dark', v);
    });
    watch(soundOn, v => localStorage.setItem('tiku_sound', v ? '1' : '0'));

    const categories = ref([]);
    const subjects = ref([]);
    const subjectCount = reactive({});
    const currentCategory = ref('');
    const currentSubject = ref('');

    // 我的考试（选定的目标行业+科目），持久化保存
    const myExam = reactive({
      category: localStorage.getItem('tiku_mycat') || '',
      subject: localStorage.getItem('tiku_mysub') || ''
    });
    const myExamSet = computed(() => !!myExam.category);

    function setMyExam(cat, sub = '') {
      myExam.category = cat;
      myExam.subject = sub || '';
      localStorage.setItem('tiku_mycat', cat);
      localStorage.setItem('tiku_mysub', sub || '');
    }

    // 全局科目选择器
    const subjectPickerOpen = ref(false);
    const subjectPickerStep = ref('type'); // 'type' 选类型 | 'exam' 选考试 | 'subject' 选科目
    const selectedGroup = ref(null);
    const selectedExam = ref(null);
    function toggleSubjectPicker() {
      if (subjectPickerOpen.value) return; // 已打开则不处理
      subjectPickerOpen.value = true;
      subjectPickerStep.value = 'type';
      selectedGroup.value = null;
      selectedExam.value = null;
    }
    function closeSubjectPicker() { subjectPickerOpen.value = false; }
    // 第一步：选择考试类型（5大分类）
    function selectGroupStep(g) {
      selectedGroup.value = g;
      subjectPickerStep.value = 'exam';
    }
    // 第二步：选择该类型下的考试
    function selectGlobalSubject(exam) {
      selectedExam.value = exam;
      if (exam.subjects && exam.subjects.length > 1) {
        subjectPickerStep.value = 'subject';
      } else {
        const sub = exam.subjects && exam.subjects[0] ? exam.subjects[0].name : '';
        setMyExam(exam.category, sub);
        subjectPickerOpen.value = false;
        currentCategory.value = exam.category;
        currentSubject.value = sub;
        subjectPickerStep.value = 'type';
        selectedGroup.value = null;
        selectedExam.value = null;
        if (page.value === 'home') { loadDaily(); }
      }
    }
    // 第三步：选定考试的具体科目
    function selectExamSubject(subject) {
      setMyExam(selectedExam.value.category, subject);
      subjectPickerOpen.value = false;
      currentCategory.value = selectedExam.value.category;
      currentSubject.value = subject;
      subjectPickerStep.value = 'type';
      selectedGroup.value = null;
      selectedExam.value = null;
      if (page.value === 'home') { loadDaily(); }
    }
    // 返回上一步
    function backToStep(step) {
      if (step === 'type') { subjectPickerStep.value = 'type'; selectedGroup.value = null; selectedExam.value = null; }
      else if (step === 'exam') { subjectPickerStep.value = 'exam'; selectedExam.value = null; }
    }
    // 通过滑轨跳转步骤（只能跳到已解锁的步骤）
    function goToStep(step) {
      if (step === 'type') { subjectPickerStep.value = 'type'; return; }
      if (step === 'exam' && selectedGroup.value) { subjectPickerStep.value = 'exam'; return; }
      if (step === 'subject' && selectedExam.value && selectedExam.value.subjects.length > 1) { subjectPickerStep.value = 'subject'; }
    }
    // 当前考试的所有科目
    const currentExamSubjects = computed(() => {
      const e = findExam(myExam.category);
      return e && e.subjects ? e.subjects : [];
    });
    // 切换当前考试的科目（页面内切换）
    function switchSubject(s) {
      setMyExam(myExam.category, s);
      currentSubject.value = s;
      if (page.value === 'home') { loadDaily(); }
    }
    // 是否已完成考试科目选择
    const examReady = computed(() => !!myExam.category);
    // 受限页面拦截
    function switchTabSafe(t) {
      if (!examReady.value && t !== 'admin') {
        alert('请先点击顶部选择考试科目');
        subjectPickerOpen.value = true;
        return;
      }
      switchTab(t);
    }

    const progress = reactive({ stat: {}, wrong: [], fav: [], checkin: { days: [], last: null, streak: 0 }, daily: [], subjects: {} });
    const products = ref([]);
    const orders = ref([]);
    // 资料商城：只显示当前科目的资料
    const shopFilter = ref('');
    const filteredProducts = computed(() => {
      const cat = myExam.category;
      if (!cat) return products.value;
      return products.value.filter(p => p.category === cat);
    });

    const checkinToday = computed(() => {
      if (!progress.checkin?.last) return false;
      return progress.checkin.last === new Date().toDateString();
    });

    const showTab = computed(() => ['home','shop','me'].includes(page.value));

    const pageTitleMap = {
      home: '刷题', shop: '资料', me: '我的',
      subjects: '选择科目', quiz: '答题', result: '成绩',
      wrong: '错题本', fav: '收藏', record: '逐题回顾', review: '逐题回顾',
      product: '商品详情', admin: '管理后台', card: '背诵卡片', orders: '我的订单'
    };

    const currentTitle = computed(() => pageTitleMap[page.value] || '题库通');

    function goBack() {
      if (pageStack.value.length > 1) {
        pageStack.value.pop();
        page.value = pageStack.value[pageStack.value.length - 1];
      }
    }
    function switchTab(t) { page.value = t; pageStack.value = [t]; }
    function goAdmin() { page.value = 'admin'; pageStack.value = ['admin']; }

    // ============ 设备 & 数据初始化 ============
    async function init() {
      try {
        const cached = localStorage.getItem('tiku_device');
        if (cached) deviceId.value = cached;
        else {
          const r = await post('/api/device', {});
          deviceId.value = r.device;
          localStorage.setItem('tiku_device', deviceId.value);
        }
        await Promise.all([loadProgress(), loadCategories(), loadProducts(), loadOrders()]);
      } catch (e) {
        console.error('init error', e);
      }
      if (!examReady.value) {
        subjectPickerOpen.value = true;
      }
    }

    async function loadProgress() {
      if (!deviceId.value) return;
      try {
        const r = await get(`/api/progress/${deviceId.value}`);
        Object.assign(progress, r);
      } catch(e) { console.warn('loadProgress failed', e); }
    }
    async function loadCategories() {
      categories.value = await get('/api/categories');
      categories.value.forEach(c => {
        (c.exams || []).forEach(e => {
          (e.subjects || []).forEach(s => { subjectCount[s.name] = s.total || 0; });
        });
      });
    }
    async function loadProducts() { products.value = await get('/api/products'); }
    async function loadOrders() { orders.value = await get(`/api/orders/${deviceId.value}`); }
    const enrichedOrders = computed(() => {
      return orders.value.map(o => {
        const p = products.value.find(p => p.id === o.product_id);
        return { ...o, productName: p ? p.name : '未知资料', productIcon: p ? catIcon(p.category) : '📄', productPrice: o.amount };
      });
    });

    // ============ 每日签到 ============
    async function doCheckin() {
      const r = await post(`/api/checkin/${deviceId.value}`, {});
      if (r.ok) { alert(`🎉 签到成功！+${r.reward} EXP`); await loadProgress(); }
      else alert(r.msg);
    }

    // ============ 每日一题 ============
    const daily = ref(null);
    const dailyPick = ref('');
    const dailyFill = ref('');
    const dailyResult = ref(null);
    const dailyDone = ref(false);
    const dailyLoaded = ref(false);
    async function loadDaily() {
      dailyPick.value = ''; dailyFill.value = ''; dailyResult.value = null; dailyDone.value = false; dailyLoaded.value = false;
      let url = '/api/daily';
      if (myExam.category) url += `?category=${encodeURIComponent(myExam.category)}`;
      if (myExam.subject) url += `&subject=${encodeURIComponent(myExam.subject)}`;
      const raw = await get(url);
      daily.value = raw && raw.question ? raw.question : raw;
      const today = new Date().toDateString();
      const lastDailyDate = localStorage.getItem('tiku_daily_date');
      const lastDailyDone = localStorage.getItem('tiku_daily_done');
      if (lastDailyDate === today && lastDailyDone === '1') {
        dailyDone.value = true;
      }
      dailyLoaded.value = true;
    }
    onMounted(loadDaily);
    watch(() => myExam.category, loadDaily);
    function optLabel(i) { return String.fromCharCode(65 + i); }
    function pickDaily(l) {
      if (dailyDone.value || dailyResult.value) return;
      dailyPick.value = l;
      if (daily.value.type !== 'fill') submitDaily();
    }
    async function submitDaily() {
      if (dailyDone.value) return;
      const ans = daily.value.type === 'fill' ? dailyFill.value : dailyPick.value;
      if (!ans) return;
      const isF = daily.value.type === 'fill';
      const isC = isF
        ? (daily.value.answer.split('|').map(s=>s.trim().toLowerCase()).includes(ans.trim().toLowerCase()))
        : (daily.value.type === 'judge'
            ? (ans[0] === daily.value.answer[0] || (['T','TRUE','正确','对'].includes(ans.toUpperCase()) && ['对','正确'].includes(daily.value.answer))
               || ['F','FALSE','错误','错'].includes(ans.toUpperCase()) && ['错','错误'].includes(daily.value.answer))
            : ans.toUpperCase() === daily.value.answer.toUpperCase());
      dailyResult.value = { ok: isC, analysis: daily.value.analysis };
      dailyDone.value = true;
      const today = new Date().toDateString();
      localStorage.setItem('tiku_daily_date', today);
      localStorage.setItem('tiku_daily_done', '1');
      const ansObj = { id: daily.value.id, answer: ans };
      answered[daily.value.id] = { answer: ans, correct: isC };
      dailyRecord.value.push(daily.value);
      try { localStorage.setItem('tiku_last_record', JSON.stringify({ list: dailyRecord.value.length ? dailyRecord.value : [daily.value], answered })); } catch(e) {}
      await post('/api/judge', { device: deviceId.value, answers: [ansObj] });
      await loadProgress();
      updateTodayStats(1, isC ? 1 : 0);
      persistHeatmap();
    }
    function nextLevelExp() {
      const lv = progress.stat.level || 1;
      return Math.floor(100 * Math.pow(1.5, lv - 1));
    }

    // ============ 科目 ============
    async function openSubjects(cat) {
      currentCategory.value = cat;
      const allSubs = categories.value.find(c => c.category === cat);
      subjects.value = allSubs ? allSubs.subjects : [];
      currentSubject.value = '';
      page.value = 'subjects'; pageStack.value.push('subjects');

      if (subjects.value.length === 0) {
        setMyExam(cat, '');
        await fetchQuestions();
        page.value = 'quiz'; pageStack.value.push('quiz');
      }
    }
    function selectSubject(s) {
      currentSubject.value = s;
      setMyExam(currentCategory.value, s);
      startPractice('order');
    }

    // 快速开始：使用"我的考试"直接刷题
    function quickPractice(mode) {
      if (!myExamSet.value) {
        alert('请先选择考试科目');
        switchMyExam();
        return;
      }
      currentCategory.value = myExam.category;
      currentSubject.value = myExam.subject;
      if (mode === 'level') { levelStage.value = 1; }
      startPractice(mode);
    }

    // 切换我的考试 - 滚动到行业列表
    function switchMyExam() {
      subjectPickerOpen.value = true;
    }

    function scrollToDaily() {
      const el = document.getElementById('daily-card');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function playSound(type) {
      if (!soundOn.value) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (type === 'correct') { osc.frequency.value = 880; gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2); osc.start(); osc.stop(ctx.currentTime + 0.2); }
        else if (type === 'wrong') { osc.frequency.value = 220; gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3); osc.start(); osc.stop(ctx.currentTime + 0.3); }
        else if (type === 'click') { osc.frequency.value = 600; gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08); osc.start(); osc.stop(ctx.currentTime + 0.08); }
      } catch(e) {}
    }

    // ============ 刷题核心 ============
    const quizList = ref([]);
    const quizIndex = ref(0);
    const quizAnswer = ref('');
    const quizJudged = ref(false);
    const quizCorrect = ref(false);
    const quizFaved = ref(false);
    const quizFill = ref('');
    const quizTotal = computed(() => quizList.value.length);
    const quizQuestion = computed(() => quizList.value[quizIndex.value]);
    const quizMode = ref('order');
    const answered = reactive({});
    const resultDetail = reactive({ correct: 0, wrong: 0 });
    const resultTitle = ref('');
    const resultRatio = ref(0);
    const resultExp = ref(0);
    const dailyRecord = ref([]);

    async function startPractice(mode) {
      if (currentCategory.value) setMyExam(currentCategory.value, currentSubject.value);
      quizMode.value = mode;
      console.log('[startPractice] mode=', mode, 'cat=', currentCategory.value, 'sub=', currentSubject.value);
      await fetchQuestions();
      console.log('[startPractice] after fetch, quizList len=', quizList.value.length);
      page.value = 'quiz'; pageStack.value.push('quiz');
    }

    function startMode(mode) {
      if (!myExamSet.value) { alert('请先选择考试科目'); switchMyExam(); return; }
      currentCategory.value = myExam.category;
      currentSubject.value = myExam.subject;
      if (mode === 'level') { levelStage.value = 1; }
      startPractice(mode);
    }

    // 把 categories（5大类）展平成所有考试科目列表
    const allExams = computed(() => {
      const list = [];
      categories.value.forEach(g => {
        (g.exams || []).forEach(e => list.push({ ...e, group: g.name, icon: g.icon, color: g.color, desc: g.desc }));
      });
      return list;
    });
    function findExam(cat) {
      return allExams.value.find(e => e.category === cat);
    }
    // 行业图标 / 描述 / 配色
    function catIcon(cat) {
      const e = findExam(cat);
      return e ? e.icon : '📚';
    }
    function catIconClass(cat) {
      const e = findExam(cat);
      if (!e) return 'blue';
      // 把颜色名映射到 class
      const map = { '#667eea': 'purple', '#f59e0b': 'orange', '#10b981': 'green', '#ef4444': 'red', '#8b5cf6': 'violet' };
      return map[e.color] || 'blue';
    }
    function catDesc(cat) {
      const e = findExam(cat);
      if (!e) return '';
      const n = e.subject_count || (e.subjects ? e.subjects.length : 0);
      return n > 1 ? `${e.group} · ${n}个科目` : e.group;
    }
    function catColor(cat) { return catIconClass(cat); }

    const categoryTotal = computed(() => {
      const e = findExam(currentCategory.value);
      return e ? e.total : 0;
    });
    const categoryHot = computed(() => {
      const e = findExam(currentCategory.value);
      return e ? e.hot_count : 0;
    });

    async function fetchQuestions() {
      let url = `/api/questions?category=${encodeURIComponent(currentCategory.value)}`;
      if (currentSubject.value) url += `&subject=${encodeURIComponent(currentSubject.value)}`;
      if (quizMode.value === 'hot') url += '&hot=1&random=1';
      else if (quizMode.value === 'exam') url += '&random=1&limit=40';
      else if (quizMode.value === 'level') {
        const minD = Math.min(levelStage.value, 3);
        url += `&random=1&limit=10&difficulty__gte=${minD}`;
      }
      else if (quizMode.value === 'wrong') url = `/api/questions?id__in=${progress.wrong.map(w=>w.id).join(',')}`;
      console.log('[fetchQuestions] url=', url, 'mode=', quizMode.value, 'cat=', currentCategory.value, 'sub=', currentSubject.value);
      quizList.value = await get(url);
      if (quizMode.value === 'order') {
        const doneIds = getCorrectlyDoneIds();
        quizList.value = quizList.value.filter(q => !doneIds.has(q.id));
      }
      console.log('[fetchQuestions] got', quizList.value.length, 'questions, ids=', quizList.value.map(q=>q.id).slice(0,5));
      quizIndex.value = 0; resetQuiz();
    }

    function getCorrectlyDoneIds() {
      try {
        return new Set(JSON.parse(localStorage.getItem('tiku_correct_ids') || '[]'));
      } catch(e) { return new Set(); }
    }
    function markCorrectDone(id) {
      try {
        const set = getCorrectlyDoneIds();
        set.add(id);
        localStorage.setItem('tiku_correct_ids', JSON.stringify([...set]));
      } catch(e) {}
    }

    function resetQuiz() {
      quizAnswer.value = ''; quizJudged.value = false; quizFill.value = '';
      quizCorrect.value = false;
      Object.keys(answered).forEach(k => delete answered[k]);
      resultDetail.correct = 0; resultDetail.wrong = 0;
      if (quizQuestion.value) quizFaved.value = progress.fav.includes(quizQuestion.value.id);
      if (quizMode.value === 'exam') { startExamTimer(); }
    }

    function typeLabel(t) { return ({single:'单选', multi:'多选', judge:'判断', fill:'填空'})[t] || t; }

    function pickQuiz(l) {
      if (quizJudged.value) return;
      const q = quizQuestion.value;
      if (q.type === 'single' || q.type === 'judge') quizAnswer.value = l;
      else if (q.type === 'multi') {
        const set = new Set(quizAnswer.value.split(',').filter(Boolean));
        set.has(l) ? set.delete(l) : set.add(l);
        quizAnswer.value = [...set].sort().join(',');
      }
      if (q.type !== 'multi') submitQuiz();
    }

    async function submitQuiz() {
      const q = quizQuestion.value;
      const ua = q.type === 'fill' ? quizFill.value : quizAnswer.value;
      const isF = q.type === 'fill';
      let ok = false;
      if (isF) {
        ok = q.answer.split('|').map(s=>s.trim().toLowerCase()).includes(String(ua||'').trim().toLowerCase());
      } else if (q.type === 'multi') {
        const a1 = (ua||'').split(',').filter(Boolean).sort();
        const a2 = q.answer.split(',').filter(Boolean).sort();
        ok = a1.join(',') === a2.join(',');
      } else {
        ok = String(ua||'').trim().toUpperCase() === q.answer.trim().toUpperCase();
      }
      quizCorrect.value = ok; quizJudged.value = true;
      resultDetail[ok ? 'correct' : 'wrong']++;
      answered[q.id] = { answer: ua, correct: ok, judged: false };
      console.log('[submitQuiz] id=', q.id, 'ua=', ua, 'ok=', ok, 'answered keys=', Object.keys(answered).length);
      playSound(ok ? 'correct' : 'wrong');

      if (quizMode.value !== 'daily') {
        post('/api/judge', { device: deviceId.value, answers: [{ id: q.id, answer: ua || '' }] }).catch(e => console.warn('submitQuiz judge failed', e));
        answered[q.id].judged = true;
      }
      updateTodayStats(1, ok ? 1 : 0);
      if (ok && quizMode.value === 'order') markCorrectDone(q.id);
    }

    function nextQuiz() {
      console.log('[nextQuiz] idx=', quizIndex.value, 'total=', quizTotal.value, 'lastQ=', quizIndex.value + 1 >= quizTotal.value);
      if (quizIndex.value + 1 >= quizTotal.value) {
        endQuiz();
      } else {
        quizIndex.value++; resetQuiz();
      }
    }

    async function endQuiz() {
      if (examTimer) clearInterval(examTimer);
      const total = quizTotal.value || 1;
      resultRatio.value = Math.round(resultDetail.correct / total * 100);
      resultTitle.value = quizMode.value === 'exam' ? '📝 模考结束'
        : quizMode.value === 'level' ? (resultDetail.correct >= levelPassScore ? `🎉 第 ${levelStage.value} 关通过！` : `💔 第 ${levelStage.value} 关未通过`)
        : '🎉 练习结束';

      if (quizMode.value === 'level' && resultDetail.correct >= levelPassScore) {
        resultExp.value = 20 + levelStage.value * 5;
        levelStage.value++;
      }
      if (quizMode.value !== 'level') { resultExp.value = quizMode.value === 'exam' ? 30 : 15; }
      updateTodayStats(0, 0, 1);
      persistHeatmap();

      // 先保存到本地 — 逐题回顾、错题备份都靠这个
      const plainAnswered = {};
      Object.keys(answered).forEach(k => { plainAnswered[k] = { answer: answered[k].answer, correct: answered[k].correct }; });
      const recPayload = { list: [...quizList.value], answered: plainAnswered };
      try {
        localStorage.setItem('tiku_last_record', JSON.stringify(recPayload));
        const wrongIds = quizList.value.filter(q => plainAnswered[q.id] && !plainAnswered[q.id].correct).map(q => q.id);
        localStorage.setItem('tiku_last_wrong', JSON.stringify(wrongIds));
        console.log('[endQuiz] saved localStorage, list len=', quizList.value.length, 'answered keys=', Object.keys(plainAnswered).length, 'wrongIds=', wrongIds);
      } catch(e) { console.error('[endQuiz] localStorage failed', e); }

      // 保存答题结果到后端（统计+错题）
      if (deviceId.value && quizList.value.length) {
        try {
          const judgedAnswers = quizList.value.map(q => {
            if (answered[q.id] && answered[q.id].judged) return null;
            return { id: q.id, answer: answered[q.id]?.answer || '' };
          }).filter(Boolean);
          if (judgedAnswers.length) {
            const judgePayload = { device: deviceId.value, answers: judgedAnswers };
            console.log('[endQuiz] posting judge, answers len=', judgePayload.answers.length, 'sample=', judgePayload.answers.slice(0,3));
            await post('/api/judge', judgePayload);
          }
          await loadProgress();
          console.log('[endQuiz] after loadProgress, wrong count=', progress.wrong.length, 'stat=', progress.stat);
        } catch(e) { console.error('[endQuiz] judge failed', e); }
      } else {
        console.warn('[endQuiz] skipped judge: deviceId=', deviceId.value, 'quizList len=', quizList.value.length);
      }

      page.value = 'result'; pageStack.value.push('result');
    }

    function reviewQuiz() {
      console.log('[reviewQuiz] quizList len=', quizList.value.length, 'answered keys=', Object.keys(answered).length);
      page.value = 'review'; pageStack.value.push('review');
    }

    async function nextLevel() {
      resultDetail.correct = 0; resultDetail.wrong = 0; resultExp.value = 0;
      await fetchQuestions();
      pageStack.value.pop();
      page.value = 'quiz';
    }
    async function retryLevel() {
      resultDetail.correct = 0; resultDetail.wrong = 0; resultExp.value = 0;
      await fetchQuestions();
      pageStack.value.pop();
      page.value = 'quiz';
    }

    // ============ 闯关模式 ============
    const levelStage = ref(1);
    const levelPassScore = 3;

    // ============ 模拟考试 ============
    const examLeft = ref('40:00');
    let examTimer = null;
    function startExamTimer() {
      if (examTimer) clearInterval(examTimer);
      let seconds = 40 * 60;
      examTimer = setInterval(() => {
        seconds--;
        const m = String(Math.floor(seconds / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        examLeft.value = `${m}:${s}`;
        if (seconds <= 0) { clearInterval(examTimer); endQuiz(); }
      }, 1000);
    }

    // ============ 排行榜 ============
    const fullLeaderboard = ref([
      { name: '学霸小明', exp: 2580 },
      { name: '刷题达人', exp: 1920 },
      { name: '考证王者', exp: 1650 },
      { name: '夜猫子', exp: 1420 },
      { name: '早起鸟', exp: 1280 },
      { name: '稳扎稳打', exp: 1100 },
      { name: '突击选手', exp: 980 },
      { name: '佛系考生', exp: 850 },
      { name: '坚持不懈', exp: 720 },
      { name: '新晋黑马', exp: 600 },
    ]);
    const showFullBoard = ref(false);
    const leaderboard = computed(() => showFullBoard.value ? fullLeaderboard.value : fullLeaderboard.value.slice(0, 3));
    function toggleLeaderboard() { showFullBoard.value = !showFullBoard.value; }

    // ============ 商品预览 ============
    const previewItems = computed(() => {
      if (!currentProduct.value) return [];
      const p = currentProduct.value;
      const previews = {
        'p001': ['言语理解：关键词定位法，快速锁定答案', '数量关系：工程问题、行程问题公式速记', '判断推理：图形推理常见规律 20 条', '资料分析：增长率、比重计算技巧'],
        'p002': ['教育学：教学原则与方法核心考点', '心理学：认知发展理论精华笔记', '教育政策法规高频考点汇编'],
        'p003': ['会计等式与借贷记账法详解', '增值税、企业所得税计算要点', '经济法基础高频考点速记'],
        'p004': ['民法总则核心条款解析', '刑法罪名辨析与案例分析', '行政法高频考点 800 题'],
        'p005': ['本月国内重大事件汇总', '国际时事热点追踪', '时政考点预测与解析'],
        'p006': ['政论文高分范文 20 篇', '策论文写作模板与技巧', '应用文写作规范与范例'],
      };
      return previews[p.id] || [p.preview || '核心考点精华内容'];
    });

    // ============ 收藏 / 错题 ============
    async function toggleFav() {
      const id = quizQuestion.value.id;
      const r = await post(`/api/fav/${deviceId.value}/${id}`, {});
      quizFaved.value = r.fav;
      await loadProgress();
    }
    async function removeWrong(id) {
      await post(`/api/wrong/${deviceId.value}/${id}`, {});
      await loadProgress();
      listQuestions.value = listQuestions.value.filter(q => q.id !== id);
      openListIdx.value = null;
    }

    // ============ 列表页面通用 ============
    const listQuestions = ref([]);
    const openListIdx = ref(null);
    const currentListQuestion = computed(() => listQuestions.value[openListIdx.value] || {});

    watch(page, async (p) => {
      openListIdx.value = null;
      if (p === 'wrong') {
        try {
          await loadProgress();
          console.log('[watch wrong] progress.wrong=', progress.wrong);
          let ids = progress.wrong.map(w => w.id).join(',');
          if (!ids) {
            const localWrong = JSON.parse(localStorage.getItem('tiku_last_wrong') || '[]');
            ids = localWrong.join(',');
            console.log('[watch wrong] using localStorage fallback ids=', ids);
          }
          console.log('[watch wrong] ids=', ids);
          if (ids) {
            const all = await get(`/api/questions?id__in=${ids}`);
            console.log('[watch wrong] fetched questions count=', all.length);
            const wrongMap = {}; progress.wrong.forEach(w => wrongMap[w.id] = w);
            listQuestions.value = all.map(q => ({ ...q, ...wrongMap[q.id] }));
          } else listQuestions.value = [];
        } catch(e) { console.error('[watch wrong] failed', e); listQuestions.value = []; }
      } else if (p === 'fav') {
        try {
          await loadProgress();
          const ids = progress.fav.join(',');
          if (ids) {
            const all = await get(`/api/questions?id__in=${ids}`);
            listQuestions.value = all;
          } else listQuestions.value = [];
        } catch(e) { console.warn('load fav failed', e); listQuestions.value = []; }
      } else if (p === 'record' || p === 'review') {
        if (!quizList.value.length) {
          try {
            const saved = JSON.parse(localStorage.getItem('tiku_last_record') || 'null');
            if (saved && saved.list && saved.list.length) {
              quizList.value = saved.list;
              Object.assign(answered, saved.answered || {});
            } else if (dailyRecord.value.length) {
              quizList.value = dailyRecord.value;
            }
          } catch(e) {}
        }
        listQuestions.value = quizList.value;
      }
    });

    function openListQuestion(idx) { openListIdx.value = openListIdx.value === idx ? null : idx; }

    function openWrong() { page.value = 'wrong'; pageStack.value.push('wrong'); }
    function startWrongPractice() { quizMode.value = 'wrong'; fetchQuestions(); page.value = 'quiz'; pageStack.value.push('quiz'); }
    function openFav() { page.value = 'fav'; pageStack.value.push('fav'); }
    function openRecord() {
      try {
        const saved = JSON.parse(localStorage.getItem('tiku_last_record') || 'null');
        console.log('[openRecord] saved=', saved ? { listLen: saved.list?.length, answeredKeys: Object.keys(saved.answered || {}).length } : null);
        if (saved && saved.list && saved.list.length) {
          quizList.value = saved.list;
          // clear and rebuild answered to ensure reactivity
          Object.keys(answered).forEach(k => delete answered[k]);
          Object.assign(answered, saved.answered || {});
          page.value = 'review'; pageStack.value.push('review');
        } else if (dailyRecord.value.length) {
          quizList.value = dailyRecord.value;
          page.value = 'review'; pageStack.value.push('review');
        } else alert('暂无答题记录，请先完成一套练习或每日一题');
      } catch(e) { console.error('[openRecord] failed', e); alert('暂无答题记录'); }
    }

    // ============ 商品 ============
    const currentProduct = ref(null);
    function openProduct(p) { currentProduct.value = p; page.value = 'product'; pageStack.value.push('product'); }
    function isPaid(id) { return progress.stat && orders.value.some(o => o.product_id === id && o.status === 'paid'); }

    const paying = ref(false);
    const payStatus = ref(0);
    async function buyProduct(p) {
      if (!deviceId.value) { await init(); }
      paying.value = true; payStatus.value = 0;
      const order = await post('/api/order', { device: deviceId.value, productId: p.id });
      payStatus.value = 1;
      setTimeout(async () => {
        payStatus.value = 2;
        await loadOrders();
        setTimeout(() => { paying.value = false; }, 1200);
      }, 1600);
    }

    // ============ 统计 ============
    const expPct = computed(() => {
      const s = progress.stat; if (!s) return 0;
      const lv = s.level || 1;
      const curThreshold = lv > 1 ? Math.floor(100 * Math.pow(1.5, lv - 2)) : 0;
      const nextThreshold = Math.floor(100 * Math.pow(1.5, lv - 1));
      const span = nextThreshold - curThreshold;
      if (span <= 0) return 100;
      return Math.min(100, Math.round(((s.exp || 0) - curThreshold) / span * 100));
    });
    const rate = computed(() => {
      const s = progress.stat; if (!s || !s.total) return '--';
      return Math.round(s.correct / s.total * 100);
    });

    // ============ 徽章 ============
    const badges = computed(() => {
      const s = progress.stat || {};
      const total = s.total || 0, correct = s.correct || 0, wrong = s.wrong || 0;
      const streak = progress.checkin?.streak || 0;
      const favCount = progress.fav?.length || 0;
      return [
        { id:1, name:'初来乍到', icon:'🌱', unlocked: total >= 1, desc:'完成第1题' },
        { id:2, name:'小试牛刀', icon:'🎯', unlocked: total >= 10, desc:'累计答题10题' },
        { id:3, name:'百步穿杨', icon:'🏹', unlocked: total >= 100, desc:'累计答题100题' },
        { id:4, name:'连击达人', icon:'🔥', unlocked: correct >= 50, desc:'累计答对50题' },
        { id:5, name:'模考首秀', icon:'📝', unlocked: total >= 40, desc:'完成40题模考' },
        { id:6, name:'PK胜者', icon:'🏆', unlocked: correct >= 30, desc:'累计答对30题' },
        { id:7, name:'打卡3天', icon:'📅', unlocked: streak >= 3, desc:'连续签到3天' },
        { id:8, name:'登堂入室', icon:'📚', unlocked: (s.level||1) >= 3, desc:'达到Lv.3' },
        { id:9, name:'全能选手', icon:'🌟', unlocked: total >= 50 && favCount >= 5, desc:'答题50+收藏5' },
        { id:10, name:'收藏家', icon:'⭐', unlocked: favCount >= 10, desc:'收藏10题' },
        { id:11, name:'持之以恒', icon:'📤', unlocked: streak >= 7, desc:'连续签到7天' },
        { id:12, name:'刷题狂魔', icon:'⚡', unlocked: total >= 500, desc:'累计答题500题' },
      ];
    });

    // ============ 今日答题统计（客户端跟踪，所有答题途径） ============
    function getTodayDateStr() { return new Date().toISOString().slice(0, 10); }
    function loadTodayStats() {
      const d = getTodayDateStr();
      const saved = JSON.parse(localStorage.getItem('tiku_today_stats') || '{}');
      if (saved.date !== d) return { date: d, total: 0, correct: 0, challenges: 0 };
      return saved;
    }
    function saveTodayStats(s) { localStorage.setItem('tiku_today_stats', JSON.stringify(s)); }
    const todayStats = reactive(loadTodayStats());
    function updateTodayStats(addTotal, addCorrect, addChallenge) {
      const d = getTodayDateStr();
      if (todayStats.date !== d) { todayStats.date = d; todayStats.total = 0; todayStats.correct = 0; todayStats.challenges = 0; }
      todayStats.total += (addTotal || 0);
      todayStats.correct += (addCorrect || 0);
      if (addChallenge) todayStats.challenges = (todayStats.challenges || 0) + 1;
      saveTodayStats({ date: todayStats.date, total: todayStats.total, correct: todayStats.correct, challenges: todayStats.challenges });
    }

    const todayCount = computed(() => todayStats.total);
    const todayCorrect = computed(() => todayStats.correct);

    const dailyTasks = computed(() => {
      const total = todayCount.value;
      const correct = Math.min(todayCorrect.value, total);
      return [
        { name: '今日答题 20 题', progress: Math.min(100, total >= 20 ? 100 : Math.round(total/20*100)), reward: 20, done: total >= 20 },
        { name: '今日答对 10 题', progress: Math.min(100, correct >= 10 ? 100 : Math.round(correct/10*100)), reward: 15, done: correct >= 10 },
        { name: '完成 1 场挑战', progress: (todayStats.challenges || 0) > 0 ? 100 : 0, reward: 25, done: (todayStats.challenges || 0) > 0 },
      ];
    });

    // ============ 热力图 ============
    const dailyMap = computed(() => {
      const m = {};
      const saved = JSON.parse(localStorage.getItem('tiku_today_stats') || '{}');
      if (saved.date && saved.total > 0) m[saved.date] = saved.total;
      const history = JSON.parse(localStorage.getItem('tiku_heatmap_history') || '{}');
      Object.assign(m, history);
      return m;
    });

    function hmLevel(d, w) {
      const weeks = 15;
      const today = new Date();
      const todayDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
      const offset = (weeks - w) * 7 + (d - 1);
      const cellDate = new Date(today);
      cellDate.setDate(today.getDate() - (todayDay + offset));
      const dateStr = cellDate.toISOString().slice(0, 10);
      const count = dailyMap.value[dateStr] || 0;
      if (count === 0) return 'l0';
      if (count < 5) return 'l1';
      if (count < 10) return 'l2';
      if (count < 20) return 'l3';
      return 'l4';
    }

    function persistHeatmap() {
      const history = JSON.parse(localStorage.getItem('tiku_heatmap_history') || '{}');
      history[todayStats.date] = todayStats.total;
      const keys = Object.keys(history).sort();
      if (keys.length > 120) {
        keys.slice(0, keys.length - 120).forEach(k => delete history[k]);
      }
      localStorage.setItem('tiku_heatmap_history', JSON.stringify(history));
    }

    // ============ 雷达图 ============
    const radarCanvas = ref(null);

    function drawRadar() {
      const canvas = radarCanvas.value;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) * 0.38;

      const subjectStats = progress.subjects || {};
      const subjectNames = Object.keys(subjectStats);
      const labels = subjectNames.length >= 3 ? subjectNames.slice(0, 6) : ['常识判断', '言语理解', '数量关系', '判断推理', '资料分析', '公共基础'];
      const n = labels.length;

      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      for (let level = 1; level <= 4; level++) {
        const r = radius * level / 4;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      ctx.strokeStyle = '#e0e0e0';
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        ctx.stroke();
      }

      const values = labels.map(name => {
        const s = subjectStats[name];
        if (s && s.total > 0) return s.correct / s.total;
        return 0;
      });

      if (values.some(v => v > 0)) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
          const r = radius * values[i];
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(102,126,234,0.25)';
        ctx.fill();
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.stroke();

        for (let i = 0; i < n; i++) {
          const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
          const r = radius * values[i];
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#667eea';
          ctx.fill();
        }
      }

      ctx.fillStyle = '#666';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
        const lx = cx + (radius + 18) * Math.cos(angle);
        const ly = cy + (radius + 18) * Math.sin(angle);
        ctx.fillText(labels[i].length > 5 ? labels[i].slice(0, 5) : labels[i], lx, ly);
      }
    }

    watch(() => progress.subjects, () => { drawRadar(); }, { deep: true });
    watch(page, (p) => { if (p === 'me') setTimeout(drawRadar, 100); });

    // ============ 菜单功能 ============
    function toggleSound() { soundOn.value = !soundOn.value; }
    function toggleDark() { darkMode.value = !darkMode.value; }
    function openOrders() { page.value = 'orders'; pageStack.value.push('orders'); }
    async function editNickname() {
      const name = prompt('请输入新昵称', progress.stat.nickname || '学习用户');
      if (name && name.trim()) {
        progress.stat.nickname = name.trim();
        await post(`/api/progress/${deviceId.value}/nickname`, { nickname: name.trim() });
        alert('昵称已更新');
      }
    }

    // ============ 数据清空 ============
    async function clearAllData() {
      if (!confirm('确认清空所有数据？此操作不可撤销')) return;
      try {
        await post(`/api/progress/${deviceId.value}/clear`, {});
      } catch(e) {}
      localStorage.removeItem('tiku_device');
      location.reload();
    }

    // ============ 管理后台 ============
    const adminToken = ref('');
    const adminAuthenticated = ref(false);
    const adminStats = ref(null);
    const crawlUrl = ref('');
    const crawlCat = ref('');
    const crawlSub = ref('');
    const crawlResult = ref('');
    const importText = ref('');
    async function authAdmin() {
      try {
        const r = await fetch('/api/admin/stats', { headers: { 'x-admin-token': adminToken.value } });
        if (r.ok) { adminAuthenticated.value = true; adminStats.value = await r.json(); }
        else alert('令牌错误');
      } catch (e) { alert('访问失败'); }
    }
    async function doCrawl() {
      const r = await fetch('/api/admin/crawl', { method:'POST', headers:{'Content-Type':'application/json','x-admin-token':adminToken.value},
        body: JSON.stringify({ url: crawlUrl.value, category: crawlCat.value, subject: crawlSub.value }) });
      const data = await r.json();
      crawlResult.value = data.ok ? `✅ 抓取 ${data.found} 道，入库 ${data.inserted} 道` : `❌ ${data.error || '失败'}`;
    }
    async function doImport() {
      try {
        const questions = importText.value.trim().split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l));
        const r = await fetch('/api/admin/ingest', { method:'POST', headers:{'Content-Type':'application/json','x-admin-token':adminToken.value},
          body: JSON.stringify({ questions }) });
        const data = await r.json();
        alert(data.ok ? `✅ 新增 ${data.inserted}，更新 ${data.updated}` : `❌ ${data.error}`);
      } catch (e) { alert('JSON 解析错误: ' + e.message); }
    }
    async function dbClear(cat) {
      if (!confirm('确认清空？')) return;
      const r = await fetch(`/api/admin/clear/${cat}`, { method:'DELETE', headers:{'x-admin-token':adminToken.value} });
      alert((await r.json()).ok ? '已清空' : '失败');
    }

    // ============ HTTP ============
    async function get(url) { const r = await fetch(url); return r.json(); }
    async function post(url, body) {
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      return r.json();
    }

    onMounted(init);

    return {
      page, pageStack, deviceId, showAdmin, showTab, currentTitle, pageTitleMap,
      darkMode, loading,
      categories, subjects, currentCategory, subjectCount, currentSubject,
      myExam, myExamSet, setMyExam, quickPractice, switchMyExam, loadDaily,
      subjectPickerOpen, subjectPickerStep, selectedGroup, selectedExam, toggleSubjectPicker, closeSubjectPicker, selectGroupStep, selectGlobalSubject, selectExamSubject, backToStep, goToStep, currentExamSubjects, switchSubject, examReady, switchTabSafe, allExams,
      progress, products, orders, enrichedOrders, shopFilter, filteredProducts, checkinToday,
      daily, dailyPick, dailyFill, dailyResult, dailyDone, dailyLoaded,
      quizList, quizIndex, quizAnswer, quizJudged, quizCorrect, quizFaved, quizFill,
      quizTotal, quizQuestion, quizMode,
      resultTitle, resultDetail, resultRatio, resultExp,
      listQuestions, openListIdx, currentListQuestion,
      examLeft, previewItems,
      levelStage, levelPassScore, showFullBoard,
      paying, payStatus, currentProduct,
      adminToken, adminAuthenticated, adminStats, crawlUrl, crawlCat, crawlSub, crawlResult, importText,
      expPct, rate, badges, dailyTasks, dailyMap, hmLevel, radarCanvas, drawRadar, soundOn, nextLevelExp,
      goBack, switchTab, goAdmin, optLabel, doCheckin, pickDaily, submitDaily,
      openSubjects, selectSubject, startPractice, startMode, fetchQuestions,
      catIcon, catIconClass, catDesc, catColor, categoryTotal, categoryHot,
      pickQuiz, submitQuiz, nextQuiz, endQuiz, reviewQuiz, nextLevel, retryLevel,
      toggleFav, removeWrong, openListQuestion,
      openWrong, startWrongPractice, openFav, openRecord,
      openProduct, buyProduct, isPaid,
      typeLabel, clearAllData, toggleSound, toggleDark, openOrders, editNickname,
      scrollToDaily, toggleLeaderboard,
      authAdmin, doCrawl, doImport, dbClear,
    };
  }
});

app.mount('#app');