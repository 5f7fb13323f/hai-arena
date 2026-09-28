import { db, doc, collection, onSnapshot, getDocs } from './firebase.js';
import { renderAuth, watchAuth, isAdmin } from './auth.js';
import { t, tr } from './i18n.js';
import { $, esc, fmtClock, toMs, teamColor } from './util.js';
import { rankTeams } from './scoring.js';
import { APP_TITLE } from './firebase-config.js';

const S = {
  user: null, admin: false, eid: null, event: null,
  teams: [], participants: [], task: null, finale: [], votes: [],
  semi: [], semivotes: [], semiImage: null, subs: [], joinUrl: ''
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
  const ids = S.event.semifinalistTeamIds || [];
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));
  const showVotes = S.admin && (s.phase === 'voting' || s.phase === 'results');
  const ranked = ids.map(id => ({ id, v: c[id] || 0 })).sort((a, b) => b.v - a.v);
  const winner = s.phase === 'results' && ranked.length ? ranked[0] : null;
  const creating = s.phase === 'creating';

  return `
    <div class="center stack" style="margin-bottom:18px">
      <span class="pill pill--live">${esc(t('semiTitle'))}</span>
      ${creating ? `<div><span class="timer" id="timer">–</span></div>` : ''}
      ${winner ? `<h1 style="color:var(--green)">${esc(t('winner'))}: ${esc(byId[winner.id]?.name || winner.id)}</h1>` : ''}
    </div>
    <div class="screen-grid">
      <div class="card">
        ${S.semiImage
          ? `<img src="${esc(S.semiImage)}" alt="" style="width:100%;border-radius:12px;display:block">`
          : `<div class="drop" style="cursor:default">${esc(t('semiWaiting'))}</div>`}
      </div>
      <div class="card stack">
        <h2>${esc(creating ? t('semiReference') : t('semiVoteTitle'))}</h2>
        ${creating
          ? `<p class="muted" style="font-size:20px">${esc(ids.map(id => byId[id]?.name || id).join(' · '))}</p>`
          : ids.map(id => {
              const e = S.semi.find(x => x.id === id);
              return `<div class="qitem ${winner?.id === id ? 'is-picked' : ''}"
                   style="${winner?.id === id ? 'border-color:var(--green)' : ''}">
                <div class="row" style="margin-bottom:6px">
                  <span class="dot" style="background:${teamColor(id)}"></span>
                  <b class="grow" style="font-size:19px">${esc(byId[id]?.name || id)}</b>
                  ${showVotes ? `<span class="entry__votes">${c[id] || 0}</span>` : ''}
                </div>
                ${e?.image ? `<img src="${esc(e.image)}" alt="" style="width:100%;border-radius:10px;margin-bottom:8px;display:block">` : ''}
                <div style="line-height:1.5">${esc((e?.prompt || '…').slice(0, 320))}</div>
              </div>`;
            }).join('')}
      </div>
    </div>`;
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

// Everyone's answers to an open-ended task, up on the wall to be read out.
function showcaseView() {
  const taskId = S.event.showcaseTaskId;
  const task = S.task && S.task.id === taskId ? S.task : null;
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
  const finalists = S.event.finalistTeamIds || [];
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));
  const showVotes = S.admin && (f.phase === 'voting' || f.phase === 'results');
  const ranked = finalists.map(id => ({ id, v: c[id] || 0 })).sort((a, b) => b.v - a.v);
  const winner = f.phase === 'results' && ranked.length ? ranked[0] : null;

  return `
    <div class="center stack" style="margin-bottom:20px">
      <span class="pill pill--live">${esc(t('finaleTitle'))}</span>
      <div class="bigtheme">${esc(tr(f.theme) || '…')}</div>
      ${f.phase === 'creating' ? `<div><span class="timer" id="timer">–</span></div>` : ''}
      ${winner ? `<h1 style="color:var(--lime)">${esc(t('winner'))}: ${esc(byId[winner.id]?.name || winner.id)}</h1>` : ''}
    </div>
    <div class="entries">
      ${finalists.map(id => {
        const e = S.finale.find(x => x.id === id) || {};
        return `<div class="entry ${winner?.id === id ? 'is-picked' : ''}">
          ${e.image ? `<img src="${esc(e.image)}" alt="">`
                    : `<div style="aspect-ratio:4/3;display:grid;place-items:center;color:var(--ink-faint);font-size:28px">…</div>`}
          <div class="entry__body">
            <div class="row">
              <span class="dot" style="background:${teamColor(id)}"></span>
              <b class="grow" style="font-size:20px">${esc(byId[id]?.name || id)}</b>
              ${showVotes ? `<span class="entry__votes">${c[id] || 0}</span>` : ''}
            </div>
            ${e.prompt ? `<div class="entry__prompt">${esc(String(e.prompt).slice(0, 300))}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    ${f.phase === 'results' ? `<div class="card" style="margin-top:24px"><h2>${esc(t('leaderboard'))}</h2>${board(8)}</div>` : ''}`;
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
