// Estado compartilhado do placar: salvo no localStorage e sincronizado
// entre janelas (TV + controle) via BroadcastChannel.

const KEY = 'placar-robos-v1';

export const DEFAULT_NAMES = [
  'Trovão', 'Faísca', 'Relâmpago', 'Titã', 'Ciclone', 'Furacão', 'Turbo',
  'Megabyte', 'Pixel', 'Circuito', 'Engrenagem', 'Parafuso', 'Tornado',
  'Vulcão', 'Meteoro', 'Cometa', 'Atômico', 'Biônico', 'Volt', 'Neon',
  'Laser', 'Dínamo', 'Nitro', 'Fênix', 'Dragão', 'Tubarão', 'Pantera',
  'Falcão', 'Lobo de Aço', 'Robocraque', 'Canhão', 'Muralha', 'Foguete',
  'Gol de Lata', 'Chuteira Turbo', 'Bit Bola', 'Megazord', 'Tanque',
  'Rolimã', 'Curto-Circuito', 'Ferro Velho', 'Lataria', 'Ômega', 'Alfa',
];

const MIN = 60 * 1000;

function defaults() {
  return {
    match: 1,
    left: { name: 'Trovão', score: 0 },
    right: { name: 'Faísca', score: 0 },
    timer: { duration: 3 * MIN, remaining: 3 * MIN, startedAt: null },
    status: 'pronto', // pronto | jogando | pausado | fim
    showTimer: true,
    sound: true,
    saved: false,
    history: [],
    names: [...DEFAULT_NAMES],
    rev: 0,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch (e) { /* ignora */ }
  return defaults();
}

let state = load();
const listeners = new Set();
const channel = 'BroadcastChannel' in self ? new BroadcastChannel('placar-robos') : null;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
}

function emit(ev) { listeners.forEach((fn) => fn(state, ev)); }

if (channel) {
  channel.onmessage = (e) => {
    if (!e.data || !e.data.state) return;
    state = e.data.state;
    emit(e.data.ev || null);
  };
} else {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = JSON.parse(e.newValue); emit(null); } catch (err) { /* ignora */ }
  });
}

export function get() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function update(mutator, ev = null) {
  const s = JSON.parse(JSON.stringify(state));
  const result = mutator(s);
  if (result === false) return;
  s.rev = (state.rev || 0) + 1;
  state = s;
  persist();
  if (channel) channel.postMessage({ state, ev });
  emit(ev);
}

// ---------- utilidades ----------
export function remaining(s = state) {
  const t = s.timer;
  if (t.startedAt == null) return t.remaining;
  return Math.max(0, t.remaining - (Date.now() - t.startedAt));
}
export const running = (s = state) => s.timer.startedAt != null;

function pickNames(s, count, avoid = []) {
  const pool = s.names.filter((n) => n.trim());
  const fresh = pool.filter((n) => !avoid.includes(n));
  const src = fresh.length >= count ? fresh : pool;
  const copy = [...src];
  const out = [];
  while (out.length < count && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  while (out.length < count) out.push('Robô ' + (out.length + 1));
  return out;
}

function saveResult(s) {
  if (s.saved) return;
  s.saved = true;
  s.history.unshift({
    n: s.match,
    l: { ...s.left }, r: { ...s.right },
    at: Date.now(),
  });
  s.history = s.history.slice(0, 30);
}

function stopTimer(s) {
  s.timer.remaining = remaining(s);
  s.timer.startedAt = null;
}

// ---------- ações ----------
export function goal(side, delta = 1) {
  update((s) => {
    const v = Math.max(0, s[side].score + delta);
    if (v === s[side].score) return false;
    s[side].score = v;
    s.saved = false;
    if (s.status === 'fim' && s.history[0] && s.history[0].n === s.match) {
      s.history.shift(); // correção após o fim: regrava o resultado
      saveResult(s);
    }
  }, delta > 0 ? { type: 'gol', side } : { type: 'menos', side });
}

export function toggleTimer() {
  if (running()) {
    update((s) => { stopTimer(s); s.status = 'pausado'; }, { type: 'pausa' });
  } else {
    update((s) => {
      if (s.timer.remaining <= 0) s.timer.remaining = s.timer.duration;
      s.timer.startedAt = Date.now();
      s.status = 'jogando';
    }, { type: 'inicio' });
  }
}

export function resetTimer() {
  update((s) => {
    s.timer.startedAt = null;
    s.timer.remaining = s.timer.duration;
    if (s.status !== 'fim') s.status = 'pronto';
  });
}

export function setDuration(ms) {
  update((s) => {
    s.timer.duration = ms;
    if (!running(s)) {
      s.timer.remaining = ms;
      if (s.status === 'pausado') s.status = 'pronto';
    }
  });
}

// Chamado pela tela da TV quando o tempo zera
export function finishTimer() {
  if (!running() || remaining() > 0) return;
  update((s) => {
    s.timer.startedAt = null;
    s.timer.remaining = 0;
    s.status = 'fim';
    saveResult(s);
  }, { type: 'fim' });
}

export function endMatch() {
  update((s) => {
    stopTimer(s);
    s.status = 'fim';
    saveResult(s);
  }, { type: 'fim' });
}

export function newMatch() {
  update((s) => {
    const played = s.left.score + s.right.score > 0 || s.status !== 'pronto';
    if (played) saveResult(s);
    s.match += 1;
    s.left.score = 0;
    s.right.score = 0;
    s.timer.startedAt = null;
    s.timer.remaining = s.timer.duration;
    s.status = 'pronto';
    s.saved = false;
  }, { type: 'nova' });
}

export function setNames(left, right) {
  update((s) => {
    s.left.name = (left || '').trim() || s.left.name;
    s.right.name = (right || '').trim() || s.right.name;
    if (s.status === 'fim' && s.history[0] && s.history[0].n === s.match) {
      s.history[0].l.name = s.left.name;
      s.history[0].r.name = s.right.name;
    }
  }, { type: 'nomes', sides: ['left', 'right'] });
}

export function drawNames(sides = ['left', 'right']) {
  update((s) => {
    const avoid = [s.left.name, s.right.name];
    const picked = pickNames(s, sides.length, avoid);
    sides.forEach((side, i) => { s[side].name = picked[i]; });
    if (sides.length === 1) {
      const other = sides[0] === 'left' ? 'right' : 'left';
      if (s[other].name === s[sides[0]].name) return false;
    }
  }, { type: 'nomes', sides, sorteio: true });
}

export function swapSides() {
  update((s) => {
    const l = s.left;
    s.left = s.right;
    s.right = l;
  }, { type: 'troca' });
}

export function setNameList(list) {
  update((s) => { s.names = list.length ? list : [...DEFAULT_NAMES]; });
}
export function resetNameList() { setNameList([]); }

export function setShowTimer(v) { update((s) => { s.showTimer = !!v; }); }
export function setSound(v) { update((s) => { s.sound = !!v; }); }
export function clearHistory() { update((s) => { s.history = []; }); }
