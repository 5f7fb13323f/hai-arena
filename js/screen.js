import { db, doc, collection, onSnapshot, getDocs } from './firebase.js';
import { renderAuth, watchAuth, isAdmin } from './auth.js';
import { t, tr } from './i18n.js';
import { $, esc, fmtClock, toMs, teamColor } from './util.js';
import { rankTeams } from './scoring.js';
import { APP_TITLE } from './firebase-config.js';

const S = {
  user: null, admin: false, eid: null, event: null,
  teams: [], participants: [], task: null, finale: [], votes: [],
  semi: [], semivotes: [], semiImage: null, subs: [], keys: {},
  slide: 0, joinUrl: '',
  // Set by gallery() so a click on a tile can find its picture again, and the
  // id of the tile currently blown up over the whole screen.
  gallery: {}, zoom: null, zoomVotes: false
};
const root = () => $('#root');
let unsubs = [];
const stopAll = () => { unsubs.forEach(u => { try { u(); } catch {} }); unsubs = []; };

S.joinUrl = location.href.replace(/screen\.html.*$/, '').replace(/^https?:\/\//, '');

watchAuth(async (user) => {
  stopAll();
  S.user = user;
  if (!user) { renderAuth(root(), {}); return; }
  S.admin = await isAdmin(user.uid);
  const wanted = new URLSearchParams(location.search).get('event');
  if (wanted) { attach(wanted); return; }
  try {
    const qs = await getDocs(collection(db, 'events'));
    const evs = qs.docs.map(d => ({ id: d.id, ...d.data() }));
    evs.sort((a, b) => (toMs(b.createdAt) || 0) - (toMs(a.createdAt) || 0));
    if (evs[0]) attach(evs[0].id); else paint();
  } catch {
    // Participants cannot list events — fall back to the one they belong to.
    const snap = await import('./firebase.js').then(m => m.getDoc(doc(db, 'users', user.uid)));
    const eid = snap.data()?.eventId;
    if (eid) attach(eid); else paint();
  }
});

function attach(eid) {
  stopAll();
  S.eid = eid;
  const b = ['events', eid];
  unsubs.push(onSnapshot(doc(db, ...b), s => {
    S.event = s.exists() ? { id: s.id, ...s.data() } : null;
    attachTask();
    paint();
  }));
  unsubs.push(onSnapshot(collection(db, ...b, 'teams'), qs => {
    S.teams = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint();
  }));
  unsubs.push(onSnapshot(collection(db, ...b, 'participants'), qs => {
    S.participants = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint();
  }));
  unsubs.push(onSnapshot(collection(db, ...b, 'submissions'), qs => {
    S.subs = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint();
  }, () => {}));
  unsubs.push(onSnapshot(collection(db, ...b, 'finale'), qs => {
    S.finale = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint();
  }));
  unsubs.push(onSnapshot(collection(db, ...b, 'semi'), qs => {
    S.semi = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint();
  }, () => {}));
  unsubs.push(onSnapshot(doc(db, ...b, 'media', 'semi-reference'), s => {
    S.semiImage = s.exists() ? s.data().image : null; paint();
  }, () => {}));
  if (S.admin) {
    unsubs.push(onSnapshot(collection(db, ...b, 'keys'), qs => {
      S.keys = Object.fromEntries(qs.docs.map(d => [d.id, d.data()])); paint();
    }, () => {}));
    unsubs.push(onSnapshot(collection(db, ...b, 'votes'), qs => {
      S.votes = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint();
    }));
    unsubs.push(onSnapshot(collection(db, ...b, 'semivotes'), qs => {
      S.semivotes = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint();
    }));
  }
}

let taskUnsub = null, attachedId = null;
function attachTask() {
  const id = S.event?.showcaseTaskId || S.event?.activeTaskId || null;
  if (id === attachedId) return;
  attachedId = id;
  taskUnsub?.(); taskUnsub = null;
  S.task = null;
  if (!id) { paint(); return; }
  taskUnsub = onSnapshot(doc(db, 'events', S.eid, 'tasks', id), s => {
    S.task = s.exists() ? { id: s.id, ...s.data() } : null; paint();
  });
}

function counts(rows) {
  const c = {};
  for (const v of (rows || S.votes)) c[v.teamId] = (c[v.teamId] || 0) + 1;
  return c;
}

function paint() {
  if (!S.user) return;
  if (!S.event) {
    root().innerHTML = `<div class="card center"><h1>${esc(t('screenNoEvent'))}</h1></div>`;
    return;
  }
  const galleryView = !!S.event.showcaseTaskId
    || S.event.phase === 'semi' || S.event.phase === 'finale';
  if (!galleryView) S.zoom = null;
  root().innerHTML =
    S.event.showcaseTaskId ? showcaseView() :
    S.event.phase === 'done' ? podiumView() :
    S.event.phase === 'finale' ? finaleView() :
    S.event.phase === 'semi' ? semiView() :
    mainView();
  tick();
}

// Up to 16 tiles a slide, filling the screen, advancing every 10 seconds.
// Slides are balanced rather than greedy: 20 entries become 10 + 10, not
// 16 + 4, so the last slide never looks half-empty.
const GALLERY_MAX = 16;
const GALLERY_GAP = 12;

// Tiles are square, so their edge is whichever fits: the width the grid has,
// or the height left under the status bar. Both are measured rather than left
// to CSS, because a square sized off the height alone runs off the side of a
// wide projector, and off the bottom of a tall one.
//
// The column count is picked to make that square as big as it can be: on a
// 16:9 projector eleven pictures look far better as 4 + 4 + 3 than as three
// rows under a 4-column cap.
function slideLayout(n) {
  const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
  const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
  const w = Math.min(1600, vw - 68);           // page padding on .screen
  const h = vh - 190;                          // logo row, status bar, dots
  let best = { cols: Math.min(4, n), edge: 0, waste: Infinity };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const byW = (w - GALLERY_GAP * (cols - 1)) / cols;
    const byH = (h - GALLERY_GAP * (rows - 1)) / rows;
    const edge = Math.floor(Math.min(byW, byH));
    const waste = cols * rows - n;
    if (edge > best.edge + 1 || (Math.abs(edge - best.edge) <= 1 && waste < best.waste)) {
      best = { cols, edge, waste };
    }
  }
  return { cols: best.cols, edge: Math.max(120, best.edge) };
}

function gallery(entries, counts, showVotes) {
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));
  S.gallery = Object.fromEntries(entries.map(e => [e.id, e]));
  S.zoomVotes = !!showVotes;
  if (!entries.length) return `<div class="card center muted">Nothing submitted yet.</div>`;

  const slideCount = Math.max(1, Math.ceil(entries.length / GALLERY_MAX));
  const perSlide = Math.ceil(entries.length / slideCount);
  const slides = [];
  for (let i = 0; i < entries.length; i += perSlide) slides.push(entries.slice(i, i + perSlide));
  const index = S.slide % slides.length;

  return `
    <div class="gallery" data-slides="${slides.length}">
      <div class="gallery__track" style="width:${slides.length * 100}%;
           transform:translateX(-${index * (100 / slides.length)}%)">
        ${slides.map(slide => {
          const { cols, edge } = slideLayout(slide.length);
          const gridW = cols * edge + (cols - 1) * GALLERY_GAP;
          return `<div class="gallery__slide" style="width:${100 / slides.length}%">
            <div class="gallery__grid" style="width:${gridW}px">
              ${slide.map(e => `<figure class="tile" data-zoom="${esc(e.id)}" style="width:${edge}px">
                ${e.image
                  ? `<img src="${esc(e.image)}" alt="">`
                  : `<div class="tile__blank">…</div>`}
                <figcaption>
                  <span class="dot" style="background:${teamColor(e.id)}"></span>
                  <span class="tile__name">${esc(byId[e.id]?.name || e.id)}</span>
                  ${showVotes ? `<span class="tile__votes">${counts[e.id] || 0}</span>` : ''}
                </figcaption>
              </figure>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
      ${slides.length > 1 ? `<div class="gallery__dots">
        ${slides.map((_, i) => `<span class="${i === index ? 'is-on' : ''}"></span>`).join('')}
      </div>` : ''}
      ${lightbox(counts)}
    </div>`;
}

// The picture the host clicked, over the whole room. Painted from state, so a
// snapshot landing while it is open leaves it standing.
function lightbox(counts) {
  if (!S.zoom) return '';
  const e = S.gallery[S.zoom];
  if (!e || !e.image) return '';
  const team = S.teams.find(x => x.id === e.id);
  return `
    <div class="lightbox" id="lightbox">
      <img src="${esc(e.image)}" alt="">
      <div class="lightbox__cap">
        <span class="dot" style="background:${teamColor(e.id)}"></span>
        <span>${esc(team?.name || e.id)}</span>
        ${S.zoomVotes ? `<span class="tile__votes">${(counts || {})[e.id] || 0}</span>` : ''}
      </div>
      <div class="lightbox__hint">click anywhere or press Esc to close</div>
    </div>`;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (ev) => {
    if (ev.target.closest?.('#lightbox')) { S.zoom = null; paint(); return; }
    const fig = ev.target.closest?.('.tile[data-zoom]');
    if (!fig) return;
    const id = fig.dataset.zoom;
    if (!S.gallery[id]?.image) return;
    S.zoom = id;
    paint();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && S.zoom) { S.zoom = null; paint(); }
  });
  // Square tiles are sized in pixels, so a resized window needs a repaint.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(paint, 150);
  });
}

function podiumView() {
  const ranked = rankTeams(S.teams);
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const medals = ['🥇', '🥈', '🥉'];
  // Indexed by RANK, not by where the column sits: first place must be the
  // tallest block wherever we put it.
  const heights = [230, 175, 140];
  const order = [1, 0, 2];          // silver, gold, bronze — winner in the middle

  return `
    <div class="center" style="margin-bottom:26px">
      <span class="pill pill--live">${esc(t('endTitle'))}</span>
      <h1 style="font-size:clamp(34px,5vw,68px);margin-top:10px">${esc(S.event.name || '')}</h1>
    </div>
    <div class="podium">
      ${order.filter(i => top[i]).map(i => {
        const x = top[i];
        return `<div class="podium__col ${i === 0 ? 'podium__col--win' : ''}">
          <div class="podium__medal">${medals[i]}</div>
          <div class="podium__name"><span class="dot" style="background:${teamColor(x.id)}"></span>${esc(x.name || x.id)}</div>
          <div class="podium__pts">${Number(x.points || 0)}</div>
          <div class="podium__block" style="height:${heights[i]}px">${x.rank}</div>
        </div>`;
      }).join('')}
    </div>
    ${rest.length ? `<div class="card" style="margin-top:28px">
      <h2>${esc(t('endStandings'))}</h2>
      <div class="lb">${rest.map(x => `
        <div class="lb__row">
          <div class="lb__rank">${x.rank}</div>
          <div class="lb__name"><span class="dot" style="background:${teamColor(x.id)}"></span><span>${esc(x.name || x.id)}</span></div>
          <div class="lb__pts">${Number(x.points || 0)}</div>
        </div>`).join('')}</div>
    </div>` : ''}`;
}

function semiView() {
  const s = S.event.semi || {};
  const c = counts(S.semivotes);
  const creating = s.phase === 'creating';
  const showVotes = S.admin && (s.phase === 'voting' || s.phase === 'results');
  const entries = S.semi.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const ranked = entries.map(e => ({ id: e.id, v: c[e.id] || 0 })).sort((a, b) => b.v - a.v);
  const winner = s.phase === 'results' && ranked.length ? ranked[0] : null;
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));

  if (creating) {
    return `
      <div class="statusbar">
        <span class="pill pill--live">${esc(t('semiTitle'))}</span>
        <span class="grow"></span>
        <span class="pill">${S.semi.length} / ${S.teams.length} ${esc(t('screenSubmitted'))}</span>
        <span class="timer" id="timer">–</span>
      </div>
      <div class="card center">
        ${S.semiImage
          ? `<img src="${esc(S.semiImage)}" alt="" style="max-width:min(900px,100%);max-height:62vh;border-radius:14px">`
          : `<div class="drop" style="cursor:default">${esc(t('semiWaiting'))}</div>`}
      </div>`;
  }

  return `
    <div class="statusbar">
      <span class="pill pill--live">${esc(t('semiTitle'))}</span>
      ${winner ? `<b style="margin-left:10px;color:var(--green);font-size:clamp(16px,1.6vw,26px)">
        ${esc(t('winner'))}: ${esc(byId[winner.id]?.name || winner.id)}</b>` : ''}
      <span class="grow"></span>
      ${S.semiImage ? `<img src="${esc(S.semiImage)}" alt="" style="height:52px;border-radius:8px;border:1px solid var(--line)" title="the original">` : ''}
      <span class="pill">${S.semivotes.length} ${esc(t('votes'))}</span>
    </div>
    ${gallery(entries, c, showVotes)}`;
}

function answeredTeams() {
  const id = S.event?.activeTaskId;
  if (!id) return null;
  return new Set(S.subs.filter(x => x.taskId === id).map(x => x.teamId));
}

function board(limit) {
  const ranked = rankTeams(S.teams).slice(0, limit || S.teams.length);
  const done = answeredTeams();
  return `<div class="lb">${ranked.map(x => `
    <div class="lb__row">
      <div class="lb__rank">${x.rank}</div>
      <div class="lb__name">
        <span class="dot" style="background:${teamColor(x.id)}"></span>
        <span>${esc(x.name || x.id)}</span>
        ${done ? (done.has(x.id)
          ? `<span class="tick" title="answered">✓</span>`
          : `<span class="tick tick--wait">·</span>`) : ''}
      </div>
      <div class="lb__pts">${Number(x.points || 0)}</div>
    </div>`).join('')}</div>`;
}

function mainView() {
  const task = S.task;
  const live = task && task.status === 'open';
  const prep = S.event.phase === 'prep';
  const done = answeredTeams();
  const answered = done ? done.size : 0;

  const status = task
    ? `<span class="pill ${live ? 'pill--live' : 'pill--closed'}">${esc(live ? t('screenOpen') : t('screenClosed'))}</span>
       <b style="margin-left:10px;font-size:clamp(15px,1.4vw,22px)">${esc(tr(task.title))}</b>`
    : `<span class="pill">${esc(prep ? t('screenPrep') : t('screenWaiting'))}</span>`;

  return `
    <div class="statusbar">
      <div class="row" style="min-width:0">${status}</div>
      <span class="grow"></span>
      ${task && live ? `<span class="pill">${answered} / ${S.teams.length} ${esc(t('screenAnswered'))}</span>` : ''}
      <span class="pill">${S.teams.length} ${esc(t('screenTeams'))} · ${S.participants.length} ${esc(t('screenPlayers'))}</span>
      ${task ? `<span class="timer" id="timer">–</span>` : ''}
    </div>
    <div class="screen-grid">
      <div class="card stack">
        ${task ? `
          <h1 style="font-size:clamp(26px,3vw,44px)">${esc(tr(task.title))}</h1>
          <p class="muted" style="font-size:clamp(15px,1.3vw,20px)">${esc(tr(task.intro))}</p>
          ${live && Array.isArray(task.payload?.steps) ? `<ol class="screen-steps">
            ${task.payload.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        ` : prep ? `
          <h1>${esc(t('prepTitle'))}</h1>
          <p class="muted" style="font-size:20px">${esc(t('prepBody'))}</p>
        ` : `
          <h1>${esc(t('screenPart1'))}</h1>
          <p class="muted" style="font-size:20px">${esc(t('screenJoin'))} <b>${esc(S.joinUrl)}</b></p>`}
      </div>
      <div class="card">
        <h2>${esc(t('leaderboard'))}</h2>
        ${board(14)}
      </div>
    </div>`;
}

// A quiz, marked up with the right answers, for walking the room through it.
function reviewView(task) {
  const key = S.keys[task.id] || {};
  const items = task.payload?.items || [];
  const single = task.type === 'quiz-single';

  return `
    <div class="statusbar">
      <span class="pill pill--live">${esc(t('screenCorrect'))}</span>
      <b style="margin-left:10px;font-size:clamp(15px,1.4vw,22px)">${esc(tr(task.title))}</b>
      <span class="grow"></span>
      ${task.maxPoints ? `<span class="pill">worth up to ${Number(task.maxPoints)} points</span>` : ''}
    </div>
    <div class="review">
      ${items.map((item, i) => {
        const right = single ? key.answers?.[item.id] : null;
        const isFalse = !single && (key.falseIds || []).includes(item.id);
        const verdict = single
          ? (right || '').toUpperCase()
          : (isFalse ? 'FALSE' : 'TRUE');
        const highlight = single || isFalse;
        return `<div class="review__item ${highlight ? 'review__item--flag' : ''}">
          <div class="row" style="margin-bottom:6px">
            <span class="mono" style="color:var(--ink-faint)">${String(i + 1).padStart(2, '0')}</span>
            <span class="pill ${single ? 'pill--live' : (isFalse ? 'pill--closed' : '')}">${esc(verdict)}</span>
          </div>
          <div class="review__text">${esc(tr(item.text))}</div>
          ${key.notes?.[item.id] ? `<div class="review__note">${esc(tr(key.notes[item.id]))}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

// Everyone's answers to an open-ended task, up on the wall to be read out.
function showcaseView() {
  const taskId = S.event.showcaseTaskId;
  const task = S.task && S.task.id === taskId ? S.task : null;
  if (task && (task.type === 'quiz-single' || task.type === 'quiz-multi')) return reviewView(task);
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));
  const golf = task?.type === 'golf';
  const rows = S.subs
    .filter(x => x.taskId === taskId && (golf ? (x.prompt || x.output) : (x.name || x.text)))
    .sort((a, b) => golf
      ? (a.prompt || '').length - (b.prompt || '').length
      : String(byId[a.teamId]?.name || '').localeCompare(String(byId[b.teamId]?.name || '')));

  return `
    <div class="statusbar">
      <span class="pill pill--live">${esc(tr(task?.title) || 'Submissions')}</span>
      <span class="grow"></span>
      <span class="pill">${rows.length} ${esc(t('screenAnswered'))}</span>
    </div>
    <div class="showcase">
      ${rows.length ? rows.map(x => `
        <div class="card" style="margin:0">
          <div class="row" style="margin-bottom:8px">
            <span class="dot" style="background:${teamColor(x.teamId)}"></span>
            <b>${esc(byId[x.teamId]?.name || x.teamId)}</b>
          </div>
          ${golf ? `
            <div class="row" style="margin-bottom:6px">
              <span class="pill">${(x.prompt || '').length} chars</span>
              ${typeof x.awarded === 'number' ? `<span class="pill pill--live">${x.awarded} pts</span>` : ''}
            </div>
            <div style="line-height:1.5;font-weight:650">${esc(String(x.prompt || '').slice(0, 300))}</div>
            <div class="review__note">${esc(String(x.output || '').slice(0, 400))}</div>
          ` : `
            ${x.name ? `<h2 style="margin:0 0 6px">${esc(x.name)}</h2>` : ''}
            <div style="line-height:1.5">${esc(String(x.text || '').slice(0, 700))}</div>
          `}
        </div>`).join('')
      : `<div class="card center muted">No answers yet.</div>`}
    </div>`;
}

function finaleView() {
  const f = S.event.finale || {};
  const c = counts(S.votes);
  const creating = f.phase === 'creating';
  const showVotes = S.admin && (f.phase === 'voting' || f.phase === 'results');
  const entries = S.finale.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const ranked = entries.map(e => ({ id: e.id, v: c[e.id] || 0 })).sort((a, b) => b.v - a.v);
  const winner = f.phase === 'results' && ranked.length ? ranked[0] : null;
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));

  if (creating) {
    return `
      <div class="statusbar">
        <span class="pill pill--live">${esc(t('finaleTitle'))}</span>
        <span class="grow"></span>
        <span class="pill">${S.finale.length} / ${S.teams.length} ${esc(t('screenSubmitted'))}</span>
        <span class="timer" id="timer">–</span>
      </div>
      <div class="center stack">
        <span class="faint">${esc(t('finaleTheme'))}</span>
        <div class="bigtheme">${esc(tr(f.theme) || '…')}</div>
      </div>`;
  }

  return `
    <div class="statusbar">
      <span class="pill pill--live">${esc(t('finaleTitle'))}</span>
      <b style="margin-left:10px;font-size:clamp(15px,1.3vw,21px)">${esc(tr(f.theme) || '')}</b>
      ${winner ? `<b style="margin-left:14px;color:var(--green);font-size:clamp(16px,1.6vw,26px)">
        ${esc(t('winner'))}: ${esc(byId[winner.id]?.name || winner.id)}</b>` : ''}
      <span class="grow"></span>
      <span class="pill">${S.votes.length} ${esc(t('votes'))}</span>
    </div>
    ${gallery(entries, c, showVotes)}`;
}

function tick() {
  const el = $('#timer');
  if (!el) return;
  const endsAt =
    S.event?.phase === 'finale' ? toMs(S.event?.finale?.endsAt) :
    S.event?.phase === 'semi' ? toMs(S.event?.semi?.endsAt) :
    toMs(S.task?.endsAt);
  if (!endsAt) { el.textContent = '—'; return; }
  const left = endsAt - Date.now();
  el.textContent = left <= 0 ? t('timeUp') : fmtClock(left);
  el.classList.toggle('is-low', left > 0 && left < 30000);
}
setInterval(tick, 1000);

// Advance the gallery every 10 seconds. Repaint only when a gallery is on
// screen, so the rest of the time this costs nothing.
setInterval(() => {
  if (S.zoom) return;                 // hold the slide while a picture is open
  const track = document.querySelector('.gallery');
  if (!track) return;
  if (Number(track.dataset.slides || 1) < 2) return;
  S.slide = (S.slide + 1) % Number(track.dataset.slides);
  paint();
}, 10000);
