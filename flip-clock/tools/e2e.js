const CHROME = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const URL_BASE = 'http://127.0.0.1:8765/?e2e=' + Date.now();
const PORT = 9333;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  [' + detail + ']' : ''));
}

async function main() {
  const userDir = path.join(os.tmpdir(), 'fc-e2e-' + Date.now());
  fs.mkdirSync(userDir, { recursive: true });

  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--incognito',
    '--hide-scrollbars', '--window-size=500,900',
    '--force-prefers-reduced-motion',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + userDir,
    'about:blank'
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await r.json();
      target = list.find(t => t.type === 'page');
      if (target && target.webSocketDebuggerUrl) break;
    } catch (e) {}
  }
  if (!target) { console.log('NO TARGET'); proc.kill(); return; }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();

  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };

  function send(method, params) {
    return new Promise(res => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  async function evalJs(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.text };
    return r.result && r.result.result ? r.result.result.value : undefined;
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL_BASE });
  await sleep(2200);

  const probe = `(function(){
    function cards(){
      return Array.prototype.map.call(document.querySelectorAll('.card'), function(c){
        var s = c.querySelectorAll('span');
        return {
          small: c.classList.contains('small'),
          t: s[0].textContent, b: s[1].textContent,
          ft: s[2].textContent, fb: s[3].textContent,
          flipping: c.classList.contains('flipping')
        };
      });
    }
    return {
      cardCount: document.querySelectorAll('.card').length,
      cards: cards(),
      caption: (document.getElementById('caption')||{}).textContent,
      sheetOpen: document.getElementById('sheet').classList.contains('open'),
      paneOn: (document.querySelector('.pane.on')||{}).id,
      u: getComputedStyle(document.documentElement).getPropertyValue('--u').trim(),
      scrollOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  })()`;

  function consistent(list) {
    var bad = [];
    list.forEach(function (c, i) {
      if (c.flipping) {
        if (!(c.t === c.fb && c.b === c.ft)) bad.push(i + ':mid:' + c.t + c.b + c.ft + c.fb);
      } else {
        if (!(c.t === c.b && c.t === c.ft && c.t === c.fb)) bad.push(i + ':idle:' + c.t + c.b + c.ft + c.fb);
      }
    });
    return bad.length === 0;
  }
  function detail(list) {
    return list.map(c => c.flipping ? c.t + c.b + c.ft + c.fb + '*' : c.t + c.b + c.ft + c.fb).join(' ');
  }

  let st = await evalJs(probe);
  check('时钟渲染 6 位', st.cardCount === 6, 'got ' + st.cardCount);
  check('时钟四层文本一致', consistent(st.cards), detail(st.cards));
  check('无横向溢出', st.scrollOverflow <= 0, 'overflow=' + st.scrollOverflow);
  check('尺寸变量已设置', /px$/.test(st.u), st.u);

  await sleep(1600);
  st = await evalJs(probe);
  check('1.6 秒后仍一致（翻页已归位）', consistent(st.cards), detail(st.cards));

  const tap = `(function(){
    var s = document.getElementById('stage');
    function ev(t){ s.dispatchEvent(new PointerEvent(t,{clientX:120,clientY:400,bubbles:true,pointerId:1,pointerType:'touch'})); }
    ev('pointerdown'); ev('pointerup');
    return true;
  })()`;
  await evalJs(tap);
  await sleep(700);
  st = await evalJs(probe);
  check('单击唤出面板', st.sheetOpen === true, 'open=' + st.sheetOpen);

  await evalJs(`document.querySelector('[data-pane="count"]').click()`);
  await sleep(300);
  st = await evalJs(probe);
  check('切换到倒计时页', st.paneOn === 'pane-count', st.paneOn);

  await evalJs(`document.getElementById('countStart').click()`);
  await sleep(1500);
  st = await evalJs(probe);
  check('计时视图切换为 4 位', st.cardCount === 4, 'got ' + st.cardCount);
  check('计时视图一致', consistent(st.cards), detail(st.cards));
  check('标题为倒计时', st.caption === '倒计时', st.caption);

  await evalJs(`document.getElementById('countStart').click()`);
  await sleep(500);
  const paused = await evalJs(`document.getElementById('countStart').textContent`);
  check('暂停后按钮变「继续」', paused === '继续', paused);

  await evalJs(`document.getElementById('countReset').click()`);
  await sleep(900);
  st = await evalJs(probe);
  check('重置回时钟 6 位', st.cardCount === 6, 'got ' + st.cardCount);
  check('重置后一致', consistent(st.cards), detail(st.cards));

  await evalJs(`document.querySelector('[data-pane="set"]').click()`);
  await sleep(250);
  const beforeTheme = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`);
  await evalJs(`document.querySelectorAll('.sw')[1].click()`);
  await sleep(250);
  const afterTheme = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`);
  check('主题切换生效', beforeTheme !== afterTheme, beforeTheme + ' -> ' + afterTheme);

  await evalJs(`document.getElementById('swSec').click()`);
  await sleep(600);
  st = await evalJs(probe);
  check('关闭秒后变 4 位', st.cardCount === 4, 'got ' + st.cardCount);
  check('关闭秒后一致', consistent(st.cards), detail(st.cards));

  await evalJs(`document.getElementById('swSec').click()`);
  await sleep(600);
  st = await evalJs(probe);
  check('重新开启秒恢复 6 位', st.cardCount === 6, 'got ' + st.cardCount);

  await evalJs(`document.getElementById('sw24').click()`);
  await sleep(1200);
  st = await evalJs(probe);
  const hourTxt = st.cards.slice(0, 2).map(c => c.t).join('');
  check('切 12 小时制后小时位有效', /^(0[1-9]|1[0-2])$/.test(hourTxt), hourTxt);
  check('12 制下一致', consistent(st.cards), detail(st.cards));

  const ampm = await evalJs(`(function(){
    var el = document.querySelector('#caption .ampm');
    return el ? el.textContent : 'NONE';
  })()`);
  check('12 制显示 AM/PM 徽标', ampm === 'AM' || ampm === 'PM', ampm);

  await evalJs(`document.getElementById('sw24').click()`);
  await sleep(1200);
  const ampm24 = await evalJs(`document.querySelectorAll('#caption .ampm').length`);
  check('24 制不显示 AM/PM', ampm24 === 0, 'count=' + ampm24);

  await evalJs(`document.getElementById('sw24').click()`);
  await sleep(1200);

  await evalJs(`document.querySelector('[data-pane="stats"]').click()`);
  await sleep(300);
  st = await evalJs(probe);
  check('记录页可打开', st.paneOn === 'pane-stats', st.paneOn);

  const bars = await evalJs(`document.querySelectorAll('#bars .bar').length`);
  check('七日柱状 7 根', bars === 7, 'got ' + bars);

  const stored = await evalJs(`localStorage.getItem('flipclock.settings.v1') ? 'yes' : 'no'`);
  check('设置已持久化', stored === 'yes', stored);

  await evalJs(`document.body.classList.remove('sheet-open'); document.getElementById('sheet').classList.remove('open'); true`);
  await sleep(900);
  st = await evalJs(probe);
  check('关闭面板后恢复 6 位一致', st.cardCount === 6 && consistent(st.cards) && !st.sheetOpen, detail(st.cards));

  await send('Page.captureScreenshot', { format: 'png' }).then(r => {
    if (r.result && r.result.data) {
      fs.writeFileSync('E:/workbuddy/2026-11-18-09-38-36/flip-clock/e2e.png', Buffer.from(r.result.data, 'base64'));
    }
  });

  const fails = results.filter(r => !r.ok);
  console.log('\n==== ' + (results.length - fails.length) + '/' + results.length + ' passed ====');
  if (fails.length) console.log('FAILED: ' + fails.map(f => f.name).join(' | '));

  ws.close();
  proc.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {}
}

main().catch(e => { console.error('ERR', e); process.exit(1); });
