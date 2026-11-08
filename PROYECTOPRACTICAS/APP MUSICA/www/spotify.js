/* =========================================================
   Conexión con Spotify (solo lectura de tus playlists).
   Usa OAuth con PKCE: no hace falta "client secret" y la app
   nunca ve tu contraseña. Spotify NO deja reproducir su audio
   fuera de su app, así que solo leemos títulos y artistas.
   ========================================================= */
'use strict';

const Spotify = (() => {
  const SCOPES = 'playlist-read-private playlist-read-collaborative user-library-read';
  const NATIVE_REDIRECT = 'com.sonora.musica://callback';
  const K = { client: 'sp_client_id', tokens: 'sp_tokens', verifier: 'sp_verifier', state: 'sp_state' };

  const isNative = () => !!window.Capacitor?.isNativePlatform?.();
  const plugin = (name) => window.Capacitor?.Plugins?.[name];
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* nada */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* nada */ } },
  };

  const redirectUri = () => (isNative() ? NATIVE_REDIRECT : location.origin + location.pathname);
  const clientId = () => (ls.get(K.client) || '').trim();
  const setClientId = (id) => ls.set(K.client, id.trim());
  const tokens = () => { try { return JSON.parse(ls.get(K.tokens)); } catch { return null; } };
  const isConnected = () => !!tokens()?.refresh_token;
  const logout = () => ls.del(K.tokens);

  function randomString(len = 64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }
  async function challengeFor(verifier) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function login() {
    if (!clientId()) throw new Error('Falta el Client ID de Spotify');
    if (!window.isSecureContext || !crypto.subtle) {
      throw new Error('Abre la app con HTTPS (o desde la APK) para conectar con Spotify');
    }
    const verifier = randomString();
    const state = randomString(16);
    ls.set(K.verifier, verifier);
    ls.set(K.state, state);
    const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
      response_type: 'code',
      client_id: clientId(),
      scope: SCOPES,
      redirect_uri: redirectUri(),
      code_challenge_method: 'S256',
      code_challenge: await challengeFor(verifier),
      state,
    });
    if (isNative() && plugin('Browser')) await plugin('Browser').open({ url });
    else location.href = url;
  }

  async function tokenRequest(body) {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId(), ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error_description || json.error || `Spotify respondió ${res.status}`);
    const old = tokens() || {};
    const t = {
      access_token: json.access_token,
      refresh_token: json.refresh_token || old.refresh_token,
      expires_at: Date.now() + (json.expires_in - 60) * 1000,
    };
    ls.set(K.tokens, JSON.stringify(t));
    return t;
  }

  /** Procesa la vuelta desde Spotify. Devuelve true si había un login pendiente. */
  async function handleRedirect(urlStr) {
    const url = new URL(urlStr);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (!code && !error) return false;
    if (isNative()) plugin('Browser')?.close?.().catch?.(() => {});
    if (error) throw new Error(error === 'access_denied' ? 'Has cancelado el acceso a Spotify' : error);
    if (url.searchParams.get('state') !== ls.get(K.state)) throw new Error('La respuesta de Spotify no es válida');
    await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: ls.get(K.verifier) || '',
    });
    ls.del(K.verifier);
    ls.del(K.state);
    return true;
  }

  async function accessToken() {
    let t = tokens();
    if (!t) throw new Error('No estás conectado a Spotify');
    if (Date.now() > t.expires_at) {
      try {
        t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token });
      } catch (e) {
        logout();
        throw new Error('La sesión de Spotify ha caducado. Vuelve a conectar.');
      }
    }
    return t.access_token;
  }

  async function api(pathOrUrl, retry = true) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `https://api.spotify.com/v1${pathOrUrl}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    if (res.status === 401 && retry) {
      const t = tokens();
      if (t) { t.expires_at = 0; ls.set(K.tokens, JSON.stringify(t)); }
      return api(pathOrUrl, false);
    }
    if (res.status === 429 && retry) {
      const wait = Math.min(+(res.headers.get('Retry-After') || 2), 30);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return api(pathOrUrl, false);
    }
    if (!res.ok) {
      const err = new Error(`Spotify respondió ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function paginate(first, mapItem, onProgress) {
    const out = [];
    let next = first;
    while (next) {
      const page = await api(next);
      for (const it of page.items || []) {
        const v = mapItem(it);
        if (v) out.push(v);
      }
      onProgress?.(out.length, page.total);
      next = page.next;
    }
    return out;
  }

  const mapTrack = (it) => {
    // En 2026 Spotify renombró "track" a "item" en algunas respuestas: aceptamos ambos.
    const t = it?.item || it?.track;
    if (!t || t.type === 'episode' || !t.name) return null;
    return {
      title: t.name,
      artist: (t.artists || []).map((a) => a.name).join(', '),
      duration: Math.round((t.duration_ms || 0) / 1000),
    };
  };

  async function me() { return api('/me'); }

  async function playlists() {
    return paginate('/me/playlists?limit=50', (p) => (p ? {
      id: p.id,
      name: p.name,
      image: p.images?.[0]?.url || '',
      total: p.items?.total ?? p.tracks?.total ?? 0,
    } : null));
  }

  async function playlistTracks(id, onProgress) {
    try {
      return await paginate(`/playlists/${id}/items?limit=50`, mapTrack, onProgress);
    } catch (e) {
      if (e.status !== 403 && e.status !== 404) throw e;
      try {
        // Endpoint antiguo, por si la cuenta aún usa la versión previa de la API
        return await paginate(`/playlists/${id}/tracks?limit=50`, mapTrack, onProgress);
      } catch (e2) {
        if (e2.status === 403) {
          throw new Error('Spotify no permite leer esta playlist (solo se pueden leer las tuyas o en las que colaboras).');
        }
        throw e2;
      }
    }
  }

  async function likedTracks(onProgress) {
    return paginate('/me/tracks?limit=50', mapTrack, onProgress);
  }

  return {
    isNative, redirectUri, clientId, setClientId, isConnected, logout,
    login, handleRedirect, me, playlists, playlistTracks, likedTracks,
  };
})();
