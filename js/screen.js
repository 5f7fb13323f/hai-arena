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
  slide: 0, joinUrl: ''
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
  root().innerHTML =
    S.event.showcaseTaskId ? showcaseView() :
    S.event.phase === 'done' ? podiumView() :
    S.event.phase === 'finale' ? finaleView() :
    S.event.phase === 'semi' ? semiView() :
    mainView();
  tick();
}

// 16 tiles a slide, advancing every 10 seconds, sliding horizontally.
const GALLERY_PER_SLIDE = 16;

function gallery(entries, counts, showVotes) {
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));
  const slides = [];
  for (let i = 0; i < entries.length; i += GALLERY_PER_SLIDE) {
    slides.push(entries.slice(i, i + GALLERY_PER_SLIDE));
  }
  if (!slides.length) return `<div class="card center muted">Nothing submitted yet.</div>`;
  const index = S.slide % slides.length;

  return `
    <div class="gallery" data-slides="${slides.length}">
      <div class="gallery__track" style="width:${slides.length * 100}%;
           transform:translateX(-${index * (100 / slides.length)}%)">
        ${slides.map(slide => `<div class="gallery__slide" style="width:${100 / slides.length}%">
          <div class="gallery__grid">
            ${slide.map(e => `<figure class="tile">
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
        </div>`).join('')}
      </div>
      ${slides.length > 1 ? `<div class="gallery__dots">
        ${slides.map((_, i) => `<span class="${i === index ? 'is-on' : ''}"></span>`).join('')}
      </div>` : ''}
    </div>`;
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
  const rows = S.subs
    .filter(x => x.taskId === taskId && (x.name || x.text))
    .sort((a, b) => String(byId[a.teamId]?.name || '').localeCompare(String(byId[b.teamId]?.name || '')));

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
          ${x.name ? `<h2 style="margin:0 0 6px">${esc(x.name)}</h2>` : ''}
          <div style="line-height:1.5">${esc(String(x.text || '').slice(0, 700))}</div>
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
  const track = document.querySelector('.gallery');
  if (!track) return;
  if (Number(track.dataset.slides || 1) < 2) return;
  S.slide = (S.slide + 1) % Number(track.dataset.slides);
  paint();
}, 10000);
