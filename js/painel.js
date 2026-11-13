// Painel de controle (usado dentro da TV como gaveta e em controle.html)
import * as S from './store.js';

const fmt = (ms) => {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DURATIONS = [1, 2, 3, 4, 5, 6, 8, 10, 15];

export function mountPainel(root, { embedded = false, onClose } = {}) {
  root.innerHTML = `
  <div class="pn">
    <header class="pn-head">
      <div>
        <b>Painel de controle</b>
        <span class="pn-off" data-off>verificando modo offline…</span>
      </div>
      ${embedded ? '<button class="pn-x" data-act="close" title="Fechar (Esc)">✕</button>' : ''}
    </header>

    <section class="pn-card">
      <h3>Teclas numéricas</h3>
      <div class="pn-keys">
        <div class="pn-key left"><kbd>1</kbd><span>Gol esquerda</span></div>
        <div class="pn-key left"><kbd>2</kbd><span>−1 esquerda</span></div>
        <div class="pn-key right"><kbd>3</kbd><span>Gol direita</span></div>
        <div class="pn-key right"><kbd>4</kbd><span>−1 direita</span></div>
        <div class="pn-key "><kbd>5</kbd><span>Iniciar / pausar</span></div>
        <div class="pn-key "><kbd>6</kbd><span>Zerar tempo</span></div>
        <div class="pn-key "><kbd>7</kbd><span>Sortear nomes</span></div>
        <div class="pn-key "><kbd>8</kbd><span>Trocar lados</span></div>
        <div class="pn-key "><kbd>9</kbd><span>Encerrar partida</span></div>
        <div class="pn-key "><kbd>0</kbd><span>Nova partida</span></div>
      </div>
    </section>

    <section class="pn-card">
      <h3>Placar · Partida <span data-match></span> <em class="pn-status" data-status></em></h3>
      <div class="pn-score">
        ${['left', 'right'].map((side) => `
        <div class="pn-side ${side}">
          <div class="pn-name" data-name="${side}"></div>
          <div class="pn-num" data-score="${side}">0</div>
          <div class="pn-row">
            <button data-act="minus" data-side="${side}" title="Tirar um gol">−1</button>
            <button class="big ${side}" data-act="goal" data-side="${side}">GOL +1</button>
          </div>
          <small>Teclas: <kbd>${side === 'left' ? '1' : '3'}</kbd> gol · <kbd>${side === 'left' ? '2' : '4'}</kbd> −1</small>
        </div>`).join('')}
      </div>
      <button class="wide" data-act="swap">⇄ Trocar lados <kbd class="k">8</kbd></button>
    </section>

    <section class="pn-card">
      <h3>Cronômetro</h3>
      <div class="pn-timer" data-timer>03:00</div>
      <div class="pn-row">
        <button class="big primary" data-act="timer">▶ Iniciar</button>
        <button data-act="reset">↺ Zerar</button>
      </div>
      <div class="pn-row pn-opts">
        <label>Duração
          <select data-dur>
            ${DURATIONS.map((m) => `<option value="${m}">${m} min</option>`).join('')}
          </select>
        </label>
        <label class="chk"><input type="checkbox" data-showtimer> Mostrar na TV</label>
      </div>
      <small>Tecla <kbd>5</kbd> ou <kbd>Espaço</kbd> inicia/pausa · <kbd>6</kbd> zera</small>
    </section>

    <section class="pn-card">
      <h3>Nomes dos robôs</h3>
      <div class="pn-names">
        ${['left', 'right'].map((side) => `
        <label class="${side}">
          <span>${side === 'left' ? 'Esquerda' : 'Direita'}</span>
          <div class="pn-in">
            <input data-in="${side}" maxlength="20" autocomplete="off" spellcheck="false" placeholder="Digite um nome">
            <button data-act="rnd" data-side="${side}" title="Sortear este">🎲</button>
          </div>
        </label>`).join('')}
      </div>
      <div class="pn-row">
        <button data-act="rndboth">🎲 Sortear os dois</button>
        <button class="primary" data-act="apply">✓ Usar estes nomes</button>
      </div>
      <small>Tecla <kbd>7</kbd> sorteia os dois nomes</small>
    </section>

    <section class="pn-card">
      <h3>Partida</h3>
      <div class="pn-row">
        <button data-act="end" data-confirm="Confirmar fim?">🏁 Encerrar partida</button>
        <button class="primary" data-act="new" data-confirm="Zerar e começar?">＋ Nova partida</button>
      </div>
      <small>“Nova partida” guarda o resultado no histórico e zera placar e cronômetro. Teclas: <kbd>9</kbd> encerra · <kbd>0</kbd> nova partida (aperte duas vezes se houver jogo em andamento).</small>
    </section>

    <details class="pn-card">
      <summary>Lista de nomes para sorteio (<span data-count></span>)</summary>
      <textarea data-list rows="9" spellcheck="false"></textarea>
      <small>Um nome por linha.</small>
      <div class="pn-row">
        <button class="primary" data-act="savelist">Salvar lista</button>
        <button data-act="deflist" data-confirm="Restaurar?">Restaurar padrão</button>
      </div>
    </details>

    <details class="pn-card">
      <summary>Tela, som e histórico</summary>
      <div class="pn-row wrap">
        ${embedded ? '<button data-act="full">⛶ Tela cheia (F)</button>' : ''}
        <button data-act="sound" data-sound>🔊 Som ligado</button>
        ${embedded ? '<button data-act="popout">↗ Abrir controle em outra janela</button>' : '<a class="btn" href="./" target="placar-tv">↗ Abrir placar (TV)</a>'}
        <button data-act="clearhist" data-confirm="Apagar histórico?">🗑 Limpar histórico</button>
      </div>
      <ol class="pn-hist" data-hist></ol>
      <small>
        Atalhos na tela da TV: <kbd>C</kbd> abre/fecha este painel · <kbd>F</kbd> tela cheia · <kbd>T</kbd> troca lados.
        Para controlar sem aparecer na TV, use o Chromebook com a tela <b>estendida</b> e abra o controle em outra janela.
      </small>
    </details>
  </div>`;

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];
  const dirty = { left: false, right: false };

  // ---------- confirmação em dois cliques ----------
  function confirmClick(btn) {
    if (!btn.dataset.confirm) return true;
    if (btn.classList.contains('confirming')) {
      btn.classList.remove('confirming');
      btn.textContent = btn.dataset.label;
      clearTimeout(btn._t);
      return true;
    }
    btn.dataset.label = btn.textContent;
    btn.textContent = btn.dataset.confirm;
    btn.classList.add('confirming');
    btn._t = setTimeout(() => {
      btn.classList.remove('confirming');
      btn.textContent = btn.dataset.label;
    }, 3500);
    return false;
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const side = btn.dataset.side;
    const act = btn.dataset.act;
    const s = S.get();
    const needsConfirm =
      (act === 'new' && (s.left.score + s.right.score > 0 || S.running())) ||
      (act === 'end' && s.status !== 'fim') ||
      act === 'clearhist' || act === 'deflist';
    if (needsConfirm && !confirmClick(btn)) return;

    switch (act) {
      case 'close': onClose && onClose(); break;
      case 'goal': S.goal(side, 1); break;
      case 'minus': S.goal(side, -1); break;
      case 'swap': S.swapSides(); break;
      case 'timer': S.toggleTimer(); break;
      case 'reset': S.resetTimer(); break;
      case 'rnd': dirty[side] = false; S.drawNames([side]); break;
      case 'rndboth': dirty.left = dirty.right = false; S.drawNames(); break;
      case 'apply':
        S.setNames($('[data-in="left"]').value, $('[data-in="right"]').value);
        dirty.left = dirty.right = false;
        break;
      case 'end': if (s.status !== 'fim') S.endMatch(); break;
      case 'new': S.newMatch(); break;
      case 'savelist': {
        const list = $('[data-list]').value.split('\n').map((x) => x.trim()).filter(Boolean);
        S.setNameList([...new Set(list)]);
        flash(btn, '✓ Salva');
        break;
      }
      case 'deflist': S.resetNameList(); fillList(true); break;
      case 'sound': S.setSound(!s.sound); break;
      case 'clearhist': S.clearHistory(); break;
      case 'full': toggleFullscreen(); break;
      case 'popout':
        window.open('./controle.html', 'placar-controle', 'width=520,height=900');
        onClose && onClose();
        break;
    }
  });

  function flash(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = old; }, 1400);
  }

  $$('[data-in]').forEach((inp) => {
    inp.addEventListener('input', () => { dirty[inp.dataset.in] = true; });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('[data-act="apply"]').click(); }
    });
  });
  $('[data-dur]').addEventListener('change', (e) => S.setDuration(Number(e.target.value) * 60000));
  $('[data-showtimer]').addEventListener('change', (e) => S.setShowTimer(e.target.checked));

  function fillList(force) {
    const ta = $('[data-list]');
    if (force || document.activeElement !== ta) ta.value = S.get().names.join('\n');
  }

  // ---------- render ----------
  function render(s) {
    $('[data-match]').textContent = s.match;
    $('[data-status]').textContent = { pronto: 'pronta', jogando: 'em jogo', pausado: 'pausada', fim: 'encerrada' }[s.status] || '';
    $('[data-status]').dataset.s = s.status;
    for (const side of ['left', 'right']) {
      $(`[data-name="${side}"]`).textContent = s[side].name;
      $(`[data-score="${side}"]`).textContent = s[side].score;
      const inp = $(`[data-in="${side}"]`);
      if (!dirty[side] && document.activeElement !== inp) inp.value = s[side].name;
    }
    const tb = $('[data-act="timer"]');
    tb.textContent = S.running(s) ? '⏸ Pausar' : (s.status === 'pausado' ? '▶ Continuar' : '▶ Iniciar');
    tb.classList.toggle('warn', S.running(s));
    const durSel = $('[data-dur]');
    const mins = Math.round(s.timer.duration / 60000);
    if (![...durSel.options].some((o) => Number(o.value) === mins)) {
      durSel.insertAdjacentHTML('beforeend', `<option value="${mins}">${mins} min</option>`);
    }
    durSel.value = String(mins);
    $('[data-showtimer]').checked = s.showTimer;
    $('[data-count]').textContent = s.names.length;
    $('[data-sound]').textContent = s.sound ? '🔊 Som ligado' : '🔇 Som desligado';
    fillList(false);
    $('[data-hist]').innerHTML = s.history.length
      ? s.history.map((h) => `<li>#${h.n} · <b>${esc(h.l.name)}</b> ${h.l.score} × ${h.r.score} <b>${esc(h.r.name)}</b></li>`).join('')
      : '<li class="empty">Nenhuma partida encerrada ainda.</li>';
    tick();
  }

  function tick() {
    const s = S.get();
    const el = $('[data-timer]');
    el.textContent = fmt(S.remaining(s));
    el.classList.toggle('run', S.running(s));
    // Sem a TV aberta, o próprio controle encerra o tempo (com folga para a TV agir primeiro)
    if (!embedded && S.running(s) && s.timer.remaining - (Date.now() - s.timer.startedAt) < -1500) S.finishTimer();
  }

  S.subscribe(render);
  render(S.get());
  setInterval(tick, 250);
  watchOffline($('[data-off]'));
}

// ---------- atalhos de teclado ----------
export function bindShortcuts({ onPanel, onFull } = {}) {
  const lastPress = {};
  // ações perigosas pedem duas apertadas em até 2 s quando há jogo em andamento
  const twice = (id, needed, fn) => {
    const now = Date.now();
    if (needed && now - (lastPress[id] || 0) > 2000) { lastPress[id] = now; return; }
    lastPress[id] = 0;
    fn();
  };
  const busy = () => { const s = S.get(); return s.left.score + s.right.score > 0 || S.running(s); };
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const digit = /^(Digit|Numpad)([0-9])$/.exec(e.code || '');
    const k = digit ? digit[2] : e.key.toLowerCase();
    const map = {
      // teclas numéricas (linha de cima ou teclado numérico)
      1: () => S.goal('left', 1),
      2: () => S.goal('left', -1),
      3: () => S.goal('right', 1),
      4: () => S.goal('right', -1),
      5: () => S.toggleTimer(),
      6: () => S.resetTimer(),
      7: () => S.drawNames(),
      8: () => S.swapSides(),
      9: () => twice('end', S.get().status !== 'fim', () => { if (S.get().status !== 'fim') S.endMatch(); }),
      0: () => twice('new', busy(), () => S.newMatch()),
      // letras (atalhos antigos continuam valendo)
      q: () => S.goal('left', 1),
      a: () => S.goal('left', -1),
      p: () => S.goal('right', 1),
      l: () => S.goal('right', -1),
      ' ': () => S.toggleTimer(),
      r: () => S.resetTimer(),
      s: () => S.drawNames(),
      t: () => S.swapSides(),
      n: () => twice('new', busy(), () => S.newMatch()),
      c: () => onPanel && onPanel(),
      escape: () => onPanel && onPanel(false),
      f: () => (onFull || toggleFullscreen)(),
    };
    if (map[k]) {
      if (e.repeat && k !== 'escape') return;
      e.preventDefault();
      map[k]();
    }
  });
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}

// ---------- modo offline (service worker) ----------
export function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

async function watchOffline(el) {
  const set = (txt, ok) => { el.textContent = txt; el.dataset.ok = ok ? '1' : '0'; };
  async function check() {
    const online = navigator.onLine;
    let cached = false;
    try {
      cached = !!(navigator.serviceWorker && navigator.serviceWorker.controller) &&
        !!(await caches.match('./index.html', { ignoreSearch: true }));
    } catch (e) { /* ignora */ }
    if (cached) set(online ? '● Pronto para funcionar sem internet' : '● Sem internet — rodando do cache', true);
    else set(online ? '○ Salvando para uso offline… recarregue a página uma vez' : '○ Sem internet e sem cache', false);
  }
  window.addEventListener('online', check);
  window.addEventListener('offline', check);
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', check);
  check();
  setInterval(check, 15000);
}
