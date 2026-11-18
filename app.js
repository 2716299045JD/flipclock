(function () {
  'use strict';

  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };

  var THEMES = {
    classic: { bg: '#000000', cardTop: '#2b2b30', cardBottom: '#1c1c20', flapTop: '#33333a', flapBottom: '#1c1c20', ink: '#f2f2f5', muted: 'rgba(242,242,245,.36)', line: 'rgba(255,255,255,.1)', seam: 'rgba(0,0,0,.92)' },
    paper:   { bg: '#e9e7e2', cardTop: '#ffffff', cardBottom: '#f3f1ed', flapTop: '#fdfcfa', flapBottom: '#f3f1ed', ink: '#23232b', muted: 'rgba(35,35,43,.42)', line: 'rgba(0,0,0,.1)', seam: 'rgba(0,0,0,.3)' },
    night:   { bg: '#070000', cardTop: '#251111', cardBottom: '#180909', flapTop: '#2e1616', flapBottom: '#180909', ink: '#ff5f52', muted: 'rgba(255,95,82,.4)', line: 'rgba(255,95,82,.16)', seam: 'rgba(0,0,0,.9)' },
    amber:   { bg: '#0a0603', cardTop: '#2f2110', cardBottom: '#1e1509', flapTop: '#3a2810', flapBottom: '#1e1509', ink: '#ffb75c', muted: 'rgba(255,183,92,.4)', line: 'rgba(255,183,92,.16)', seam: 'rgba(0,0,0,.9)' },
    mint:    { bg: '#04100c', cardTop: '#132c23', cardBottom: '#0a1c16', flapTop: '#18382c', flapBottom: '#0a1c16', ink: '#72e6b7', muted: 'rgba(114,230,183,.4)', line: 'rgba(114,230,183,.16)', seam: 'rgba(0,0,0,.9)' }
  };

  var KEY_SET = 'flipclock.settings.v1';
  var KEY_REC = 'flipclock.records.v1';

  var DEFAULTS = {
    theme: 'classic',
    h24: true,
    sec: true,
    sound: false,
    wake: true,
    night: true,
    bright: 100,
    pomoMin: 25
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(KEY_SET);
      if (!raw) return Object.assign({}, DEFAULTS);
      var o = JSON.parse(raw);
      var out = Object.assign({}, DEFAULTS);
      for (var k in o) { if (k in out) out[k] = o[k]; }
      return out;
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }

  function saveSettings() {
    try { localStorage.setItem(KEY_SET, JSON.stringify(S)); } catch (e) {}
  }

  var S = loadSettings();

  function dayKey(d) {
    var t = d || new Date();
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
  }

  function loadRecords() {
    try {
      var raw = localStorage.getItem(KEY_REC);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveRecords(r) {
    try { localStorage.setItem(KEY_REC, JSON.stringify(r)); } catch (e) {}
  }

  function addRecord(kind, ms, count) {
    var r = loadRecords();
    var k = dayKey();
    if (!r[k]) r[k] = { pomo: 0, focus: 0 };
    if (kind === 'pomo') r[k].pomo += (count || 1);
    if (kind === 'pomo' || kind === 'count') r[k].focus += ms;
    saveRecords(r);
    paintStats();
  }

  function makeSpan() {
    var s = document.createElement('span');
    s.textContent = '0';
    return s;
  }

  function makeCard(small) {
    var card = document.createElement('div');
    card.className = 'card' + (small ? ' small' : '');

    var ft = document.createElement('div'); ft.className = 'face top';
    var ftS = makeSpan(); ft.appendChild(ftS);

    var fb = document.createElement('div'); fb.className = 'face bottom';
    var fbS = makeSpan(); fb.appendChild(fbS);

    var flt = document.createElement('div'); flt.className = 'flap flap-top';
    var fltS = makeSpan(); flt.appendChild(fltS);

    var flb = document.createElement('div'); flb.className = 'flap flap-bottom';
    var flbS = makeSpan(); flb.appendChild(flbS);

    card.appendChild(ft);
    card.appendChild(fb);
    card.appendChild(flt);
    card.appendChild(flb);

    return { el: card, ft: ftS, fb: fbS, flt: fltS, flb: flbS, cur: null };
  }

  function makeColon(small) {
    var c = document.createElement('div');
    c.className = 'colon' + (small ? ' small' : '');
    c.appendChild(document.createElement('i'));
    c.appendChild(document.createElement('i'));
    return c;
  }

  var burn = document.getElementById('burn');
  var slots = [];
  var slotMode = '';

  function build(pattern, small) {
    var row = document.createElement('div');
    row.className = 'row';
    var out = [];
    for (var i = 0; i < pattern.length; i++) {
      if (pattern[i] === 'c') {
        row.appendChild(makeColon(small));
      } else {
        var card = makeCard(small);
        out.push(card);
        row.appendChild(card.el);
      }
    }
    return { row: row, slots: out };
  }

  var captionEl = null;

  function rebuild(mode) {
    if (slotMode === mode) return;
    slotMode = mode;
    burn.innerHTML = '';
    slots = [];

    if (mode === 'clock') {
      var main = build(['d', 'd', 'c', 'd', 'd'], false);
      burn.appendChild(main.row);
      slots = slots.concat(main.slots);

      if (S.sec) {
        var sec = build(['d', 'd'], true);
        sec.row.className = 'row sec';
        burn.appendChild(sec.row);
        slots = slots.concat(sec.slots);
      }

      captionEl = document.createElement('div');
      captionEl.id = 'caption';
      burn.appendChild(captionEl);
      paintCaption();
    } else {
      var t = build(['d', 'd', 'c', 'd', 'd'], false);
      burn.appendChild(t.row);
      slots = slots.concat(t.slots);

      captionEl = document.createElement('div');
      captionEl.id = 'caption';
      captionEl.textContent = '计时中';
      burn.appendChild(captionEl);
    }

    slotMode = mode;
  }

  function paintCaption() {
    if (!captionEl) return;
    var d = new Date();
    var wk = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()];
    var dateStr = (d.getMonth() + 1) + '月' + d.getDate() + '日　' + wk;
    if (S.h24) {
      captionEl.textContent = dateStr;
    } else {
      captionEl.innerHTML = '<span class="ampm">' + (d.getHours() < 12 ? 'AM' : 'PM') + '</span>' + dateStr;
    }
  }

  var audioCtx = null;
  var noiseBuf = null;

  function initAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      audioCtx = new Ctx();
      var len = Math.floor(audioCtx.sampleRate * 0.07);
      noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 7);
      }
      return true;
    } catch (e) { return false; }
  }

  function tickSound() {
    if (!S.sound) return;
    if (!audioCtx && !initAudio()) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 1.5;
    var g = audioCtx.createGain();
    g.gain.value = 0.13;
    src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
    src.start();
  }

  function chime() {
    if (!audioCtx && !initAudio()) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var notes = [784, 988, 1319];
    notes.forEach(function (f, i) {
      var t0 = audioCtx.currentTime + i * 0.22;
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.75);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + 0.8);
    });
  }

  function flip(slot, nd) {
    var od = slot.cur;
    if (od === nd) return;
    slot.cur = nd;
    slot.flt.textContent = od;
    slot.ft.textContent = nd;
    slot.flb.textContent = nd;

    var el = slot.el;
    el.classList.remove('flipping');
    void el.offsetWidth;
    el.classList.add('flipping');
    tickSound();

    window.setTimeout(function () {
      slot.fb.textContent = nd;
      slot.flt.textContent = nd;
      el.classList.remove('flipping');
    }, 640);
  }

  function setAll(str) {
    var compact = str.replace(/:/g, '');
    for (var i = 0; i < slots.length; i++) {
      var d = compact.charAt(i) || '0';
      slots[i].cur = d;
      slots[i].ft.textContent = d;
      slots[i].fb.textContent = d;
      slots[i].flt.textContent = d;
      slots[i].flb.textContent = d;
    }
  }

  function push(str) {
    var compact = str.replace(/:/g, '');
    for (var i = 0; i < slots.length; i++) {
      flip(slots[i], compact.charAt(i) || '0');
    }
  }

  var viewMode = 'clock';
  var lastClockStr = '';

  function clockString() {
    var d = new Date();
    var h = d.getHours();
    if (!S.h24) {
      h = h % 12;
      if (h === 0) h = 12;
    }
    return pad(h) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  var clockTimer = null;

  function clockLoop() {
    if (clockTimer) { window.clearTimeout(clockTimer); clockTimer = null; }
    if (timer.phase === 'running') return;

    if (viewMode !== 'clock') {
      viewMode = 'clock';
      rebuild('clock');
      lastClockStr = '';
    }

    var str = clockString();
    if (str !== lastClockStr) {
      if (!lastClockStr) setAll(str);
      else push(str);
      lastClockStr = str;
    }
    paintCaption();

    var d = new Date();
    clockTimer = window.setTimeout(clockLoop, 1000 - (d.getTime() % 1000) + 12);
  }

  var timer = {
    kind: null,
    phase: 'idle',
    startTs: 0,
    accMs: 0,
    totalMs: 0,
    restMode: false,
    round: 0
  };

  function elapsedMs() {
    return timer.accMs + (timer.phase === 'running' ? (Date.now() - timer.startTs) : 0);
  }

  function remainMs() {
    return Math.max(0, timer.totalMs - elapsedMs());
  }

  function fmtMS(ms, roundUp) {
    var total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
    var m = Math.min(99, Math.floor(total / 60));
    var s = total % 60;
    return pad(m) + ':' + pad(s);
  }

  var timerRAF = null;
  var lastTimerText = '';

  function paintTimer() {
    var text;
    if (timer.kind === 'stop' || timer.kind === 'pomo') {
      text = fmtMS(timer.kind === 'stop' ? elapsedMs() : remainMs(), false);
    } else {
      text = fmtMS(remainMs(), true);
    }

    if (text !== lastTimerText) {
      if (viewMode !== 'timer') {
        viewMode = 'timer';
        rebuild('timer');
        setAll(text);
      } else {
        push(text);
      }
      lastTimerText = text;

      var pd = document.getElementById('pomoDisp');
      var cd = document.getElementById('countDisp');
      var sd = document.getElementById('stopDisp');
      if (pd) pd.textContent = timer.kind === 'pomo' ? text : pd.textContent;
      if (cd) cd.textContent = timer.kind === 'count' ? text : cd.textContent;
      if (sd) sd.textContent = timer.kind === 'stop' ? text : sd.textContent;
    }

    if (captionEl) {
      if (timer.kind === 'pomo') {
        captionEl.textContent = timer.restMode ? '休息中' : '专注中';
      } else if (timer.kind === 'count') {
        captionEl.textContent = '倒计时';
      } else {
        captionEl.textContent = '秒表';
      }
    }
  }

  function timerLoop() {
    if (timer.phase !== 'running') { timerRAF = null; return; }
    paintTimer();

    if ((timer.kind === 'pomo' || timer.kind === 'count') && remainMs() <= 0) {
      finishTimer();
      return;
    }
    timerRAF = window.requestAnimationFrame(timerLoop);
  }

  function startTimer(kind) {
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (clockTimer) { window.clearTimeout(clockTimer); clockTimer = null; }

    timer.kind = kind;
    timer.phase = 'running';
    timer.accMs = 0;
    timer.startTs = Date.now();
    timer.restMode = false;
    timer.round = 0;
    lastTimerText = '';

    if (kind === 'pomo') timer.totalMs = S.pomoMin * 60000;
    else if (kind === 'count') timer.totalMs = countMinutes * 60000;
    else timer.totalMs = 0;

    if (timerRAF) window.cancelAnimationFrame(timerRAF);
    timerRAF = window.requestAnimationFrame(timerLoop);
    syncButtons();
  }

  function pauseTimer() {
    if (timer.phase !== 'running') return;
    timer.accMs += Date.now() - timer.startTs;
    timer.phase = 'paused';
    if (timerRAF) { window.cancelAnimationFrame(timerRAF); timerRAF = null; }
    syncButtons();
  }

  function resumeTimer() {
    if (timer.phase !== 'paused') return;
    timer.startTs = Date.now();
    timer.phase = 'running';
    if (timerRAF) window.cancelAnimationFrame(timerRAF);
    timerRAF = window.requestAnimationFrame(timerLoop);
    syncButtons();
  }

  function resetTimer() {
    if (timerRAF) { window.cancelAnimationFrame(timerRAF); timerRAF = null; }
    timer.phase = 'idle';
    timer.accMs = 0;
    timer.startTs = 0;
    timer.round = 0;
    timer.restMode = false;
    var k = timer.kind;
    timer.kind = null;
    viewMode = 'clock';
    rebuild('clock');
    lastClockStr = '';
    lastTimerText = '';
    if (k === 'pomo') document.getElementById('pomoDisp').textContent = pad(S.pomoMin) + ':00';
    if (k === 'count') document.getElementById('countDisp').textContent = pad(countMinutes) + ':00';
    if (k === 'stop') document.getElementById('stopDisp').textContent = '00:00';
    syncButtons();
    if (!clockTimer) clockLoop();
  }

  function finishTimer() {
    if (timerRAF) { window.cancelAnimationFrame(timerRAF); timerRAF = null; }

    if (timer.kind === 'pomo') {
      if (!timer.restMode) {
        addRecord('pomo', timer.totalMs);
        timer.round++;
        timer.restMode = true;
        timer.totalMs = (timer.round % 4 === 0 ? 15 : 5) * 60000;
        timer.accMs = 0;
        timer.startTs = Date.now();
        timer.phase = 'running';
        timerRAF = window.requestAnimationFrame(timerLoop);
        notify('番茄结束，开始休息');
        chime();
        vibrate([220, 120, 220, 120, 420]);
        syncButtons();
        return;
      } else {
        timer.restMode = false;
        timer.totalMs = S.pomoMin * 60000;
        timer.accMs = 0;
        timer.startTs = Date.now();
        timer.phase = 'running';
        timerRAF = window.requestAnimationFrame(timerLoop);
        notify('休息结束，继续专注');
        chime();
        vibrate([220, 120, 220, 120, 420]);
        syncButtons();
        return;
      }
    }

    if (timer.kind === 'count') {
      addRecord('count', timer.totalMs);
      notify('倒计时结束');
      chime();
      vibrate([300, 100, 300, 100, 500]);
    }

    timer.phase = 'idle';
    viewMode = 'clock';
    rebuild('clock');
    lastClockStr = '';
    lastTimerText = '';
    syncButtons();
    if (!clockTimer) clockLoop();
  }

  function vibrate(p) {
    if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} }
  }

  function notify(text) {
    toast(text);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('翻页时钟', { body: text, silent: true }); } catch (e) {}
    }
  }

  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('on');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  }

  function updatePomoSub() {
    var el = document.getElementById('pomoSub');
    if (!el) return;
    if (timer.kind === 'pomo' && timer.restMode) {
      el.textContent = '休息 · 每 4 个番茄长休 15 分钟';
    } else if (timer.round > 0) {
      el.textContent = '专注 · 已完成 ' + timer.round + ' 个';
    } else {
      el.textContent = '专注 · 已连续 0 个';
    }
  }

  function syncButtons() {
    var running = timer.phase === 'running';
    var paused = timer.phase === 'paused';

    var ps = document.getElementById('pomoStart');
    if (ps) ps.textContent = running && timer.kind === 'pomo' ? '暂停' : (paused && timer.kind === 'pomo' ? '继续' : '开始');

    var cs = document.getElementById('countStart');
    if (cs) cs.textContent = running && timer.kind === 'count' ? '暂停' : (paused && timer.kind === 'count' ? '继续' : '开始');

    var ss = document.getElementById('stopStart');
    if (ss) ss.textContent = running && timer.kind === 'stop' ? '暂停' : (paused && timer.kind === 'stop' ? '继续' : '开始');

    updatePomoSub();
  }

  var countMinutes = 15;

  var wakeLock = null;

  function reqWake() {
    if (!S.wake) { releaseWake(); return; }
    if (!('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible') return;
    if (wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () {});
  }

  function releaseWake() {
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
  }

  function applyTheme() {
    var t = THEMES[S.theme] || THEMES.classic;
    var r = document.documentElement.style;
    r.setProperty('--bg', t.bg);
    r.setProperty('--card-top', t.cardTop);
    r.setProperty('--card-bottom', t.cardBottom);
    r.setProperty('--flap-top', t.flapTop);
    r.setProperty('--flap-bottom', t.flapBottom);
    r.setProperty('--ink', t.ink);
    r.setProperty('--muted', t.muted);
    r.setProperty('--line', t.line);
    r.setProperty('--seam', t.seam);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t.bg);
  }

  function fit() {
    var w = window.innerWidth || 390;
    var h = window.innerHeight || 844;
    var byWidth = (w * 0.92) / 4.58;
    var byHeight = h * 0.27;
    var u = Math.min(byWidth, byHeight, 220);
    if (u < 26) u = 26;
    document.documentElement.style.setProperty('--u', u.toFixed(2) + 'px');
  }

  function applyBright() {
    var stage = document.getElementById('stage');
    var v = S.bright / 100;
    if (S.night) {
      var h = new Date().getHours();
      if (h >= 22 || h < 7) v = Math.min(v, 0.42);
    }
    stage.style.filter = v < 0.99 ? 'brightness(' + v + ')' : '';
  }

  var burnTimer = null;
  function startBurnIn() {
    if (burnTimer) return;
    burnTimer = window.setInterval(function () {
      if (viewMode !== 'clock' || timer.phase === 'running') return;
      var x = (Math.random() * 5 - 2.5).toFixed(1);
      var y = (Math.random() * 5 - 2.5).toFixed(1);
      var b = document.getElementById('burn');
      if (b) b.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }, 45000);
  }

  var lastTapTs = 0;
  var tapDelay = null;
  var pressTimer = null;
  var startPt = null;

  function openSheet(pane) {
    document.body.classList.add('sheet-open');
    document.getElementById('sheet').classList.add('open');
    if (pane) selectPane(pane);
    hideHint();
    askNotify();
  }

  function closeSheet() {
    document.body.classList.remove('sheet-open');
    document.getElementById('sheet').classList.remove('open');
  }

  function sheetOpen() {
    return document.getElementById('sheet').classList.contains('open');
  }

  function selectPane(name) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('on', tabs[i].getAttribute('data-pane') === name);
    }
    var panes = document.querySelectorAll('.pane');
    for (var j = 0; j < panes.length; j++) {
      panes[j].classList.toggle('on', panes[j].id === 'pane-' + name);
    }
    if (name === 'stats') paintStats();
  }

  var hintEl = document.getElementById('hint');
  function hideHint() { hintEl.classList.add('gone'); }

  var stage = document.getElementById('stage');

  stage.addEventListener('pointerdown', function (e) {
    startPt = { x: e.clientX, y: e.clientY, t: Date.now() };
    if (pressTimer) window.clearTimeout(pressTimer);
    pressTimer = window.setTimeout(function () {
      pressTimer = null;
      startPt = null;
      openSheet('set');
      hideHint();
    }, 620);
  });

  stage.addEventListener('pointerup', function (e) {
    if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = null; }
    if (!startPt) return;

    var dx = Math.abs(e.clientX - startPt.x);
    var dy = Math.abs(e.clientY - startPt.y);
    var dt = Date.now() - startPt.t;
    startPt = null;

    if (dx > 12 || dy > 12 || dt > 620) return;

    if (sheetOpen()) { closeSheet(); return; }

    var now = Date.now();
    if (now - lastTapTs < 240) {
      if (tapDelay) { window.clearTimeout(tapDelay); tapDelay = null; }
      lastTapTs = 0;
      S.sound = !S.sound;
      saveSettings();
      syncSwitch();
      toast(S.sound ? '翻页音效已开启' : '翻页音效已关闭');
      if (S.sound && !audioCtx) initAudio();
      return;
    }
    lastTapTs = now;

    if (tapDelay) window.clearTimeout(tapDelay);
    tapDelay = window.setTimeout(function () {
      tapDelay = null;
      openSheet();
    }, 270);
  });

  stage.addEventListener('pointercancel', function () {
    if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = null; }
    startPt = null;
  });

  document.getElementById('sheet').addEventListener('click', function (e) {
    if (e.target.id === 'sheet') closeSheet();
  });

  document.getElementById('tabs').addEventListener('click', function (e) {
    var t = e.target.closest('.tab');
    if (t) selectPane(t.getAttribute('data-pane'));
  });

  document.getElementById('pomoStart').addEventListener('click', function () {
    if (timer.kind === 'pomo' && timer.phase === 'running') pauseTimer();
    else if (timer.kind === 'pomo' && timer.phase === 'paused') resumeTimer();
    else startTimer('pomo');
  });

  document.getElementById('pomoReset').addEventListener('click', function () {
    if (timer.kind === 'pomo') resetTimer();
  });

  document.getElementById('countStart').addEventListener('click', function () {
    if (timer.kind === 'count' && timer.phase === 'running') pauseTimer();
    else if (timer.kind === 'count' && timer.phase === 'paused') resumeTimer();
    else startTimer('count');
  });

  document.getElementById('countReset').addEventListener('click', function () {
    if (timer.kind === 'count') resetTimer();
  });

  document.getElementById('stopStart').addEventListener('click', function () {
    if (timer.kind === 'stop' && timer.phase === 'running') pauseTimer();
    else if (timer.kind === 'stop' && timer.phase === 'paused') resumeTimer();
    else startTimer('stop');
  });

  document.getElementById('stopReset').addEventListener('click', function () {
    if (timer.kind === 'stop') resetTimer();
  });

  var pomoChips = document.getElementById('pomoChips');
  pomoChips.addEventListener('click', function (e) {
    var c = e.target.closest('.chip');
    if (!c) return;
    var arr = pomoChips.querySelectorAll('.chip');
    for (var i = 0; i < arr.length; i++) arr[i].classList.remove('on');
    c.classList.add('on');
    S.pomoMin = parseInt(c.getAttribute('data-min'), 10);
    saveSettings();
    if (timer.kind !== 'pomo' || timer.phase === 'idle') {
      document.getElementById('pomoDisp').textContent = pad(S.pomoMin) + ':00';
    }
  });

  var countChips = document.getElementById('countChips');
  countChips.addEventListener('click', function (e) {
    var c = e.target.closest('.chip');
    if (!c) return;
    var arr = countChips.querySelectorAll('.chip');
    for (var i = 0; i < arr.length; i++) arr[i].classList.remove('on');
    c.classList.add('on');
    countMinutes = parseInt(c.getAttribute('data-min'), 10);
    if (timer.kind !== 'count' || timer.phase === 'idle') {
      document.getElementById('countDisp').textContent = pad(countMinutes) + ':00';
    }
  });

  function paintStats() {
    var r = loadRecords();
    var today = r[dayKey()] || { pomo: 0, focus: 0 };
    var p = document.getElementById('stPomo');
    var f = document.getElementById('stFocus');
    if (p) p.innerHTML = today.pomo + '<small>个</small>';
    if (f) f.innerHTML = Math.round(today.focus / 60000) + '<small>分钟</small>';

    var bars = document.getElementById('bars');
    var labels = document.getElementById('barLabels');
    if (!bars || !labels) return;

    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var k = dayKey(d);
      days.push({ key: k, focus: (r[k] && r[k].focus) || 0, isToday: i === 0, label: (d.getMonth() + 1) + '/' + d.getDate() });
    }

    var max = 1;
    days.forEach(function (x) { if (x.focus > max) max = x.focus; });

    bars.innerHTML = '';
    labels.innerHTML = '';
    days.forEach(function (x) {
      var b = document.createElement('div');
      b.className = 'bar' + (x.isToday ? ' today' : '');
      var i2 = document.createElement('i');
      i2.style.height = Math.max(3, Math.round(x.focus / max * 100)) + '%';
      b.appendChild(i2);
      bars.appendChild(b);

      var s = document.createElement('span');
      s.textContent = x.label;
      labels.appendChild(s);
    });
  }

  function syncSwitch() {
    document.getElementById('sw24').classList.toggle('on', S.h24);
    document.getElementById('swSec').classList.toggle('on', S.sec);
    document.getElementById('swSound').classList.toggle('on', S.sound);
    document.getElementById('swWake').classList.toggle('on', S.wake);
    document.getElementById('swNight').classList.toggle('on', S.night);
    document.getElementById('bright').value = S.bright;

    var sw = document.getElementById('swatches');
    sw.innerHTML = '';
    Object.keys(THEMES).forEach(function (k) {
      var d = document.createElement('div');
      d.className = 'sw' + (S.theme === k ? ' on' : '');
      d.style.background = THEMES[k].bg;
      d.style.setProperty('--sw-ink', THEMES[k].ink);
      d.setAttribute('data-theme', k);
      sw.appendChild(d);
    });

    var pc = document.getElementById('pomoChips').querySelectorAll('.chip');
    for (var pi = 0; pi < pc.length; pi++) {
      pc[pi].classList.toggle('on', parseInt(pc[pi].getAttribute('data-min'), 10) === S.pomoMin);
    }
    var pdisp = document.getElementById('pomoDisp');
    if (pdisp && (timer.kind !== 'pomo' || timer.phase === 'idle')) {
      pdisp.textContent = pad(S.pomoMin) + ':00';
    }

    var cap = document.getElementById('capTip');
    if (cap) {
      var wl = 'wakeLock' in navigator;
      var fs = !!(document.documentElement.requestFullscreen);
      var lines = [];
      lines.push('常亮支持：' + (wl ? '是' : '否，请在系统设置里把自动锁屏调长'));
      lines.push('全屏能力：' + (fs ? '支持' : '不支持，请用「添加到主屏幕」'));
      if (navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches) {
        lines.push('当前以独立应用模式运行');
      }
      cap.textContent = lines.join('　·　');
    }
  }

  document.getElementById('swatches').addEventListener('click', function (e) {
    var s = e.target.closest('.sw');
    if (!s) return;
    S.theme = s.getAttribute('data-theme');
    saveSettings();
    applyTheme();
    syncSwitch();
  });

  document.getElementById('sw24').addEventListener('click', function () {
    S.h24 = !S.h24; saveSettings(); syncSwitch(); lastClockStr = '';
  });
  document.getElementById('swSec').addEventListener('click', function () {
    S.sec = !S.sec; saveSettings(); syncSwitch(); slotMode = ''; rebuild('clock'); lastClockStr = '';
  });
  document.getElementById('swSound').addEventListener('click', function () {
    S.sound = !S.sound; saveSettings(); syncSwitch();
    if (S.sound && !audioCtx) initAudio();
  });
  document.getElementById('swWake').addEventListener('click', function () {
    S.wake = !S.wake; saveSettings(); syncSwitch();
    if (S.wake) reqWake(); else releaseWake();
  });
  document.getElementById('swNight').addEventListener('click', function () {
    S.night = !S.night; saveSettings(); syncSwitch(); applyBright();
  });
  document.getElementById('bright').addEventListener('input', function (e) {
    S.bright = parseInt(e.target.value, 10);
    saveSettings();
    applyBright();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      reqWake();
      applyBright();
      lastClockStr = '';
      if (timer.phase === 'running') {
        if (timerRAF) window.cancelAnimationFrame(timerRAF);
        timerRAF = window.requestAnimationFrame(timerLoop);
      }
      if (!clockTimer) clockLoop();
    }
  });

  window.addEventListener('orientationchange', function () {
    window.setTimeout(function () {
      fit();
      slotMode = '';
      if (viewMode === 'clock') rebuild('clock');
      else rebuild('timer');
    }, 220);
  });

  window.addEventListener('resize', function () {
    fit();
  });

  var notifAsked = false;
  function askNotify() {
    if (notifAsked) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') { notifAsked = true; return; }
    notifAsked = true;
    try { Notification.requestPermission(); } catch (e) {}
  }

  applyTheme();
  fit();
  applyBright();
  syncSwitch();
  rebuild('clock');
  lastClockStr = '';
  clockLoop();
  reqWake();
  startBurnIn();
  paintStats();

  var qp = null;
  try { qp = new URLSearchParams(window.location.search).get('pane'); } catch (e) {}
  if (qp) {
    window.setTimeout(function () { openSheet(qp); }, 260);
  }

  var canSW = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (canSW && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  window.setTimeout(hideHint, 4200);
})();
