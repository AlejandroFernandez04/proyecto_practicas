/* =========================================================
   Sonora · App de música gratis (PWA)
   Fuente de música: API pública de Audius (gratis, legal,
   sin clave). https://docs.audius.org
   ========================================================= */
'use strict';

const APP_NAME = 'sonora_musica_gratis';
const FALLBACK_HOSTS = ['https://api.audius.co', 'https://discoveryprovider.audius.co'];
const GENRES = [
  { label: 'Todo', value: '' },
  { label: 'Electrónica', value: 'Electronic' },
  { label: 'Hip-Hop', value: 'Hip-Hop/Rap' },
  { label: 'Pop', value: 'Pop' },
  { label: 'Rock', value: 'Rock' },
  { label: 'Lo-Fi', value: 'Lo-Fi' },
  { label: 'Latina', value: 'Latin' },
  { label: 'R&B', value: 'R&B/Soul' },
  { label: 'Ambient', value: 'Ambient' },
  { label: 'Jazz', value: 'Jazz' },
];

const ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="m6 18 8.5-6L6 6zM16 6v12h2V6z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>',
  heartOutline: '<svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09A6 6 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5A5.5 5.5 0 0 0 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>',
};

/* ---------------- Utilidades ---------------- */
const $ = (sel) => document.querySelector(sel);
const fmtTime = (s) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const store = {
  get(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* sin almacenamiento */ } },
};
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- API Audius ---------------- */
const api = {
  host: null,

  async pickHost() {
    if (this.host) return this.host;
    try {
      const res = await fetch('https://api.audius.co', { cache: 'no-store' });
      const { data } = await res.json();
      if (Array.isArray(data) && data.length) {
        this.host = data[Math.floor(Math.random() * data.length)];
        return this.host;
      }
    } catch { /* usamos los de respaldo */ }
    this.host = FALLBACK_HOSTS[0];
    return this.host;
  },

  async get(path, params = {}) {
    const qs = new URLSearchParams({ ...params, app_name: APP_NAME });
    const tried = new Set();
    let lastErr;
    for (let i = 0; i < 3; i++) {
      const host = await this.pickHost();
      tried.add(host);
      try {
        const res = await fetch(`${host}/v1${path}?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.data ?? [];
      } catch (err) {
        lastErr = err;
        // Probar otro servidor
        this.host = FALLBACK_HOSTS.find((h) => !tried.has(h)) || null;
        if (!this.host) break;
      }
    }
    throw lastErr || new Error('Sin conexión');
  },

  normalize(t) {
    return {
      id: t.id,
      title: t.title,
      artist: t.user?.name || 'Artista desconocido',
      art: t.artwork?.['480x480'] || t.artwork?.['150x150'] || '',
      thumb: t.artwork?.['150x150'] || t.artwork?.['480x480'] || '',
      duration: t.duration || 0,
      genre: t.genre || '',
    };
  },

  async trending(genre) {
    const params = { time: 'week', limit: 40 };
    if (genre) params.genre = genre;
    const data = await this.get('/tracks/trending', params);
    return data.filter((t) => t.is_streamable !== false).map(this.normalize);
  },

  async search(query) {
    const data = await this.get('/tracks/search', { query, limit: 40 });
    return data.filter((t) => t.is_streamable !== false).map(this.normalize);
  },

  streamUrl(id) {
    return `${this.host || FALLBACK_HOSTS[0]}/v1/tracks/${encodeURIComponent(id)}/stream?app_name=${APP_NAME}`;
  },
};

/* ---------------- Estado ---------------- */
const state = {
  queue: [],
  index: -1,
  shuffle: store.get('shuffle', false),
  repeat: store.get('repeat', false),
  favs: store.get('favs', []),
  genre: '',
};
const audio = $('#audio');
const isFav = (id) => state.favs.some((f) => f.id === id);
const current = () => state.queue[state.index];

/* ---------------- Render de listas ---------------- */
function skeleton(listEl, n = 8) {
  listEl.innerHTML = Array.from({ length: n }, () =>
    '<li class="skeleton"><div class="s-img"></div><div class="s-txt"></div></li>').join('');
}

function renderList(listEl, tracks, emptyMsg) {
  if (!tracks.length) {
    listEl.innerHTML = `<li class="state">${emptyMsg}</li>`;
    return;
  }
  listEl.innerHTML = tracks.map((t, i) => `
    <li class="track ${current()?.id === t.id ? 'playing' : ''}" data-i="${i}" data-id="${escapeHTML(t.id)}">
      ${t.thumb ? `<img src="${escapeHTML(t.thumb)}" alt="" loading="lazy">` : '<div class="art-ph"></div>'}
      <button class="t-main" data-action="play" aria-label="Reproducir ${escapeHTML(t.title)}">
        <div class="t-title ellipsis">${escapeHTML(t.title)}</div>
        <div class="t-sub ellipsis">${escapeHTML(t.artist)} · ${fmtTime(t.duration)}</div>
      </button>
      <button class="fav-btn ${isFav(t.id) ? 'on' : ''}" data-action="fav" aria-label="Favorito">
        ${isFav(t.id) ? ICONS.heart : ICONS.heartOutline}
      </button>
    </li>`).join('');
  listEl._tracks = tracks;
}

function renderError(listEl, retry) {
  listEl.innerHTML = `<li class="state">No se pudo cargar la música.<br>Comprueba tu conexión.<br><button>Reintentar</button></li>`;
  listEl.querySelector('button').onclick = retry;
}

function bindList(listEl) {
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const li = e.target.closest('.track');
    if (!btn || !li) return;
    const tracks = listEl._tracks || [];
    const t = tracks[+li.dataset.i];
    if (!t) return;
    if (btn.dataset.action === 'play') playFrom(tracks, +li.dataset.i);
    else toggleFav(t);
  });
}

function refreshLists() {
  for (const el of document.querySelectorAll('.track-list')) {
    if (el._tracks) {
      el.querySelectorAll('.track').forEach((li) => {
        const t = el._tracks[+li.dataset.i];
        li.classList.toggle('playing', current()?.id === t.id);
        const fb = li.querySelector('.fav-btn');
        fb.classList.toggle('on', isFav(t.id));
        fb.innerHTML = isFav(t.id) ? ICONS.heart : ICONS.heartOutline;
      });
    }
  }
}

/* ---------------- Vistas ---------------- */
async function loadHome() {
  const list = $('#home-list');
  skeleton(list);
  try {
    const tracks = await api.trending(state.genre);
    renderList(list, tracks, 'No hay canciones en este género ahora mismo.');
  } catch {
    renderError(list, loadHome);
  }
}

function renderGenres() {
  const wrap = $('#genre-chips');
  wrap.innerHTML = GENRES.map((g) =>
    `<button class="chip ${g.value === state.genre ? 'active' : ''}" role="tab" data-g="${g.value}">${g.label}</button>`).join('');
  wrap.onclick = (e) => {
    const chip = e.target.closest('.chip');
    if (!chip || chip.dataset.g === state.genre) return;
    state.genre = chip.dataset.g;
    renderGenres();
    loadHome();
  };
}

let searchTimer;
let searchSeq = 0;
async function doSearch(q) {
  const list = $('#search-list');
  q = q.trim();
  if (!q) {
    list._tracks = null;
    list.innerHTML = '<li class="state">Busca tu artista o canción favorita.</li>';
    return;
  }
  const seq = ++searchSeq;
  skeleton(list, 6);
  try {
    const tracks = await api.search(q);
    if (seq !== searchSeq) return; // respuesta antigua
    renderList(list, tracks, `Sin resultados para «${escapeHTML(q)}».`);
  } catch {
    if (seq === searchSeq) renderError(list, () => doSearch(q));
  }
}

function renderFavs() {
  renderList($('#favs-list'), state.favs,
    'Aún no tienes favoritos.<br>Pulsa el ♥ en cualquier canción para guardarla aquí.');
}

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'favs') renderFavs();
  if (name === 'search') setTimeout(() => $('#search-input').focus(), 50);
  window.scrollTo(0, 0);
}

/* ---------------- Favoritos ---------------- */
function toggleFav(t) {
  if (isFav(t.id)) {
    state.favs = state.favs.filter((f) => f.id !== t.id);
    toast('Eliminado de favoritos');
  } else {
    state.favs = [t, ...state.favs];
    toast('Añadido a favoritos');
  }
  store.set('favs', state.favs);
  refreshLists();
  updatePlayerUI();
  if ($('#view-favs').classList.contains('active')) renderFavs();
}

/* ---------------- Reproductor ---------------- */
function playFrom(tracks, i) {
  state.queue = tracks.slice();
  playIndex(i);
}

function playIndex(i) {
  if (!state.queue.length) return;
  state.index = (i + state.queue.length) % state.queue.length;
  const t = current();
  audio.src = api.streamUrl(t.id);
  audio.play().catch(() => { /* el usuario puede pulsar play */ });
  updatePlayerUI();
  updateMediaSession();
  refreshLists();
}

function next(auto = false) {
  if (!state.queue.length) return;
  if (state.shuffle && state.queue.length > 1) {
    let r;
    do { r = Math.floor(Math.random() * state.queue.length); } while (r === state.index);
    playIndex(r);
  } else if (auto && !state.repeat && state.index === state.queue.length - 1) {
    audio.pause(); // fin de la cola
  } else {
    playIndex(state.index + 1);
  }
}

function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  playIndex(state.index - 1);
}

function togglePlay() {
  if (!current()) return;
  if (audio.paused) audio.play().catch(() => toast('No se pudo reproducir'));
  else audio.pause();
}

function updatePlayerUI() {
  const t = current();
  if (!t) return;
  $('#mini-player').classList.remove('hidden');
  $('#mini-title').textContent = t.title;
  $('#mini-artist').textContent = t.artist;
  $('#mini-art').src = t.thumb || 'icons/icon.svg';
  $('#fp-title').textContent = t.title;
  $('#fp-artist').textContent = t.artist;
  $('#fp-art').src = t.art || 'icons/icon.svg';
  $('#fp-bg').style.backgroundImage = t.art ? `url("${t.art}")` : 'none';
  const fav = isFav(t.id);
  $('#fp-fav').innerHTML = fav ? ICONS.heart : ICONS.heartOutline;
  $('#fp-fav').style.color = fav ? 'var(--accent-2)' : '';
  $('#fp-fav').setAttribute('aria-label', fav ? 'Quitar de favoritos' : 'Añadir a favoritos');
  updatePlayButtons();
}

function updatePlayButtons() {
  const icon = audio.paused ? ICONS.play : ICONS.pause;
  const label = audio.paused ? 'Reproducir' : 'Pausar';
  for (const id of ['#mini-play', '#btn-play']) {
    $(id).innerHTML = icon;
    $(id).setAttribute('aria-label', label);
  }
}

function updateProgress() {
  const dur = audio.duration || current()?.duration || 0;
  const pct = dur ? (audio.currentTime / dur) * 100 : 0;
  $('#mini-progress-bar').style.width = `${pct}%`;
  if (!seeking) {
    $('#seek').value = pct;
    $('#seek').style.setProperty('--p', `${pct}%`);
  }
  $('#t-cur').textContent = fmtTime(audio.currentTime);
  $('#t-dur').textContent = fmtTime(dur);
}

function updateMediaSession() {
  const t = current();
  if (!('mediaSession' in navigator) || !t) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    album: 'Sonora',
    artwork: t.art ? [{ src: t.art, sizes: '480x480', type: 'image/jpeg' }] : [],
  });
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const handlers = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    previoustrack: prev,
    nexttrack: () => next(),
    seekto: (d) => { audio.currentTime = d.seekTime; },
  };
  for (const [action, fn] of Object.entries(handlers)) {
    try { ms.setActionHandler(action, fn); } catch { /* acción no soportada */ }
  }
}

function openPlayer() {
  if (!current()) return;
  $('#full-player').classList.add('open');
  $('#full-player').setAttribute('aria-hidden', 'false');
  history.pushState({ player: true }, '');
}
function closePlayer(fromHistory = false) {
  if (!$('#full-player').classList.contains('open')) return;
  $('#full-player').classList.remove('open');
  $('#full-player').setAttribute('aria-hidden', 'true');
  if (!fromHistory && history.state?.player) history.back();
}

/* ---------------- Eventos ---------------- */
let seeking = false;

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
  ['#home-list', '#search-list', '#favs-list'].forEach((s) => bindList($(s)));

  $('#search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(e.target.value), 400);
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(searchTimer);
    doSearch($('#search-input').value);
    $('#search-input').blur();
  });

  $('#mini-player').addEventListener('click', (e) => {
    if (e.target.closest('#mini-play')) togglePlay();
    else if (e.target.closest('#mini-next')) next();
    else openPlayer();
  });
  $('#mini-player').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'mini-player') openPlayer();
  });
  $('#mini-next').innerHTML = ICONS.next;

  $('#fp-close').onclick = () => closePlayer();
  $('#fp-fav').onclick = () => current() && toggleFav(current());
  $('#btn-play').onclick = togglePlay;
  $('#btn-next').onclick = () => next();
  $('#btn-prev').onclick = prev;
  $('#btn-shuffle').onclick = () => {
    state.shuffle = !state.shuffle;
    store.set('shuffle', state.shuffle);
    syncToggles();
    toast(state.shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado');
  };
  $('#btn-repeat').onclick = () => {
    state.repeat = !state.repeat;
    store.set('repeat', state.repeat);
    syncToggles();
    toast(state.repeat ? 'Repetir lista activado' : 'Repetir lista desactivado');
  };

  const seek = $('#seek');
  seek.addEventListener('input', () => {
    seeking = true;
    seek.style.setProperty('--p', `${seek.value}%`);
    const dur = audio.duration || current()?.duration || 0;
    $('#t-cur').textContent = fmtTime((seek.value / 100) * dur);
  });
  seek.addEventListener('change', () => {
    const dur = audio.duration || 0;
    if (dur) audio.currentTime = (seek.value / 100) * dur;
    seeking = false;
  });

  // Gesto: deslizar hacia abajo para cerrar el reproductor
  let startY = null;
  const fp = $('#full-player');
  fp.addEventListener('touchstart', (e) => {
    startY = e.target.closest('input') ? null : e.touches[0].clientY;
  }, { passive: true });
  fp.addEventListener('touchend', (e) => {
    if (startY !== null && e.changedTouches[0].clientY - startY > 100) closePlayer();
    startY = null;
  });
  window.addEventListener('popstate', () => closePlayer(true));

  audio.addEventListener('play', updatePlayButtons);
  audio.addEventListener('pause', updatePlayButtons);
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('ended', () => next(true));
  let failures = 0;
  audio.addEventListener('playing', () => { failures = 0; });
  audio.addEventListener('error', () => {
    if (!current()) return;
    failures++;
    if (failures >= 5) {
      failures = 0;
      toast('No se puede reproducir ahora. Revisa tu conexión.');
      return;
    }
    toast('Esta canción no está disponible, saltando…');
    setTimeout(() => next(true), 800);
  });
}

function syncToggles() {
  $('#btn-shuffle').setAttribute('aria-pressed', state.shuffle);
  $('#btn-repeat').setAttribute('aria-pressed', state.repeat);
}

/* ---------------- Inicio ---------------- */
function init() {
  renderGenres();
  bindEvents();
  syncToggles();
  setupMediaSession();
  doSearch('');
  loadHome();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
