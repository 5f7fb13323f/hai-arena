import {
  db, doc, collection, onSnapshot, setDoc, getDoc, serverTimestamp, query, where
} from './firebase.js';
import { renderAuth, watchAuth, logout } from './auth.js';
import { t, tr, lang, mountLangToggle } from './i18n.js';
import { $, esc, toast, fmtClock, toMs, teamColor, debounce, imageToDataUrl } from './util.js';
import { rankTeams } from './scoring.js';

const S = {
  user: null, eventId: null, event: null, me: null,
  teams: [], participants: [], task: null, sub: null,
  finaleEntries: [], myVote: null,
  semiImage: null, semiEntries: [], mySemi: null, mySemiVote: null,
  tab: 'task', unsubs: [], dirty: false, autoTab: true
};

const root = () => $('#root');
const stop = () => { S.unsubs.forEach(u => { try { u(); } catch {} }); S.unsubs = []; };

// --------------------------------------------------------------- bootstrap --
mountLangToggle($('#langToggle'));
window.addEventListener('langchange', () => paint());

$('#logoutBtn').addEventListener('click', async () => { stop(); await logout(); });

watchAuth(async (user) => {
  stop();
  Object.assign(S, {
    user, eventId: null, event: null, me: null, teams: [], participants: [],
    task: null, sub: null, finaleEntries: [], myVote: null,
    semiImage: null, semiEntries: [], mySemi: null, mySemiVote: null, autoTab: true
  });

  if (!user) {
    $('#topUser').textContent = '';
    $('#logoutBtn').classList.add('hide');
    renderAuth(root(), {});
    return;
  }

  $('#logoutBtn').classList.remove('hide');
  root().innerHTML = `<div class="card center muted">…</div>`;

  S.unsubs.push(onSnapshot(doc(db, 'users', user.uid), (snap) => {
    const data = snap.data() || {};
    $('#topUser').textContent = data.username || '';
    const nextEvent = data.eventId || null;
    if (nextEvent !== S.eventId) {
      S.eventId = nextEvent;
      attachEvent();
    }
    paint();
  }, () => paint()));
});

let eventUnsubs = [];
function attachEvent() {
  eventUnsubs.forEach(u => { try { u(); } catch {} });
  eventUnsubs = [];
  S.event = null; S.me = null; S.teams = []; S.participants = [];
  S.task = null; S.sub = null; S.finaleEntries = []; S.myVote = null;
  S.semiImage = null; S.semiEntries = []; S.mySemi = null; S.mySemiVote = null;
  attachedTaskId = null; attachedSubId = null; semiListPhase = null;
  if (!S.eventId) { paint(); return; }

  const eid = S.eventId;
  const base = ['events', eid];

  eventUnsubs.push(onSnapshot(doc(db, ...base), (snap) => {
    S.event = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    attachTask();
    attachFinale();
    attachSemi();
    paint();
  }, () => paint()));

  eventUnsubs.push(onSnapshot(doc(db, ...base, 'participants', S.user.uid), (snap) => {
    S.me = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    attachSubmission();
    paint();
  }, () => paint()));

  eventUnsubs.push(onSnapshot(collection(db, ...base, 'participants'), (qs) => {
    S.participants = qs.docs.map(d => ({ id: d.id, ...d.data() }));
    paint();
  }, () => {}));

  eventUnsubs.push(onSnapshot(collection(db, ...base, 'teams'), (qs) => {
    S.teams = qs.docs.map(d => ({ id: d.id, ...d.data() }));
    paint();
  }, () => {}));
}

let taskUnsub = null, subUnsub = null, finaleUnsub = null, voteUnsub = null;
let attachedTaskId = null;

function attachTask() {
  const id = S.event?.activeTaskId || null;
  if (id === attachedTaskId) return;
  attachedTaskId = id;
  taskUnsub?.(); taskUnsub = null;
  S.task = null;
  if (!id) { attachSubmission(); paint(); return; }

  taskUnsub = onSnapshot(doc(db, 'events', S.eventId, 'tasks', id), (snap) => {
    S.task = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    if (S.task?.status === 'open') S.autoTab && (S.tab = 'task');
    attachSubmission();
    paint();
  }, () => paint());
}

function subId() {
  if (!S.task || !S.me?.teamId) return null;
  return `${S.task.id}__${S.me.teamId}__team`;
}

let attachedSubId = null;
function attachSubmission() {
  const id = subId();
  if (id === attachedSubId) return;             // already listening to this doc
  subUnsub?.(); subUnsub = null;
  attachedSubId = id;
  S.sub = null;
  if (!id) return;
  subUnsub = onSnapshot(doc(db, 'events', S.eventId, 'submissions', id), (snap) => {
    const server = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    // Whatever this player is typing right now wins over the server copy,
    // so a teammate's save never yanks the field out from under them.
    S.sub = S.dirty ? { ...(server || {}), ...(S.sub || {}) } : server;
    paint();
  }, () => {});
}

function attachFinale() {
  if (finaleUnsub) return;
  finaleUnsub = onSnapshot(collection(db, 'events', S.eventId, 'finale'), (qs) => {
    S.finaleEntries = qs.docs.map(d => ({ id: d.id, ...d.data() }));
    paint();
  }, () => {});
  voteUnsub = onSnapshot(doc(db, 'events', S.eventId, 'votes', S.user.uid), (snap) => {
    S.myVote = snap.exists() ? snap.data().teamId : null;
    paint();
  }, () => {});
  eventUnsubs.push(() => { finaleUnsub?.(); finaleUnsub = null; voteUnsub?.(); voteUnsub = null; });
}

// ------------------------------------------------------------- semi-final ---
// The reference image and my own entry are always readable. The full list of
// entries is only readable once the host opens voting — the rules make sure of
// it, so the last team to submit cannot copy the best reconstruction.
let semiBaseUnsubs = null, semiListUnsub = null, semiListPhase = null;

function attachSemi() {
  if (!S.me?.teamId) return;

  if (!semiBaseUnsubs) {
    semiBaseUnsubs = [
      onSnapshot(doc(db, 'events', S.eventId, 'media', 'semi-reference'), (snap) => {
        S.semiImage = snap.exists() ? snap.data().image : null;
        paint();
      }, () => {}),
      onSnapshot(doc(db, 'events', S.eventId, 'semi', S.me.teamId), (snap) => {
        S.mySemi = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        paint();
      }, () => {}),
      onSnapshot(doc(db, 'events', S.eventId, 'semivotes', S.user.uid), (snap) => {
        S.mySemiVote = snap.exists() ? snap.data().teamId : null;
        paint();
      }, () => {})
    ];
    eventUnsubs.push(() => {
      semiBaseUnsubs?.forEach(u => { try { u(); } catch {} });
      semiBaseUnsubs = null;
      semiListUnsub?.(); semiListUnsub = null; semiListPhase = null;
    });
  }

  const phase = S.event?.semi?.phase || 'idle';
  if (phase === semiListPhase) return;
  semiListPhase = phase;
  semiListUnsub?.(); semiListUnsub = null;
  S.semiEntries = [];
  if (phase === 'creating' || phase === 'idle') return;

  semiListUnsub = onSnapshot(collection(db, 'events', S.eventId, 'semi'), (qs) => {
    S.semiEntries = qs.docs.map(d => ({ id: d.id, ...d.data() }));
    paint();
  }, () => {});
}

// ------------------------------------------------------------------ saving --
async function saveSubmission(patch, { quiet = false } = {}) {
  const id = subId();
  if (!id) return;
  try {
    await setDoc(doc(db, 'events', S.eventId, 'submissions', id), {
      taskId: S.task.id,
      teamId: S.me.teamId,
      by: S.user.uid,
      byName: S.me.username || '',
      updatedAt: serverTimestamp(),
      ...patch
    }, { merge: true });
    S.dirty = false;
    if (!quiet) toast(t('saved'));
  } catch (e) {
    S.dirty = false;
    toast(e?.code === 'permission-denied' ? t('timeUp') : (e.message || 'error'), 'err');
  }
}
const autosave = debounce((patch) => saveSubmission(patch, { quiet: true }), 900);

// ------------------------------------------------------------------- paint --
function paint() {
  if (!S.user) return;

  if (!S.eventId || !S.event) {
    root().innerHTML = `<div class="card center stack">
      <h2>${esc(t('waitingTitle'))}</h2>
      <p class="muted">${esc(t('waitingBody'))}</p>
    </div>`;
    return;
  }
  if (!S.me) {
    root().innerHTML = `<div class="card center stack">
      <h2>${esc(t('waitingTitle'))}</h2>
      <p class="muted">${esc(t('waitingBody'))}</p>
      <p class="faint">${esc(S.event.name || '')}</p>
    </div>`;
    return;
  }

  const phase = S.event.phase;
  const headline =
    phase === 'finale' ? t('finaleTitle').split('—')[0].trim() :
    phase === 'semi' ? t('semiTitle').split('—')[0].trim() : t('task');

  const html = `
    ${teamStrip()}
    <div class="tabs">
      <button data-tab="task" class="${S.tab === 'task' ? 'is-on' : ''}">${esc(headline)}</button>
      <button data-tab="team" class="${S.tab === 'team' ? 'is-on' : ''}">${esc(t('team'))}</button>
      <button data-tab="lb" class="${S.tab === 'lb' ? 'is-on' : ''}">${esc(t('leaderboard'))}</button>
    </div>
    <div id="tabBody">${
      S.tab === 'team' ? teamPanel() :
      S.tab === 'lb' ? leaderboardPanel() :
      phase === 'finale' ? finalePanel() :
      phase === 'semi' ? semiPanel() :
      taskPanel()
    }</div>`;
  root().innerHTML = html;

  root().querySelectorAll('[data-tab]').forEach(b =>
    b.addEventListener('click', () => { S.autoTab = false; S.tab = b.dataset.tab; paint(); }));

  wireTaskPanel();
  wireFinalePanel();
  wireSemiPanel();
  wireTeamPanel();
  tick();
}

function myTeamDoc() { return S.teams.find(x => x.id === S.me?.teamId); }

function teamStrip() {
  const team = myTeamDoc();
  if (!team) return '';
  const col = teamColor(team.id);
  return `<div class="card" style="padding:14px 16px;margin-top:16px">
    <div class="row">
      <span class="dot" style="background:${col}"></span>
      <b class="grow">${esc(team.name || '')}</b>
      <span class="pill">${esc(t('slot'))} ${esc(S.me.slot ?? '?')}</span>
      <span class="lb__pts">${Number(team.points || 0)}</span>
    </div>
  </div>`;
}

// ------------------------------------------------------------- task panel ---
function taskPanel() {
  const task = S.task;
  if (!task || task.status === 'locked') {
    return `<div class="card center stack">
      <h2>${esc(t('noTaskTitle'))}</h2><p class="muted">${esc(t('noTaskBody'))}</p></div>`;
  }
  const closed = task.status !== 'open';
  const head = `
    <div class="card">
      <div class="row" style="margin-bottom:8px">
        <span class="pill ${closed ? 'pill--closed' : 'pill--live'}">${esc(closed ? t('closedTitle') : t('timeLeft'))}</span>
        <span class="grow"></span>
        <span class="timer" id="timer">–</span>
      </div>
      <h2>${esc(tr(task.title))}</h2>
      <p class="muted" style="margin:0">${esc(tr(task.intro))}</p>
      ${closed ? '' : `<p class="faint" style="margin:10px 0 0">${esc(t('sharedNote'))}</p>`}
    </div>`;

  if (closed) {
    return head + `<div class="card center"><p class="muted">${esc(t('closedBody'))}</p></div>`;
  }

  const body =
    task.type === 'quiz-single' ? quizSingleBody(task) :
    task.type === 'quiz-multi' ? quizMultiBody(task) :
    task.type === 'golf' ? golfBody(task) :
    openBody(task);

  return head + body + `<div class="sticky-save">
      <button class="btn btn--wide" id="saveBtn">${esc(t('save'))}</button>
      ${S.sub?.byName ? `<p class="faint center" style="margin:8px 0 0">${esc(t('savedBy'))} ${esc(S.sub.byName)}</p>` : ''}
    </div>`;
}

function quizSingleBody(task) {
  const answers = S.sub?.answers || {};
  const opts = task.options || [];
  const items = (task.payload?.items || []).map((it, i) => `
    <div class="qitem">
      <div class="qitem__no">0${i + 1}</div>
      <p class="qitem__text">${esc(tr(it.text))}</p>
      <div class="choices" data-item="${esc(it.id)}">
        ${opts.map(o => `<button type="button" class="choice ${answers[it.id] === o.id ? 'is-on' : ''}"
            data-val="${esc(o.id)}">${esc(tr(o.label))}</button>`).join('')}
      </div>
    </div>`).join('');
  return `<div class="card">${items}</div>`;
}

function quizMultiBody(task) {
  const flagged = new Set(S.sub?.flagged || []);
  const items = (task.payload?.items || []).map((it, i) => `
    <label class="tickrow ${flagged.has(it.id) ? 'is-on' : ''}" data-flag="${esc(it.id)}">
      <input type="checkbox" ${flagged.has(it.id) ? 'checked' : ''}>
      <span><b class="mono" style="color:var(--cyan)">${String(i + 1).padStart(2, '0')}</b> &nbsp;${esc(tr(it.text))}</span>
    </label>`).join('');
  return `<div class="card">
      <p class="faint" style="margin-top:0">${esc(tr(task.payload?.lead))}</p>
      <p style="font-weight:650">${esc(t('flagFalse'))}</p>
      ${items}
    </div>`;
}

function golfBody(task) {
  const prompt = S.sub?.prompt || '';
  return `<div class="card stack">
    <div class="theme-banner" style="padding:16px">
      <span class="faint">TARGET</span><b style="font-size:18px">${esc(tr(task.payload?.target))}</b>
    </div>
    <p class="faint">${esc(tr(task.payload?.rules))}</p>
    <label class="field"><span>${esc(t('prompt'))}</span>
      <textarea id="fPrompt" data-field="prompt">${esc(prompt)}</textarea></label>
    <p class="counter"><b id="charCount">${prompt.length}</b> ${esc(t('chars'))}</p>
    <label class="field"><span>${esc(t('output'))}</span>
      <textarea id="fOutput" data-field="output">${esc(S.sub?.output || '')}</textarea></label>
  </div>`;
}

function openBody(task) {
  const items = (tr(task.payload?.items) || []);
  const chips = Array.isArray(items) ? items.map(x => `<span class="itemchip">${esc(x)}</span>`).join('') : '';
  return `<div class="card stack">
    <div class="itemchips">${chips}</div>
    ${task.payload?.scoring ? `<p class="faint" style="margin:0">${esc(tr(task.payload.scoring))}</p>` : ''}
    <p class="faint">${esc(tr(task.payload?.hint))}</p>
    <label class="field"><span>${esc(t('inventionName'))}</span>
      <input type="text" data-field="name" value="${esc(S.sub?.name || '')}"></label>
    <label class="field"><span>${esc(t('howItWorks'))}</span>
      <textarea data-field="text" style="min-height:140px">${esc(S.sub?.text || '')}</textarea></label>
    <label class="field"><span>${esc(t('prompt'))}</span>
      <textarea data-field="prompt">${esc(S.sub?.prompt || '')}</textarea></label>
  </div>`;
}

function wireTaskPanel() {
  const box = root();

  box.querySelectorAll('.choices').forEach(group => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice');
      if (!btn) return;
      group.querySelectorAll('.choice').forEach(c => c.classList.toggle('is-on', c === btn));
      const answers = { ...(S.sub?.answers || {}), [group.dataset.item]: btn.dataset.val };
      S.sub = { ...(S.sub || {}), answers };
      S.dirty = true;
      autosave({ answers });
    });
  });

  box.querySelectorAll('[data-flag]').forEach(row => {
    row.addEventListener('change', () => {
      const set = new Set(S.sub?.flagged || []);
      const id = row.dataset.flag;
      row.querySelector('input').checked ? set.add(id) : set.delete(id);
      row.classList.toggle('is-on', set.has(id));
      const flagged = Array.from(set);
      S.sub = { ...(S.sub || {}), flagged };
      S.dirty = true;
      autosave({ flagged });
    });
  });

  box.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      const field = input.dataset.field;
      S.sub = { ...(S.sub || {}), [field]: input.value };
      S.dirty = true;
      if (field === 'prompt') {
        const c = box.querySelector('#charCount');
        if (c) c.textContent = input.value.length;
      }
      autosave({ [field]: input.value });
    });
  });

  const save = box.querySelector('#saveBtn');
  if (save) save.addEventListener('click', () => {
    autosave.cancel();
    const patch = {};
    if (S.sub?.answers) patch.answers = S.sub.answers;
    if (S.sub?.flagged) patch.flagged = S.sub.flagged;
    for (const f of ['prompt', 'output', 'name', 'text', 'text2']) {
      if (S.sub?.[f] != null) patch[f] = S.sub[f];
    }
    saveSubmission(patch);
  });
}

// ------------------------------------------------------------ team & board --
function teamPanel() {
  const team = myTeamDoc();
  const canRename = S.event?.phase === 'lobby';
  const mates = S.participants
    .filter(p => p.teamId === S.me.teamId)
    .sort((a, b) => (a.slot || 0) - (b.slot || 0));
  return `<div class="card stack">
    <h2>${esc(team?.name || t('yourTeam'))}</h2>
    ${canRename ? `
      <label class="field"><span>${esc(t('renameTeam'))}</span>
        <input type="text" id="teamName" maxlength="28" value="${esc(team?.name || '')}"></label>
      <p class="faint" style="margin:6px 0 0">${esc(t('renameHint'))}</p>
      <button class="btn btn--wide" id="renameBtn">${esc(t('renameSave'))}</button>
    ` : `<p class="faint" style="margin:0">${esc(t('renameLocked'))}</p>`}
    <p class="faint" style="margin:0">${esc(t('teammates'))}</p>
    <div class="lb">
      ${mates.map(m => `<div class="lb__row ${m.id === S.user.uid ? 'is-me' : ''}">
        <div class="lb__rank">${esc(m.slot ?? '')}</div>
        <div class="lb__name"><span>${esc(m.username || '')}</span>${m.id === S.user.uid ? `<span class="pill">${esc(t('you'))}</span>` : ''}</div>
        <div></div></div>`).join('')}
    </div>
  </div>`;
}

function leaderboardPanel() {
  const ranked = rankTeams(S.teams);
  return `<div class="card">
    <h2>${esc(t('leaderboard'))}</h2>
    <div class="lb">
      ${ranked.map(x => `<div class="lb__row ${x.id === S.me.teamId ? 'is-me' : ''}">
        <div class="lb__rank">${x.rank}</div>
        <div class="lb__name"><span class="dot" style="background:${teamColor(x.id)}"></span><span>${esc(x.name || '')}</span></div>
        <div class="lb__pts">${Number(x.points || 0)}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

function wireTeamPanel() {
  const btn = root().querySelector('#renameBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const name = root().querySelector('#teamName').value.trim().slice(0, 28);
    if (!name) return;
    try {
      await setDoc(doc(db, 'events', S.eventId, 'teams', S.me.teamId), { name }, { merge: true });
      toast(t('saved'));
    } catch (e) {
      toast(e?.code === 'permission-denied' ? t('renameLocked') : (e.message || 'error'), 'err');
    }
  });
}

// ------------------------------------------------------------- semi-final ---
function semiPanel() {
  const s = S.event.semi || {};
  const semis = S.event.semifinalistTeamIds || [];
  const amIn = semis.includes(S.me.teamId);
  const picture = S.semiImage
    ? `<img class="preview" src="${esc(S.semiImage)}" alt="">`
    : `<div class="drop" style="cursor:default">${esc(t('semiWaiting'))}</div>`;

  if (s.phase === 'creating') {
    if (!amIn) {
      return `<div class="card stack">
        <h2 class="center">${esc(t('semiTitle'))}</h2>
        ${picture}
        <p class="center muted">${esc(t('semiNotIn'))}</p>
        <div class="row" style="justify-content:center"><span class="timer" id="timer">–</span></div>
      </div>`;
    }
    return `<div class="card stack">
      <div class="row"><span class="pill pill--live">${esc(t('semiReference'))}</span>
        <span class="grow"></span><span class="timer" id="timer">–</span></div>
      ${picture}
      ${s.hint ? `<p class="faint">${esc(tr(s.hint))}</p>` : ''}
      <label class="field"><span>${esc(t('semiYourPrompt'))}</span>
        <textarea id="semiPrompt" style="min-height:150px">${esc(S.mySemi?.prompt || '')}</textarea></label>
      <button class="btn btn--wide btn--pink" id="semiSave">${esc(t('save'))}</button>
      <p class="faint center" style="margin:0">${esc(t('sharedNote'))}</p>
    </div>`;
  }

  if (s.phase === 'voting' || s.phase === 'results') {
    const voting = s.phase === 'voting' && !amIn;
    return `<div class="card stack">
      <h2 class="center">${esc(voting ? t('semiVoteTitle') : t('finaleResults'))}</h2>
      ${picture}
      ${amIn && s.phase === 'voting' ? `<p class="center muted">${esc(t('semiNoSelfVote'))}</p>` : ''}
      ${semiEntriesList(voting)}
    </div>`;
  }

  return `<div class="card center stack">
    <h2>${esc(t('semiTitle'))}</h2>
    <p class="muted">${esc(t('semiWaiting'))}</p></div>`;
}

function semiEntriesList(votable) {
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));
  const order = S.event.semifinalistTeamIds || [];
  return `<div class="stack">
    ${order.map(id => {
      const e = S.semiEntries.find(x => x.id === id);
      const picked = S.mySemiVote === id;
      return `<div class="qitem ${picked ? 'is-picked' : ''}"
           ${votable ? `data-semivote="${esc(id)}" style="cursor:pointer;border-color:${picked ? 'var(--green)' : ''}"` : ''}>
        <div class="row" style="margin-bottom:8px">
          <span class="dot" style="background:${teamColor(id)}"></span>
          <b class="grow">${esc(byId[id]?.name || id)}</b>
          ${picked ? `<span class="pill pill--live">${esc(t('finaleVoteDone'))}</span>` : ''}
        </div>
        <p class="qitem__text" style="margin:0">${esc(e?.prompt || '…')}</p>
        ${votable ? `<button class="btn btn--sm btn--wide" style="margin-top:10px">${esc(picked ? t('finaleVoteDone') : t('semiVoteTitle'))}</button>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function wireSemiPanel() {
  const box = root();

  const save = box.querySelector('#semiSave');
  if (save) save.addEventListener('click', async () => {
    try {
      await setDoc(doc(db, 'events', S.eventId, 'semi', S.me.teamId), {
        teamId: S.me.teamId,
        prompt: box.querySelector('#semiPrompt')?.value || '',
        by: S.user.uid,
        byName: S.me.username || '',
        at: serverTimestamp()
      }, { merge: true });
      toast(t('saved'));
    } catch (e) {
      toast(e?.code === 'permission-denied' ? t('timeUp') : (e.message || 'error'), 'err');
    }
  });

  box.querySelectorAll('[data-semivote]').forEach(card => {
    card.addEventListener('click', async () => {
      try {
        await setDoc(doc(db, 'events', S.eventId, 'semivotes', S.user.uid), {
          teamId: card.dataset.semivote, at: serverTimestamp()
        });
        toast(t('finaleVoteDone'));
      } catch (e) {
        toast(e?.code === 'permission-denied' ? t('semiWaiting') : (e.message || 'error'), 'err');
      }
    });
  });
}

// ----------------------------------------------------------------- finale ---
function finalePanel() {
  const f = S.event.finale || {};
  const finalists = S.event.finalistTeamIds || [];
  const amFinalist = finalists.includes(S.me.teamId);
  const theme = `<div class="theme-banner"><span class="faint">${esc(t('finaleTheme'))}</span>
      <b>${esc(tr(f.theme) || '…')}</b></div>`;

  if (f.phase === 'creating') {
    if (!amFinalist) {
      return `<div class="card stack">${theme}
        <p class="center muted">${esc(t('finaleNotFinalist'))}</p>
        <div class="row center" style="justify-content:center">
          <span class="timer" id="timer">–</span></div></div>`;
    }
    const mine = S.finaleEntries.find(x => x.id === S.me.teamId);
    return `<div class="card stack">${theme}
      <div class="row" style="justify-content:center"><span class="timer" id="timer">–</span></div>
      ${mine?.image ? `<img class="preview" src="${esc(mine.image)}" alt="">` : ''}
      <div class="drop" id="drop">${esc(t('finaleUpload'))}</div>
      <input type="file" accept="image/*" id="file" class="hide">
      <label class="field"><span>${esc(t('prompt'))}</span>
        <textarea id="fPrompt2">${esc(mine?.prompt || '')}</textarea></label>
      <button class="btn btn--wide btn--pink" id="finaleSave">${esc(t('save'))}</button>
    </div>`;
  }

  if (f.phase === 'voting') {
    if (amFinalist) {
      return `<div class="card stack">${theme}
        <p class="center muted">${esc(t('finaleNoSelfVote'))}</p>${entriesGrid(false)}</div>`;
    }
    return `<div class="card stack">${theme}
      <h2 class="center">${esc(t('finaleVoteTitle'))}</h2>
      ${entriesGrid(true)}
      <p class="center faint">${esc(S.myVote ? t('finaleVoteChange') : '')}</p>
    </div>`;
  }

  if (f.phase === 'results') {
    return `<div class="card stack">${theme}
      <h2 class="center">${esc(t('finaleResults'))}</h2>
      <p class="center muted">${esc(t('closedBody'))}</p>${entriesGrid(false)}</div>`;
  }

  return `<div class="card center stack">${theme}
    <p class="muted">${esc(t('finaleWaiting'))}</p></div>`;
}

function entriesGrid(votable) {
  const byId = Object.fromEntries(S.teams.map(x => [x.id, x]));
  const order = (S.event.finalistTeamIds || []);
  const entries = order.map(id => S.finaleEntries.find(e => e.id === id) || { id });
  return `<div class="entries">
    ${entries.map(e => `
      <div class="entry ${S.myVote === e.id ? 'is-picked' : ''}" ${votable ? `data-vote="${esc(e.id)}" style="cursor:pointer"` : ''}>
        ${e.image ? `<img src="${esc(e.image)}" alt="">` : `<div style="aspect-ratio:1/1;display:grid;place-items:center;color:var(--ink-faint)">…</div>`}
        <div class="entry__body">
          <div class="entry__name"><span class="dot" style="background:${teamColor(e.id)}"></span>${esc(byId[e.id]?.name || e.id)}</div>
          ${e.prompt ? `<div class="entry__prompt">${esc(String(e.prompt).slice(0, 220))}</div>` : ''}
          ${votable ? `<button class="btn btn--sm btn--wide" style="margin-top:10px">${esc(S.myVote === e.id ? t('finaleVoteDone') : t('finaleVoteTitle'))}</button>` : ''}
        </div>
      </div>`).join('')}
  </div>`;
}

function wireFinalePanel() {
  const box = root();

  box.querySelectorAll('[data-vote]').forEach(card => {
    card.addEventListener('click', async () => {
      try {
        await setDoc(doc(db, 'events', S.eventId, 'votes', S.user.uid), {
          teamId: card.dataset.vote, at: serverTimestamp()
        });
        toast(t('finaleVoteDone'));
      } catch (e) {
        toast(e?.code === 'permission-denied' ? t('finaleWaiting') : (e.message || 'error'), 'err');
      }
    });
  });

  const drop = box.querySelector('#drop');
  const file = box.querySelector('#file');
  if (drop && file) {
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      drop.textContent = t('uploading');
      try {
        const image = await imageToDataUrl(f);
        await setDoc(doc(db, 'events', S.eventId, 'finale', S.me.teamId), {
          image, teamId: S.me.teamId, at: serverTimestamp(),
          prompt: box.querySelector('#fPrompt2')?.value || ''
        }, { merge: true });
        toast(t('saved'));
      } catch (e) {
        toast(t('imageTooBig'), 'err');
      } finally {
        drop.textContent = t('finaleUpload');
      }
    });
  }

  const fs = box.querySelector('#finaleSave');
  if (fs) fs.addEventListener('click', async () => {
    try {
      await setDoc(doc(db, 'events', S.eventId, 'finale', S.me.teamId), {
        teamId: S.me.teamId,
        prompt: box.querySelector('#fPrompt2')?.value || '',
        at: serverTimestamp()
      }, { merge: true });
      toast(t('saved'));
    } catch (e) { toast(e.message || 'error', 'err'); }
  });
}

// ------------------------------------------------------------------ timer ---
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
