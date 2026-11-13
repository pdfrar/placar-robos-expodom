// Tela da TV: placar, animações, sons, wake lock
import * as S from './store.js';
import { mountPainel, bindShortcuts, registerSW, toggleFullscreen } from './painel.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- som (Web Audio, sem arquivos) ----------
let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function tone(freq, start, dur, opts = {}) {
  try { playTone(freq, start, dur, opts); } catch (e) { /* som nunca pode travar a tela */ }
}
function playTone(freq, start, dur, { type = 'square', vol = 0.18, vibrato = 0 } = {}) {
  if (!S.get().sound) return;
  const a = audio();
  if (!a) return;
  const fade = Math.min(0.05, dur / 3);
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (vibrato) {
    const lfo = a.createOscillator();
    const lg = a.createGain();
    lfo.frequency.value = 28;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t0); lfo.stop(t0 + dur);
  }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + fade);
  g.gain.setValueAtTime(vol, t0 + dur - fade);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
const sfx = {
  whistle: (n = 1, len = 0.35) => { for (let i = 0; i < n; i++) tone(2600, i * (len + 0.12), len, { type: 'sine', vol: 0.22, vibrato: 140 }); },
  goal: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.16, { type: 'square', vol: 0.12 }));
    tone(1047, 0.48, 0.5, { type: 'square', vol: 0.12 });
    tone(1319, 0.48, 0.5, { type: 'triangle', vol: 0.1 });
  },
  beep: () => tone(880, 0, 0.12, { type: 'square', vol: 0.1 }),
  tick: () => tone(1400, 0, 0.03, { type: 'square', vol: 0.05 }),
  down: () => tone(220, 0, 0.18, { type: 'sawtooth', vol: 0.08 }),
};

// ---------- ajuste do tamanho do nome ----------
function fit(el, maxU, minU = 1.6) {
  let size = maxU;
  el.style.fontSize = `calc(var(--u) * ${size})`;
  while (el.scrollWidth > el.clientWidth + 1 && size > minU) {
    size -= 0.15;
    el.style.fontSize = `calc(var(--u) * ${size})`;
  }
}
const fitNames = () => ['left', 'right'].forEach((side) => fit($(`#name-${side} .txt`), 4.4));

function restart(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// ---------- animação de sorteio ----------
const rolling = { left: 0, right: 0 };
function rollName(side, finalName) {
  const el = $(`#name-${side} .txt`);
  const pool = S.get().names;
  const id = ++rolling[side];
  const start = performance.now();
  const total = 1900 + (side === 'right' ? 500 : 0);
  let delay = 50;
  $(`#name-${side}`).classList.add('rolling');
  const step = () => {
    if (id !== rolling[side]) return;
    if (performance.now() - start >= total) {
      el.textContent = finalName;
      fit(el, 4.4);
      $(`#name-${side}`).classList.remove('rolling');
      restart($(`#name-${side}`), 'land');
      sfx.beep();
      return;
    }
    el.textContent = pool[Math.floor(Math.random() * pool.length)] || finalName;
    fit(el, 4.4);
    sfx.tick();
    delay *= 1.12;
    setTimeout(step, delay);
  };
  step();
}

// ---------- overlays ----------
let overlayTimer = null;
function showOverlay(kind, html, ms) {
  const ov = $('#overlay');
  ov.className = `overlay ${kind}`;
  ov.innerHTML = html;
  restart(ov, 'show');
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => ov.classList.remove('show'), ms);
}

// ---------- render ----------
let last = null;
function render(s, ev) {
  $('#match-n').textContent = s.match;

  for (const side of ['left', 'right']) {
    const card = $(`#team-${side}`);
    const sc = $(`#score-${side}`);
    if (sc.textContent !== String(s[side].score)) {
      sc.textContent = s[side].score;
      restart(sc, 'bump');
    }
    const isRolling = $(`#name-${side}`).classList.contains('rolling');
    const txt = $(`#name-${side} .txt`);
    if (!isRolling && txt.textContent !== s[side].name) {
      txt.textContent = s[side].name;
      fit(txt, 4.4);
    }
    const other = side === 'left' ? 'right' : 'left';
    card.classList.toggle('winner', s.status === 'fim' && s[side].score > s[other].score);
  }
  $('#center').classList.toggle('no-timer', !s.showTimer);
  const draw = s.status === 'fim' && s.left.score === s.right.score;
  $('#status').textContent = {
    pronto: 'PREPARAR', jogando: 'EM JOGO', pausado: 'PAUSADO', fim: draw ? 'EMPATE' : 'FIM DE JOGO',
  }[s.status];
  $('#status').dataset.s = s.status;

  const hist = s.history.filter((h) => !(h.n === s.match && s.status !== 'fim')).slice(0, 4);
  $('#history').innerHTML = hist.length
    ? hist.map((h) => `
      <li><span class="n">#${h.n}</span>
        <span class="${h.l.score > h.r.score ? 'w' : ''}">${esc(h.l.name)}</span>
        <b>${h.l.score} × ${h.r.score}</b>
        <span class="${h.r.score > h.l.score ? 'w' : ''}">${esc(h.r.name)}</span></li>`).join('')
    : '<li class="empty">As partidas encerradas aparecem aqui</li>';

  if (ev) handleEvent(s, ev);
  last = s;
  tick();
}

function handleEvent(s, ev) {
  switch (ev.type) {
    case 'gol': {
      const side = ev.side;
      restart($(`#team-${side}`), 'scored');
      showOverlay(`goal ${side}`, `
        <div class="ov-big">GOOOL!</div>
        <div class="ov-name">${esc(s[side].name)}</div>
        <div class="ov-score">${s.left.score} <span>×</span> ${s.right.score}</div>`, 2800);
      sfx.goal();
      break;
    }
    case 'menos': sfx.down(); break;
    case 'nomes':
      if (ev.sorteio) ev.sides.forEach((side) => rollName(side, s[side].name));
      else ev.sides.forEach((side) => restart($(`#name-${side}`), 'land'));
      break;
    case 'inicio': sfx.whistle(1, 0.45); break;
    case 'pausa': sfx.whistle(1, 0.2); break;
    case 'fim': {
      const w = s.left.score === s.right.score ? null : (s.left.score > s.right.score ? 'left' : 'right');
      showOverlay(`end ${w || 'draw'}`, `
        <div class="ov-small">FIM DE JOGO</div>
        <div class="ov-big">${w ? 'VITÓRIA!' : 'EMPATE!'}</div>
        ${w ? `<div class="ov-name">${esc(s[w].name)}</div>` : ''}
        <div class="ov-score">${s.left.score} <span>×</span> ${s.right.score}</div>`, 5200);
      sfx.whistle(3, 0.5);
      break;
    }
    case 'nova':
      showOverlay('new', `<div class="ov-small">PARTIDA</div><div class="ov-big">#${s.match}</div>`, 1800);
      break;
    case 'troca':
      ['left', 'right'].forEach((side) => {
        const t = $(`#name-${side} .txt`);
        t.textContent = s[side].name; fit(t, 4.4);
        restart($(`#team-${side}`), 'swap');
      });
      break;
  }
}

// ---------- cronômetro ----------
let lastSec = null;
function tick() {
  const s = S.get();
  const ms = S.remaining(s);
  const secs = Math.ceil(ms / 1000);
  $('#timer').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const run = S.running(s);
  $('#timer').classList.toggle('danger', run && secs <= 10);
  $('#timer').classList.toggle('paused', s.status === 'pausado');
  const total = s.timer.duration || 1;
  $('#timer-bar').style.transform = `scaleX(${Math.max(0, Math.min(1, ms / total))})`;
  if (run && secs !== lastSec && secs <= 5 && secs > 0) sfx.beep();
  lastSec = secs;
  if (run && ms <= 0) S.finishTimer();
}

// ---------- painel lateral ----------
const drawer = $('#drawer');
function setPanel(open) {
  const v = open === undefined ? !drawer.classList.contains('open') : open;
  drawer.classList.toggle('open', v);
  document.body.classList.toggle('panel-open', v);
}
mountPainel($('#drawer-inner'), { embedded: true, onClose: () => setPanel(false) });
bindShortcuts({ onPanel: setPanel, onFull: toggleFullscreen });
$('#gear').addEventListener('click', () => setPanel(true));
$('#drawer-backdrop').addEventListener('click', () => setPanel(false));

// esconde o cursor e o botão quando parado
let idle = null;
function wake() {
  document.body.classList.add('active');
  clearTimeout(idle);
  idle = setTimeout(() => document.body.classList.remove('active'), 2500);
}
['mousemove', 'mousedown', 'touchstart'].forEach((e) => window.addEventListener(e, wake, { passive: true }));

// libera o áudio no primeiro toque/tecla
const unlock = () => { audio(); updateSoundHint(); };
['keydown', 'mousedown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
function updateSoundHint() {
  const blocked = S.get().sound && (!ctx || ctx.state !== 'running');
  $('#sound-hint').hidden = !blocked;
}
$('#sound-hint').addEventListener('click', unlock);

// mantém a tela ligada
let lock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    }
  } catch (e) { /* ignora */ }
}
document.addEventListener('visibilitychange', keepAwake);
window.addEventListener('click', keepAwake);
keepAwake();

window.addEventListener('resize', fitNames);
S.subscribe((s, ev) => { render(s, ev); updateSoundHint(); });
render(S.get(), null);
document.fonts && document.fonts.ready.then(fitNames);
setInterval(tick, 200);
setInterval(updateSoundHint, 2000);
updateSoundHint();
registerSW();
