/* =========================================================
   Sonora · App de música gratis
   Fuente de música: API pública de Audius (gratis, legal,
   sin clave). https://docs.audius.org
   Importación de playlists: spotify.js + matcher.js
   ========================================================= */
'use strict';

const APP_NAME = 'sonora_musica_gratis';
const FALLBACK_HOSTS = ['https://api.audius.co', 'https://discoveryprovider.audius.co'];
const MAX_IMPORT = 1000;
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
  note: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>',
  spotify: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.59 14.42a.62.62 0 0 1-.86.2c-2.35-1.43-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.81-.87 7.08-.5 9.72 1.11.3.18.39.57.21.86zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.57 11.23 1.33.37.22.48.7.26 1.07zm.1-2.83C14.69 8.96 9.37 8.78 6.29 9.71a.94.94 0 1 1-.54-1.79c3.53-1.07 9.4-.86 13.11 1.34a.94.94 0 0 1-.95 1.61z"/></svg>',
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
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
  },
};
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/** Si una portada no carga, se pone un recuadro de color en su lugar. */
window.artFail = (img) => {
  const d = document.createElement('div');
  d.className = img.classList.contains('pl-thumb') ? 'pl-thumb' : 'art-ph';
  d.innerHTML = ICONS.note;
  img.replaceWith(d);
};

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
        this.host = FALLBACK_HOSTS.find((h) => !tried.has(h)) || null;
        if (!this.host) break;
      }
    }
    this.host = null;
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

  async search(query, limit = 40) {
    const data = await this.get('/tracks/search', { query, limit });
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
  playlists: store.get('playlists', []),
  genre: '',
  openPlaylist: null,
  importing: false,
};
const audio = $('#audio');
const isFav = (id) => state.favs.some((f) => f.id === id);
const current = () => state.queue[state.index];
function savePlaylists() {
  if (!store.set('playlists', state.playlists)) toast('No queda espacio para guardar más playlists');
}

/* ---------------- Capas (para el botón "atrás") ---------------- */
const layers = [];
function pushLayer(name) {
  layers.push(name);
  history.pushState({ layer: name }, '');
}
function hideLayer(name) {
  if (name === 'player') {
    $('#full-player').classList.remove('open');
    $('#full-player').setAttribute('aria-hidden', 'true');
  } else if (name === 'sheet') {
    $('#sheet').classList.remove('open');
    $('#sheet').setAttribute('aria-hidden', 'true');
  } else if (name === 'playlist') {
    showView('library');
  }
}
function closeLayer(name) {
  const i = layers.lastIndexOf(name);
  if (i < 0) return;
  if (i === layers.length - 1) history.back(); // popstate se encarga
  else { layers.splice(i, 1); hideLayer(name); }
}
window.addEventListener('popstate', () => {
  const name = layers.pop();
  if (name) hideLayer(name);
});

/* ---------------- Render de listas ---------------- */
function skeleton(listEl, n = 8) {
  listEl._tracks = null;
  listEl.innerHTML = Array.from({ length: n }, () =>
    '<li class="skeleton"><div class="s-img"></div><div class="s-txt"></div></li>').join('');
}

function renderList(listEl, tracks, emptyMsg) {
  listEl._tracks = tracks;
  if (!tracks.length) {
    listEl.innerHTML = `<li class="state">${emptyMsg}</li>`;
    return;
  }
  listEl.innerHTML = tracks.map((t, i) => `
    <li class="track ${current()?.id === t.id ? 'playing' : ''}" data-i="${i}">
      ${t.thumb ? `<img src="${escapeHTML(t.thumb)}" alt="" loading="lazy" onerror="artFail(this)">` : '<div class="art-ph"></div>'}
      <button class="t-main" data-action="play" aria-label="Reproducir ${escapeHTML(t.title)}">
        <div class="t-title ellipsis">${escapeHTML(t.title)}</div>
        <div class="t-sub ellipsis">${t.kind === 'version' ? '<span class="badge version">Versión</span>' : ''}${escapeHTML(t.artist)} · ${fmtTime(t.duration)}</div>
        ${t.orig && t.kind === 'version' ? `<div class="t-orig ellipsis">Original: ${escapeHTML(t.orig.artist)} – ${escapeHTML(t.orig.title)}</div>` : ''}
      </button>
      <button class="fav-btn ${isFav(t.id) ? 'on' : ''}" data-action="fav" aria-label="Favorito">
        ${isFav(t.id) ? ICONS.heart : ICONS.heartOutline}
      </button>
    </li>`).join('');
}

function renderError(listEl, retry) {
  listEl._tracks = null;
  listEl.innerHTML = '<li class="state">No se pudo cargar la música.<br>Comprueba tu conexión.<br><button>Reintentar</button></li>';
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
    if (!el._tracks) continue;
    el.querySelectorAll('.track').forEach((li) => {
      const t = el._tracks[+li.dataset.i];
      li.classList.toggle('playing', current()?.id === t.id);
      const fb = li.querySelector('.fav-btn');
      fb.classList.toggle('on', isFav(t.id));
      fb.innerHTML = isFav(t.id) ? ICONS.heart : ICONS.heartOutline;
    });
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

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  const navName = name === 'playlist' ? 'library' : name;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === navName));
  if (name === 'library') { state.openPlaylist = null; renderLibrary(); }
  if (name === 'search') setTimeout(() => $('#search-input').focus(), 50);
  window.scrollTo(0, 0);
}

/* ---------------- Biblioteca ---------------- */
function playlistStats(pl) {
  const total = pl.items.length;
  const found = pl.items.filter((it) => it.match).length;
  return { total, found };
}

function renderLibrary() {
  const list = $('#pl-list');
  const favCount = state.favs.length;
  const rows = [`
    <li><button class="pl-item" data-pl="favs">
      <div class="pl-thumb">${ICONS.heart}</div>
      <div class="t-main"><div class="t-title ellipsis">Favoritos</div>
      <div class="t-sub">${favCount} ${favCount === 1 ? 'canción' : 'canciones'}</div></div>
    </button></li>`];
  for (const pl of state.playlists) {
    const { total, found } = playlistStats(pl);
    rows.push(`
    <li><button class="pl-item" data-pl="${escapeHTML(pl.id)}">
      ${pl.image ? `<img class="pl-thumb" src="${escapeHTML(pl.image)}" alt="" onerror="artFail(this)">`
    : `<div class="pl-thumb ${pl.source === 'spotify' ? 'green' : ''}">${pl.source === 'spotify' ? ICONS.spotify : ICONS.note}</div>`}
      <div class="t-main"><div class="t-title ellipsis">${escapeHTML(pl.name)}</div>
      <div class="t-sub ellipsis">${pl.source === 'spotify' ? 'De Spotify · ' : ''}${found} de ${total} gratis</div></div>
    </button></li>`);
  }
  if (!state.playlists.length) {
    rows.push(`<li class="state">Importa tus playlists de Spotify y Sonora buscará esas canciones gratis.<br><button id="lib-import">Importar playlist</button></li>`);
  }
  list.innerHTML = rows.join('');
  $('#lib-import')?.addEventListener('click', openSheet);
}

function playlistTracks(pl) {
  if (pl === 'favs') return state.favs;
  return pl.items.filter((it) => it.match).map((it) => ({ ...it.match, kind: it.kind, orig: it.want }));
}

function openPlaylist(id, { push = true } = {}) {
  const pl = id === 'favs' ? 'favs' : state.playlists.find((p) => p.id === id);
  if (!pl) return;
  state.openPlaylist = id;
  if (push && !layers.includes('playlist')) pushLayer('playlist');
  showView('playlist');
  state.openPlaylist = id;
  renderPlaylist();
}

function renderPlaylist() {
  const id = state.openPlaylist;
  const pl = id === 'favs' ? 'favs' : state.playlists.find((p) => p.id === id);
  if (!pl) return;
  const tracks = playlistTracks(pl);
  const cover = $('#pl-cover');
  if (pl === 'favs') {
    $('#pl-name').textContent = 'Favoritos';
    $('#pl-stats').textContent = `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}`;
    cover.style.backgroundImage = '';
    cover.innerHTML = ICONS.heart;
  } else {
    const { total, found } = playlistStats(pl);
    const versions = pl.items.filter((it) => it.kind === 'version').length;
    $('#pl-name').textContent = pl.name;
    $('#pl-stats').textContent = `${found} de ${total} canciones disponibles gratis`
      + (versions ? ` (${versions} son versiones de otros artistas)` : '')
      + `. Actualizada el ${new Date(pl.updated).toLocaleDateString('es-ES')}.`;
    cover.style.backgroundImage = pl.image ? `url("${pl.image}")` : '';
    cover.innerHTML = pl.image ? '' : (pl.source === 'spotify' ? ICONS.spotify : ICONS.note);
  }
  $('#pl-sync').classList.toggle('hidden', pl === 'favs' || pl.source !== 'spotify');
  $('#pl-delete').classList.toggle('hidden', pl === 'favs');
  $('#pl-play').disabled = !tracks.length;
  $('#pl-shuffle').disabled = !tracks.length;

  renderList($('#pl-tracks'), tracks, pl === 'favs'
    ? 'Aún no tienes favoritos.<br>Pulsa el ♥ en cualquier canción para guardarla aquí.'
    : 'Ninguna canción de esta playlist está en Audius.');

  const missing = pl === 'favs' ? [] : pl.items.filter((it) => !it.match);
  const det = $('#pl-missing');
  det.classList.toggle('hidden', !missing.length);
  if (missing.length) {
    det.querySelector('summary').textContent = `${missing.length} no ${missing.length === 1 ? 'está disponible' : 'están disponibles'} gratis`;
    $('#pl-missing-list').innerHTML = missing.map((it) =>
      `<li>${escapeHTML(it.want.artist ? `${it.want.artist} – ` : '')}${escapeHTML(it.want.title)}${it.failed ? ' <span class="badge">error de red</span>' : ''}</li>`).join('');
  }
}

/* ---------------- Importar ---------------- */
function openSheet() {
  if (!$('#sheet').classList.contains('open')) {
    $('#sheet').classList.add('open');
    $('#sheet').setAttribute('aria-hidden', 'false');
    pushLayer('sheet');
  }
  renderSpotifyTab();
}

function setTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $('#tab-spotify').classList.toggle('hidden', name !== 'spotify');
  $('#tab-text').classList.toggle('hidden', name !== 'text');
}

function setProgress(label, done, total) {
  const box = $('#import-progress');
  if (label === null) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  $('#import-label').textContent = label;
  $('#import-bar').style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
}

async function renderSpotifyTab() {
  $('#sp-redirect').textContent = Spotify.redirectUri();
  $('#sp-client').value = Spotify.clientId();
  const connected = Spotify.isConnected();
  $('#sp-setup').classList.toggle('hidden', connected);
  $('#sp-connected').classList.toggle('hidden', !connected);
  if (!connected) return;

  const list = $('#sp-playlists');
  skeleton(list, 4);
  try {
    const [me, pls] = await Promise.all([Spotify.me().catch(() => null), Spotify.playlists()]);
    $('#sp-user').textContent = me ? `Conectado como ${me.display_name || me.id}` : 'Conectado a Spotify';
    const items = [{ id: 'liked', name: 'Canciones que te gustan', image: '', total: null }, ...pls];
    list.innerHTML = items.map((p) => {
      const imported = state.playlists.some((x) => x.spotifyId === p.id);
      return `<li><button class="pl-item" data-sp="${escapeHTML(p.id)}">
        ${p.image ? `<img class="pl-thumb" src="${escapeHTML(p.image)}" alt="" loading="lazy" onerror="artFail(this)">` : `<div class="pl-thumb">${p.id === 'liked' ? ICONS.heart : ICONS.note}</div>`}
        <div class="t-main"><div class="t-title ellipsis">${escapeHTML(p.name)}</div>
        <div class="t-sub">${p.total != null ? `${p.total} canciones` : 'Tu biblioteca'}${imported ? ' · ya importada' : ''}</div></div>
      </button></li>`;
    }).join('');
    list._spItems = items;
  } catch (e) {
    list.innerHTML = `<li class="state">${escapeHTML(e.message)}<br><button>Reintentar</button></li>`;
    list.querySelector('button').onclick = renderSpotifyTab;
    if (!Spotify.isConnected()) renderSpotifyTab();
  }
}

const searchForMatch = (q) => api.search(q, 10);

async function runImport({ name, source, spotifyId = null, image = '', wanted, existing = null }) {
  if (state.importing) return null;
  state.importing = true;
  document.querySelectorAll('#sheet button, #pl-sync').forEach((b) => { b.disabled = true; });
  try {
    if (wanted.length > MAX_IMPORT) {
      toast(`Solo se importan las primeras ${MAX_IMPORT} canciones`);
      wanted = wanted.slice(0, MAX_IMPORT);
    }
    const cache = {};
    for (const it of existing?.items || []) {
      if (!it.failed) cache[Matcher.keyOf(it.want)] = it.match ? { track: it.match, kind: it.kind } : null;
    }
    const items = await Matcher.matchAll(wanted, searchForMatch, {
      cache,
      onProgress: (d, t) => setProgress(`Buscando canciones gratis… ${d} de ${t}`, d, t),
    });
    const pl = existing || { id: `pl_${Date.now().toString(36)}`, source, spotifyId };
    Object.assign(pl, { name, image: image || pl.image || '', items, updated: Date.now() });
    if (!existing) state.playlists.unshift(pl);
    savePlaylists();
    const found = items.filter((i) => i.match).length;
    toast(`${found} de ${items.length} canciones encontradas gratis`);
    return pl;
  } finally {
    state.importing = false;
    setProgress(null);
    document.querySelectorAll('#sheet button, #pl-sync').forEach((b) => { b.disabled = false; });
  }
}

async function fetchSpotifyTracks(spId) {
  const onProgress = (d, t) => setProgress(`Leyendo tu playlist de Spotify… ${d} de ${t}`, d, t);
  return spId === 'liked' ? Spotify.likedTracks(onProgress) : Spotify.playlistTracks(spId, onProgress);
}

async function importSpotify(p) {
  try {
    setProgress('Leyendo tu playlist de Spotify…', 0, 0);
    const wanted = await fetchSpotifyTracks(p.id);
    if (!wanted.length) { setProgress(null); toast('Esta playlist está vacía'); return; }
    const existing = state.playlists.find((x) => x.spotifyId === p.id) || null;
    const pl = await runImport({ name: p.name, source: 'spotify', spotifyId: p.id, image: p.image, wanted, existing });
    if (pl) { closeLayer('sheet'); setTimeout(() => openPlaylist(pl.id), 350); }
  } catch (e) {
    setProgress(null);
    toast(e.message || 'No se pudo importar');
  }
}

async function syncPlaylist() {
  const pl = state.playlists.find((p) => p.id === state.openPlaylist);
  if (!pl || pl.source !== 'spotify') return;
  if (!Spotify.isConnected()) { toast('Conecta Spotify para sincronizar'); openSheet(); return; }
  $('#import-progress').classList.remove('hidden');
  openSheet();
  try {
    const wanted = await fetchSpotifyTracks(pl.spotifyId);
    await runImport({ name: pl.name, source: 'spotify', spotifyId: pl.spotifyId, wanted, existing: pl });
    closeLayer('sheet');
    renderPlaylist();
  } catch (e) {
    setProgress(null);
    toast(e.message || 'No se pudo sincronizar');
  }
}

async function importText() {
  const wanted = Matcher.parseList($('#txt-list').value);
  if (!wanted.length) { toast('Escribe al menos una canción'); return; }
  const name = $('#txt-name').value.trim() || 'Mi playlist';
  const pl = await runImport({ name, source: 'text', wanted });
  if (pl) {
    $('#txt-list').value = '';
    $('#txt-name').value = '';
    closeLayer('sheet');
    setTimeout(() => openPlaylist(pl.id), 350);
  }
}

async function onSpotifyRedirect(url) {
  try {
    if (await Spotify.handleRedirect(url)) {
      toast('¡Spotify conectado!');
      showView('library');
      openSheet();
    }
  } catch (e) {
    toast(e.message);
    showView('library');
    openSheet();
  }
}

/* ---------------- Favoritos ---------------- */
function toggleFav(t) {
  if (isFav(t.id)) {
    state.favs = state.favs.filter((f) => f.id !== t.id);
    toast('Eliminado de favoritos');
  } else {
    const { kind, orig, ...clean } = t;
    state.favs = [clean, ...state.favs];
    toast('Añadido a favoritos');
  }
  store.set('favs', state.favs);
  refreshLists();
  updatePlayerUI();
  if (state.openPlaylist === 'favs') renderPlaylist();
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
  const orig = $('#fp-orig');
  orig.classList.toggle('hidden', t.kind !== 'version');
  if (t.kind === 'version') orig.textContent = `Versión de «${t.orig.title}» (${t.orig.artist})`;
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

let seeking = false;
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
  const handlers = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    previoustrack: prev,
    nexttrack: () => next(),
    seekto: (d) => { audio.currentTime = d.seekTime; },
  };
  for (const [action, fn] of Object.entries(handlers)) {
    try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* no soportada */ }
  }
}

function openPlayer() {
  if (!current() || $('#full-player').classList.contains('open')) return;
  $('#full-player').classList.add('open');
  $('#full-player').setAttribute('aria-hidden', 'false');
  pushLayer('player');
}

function syncToggles() {
  $('#btn-shuffle').setAttribute('aria-pressed', state.shuffle);
  $('#btn-repeat').setAttribute('aria-pressed', state.repeat);
}

/* ---------------- Eventos ---------------- */
function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => {
    const i = layers.indexOf('playlist');
    if (i >= 0) layers.splice(i, 1);
    showView(b.dataset.view);
  }));
  ['#home-list', '#search-list', '#pl-tracks'].forEach((s) => bindList($(s)));

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

  // Biblioteca
  $('#btn-import').onclick = openSheet;
  $('#pl-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pl]');
    if (b) openPlaylist(b.dataset.pl);
  });
  $('#pl-back').onclick = () => closeLayer('playlist');
  $('#pl-play').onclick = () => {
    const tracks = $('#pl-tracks')._tracks || [];
    if (!tracks.length) return;
    state.shuffle = false; store.set('shuffle', false); syncToggles();
    playFrom(tracks, 0);
  };
  $('#pl-shuffle').onclick = () => {
    const tracks = $('#pl-tracks')._tracks || [];
    if (!tracks.length) return;
    state.shuffle = true; store.set('shuffle', true); syncToggles();
    playFrom(tracks, Math.floor(Math.random() * tracks.length));
  };
  $('#pl-sync').onclick = syncPlaylist;
  $('#pl-delete').onclick = () => {
    const pl = state.playlists.find((p) => p.id === state.openPlaylist);
    if (!pl || !confirm(`¿Eliminar «${pl.name}» de Sonora? (En Spotify no se borra nada)`)) return;
    state.playlists = state.playlists.filter((p) => p !== pl);
    savePlaylists();
    closeLayer('playlist');
    toast('Playlist eliminada');
  };

  // Ventana de importar
  $('#sheet-close').onclick = () => closeLayer('sheet');
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet' && !state.importing) closeLayer('sheet'); });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
  $('#sp-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(Spotify.redirectUri()); toast('Copiado'); } catch { toast('Mantén pulsado para copiar'); }
  };
  $('#sp-client').addEventListener('change', (e) => Spotify.setClientId(e.target.value));
  $('#sp-connect').onclick = async () => {
    Spotify.setClientId($('#sp-client').value);
    if (!/^[0-9a-f]{32}$/i.test(Spotify.clientId())) { toast('El Client ID tiene 32 letras y números'); return; }
    try { await Spotify.login(); } catch (e) { toast(e.message); }
  };
  $('#sp-logout').onclick = () => { Spotify.logout(); renderSpotifyTab(); toast('Spotify desconectado'); };
  $('#sp-playlists').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sp]');
    const items = $('#sp-playlists')._spItems || [];
    const p = b && items.find((x) => x.id === b.dataset.sp);
    if (p) importSpotify(p);
  });
  $('#txt-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    $('#txt-list').value = await file.text();
    if (!$('#txt-name').value) $('#txt-name').value = file.name.replace(/\.(csv|txt)$/i, '').replace(/[_-]+/g, ' ');
    toast(`${Matcher.parseList($('#txt-list').value).length} canciones leídas`);
    e.target.value = '';
  });
  $('#txt-import').onclick = importText;

  // Reproductor
  $('#mini-player').addEventListener('click', (e) => {
    if (e.target.closest('#mini-play')) togglePlay();
    else if (e.target.closest('#mini-next')) next();
    else openPlayer();
  });
  $('#mini-player').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'mini-player') openPlayer();
  });
  $('#mini-next').innerHTML = ICONS.next;
  for (const id of ['#mini-art', '#fp-art']) {
    $(id).addEventListener('error', (e) => { if (!e.target.src.endsWith('icons/icon.svg')) e.target.src = 'icons/icon.svg'; });
  }

  $('#fp-close').onclick = () => closeLayer('player');
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
    if (startY !== null && e.changedTouches[0].clientY - startY > 100) closeLayer('player');
    startY = null;
  });

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

/* ---------------- iPhone: aviso de instalación ---------------- */
function setupIOSInstall() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!isIOS || standalone || Spotify.isNative() || store.get('iosHintClosed', false)) return;
  const box = $('#ios-install');
  setTimeout(() => box.classList.remove('hidden'), 1500);
  $('#ios-close').onclick = () => { box.classList.add('hidden'); store.set('iosHintClosed', true); };
}

/* ---------------- Inicio ---------------- */
function init() {
  renderGenres();
  bindEvents();
  syncToggles();
  setupMediaSession();
  doSearch('');
  loadHome();

  // Vuelta desde el login de Spotify
  const App = window.Capacitor?.Plugins?.App;
  if (Spotify.isNative() && App) {
    App.addListener('appUrlOpen', ({ url }) => {
      if (url?.startsWith('com.sonora.musica://')) onSpotifyRedirect(url);
    });
  } else if (/[?&](code|error)=/.test(location.search)) {
    const url = location.href;
    history.replaceState(null, '', location.pathname);
    onSpotifyRedirect(url);
  }

  setupIOSInstall();

  if ('serviceWorker' in navigator && !Spotify.isNative() && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
