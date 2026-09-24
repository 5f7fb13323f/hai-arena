export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtClock(ms) {
  if (ms == null || ms < 0) ms = 0;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Firestore Timestamp | Date | number -> ms
export function toMs(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

export const TEAM_COLORS = [
  '#2fe07a', '#ffc53d', '#ff6b7a', '#6ee7b7', '#9ae66e', '#ffa14d',
  '#4ade80', '#ff8fa3', '#34d399', '#fde047', '#7dd3fc', '#c4b5fd'
];

export function teamColor(idOrIndex) {
  if (typeof idOrIndex === 'number') return TEAM_COLORS[idOrIndex % TEAM_COLORS.length];
  let h = 0;
  const s = String(idOrIndex ?? '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TEAM_COLORS[h % TEAM_COLORS.length];
}

let toastTimer = null;
export function toast(msg, kind = 'ok') {
  let n = document.getElementById('toast');
  if (!n) {
    n = document.createElement('div');
    n.id = 'toast';
    document.body.appendChild(n);
  }
  n.textContent = msg;
  n.className = `toast toast--${kind} is-on`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => n.classList.remove('is-on'), 2600);
}

// Downscale an image file in the browser and return a JPEG data URL.
// Firestore documents cap at ~1 MB, so we aim well below that: no Firebase
// Storage needed, which keeps the whole thing on the free Spark plan.
export function imageToDataUrl(file, maxPx = 1100, maxBytes = 420_000) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('not an image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#04110a';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      let q = 0.82;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > maxBytes && q > 0.3) {
        q -= 0.1;
        out = c.toDataURL('image/jpeg', q);
      }
      if (out.length > maxBytes) return reject(new Error('too large'));
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

export function debounce(fn, ms = 600) {
  let t = null;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}
