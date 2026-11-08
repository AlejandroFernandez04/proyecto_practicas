/* =========================================================
   Busca en Audius (música gratis) cada canción de una playlist
   importada y decide si es la original, una versión o no está.
   ========================================================= */
'use strict';

const Matcher = (() => {
  const STOP = new Set(['the', 'a', 'el', 'la', 'los', 'las', 'de', 'and', 'y', 'feat', 'ft', 'featuring', 'with', 'con', 'prod']);

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      // fuera "(Remastered 2011)", "[Live]", "- Radio Edit"…
      .replace(/\((?:[^)]*(?:remaster|version|edit|live|mono|stereo|mix|feat|ft\.|with|deluxe)[^)]*)\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\s-\s.*(?:remaster|version|edit|live|mix).*$/g, ' ')
      .replace(/[^a-z0-9ñ]+/g, ' ')
      .trim();
  }
  const tokens = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w));

  /** Parecido entre 0 y 1: qué parte de las palabras buscadas aparecen en el candidato. */
  function coverage(wanted, candidate) {
    const w = tokens(wanted);
    if (!w.length) return 0;
    const c = new Set(tokens(candidate));
    return w.filter((t) => c.has(t)).length / w.length;
  }
  function similarity(a, b) {
    const ta = new Set(tokens(a));
    const tb = new Set(tokens(b));
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    ta.forEach((t) => { if (tb.has(t)) inter++; });
    return (2 * inter) / (ta.size + tb.size);
  }

  const REMIX = /\b(remix|flip|cover|edit|bootleg|rework|vip|mashup|version|versi[oó]n|instrumental|sped up|slowed|nightcore|karaoke|acoustic|ac[uú]stico|piano|bater[ií]a|guitar|tribute|tributo|live|en vivo)\b/i;

  function score(want, cand) {
    // En Audius el título suele llevar el artista: "Artista - Canción"
    const titleSim = Math.max(similarity(want.title, cand.title), coverage(want.title, cand.title) * 0.95);
    const artists = String(want.artist || '').split(',').map((a) => a.trim()).filter(Boolean);
    // ¿Lo ha subido el propio artista?
    const uploaderSim = artists.length
      ? Math.max(...artists.map((a) => Math.max(similarity(a, cand.artist), coverage(a, cand.artist))))
      : 0;
    // ¿El artista solo aparece en el título? (típico de remixes y covers)
    const inTitle = artists.length ? Math.max(...artists.map((a) => coverage(a, cand.title))) : 0;
    const artistSim = Math.max(uploaderSim, inTitle * 0.8);
    // Remix/cover/directo… que no estaba en el título original
    const isRemix = REMIX.test(cand.title) && !REMIX.test(want.title);
    let durPenalty = 0; // p. ej. mixes de 1 hora
    if (want.duration && cand.duration) {
      const diff = Math.abs(want.duration - cand.duration) / want.duration;
      if (diff > 0.5) durPenalty = 0.25;
      else if (diff > 0.2) durPenalty = 0.1;
    }
    const original = uploaderSim >= 0.6 && !isRemix;
    return {
      titleSim, artistSim, original,
      total: titleSim * 0.6 + artistSim * 0.4 - durPenalty + (original ? 0.15 : 0),
    };
  }

  function best(want, candidates) {
    let top = null;
    for (const c of candidates) {
      const s = score(want, c);
      if (s.titleSim < 0.6) continue;
      if (!top || s.total > top.s.total) top = { c, s };
    }
    if (!top || top.s.total < 0.45) return null;
    return { track: top.c, kind: top.s.original ? 'original' : 'version' };
  }

  async function matchOne(want, searchFn) {
    const firstArtist = String(want.artist || '').split(',')[0].trim();
    const cleanTitle = norm(want.title);
    let found = best(want, await searchFn(`${cleanTitle} ${norm(firstArtist)}`.trim()));
    if (!found || found.kind === 'version') {
      const alt = best(want, await searchFn(cleanTitle));
      if (alt && (!found || alt.kind === 'original')) found = alt;
    }
    return found;
  }

  /**
   * Empareja una lista de canciones. Reutiliza resultados anteriores (cache) para que
   * volver a sincronizar sea rápido. onProgress(hechas, total).
   */
  async function matchAll(wanted, searchFn, { cache = {}, onProgress, concurrency = 4 } = {}) {
    const results = new Array(wanted.length);
    let done = 0;
    let next = 0;
    async function worker() {
      while (next < wanted.length) {
        const i = next++;
        const w = wanted[i];
        const key = keyOf(w);
        let m = cache[key];
        if (m === undefined) {
          try { m = await matchOne(w, searchFn); } catch { m = undefined; }
        }
        results[i] = { want: w, match: m?.track || null, kind: m?.kind || null, failed: m === undefined };
        onProgress?.(++done, wanted.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, wanted.length) }, worker));
    return results;
  }

  const keyOf = (w) => `${norm(w.title)}|${norm(w.artist)}`;

  /* -------- Lectura de listas en texto / CSV -------- */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') q = false;
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }

  /** Acepta el CSV de Exportify/Spotify o líneas "Artista - Canción". */
  function parseList(text) {
    text = String(text || '').replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/)[0].toLowerCase();
    if (firstLine.includes(',') && /track name|nombre|title|título|titulo/.test(firstLine) && /artist/.test(firstLine)) {
      const [header, ...rows] = parseCSV(text);
      const h = header.map((x) => x.toLowerCase().trim());
      const ti = h.findIndex((x) => /track name|^name$|nombre|^title$|título|titulo/.test(x));
      const ai = h.findIndex((x) => /artist/.test(x));
      const di = h.findIndex((x) => /duration/.test(x));
      return rows.map((r) => ({
        title: (r[ti] || '').trim(),
        artist: (r[ai] || '').replace(/;/g, ', ').trim(),
        duration: di >= 0 ? Math.round((+r[di] || 0) / 1000) : 0,
      })).filter((t) => t.title);
    }
    return text.split(/\r?\n/)
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.split(/\s+[-–—]\s+/);
        return m.length >= 2
          ? { artist: m[0].trim(), title: m.slice(1).join(' - ').trim(), duration: 0 }
          : { artist: '', title: l, duration: 0 };
      });
  }

  return { matchAll, parseList, keyOf, _score: score, _norm: norm };
})();
