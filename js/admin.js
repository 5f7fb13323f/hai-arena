import {
  db, doc, collection, getDocs, onSnapshot, setDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp
} from './firebase.js';
import { renderAuth, watchAuth, logout, isAdmin } from './auth.js';
import { $, esc, toast, shuffle, slug, teamColor, imageToDataUrl } from './util.js';
import { TASKS, teamName, FINALE_THEMES, RUN_OF_SHOW, SEMI } from './content.js';
import { gradeTask, totalsFromSubmissions, rankTeams, makeTeams, awardByVotes } from './scoring.js';
import { createAccounts, testerNames } from './bulk.js';

const S = {
  user: null, events: [], eid: null, event: null,
  users: [], hosts: [], participants: [], teams: [], tasks: [], subs: [],
  votes: [], finale: [], semi: [], semivotes: [], semiImage: null,
  keys: {}, selectedTask: null, filter: '', busy: '', howMany: 30
};
const root = () => $('#root');
let unsubs = [];
const stopAll = () => { unsubs.forEach(u => { try { u(); } catch {} }); unsubs = []; };

$('#logoutBtn').addEventListener('click', async () => { stopAll(); await logout(); });

watchAuth(async (user) => {
  stopAll();
  S.user = user;
  if (!user) { $('#topUser').textContent = ''; renderAuth(root(), {}); return; }
  if (!(await isAdmin(user.uid))) {
    root().innerHTML = `<div class="card center stack">
      <h2>Not a host</h2>
      <p class="muted">Create a document in the <code>admins</code> collection with this ID:</p>
      <p><code>${esc(user.uid)}</code></p>
      <button class="btn btn--ghost" id="lo">Log out</button></div>`;
    $('#lo').addEventListener('click', () => logout());
    return;
  }
  $('#topUser').textContent = 'host';
  unsubs.push(onSnapshot(collection(db, 'events'), (qs) => {
    S.events = qs.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!S.eid && S.events.length) selectEvent(S.events[0].id);
    else paint();
  }));
  // Live, so people who register mid-event appear without anyone clicking refresh.
  unsubs.push(onSnapshot(collection(db, 'users'), (qs) => {
    S.users = qs.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.username).localeCompare(String(b.username)));
    autoPlace();
    paint();
  }, (e) => toast('Could not read users: ' + e.message, 'err')));
  unsubs.push(onSnapshot(collection(db, 'admins'), (qs) => {
    S.hosts = qs.docs.map(d => d.id);
    autoPlace();                 // a new host comes straight out of their team
    paint();
  }, () => {}));
});

let evUnsubs = [];
function selectEvent(eid) {
  evUnsubs.forEach(u => { try { u(); } catch {} });
  evUnsubs = [];
  S.eid = eid;
  Object.assign(S, {
    event: null, participants: [], teams: [], tasks: [], subs: [],
    votes: [], finale: [], semi: [], semivotes: [], semiImage: null, keys: {}
  });
  if (!eid) { paint(); return; }
  const b = ['events', eid];
  const sub = (ref, fn) => evUnsubs.push(onSnapshot(ref, fn));

  sub(doc(db, ...b), s => { S.event = s.exists() ? { id: s.id, ...s.data() } : null; autoPlace(); paint(); });
  sub(collection(db, ...b, 'participants'), qs => {
    S.participants = qs.docs.map(d => ({ id: d.id, ...d.data() })); autoPlace(); paint();
  });
  sub(collection(db, ...b, 'teams'), qs => { S.teams = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint(); });
  sub(collection(db, ...b, 'tasks'), qs => {
    S.tasks = qs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, c) => (a.order || 0) - (c.order || 0)); paint();
  });
  sub(collection(db, ...b, 'submissions'), qs => { S.subs = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint(); });
  sub(collection(db, ...b, 'votes'), qs => { S.votes = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint(); });
  sub(collection(db, ...b, 'finale'), qs => { S.finale = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint(); });
  sub(collection(db, ...b, 'semi'), qs => { S.semi = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint(); });
  sub(collection(db, ...b, 'semivotes'), qs => { S.semivotes = qs.docs.map(d => ({ id: d.id, ...d.data() })); paint(); });
  sub(doc(db, ...b, 'media', 'semi-reference'), s => { S.semiImage = s.exists() ? s.data().image : null; paint(); });
  sub(collection(db, ...b, 'keys'), qs => {
    S.keys = Object.fromEntries(qs.docs.map(d => [d.id, d.data()])); paint();
  });
}

// ----------------------------------------------------------- hosts are out --
// A host runs the event from this panel and stands at the big screen; they are
// never a player. So hosts are kept out of the roster, out of the shuffle, and
// out of the headcount the elastic scoring is built on.
const isHost = (id) => S.hosts.includes(id);
const playerUsers = () => S.users.filter(u => !isHost(u.id));
const players = () => S.participants.filter(p => !isHost(p.id));

// --------------------------------------------------- late joiners, handled --
// Players cannot add themselves (the rules forbid it), so the host panel does
// it for them: anyone who registers after the shuffle is dropped into the
// smallest team. Only works while this page is open, which it is all session.
let placing = false;
async function autoPlace() {
  if (!S.event || S.event.phase === 'done' || !S.eid || placing) return;

  // Someone promoted to host after joining, or a host left over from an older
  // event. They come out whether or not auto-join is on.
  const strays = S.participants.filter(p => isHost(p.id));
  const join = !!S.event.autoJoin;
  const missing = join ? playerUsers().filter(u => !S.participants.some(p => p.id === u.id)) : [];
  const unassigned = join ? players().filter(p => !p.teamId) : [];
  if (!missing.length && !strays.length && !(unassigned.length && S.teams.length)) return;

  placing = true;
  try {
    if (strays.length) await dropHostsFromEvent(strays);
    if (missing.length) await addUsersToEvent(missing.map(u => u.id), { quiet: true });
    if (join && S.teams.length) {
      const fresh = players().filter(p => !p.teamId);
      if (fresh.length) {
        const sizes = Object.fromEntries(S.teams.map(x => [x.id, players().filter(p => p.teamId === x.id).length]));
        const b = writeBatch(db);
        for (const p of fresh) {
          const target = Object.entries(sizes).sort((a, c) => a[1] - c[1])[0];
          if (!target) break;
          sizes[target[0]]++;
          b.set(doc(db, 'events', S.eid, 'participants', p.id),
            { teamId: target[0], slot: sizes[target[0]] }, { merge: true });
          b.set(doc(db, 'events', S.eid, 'teams', target[0]), { memberCount: sizes[target[0]] }, { merge: true });
        }
        await b.commit();
        toast(`${fresh.length} late joiner(s) placed`);
      }
    }
  } catch (e) {
    toast('Auto-join failed: ' + e.message, 'err');
  } finally {
    placing = false;
  }
}

// ------------------------------------------------------------------ actions -
async function createEvent() {
  const name = prompt('Event name', 'HAI Arena — team workshop');
  if (!name) return;
  const id = (slug(name) || 'event') + '-' + Math.random().toString(36).slice(2, 6);
  await setDoc(doc(db, 'events', id), {
    name, phase: 'lobby', activeTaskId: null, autoJoin: true,
    finalistTeamIds: [], semifinalistTeamIds: [],
    semi: { phase: 'idle', endsAt: null },
    finale: { phase: 'idle', theme: null, endsAt: null },
    createdAt: serverTimestamp()
  });
  selectEvent(id);
  toast('Event created');
}

async function seedTasks() {
  // Answer keys are loaded only here, and only by the host. Once you have
  // seeded, js/answers.js can be deleted from the repo — the keys then exist
  // only in Firestore, where the rules keep them away from players.
  let ANSWERS = {}, SECRETS = {}, haveAnswers = true;
  try {
    ({ ANSWERS, SECRETS } = await import('./answers.js'));
  } catch {
    haveAnswers = false;
  }

  const b = writeBatch(db);
  for (const task of TASKS) {
    // Written in order, the answers alternate — true, false, true, false — and
    // a team that spots the rhythm scores without reading. Shuffle once per
    // event so everyone sees the same order but nobody can pattern-match it.
    const seeded = (task.type === 'quiz-single' || task.type === 'quiz-multi')
      ? { ...task, payload: { ...task.payload, items: shuffle(task.payload.items) } }
      : task;
    b.set(doc(db, 'events', S.eid, 'tasks', task.id), {
      ...seeded, status: 'locked', endsAt: null
    }, { merge: true });
    if (haveAnswers) {
      b.set(doc(db, 'events', S.eid, 'keys', task.id), {
        ...(ANSWERS[task.id] || {}), accepted: {}, awards: {}
      }, { merge: true });
      if (SECRETS[task.id]) {
        b.set(doc(db, 'events', S.eid, 'private', `${task.id}__secret`), SECRETS[task.id], { merge: true });
      }
    }
  }
  await b.commit();
  toast(haveAnswers
    ? `Seeded ${TASKS.length} tasks with answer keys`
    : `Seeded ${TASKS.length} tasks — answers.js is gone, so existing keys were left alone`);
}

// Takes hosts back out of an event they were added to before they were made a
// host, and leaves their old team one member lighter.
async function dropHostsFromEvent(strays) {
  const b = writeBatch(db);
  const shrink = {};
  for (const p of strays) {
    b.delete(doc(db, 'events', S.eid, 'participants', p.id));
    b.set(doc(db, 'users', p.id), { eventId: null }, { merge: true });
    if (p.teamId) shrink[p.teamId] = (shrink[p.teamId] || 0) + 1;
  }
  for (const [tid, n] of Object.entries(shrink)) {
    const team = S.teams.find(x => x.id === tid);
    if (team) b.set(doc(db, 'events', S.eid, 'teams', tid),
      { memberCount: Math.max(0, (team.memberCount || 0) - n) }, { merge: true });
  }
  await b.commit();
  toast(`${strays.length} host(s) taken out of the teams`);
}

async function addUsersToEvent(ids, { quiet = false } = {}) {
  const skipped = ids.filter(isHost).length;
  ids = ids.filter(id => !isHost(id));
  if (skipped && !quiet) toast(`${skipped} host(s) skipped — hosts do not play`);
  if (!ids.length) { if (!quiet && !skipped) toast('Nobody selected', 'err'); return; }
  for (let i = 0; i < ids.length; i += 200) {
    const b = writeBatch(db);
    for (const uid of ids.slice(i, i + 200)) {
      const u = S.users.find(x => x.id === uid);
      b.set(doc(db, 'events', S.eid, 'participants', uid), {
        username: u?.username || uid, teamId: null, slot: null, joinedAt: serverTimestamp()
      }, { merge: true });
      b.set(doc(db, 'users', uid), { eventId: S.eid }, { merge: true });
    }
    await b.commit();
  }
  if (!quiet) toast(`${ids.length} added`);
}

async function removeParticipant(uid) {
  const b = writeBatch(db);
  b.delete(doc(db, 'events', S.eid, 'participants', uid));
  b.set(doc(db, 'users', uid), { eventId: null }, { merge: true });
  await b.commit();
}

async function shuffleTeams(size) {
  const strays = S.participants.filter(p => isHost(p.id));
  if (strays.length) await dropHostsFromEvent(strays);
  const ids = shuffle(players().map(p => p.id));
  if (!ids.length) return toast('No participants yet', 'err');
  const groups = makeTeams(ids, size);

  const b = writeBatch(db);
  for (const old of S.teams) b.delete(doc(db, 'events', S.eid, 'teams', old.id));
  groups.forEach((members, i) => {
    const tid = `team-${String(i + 1).padStart(2, '0')}`;
    b.set(doc(db, 'events', S.eid, 'teams', tid), {
      name: teamName(i + 1), points: 0, bonus: 0,
      memberCount: members.length, order: i + 1
    });
    members.forEach((uid, j) => {
      b.set(doc(db, 'events', S.eid, 'participants', uid), { teamId: tid, slot: j + 1 }, { merge: true });
    });
  });
  await b.commit();
  toast(`${groups.length} teams created — open preparation to let them rename`);
}

const openPrep = () => setEvent({ phase: 'prep' }).then(() => toast('Preparation open — teams can rename themselves'));
const closePrep = () => setEvent({ phase: 'lobby' }).then(() => toast('Preparation closed — names are locked'));

async function openTask(taskId, minutes) {
  const endsAt = new Date(Date.now() + Math.max(1, minutes) * 60000);
  // Scoring is elastic: this task is worth one point per person in the room,
  // fixed at the moment it opens so later arrivals cannot change it.
  const maxPoints = Math.max(1, players().length);
  const b = writeBatch(db);
  b.set(doc(db, 'events', S.eid, 'tasks', taskId), { status: 'open', endsAt, maxPoints }, { merge: true });
  b.set(doc(db, 'events', S.eid), { activeTaskId: taskId, phase: 'part1' }, { merge: true });
  await b.commit();
  toast(`Task open — worth up to ${maxPoints} points`);
}

const closeTask = (taskId) =>
  setDoc(doc(db, 'events', S.eid, 'tasks', taskId), { status: 'closed' }, { merge: true })
    .then(() => toast('Task closed'));

const setKeyField = (taskId, path, value) =>
  setDoc(doc(db, 'events', S.eid, 'keys', taskId),
    path.reduceRight((acc, k) => ({ [k]: acc }), value), { merge: true });

const setEvent = (patch) => setDoc(doc(db, 'events', S.eid), patch, { merge: true });

function recomputeInto(batch, bonusByTeam, extraSubs = []) {
  const totals = totalsFromSubmissions([...S.subs, ...extraSubs], bonusByTeam);
  for (const teamDoc of S.teams) {
    batch.set(doc(db, 'events', S.eid, 'teams', teamDoc.id), { points: totals[teamDoc.id] || 0 }, { merge: true });
  }
}

async function gradeAndPublish(taskId) {
  const task = S.tasks.find(x => x.id === taskId);
  if (!task) return;
  const key = S.keys[taskId] || {};
  const subs = S.subs.filter(s => s.taskId === taskId);
  const graded = gradeTask(task, key, subs);

  const b = writeBatch(db);
  for (const s of subs) {
    const g = graded[s.teamId] || { points: 0, detail: '' };
    b.set(doc(db, 'events', S.eid, 'submissions', s.id), {
      awarded: g.points, gradeDetail: g.detail, locked: true
    }, { merge: true });
  }
  b.set(doc(db, 'events', S.eid, 'tasks', taskId), { graded: true }, { merge: true });
  // Recompute every team's total from scratch: the freshly graded submissions
  // for this task, plus every other task's already-awarded points, plus bonus.
  // Grading the same task twice is therefore safe — it never double-counts.
  const bonusByTeam = Object.fromEntries(S.teams.map(x => [x.id, Number(x.bonus || 0)]));
  const merged = subs.map(s => ({ ...s, awarded: graded[s.teamId]?.points ?? 0 }));
  const totals = totalsFromSubmissions(
    [...S.subs.filter(s => s.taskId !== taskId), ...merged], bonusByTeam);
  for (const teamDoc of S.teams) {
    b.set(doc(db, 'events', S.eid, 'teams', teamDoc.id), { points: totals[teamDoc.id] || 0 }, { merge: true });
  }
  await b.commit();
  toast('Graded — leaderboard updated');
}

async function setTeamBonus(teamId, bonus) {
  const b = writeBatch(db);
  b.set(doc(db, 'events', S.eid, 'teams', teamId), { bonus }, { merge: true });
  const bonusByTeam = Object.fromEntries(
    S.teams.map(x => [x.id, x.id === teamId ? bonus : Number(x.bonus || 0)]));
  recomputeInto(b, bonusByTeam);
  await b.commit();
}

// tasks seeded by an older build stored {en, pl} objects
const taskTitle = (task) => (typeof task?.title === 'string' ? task.title : task?.title?.en || task?.id || '');
const themeText = (th) => (typeof th === 'string' ? th : th?.en || '');

const countVotes = (rows) => {
  const c = {};
  for (const v of rows) c[v.teamId] = (c[v.teamId] || 0) + 1;
  return c;
};

// Applying a voted round is REPLAY-SAFE. We remember what the round last
// awarded, take that back off, then apply the current standings — so pressing
// the button again after a few late votes corrects the scores instead of
// paying everybody twice.
async function applyVotedRound(field, teamIds, counts, label) {
  const { ranked, award } = awardByVotes(teamIds, counts);
  const previous = S.event[field] || {};

  const bonusByTeam = Object.fromEntries(S.teams.map(x => [x.id, Number(x.bonus || 0)]));
  for (const [id, pts] of Object.entries(previous)) bonusByTeam[id] = (bonusByTeam[id] || 0) - Number(pts || 0);
  for (const [id, pts] of Object.entries(award)) bonusByTeam[id] = (bonusByTeam[id] || 0) + Number(pts || 0);

  const b = writeBatch(db);
  for (const teamDoc of S.teams) {
    b.set(doc(db, 'events', S.eid, 'teams', teamDoc.id), { bonus: bonusByTeam[teamDoc.id] || 0 }, { merge: true });
  }
  recomputeInto(b, bonusByTeam);
  // update() rather than set(merge) so the record replaces cleanly and cannot
  // accumulate stale teams from an earlier line-up.
  b.update(doc(db, 'events', S.eid), { [field]: award });
  await b.commit();

  const name = id => S.teams.find(x => x.id === id)?.name || id;
  const again = Object.keys(previous).length ? 're-applied' : 'applied';
  toast(`${label} points ${again} — ${ranked.map(r => `${name(r.id)} ${award[r.id]}`).join(', ')}`);
}

// Firestore has no recursive delete from the browser, so we walk the
// subcollections ourselves. Live events are refused: only a finished event
// or one still sitting in the lobby can go.
const EVENT_SUBCOLLECTIONS = [
  'participants', 'teams', 'tasks', 'keys', 'media',
  'submissions', 'semi', 'semivotes', 'finale', 'votes'
];

const isDeletable = (ev) => !!ev && (ev.phase === 'done' || ev.phase === 'lobby');

async function deleteEvent(eid) {
  const ev = S.events.find(x => x.id === eid);
  if (!isDeletable(ev)) return toast('That event is still running — end it first.', 'err');

  const refs = [];
  const memberIds = [];
  for (const name of EVENT_SUBCOLLECTIONS) {
    // A collection that never existed comes back empty; anything else that
    // goes wrong must stop us, because half-deleting an event is worse than
    // not deleting it at all.
    let qs;
    try {
      qs = await getDocs(collection(db, 'events', eid, name));
    } catch (e) {
      toast(`Could not read ${name}: ${e.message}. Nothing was deleted.`, 'err');
      return;
    }
    for (const d of (qs.docs || [])) {
      refs.push(doc(db, 'events', eid, name, d.id));
      if (name === 'participants') memberIds.push(d.id);
    }
  }

  // Players follow users/<uid>.eventId, so clear it or they wait forever.
  for (let i = 0; i < memberIds.length; i += 200) {
    const b = writeBatch(db);
    for (const uid of memberIds.slice(i, i + 200)) {
      b.set(doc(db, 'users', uid), { eventId: null }, { merge: true });
    }
    await b.commit();
  }

  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    for (const ref of refs.slice(i, i + 400)) b.delete(ref);
    await b.commit();
  }

  await deleteDoc(doc(db, 'events', eid));   // the event doc goes last
  const next = S.events.find(x => x.id !== eid);
  selectEvent(next ? next.id : null);
  toast(`Deleted "${ev.name}" and ${refs.length} record(s)`);
}

const showcase = (taskId) =>
  setEvent({ showcaseTaskId: taskId }).then(() =>
    toast(taskId ? 'Answers are on the big screen' : 'Big screen back to the leaderboard'));

// Removes the Firestore record for every account that is not a host. It does
// NOT remove the logins themselves — only the Firebase console can do that —
// but without a record an account cannot appear in a roster or be auto-joined.
async function purgeNonHostAccounts() {
  const victims = S.users.filter(u => !S.hosts.includes(u.id));
  if (!victims.length) return toast('Nothing to remove — every account is a host', 'err');

  for (let i = 0; i < victims.length; i += 200) {
    const b = writeBatch(db);
    for (const u of victims.slice(i, i + 200)) {
      b.delete(doc(db, 'users', u.id));
      if (S.eid) b.delete(doc(db, 'events', S.eid, 'participants', u.id));
    }
    await b.commit();
  }
  toast(`${victims.length} account record(s) removed — their logins still exist in Firebase Auth`);
}

async function endEvent() {
  const open = S.tasks.find(x => x.status === 'open');
  const b = writeBatch(db);
  if (open) b.set(doc(db, 'events', S.eid, 'tasks', open.id), { status: 'closed' }, { merge: true });
  b.set(doc(db, 'events', S.eid), {
    phase: 'done', activeTaskId: null, autoJoin: false, endedAt: serverTimestamp()
  }, { merge: true });
  await b.commit();
  toast('Event ended — winners are on the big screen');
}

async function reopenEvent() {
  await setEvent({ phase: 'part1', endedAt: null });
  toast('Event reopened');
}

async function uploadSemiImage(file) {
  const image = await imageToDataUrl(file, 1200, 500_000);
  await setDoc(doc(db, 'events', S.eid, 'media', 'semi-reference'), { image, at: serverTimestamp() });
  toast('Reference image uploaded');
}

async function clearRound(which) {
  const b = writeBatch(db);
  b.update(doc(db, 'events', S.eid), { [which === 'semi' ? 'semiAward' : 'finalAward']: null });
  if (which === 'semi') {
    for (const v of S.semivotes) b.delete(doc(db, 'events', S.eid, 'semivotes', v.id));
    for (const e of S.semi) b.delete(doc(db, 'events', S.eid, 'semi', e.id));
  } else {
    for (const v of S.votes) b.delete(doc(db, 'events', S.eid, 'votes', v.id));
    for (const e of S.finale) b.delete(doc(db, 'events', S.eid, 'finale', e.id));
  }
  await b.commit();
  toast('Cleared');
}

// -------------------------------------------------------------------- paint -
function paint() {
  if (!S.user) return;
  root().innerHTML = `
    <div class="row" style="margin:16px 0">
      <select id="evSel" class="grow">
        ${S.events.map(e => `<option value="${esc(e.id)}" ${e.id === S.eid ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        ${S.events.length ? '' : '<option value="">— no events —</option>'}
      </select>
      <button class="btn btn--sm" id="newEv">New event</button>
      <button class="btn btn--sm btn--danger" id="delEv"
        ${isDeletable(S.event) ? '' : 'disabled'}
        title="${isDeletable(S.event)
          ? 'Delete this event and all of its data'
          : 'Only an event in the lobby or a finished one can be deleted'}">Delete</button>
      <a class="btn btn--ghost btn--sm" href="./screen.html" target="_blank">Big screen ↗</a>
    </div>
    ${S.event ? `<p class="faint" style="margin:-8px 0 12px">
      state: <b>${esc(S.event.phase || 'lobby')}</b>${isDeletable(S.event) ? '' : ' — running, so it cannot be deleted'}
    </p>` : ''}
    ${S.eid && S.event ? `<div class="admin-grid">
      <div>${rosterCard()}${accountsCard()}${runOfShowCard()}</div>
      <div>${tasksCard()}${gradingCard()}${semiCard()}${finaleCard()}${endCard()}${teamsCard()}</div>
    </div>` : `${accountsCard()}
      <div class="card center muted">Create an event to begin.</div>`}`;

  $('#newEv').addEventListener('click', createEvent);
  $('#delEv')?.addEventListener('click', () => {
    if (!isDeletable(S.event)) return;
    const counts = [
      `${S.participants.length} participant(s)`,
      `${S.teams.length} team(s)`,
      `${S.subs.length} answer sheet(s)`,
      `${S.semi.length + S.finale.length} uploaded image(s)`
    ].join(', ');
    if (!confirm(`Delete "${S.event.name}" permanently?\n\nThis removes ${counts}. It cannot be undone.\n\nThe accounts themselves are not touched.`)) return;
    deleteEvent(S.eid);
  });
  $('#evSel')?.addEventListener('change', e => selectEvent(e.target.value));
  wire();
}

function rosterCard() {
  const inEvent = new Set(players().map(p => p.id));
  const unassigned = players().filter(p => !p.teamId).length;
  const everyoneIn = playerUsers().length === inEvent.size;
  const f = S.filter.toLowerCase();
  const rows = S.users.filter(u => !f || String(u.username || u.id).toLowerCase().includes(f));

  return `<div class="card">
    <h2>Roster <span class="pill">${inEvent.size} playing · ${S.teams.length} teams</span></h2>
    <p class="faint">${playerUsers().length} player account(s) · ${S.hosts.length} host(s), who do not play ·
      ${unassigned} without a team · list updates live</p>

    <label class="row" style="gap:8px;margin:4px 0 10px;cursor:pointer">
      <input type="checkbox" id="autoJoin" ${S.event.autoJoin ? 'checked' : ''}
             style="width:18px;height:18px;accent-color:var(--green)">
      <span><b>Auto-join late arrivals</b><br>
        <span class="faint">New accounts join this event and land in the smallest team, as long as this page stays open.</span></span>
    </label>

    <div class="row">
      <button class="btn btn--sm" id="addAll" ${everyoneIn ? 'disabled' : ''}>Add everyone</button>
      <button class="btn btn--sm btn--ghost" id="addSel" ${everyoneIn ? 'disabled' : ''}>Add ticked</button>
      ${everyoneIn
        ? '<span class="faint">everyone is already in — next step is Shuffle</span>' : ''}
    </div>
    <div class="row" style="margin-top:10px">
      <span class="faint">Team size</span>
      <input type="number" id="tsize" value="5" min="2" max="8">
      <button class="btn btn--sm btn--pink" id="shuffle">Shuffle into teams</button>
    </div>

    <div class="row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
      ${S.event.phase === 'prep'
        ? `<button class="btn btn--sm" id="closePrep">Close preparation</button>
           <span class="faint">Teams are renaming themselves right now.</span>`
        : `<button class="btn btn--sm btn--ghost" id="openPrep"
             ${S.teams.length ? '' : 'disabled'}>Open preparation</button>
           <span class="faint">${S.teams.length
             ? 'Lets teams rename themselves. Close it before task 1.'
             : 'Shuffle the teams first.'}</span>`}
    </div>
    <input type="text" id="filter" placeholder="Find a person…" value="${esc(S.filter)}" style="margin-top:10px">

    <div class="scroll" style="margin-top:10px">
      <table><thead><tr><th style="width:26px"></th><th>User</th><th>Team</th><th></th></tr></thead><tbody>
      ${rows.map(u => {
        const p = S.participants.find(x => x.id === u.id);
        const team = S.teams.find(x => x.id === p?.teamId);
        const host = isHost(u.id);
        return `<tr>
          <td>${host
            ? '<span title="hosts do not play" class="faint">—</span>'
            : p
              ? '<span title="already in this event" style="color:var(--green);font-weight:700">✓</span>'
              : `<input type="checkbox" class="upick" value="${esc(u.id)}">`}</td>
          <td>${esc(u.username || u.id)}
            ${host ? '<span class="pill pill--live" style="margin-left:6px">host</span>' : ''}</td>
          <td class="faint">${host
            ? 'runs the event'
            : team
              ? `<span class="dot" style="background:${teamColor(team.id)};display:inline-block;margin-right:5px"></span>${esc(team.name)} · ${esc(String(p.slot ?? ''))}`
              : (p ? 'unassigned' : '—')}</td>
          <td>${p ? `<button class="btn btn--sm btn--danger" data-rm="${esc(u.id)}" title="Remove from this event">×</button>` : ''}</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>
  </div>`;
}

function accountsCard() {
  const testers = S.users.filter(u => /^tester\d+$/i.test(u.username || '')).length;
  return `<div class="card">
    <h2>Accounts</h2>
    <p class="faint">${S.users.length} accounts · ${S.hosts.length} host(s) · ${testers} tester account(s)</p>
    <div class="row">
      <span class="faint">Create</span>
      <input type="number" id="howMany" value="${S.howMany}" min="1" max="120">
      <button class="btn btn--sm" id="makeTesters" ${S.busy ? 'disabled' : ''}>tester01…</button>
    </div>
    <p class="faint" style="margin:10px 0 0">
      ${S.busy ? esc(S.busy) : 'Asks for the password once, then creates them one by one. Your own session stays signed in. Accounts that already exist are skipped, so running it twice is safe.'}
    </p>

    <h2 style="font-size:16px;margin:18px 0 6px">Hosts</h2>
    <div class="row" style="gap:6px;flex-wrap:wrap">
      ${S.hosts.length
        ? S.hosts.map(uid => {
            const u = S.users.find(x => x.id === uid);
            return `<span class="pill pill--live">${esc(u?.username || uid.slice(0, 8))}
              <button class="btn btn--sm btn--ghost" data-unhost="${esc(uid)}"
                style="padding:0 6px;margin-left:6px;border:0;color:var(--red)" title="Remove host rights">×</button></span>`;
          }).join('')
        : '<span class="faint">none yet — add the first one in the Firebase console</span>'}
    </div>
    <div class="row" style="margin-top:10px">
      <select id="hostPick" class="grow">
        <option value="">— choose an account —</option>
        ${S.users.filter(u => !S.hosts.includes(u.id))
          .map(u => `<option value="${esc(u.id)}">${esc(u.username || u.id)}</option>`).join('')}
      </select>
      <button class="btn btn--sm btn--ghost" id="makeHost">Make host</button>
    </div>
    <p class="faint" style="margin:8px 0 0">A host can run the event and promote other hosts.</p>

    <h2 style="font-size:16px;margin:18px 0 6px">Clear out accounts</h2>
    <button class="btn btn--sm btn--danger" id="purgeUsers"
      ${S.users.length > S.hosts.length ? '' : 'disabled'}>
      Remove all non-host accounts (${Math.max(0, S.users.length - S.hosts.length)})</button>
    <p class="faint" style="margin:8px 0 0">Wipes every non-host account record, so testers stop
      appearing in the roster and stop being auto-joined. The logins themselves survive —
      delete those under Authentication in the Firebase console.</p>
  </div>`;
}

function runOfShowCard() {
  return `<div class="card"><h2>Run of show</h2>
    <table><tbody>${RUN_OF_SHOW.map(r =>
      `<tr><td class="mono" style="white-space:nowrap">${esc(r.min)}</td><td>${esc(r.en)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function tasksCard() {
  if (!S.tasks.length) {
    return `<div class="card"><h2>Tasks</h2>
      <p class="muted">No tasks in this event yet.</p>
      <button class="btn" id="seed">Seed default tasks</button></div>`;
  }
  return `<div class="card">
    <h2>Tasks</h2>
    <p class="faint">For each one: <b>Open</b> → teams answer → <b>Close</b> → <b>Review</b>
      (accept or score where needed) → <b>Grade &amp; publish</b>. The leaderboard only moves
      on that last click. Then open the next task.</p>
    <table><thead><tr><th>Task</th><th>Status</th><th>Subs</th><th>Control</th></tr></thead><tbody>
    ${S.tasks.map(task => {
      const n = S.subs.filter(s => s.taskId === task.id).length;
      const cls = task.status === 'open' ? 'pill--live' : task.status === 'closed' ? 'pill--closed' : '';
      return `<tr>
        <td><b>${esc(taskTitle(task))}</b><br><span class="faint">${esc(task.type)}</span></td>
        <td><span class="pill ${cls}">${esc(task.status)}</span>
          ${task.graded ? '<br><span class="pill pill--live" style="margin-top:4px">graded</span>' : ''}</td>
        <td class="mono">${n} / ${S.teams.length}</td>
        <td><div class="row">
          <input type="number" class="tmin" data-task="${esc(task.id)}" value="${task.minutes || 6}" min="1" max="30">
          <button class="btn btn--sm" data-open="${esc(task.id)}">Open</button>
          <button class="btn btn--sm btn--ghost" data-close="${esc(task.id)}">Close</button>
          <button class="btn btn--sm btn--ghost" data-review="${esc(task.id)}">Review</button>
        </div></td></tr>`;
    }).join('')}
    </tbody></table>
    <div class="row" style="margin-top:10px">
      <button class="btn btn--sm btn--ghost" id="seed">Re-seed tasks</button>
      <button class="btn btn--sm btn--ghost" id="noTask">Clear active task</button>
    </div>
  </div>`;
}

function gradingCard() {
  const taskId = S.selectedTask;
  const task = S.tasks.find(x => x.id === taskId);
  if (!task) return '';
  const key = S.keys[taskId] || {};
  const subs = S.subs.filter(s => s.taskId === taskId);
  const teamName = id => S.teams.find(x => x.id === id)?.name || id;

  const rows = subs.map(s => {
    const label = `<b>${esc(teamName(s.teamId))}</b><br><span class="faint">${esc(s.byName || '')}</span>`;

    if (task.type === 'quiz-single' || task.type === 'quiz-multi') {
      const body = task.type === 'quiz-single'
        ? Object.entries(s.answers || {}).map(([k, v]) => `${k}:${v}`).join('  ')
        : (s.flagged || []).join(', ');
      return `<tr><td>${label}</td><td class="mono sub-text">${esc(body)}</td>
        <td class="mono">${s.awarded ?? '—'}</td></tr>`;
    }

    if (task.type === 'golf') {
      const on = key.accepted?.[s.teamId] === true;
      const override = key.awards?.[s.teamId];
      return `<tr><td>${label}</td>
        <td class="sub-text"><b class="mono">${(s.prompt || '').length} chars</b><br>${esc(s.prompt || '')}
          <br><span class="faint">${esc((s.output || '').slice(0, 400))}</span></td>
        <td>
          <button class="btn btn--sm ${on ? '' : 'btn--ghost'}" data-accept="${esc(s.teamId)}">${on ? 'accepted' : 'accept'}</button>
          <div style="margin-top:6px"><input type="number" class="award" data-team="${esc(s.teamId)}"
            value="${override ?? ''}" placeholder="override" title="Leave blank to use the automatic score"></div>
          <div class="mono">${s.awarded ?? '—'}</div>
        </td></tr>`;
    }

    const cur = key.awards?.[s.teamId] ?? '';
    return `<tr><td>${label}</td>
      <td class="sub-text"><b>${esc(s.name || '')}</b><br>${esc(s.text || '')}
        <br><span class="faint">${esc(s.prompt || '')}</span></td>
      <td><input type="number" class="award" data-team="${esc(s.teamId)}" value="${esc(String(cur))}"
            min="0" max="${task.points?.max || 10}"><div class="mono">${s.awarded ?? '—'}</div></td></tr>`;
  }).join('');

  return `<div class="card">
    <h2>Review — ${esc(taskTitle(task) || taskId)}</h2>
    <p class="faint">${subs.length} submission(s) of ${S.teams.length} team(s)</p>
    ${task.type === 'golf' ? `<p class="warn">Click <b>accept</b> for every team whose pasted output
        really meets all three rules — un-accepted teams score 0. The number box is an override:
        fill it only if you want to replace the automatic score entirely.</p>` : ''}
    ${task.type === 'open' ? `<p class="warn">Type a score from 0 to ${task.points?.max || 10} in each
        team's box. Nothing is added to the leaderboard until you press
        <b>Grade &amp; publish</b> — that applies every box at once.</p>` : ''}
    ${true ? `<div class="row" style="margin-bottom:10px">
        ${S.event.showcaseTaskId === taskId
          ? `<button class="btn btn--sm" data-showcase="">Hide from big screen</button>
             <span class="faint">The answers are on the big screen now.</span>`
          : `<button class="btn btn--sm btn--ghost" data-showcase="${esc(taskId)}">Show on big screen</button>
             <span class="faint">${task.type === 'quiz-single' || task.type === 'quiz-multi'
               ? 'Puts the questions up with the right answers marked, so you can walk the room through them.'
               : "Puts every team's answer up so the room can read them."}</span>`}
      </div>` : ''}
    <div class="scroll"><table><thead><tr><th>Team</th><th>Answer</th><th>Score</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" class="faint">nothing yet</td></tr>'}</tbody></table></div>
    <div class="row" style="margin-top:12px">
      <button class="btn" data-grade="${esc(taskId)}">Grade &amp; publish</button>
      <button class="btn btn--sm btn--ghost" id="closeReview">Hide</button>
    </div>
  </div>`;
}

function semiCard() {
  const s = S.event.semi || {};
  const counts = countVotes(S.semivotes);
  const name = id => S.teams.find(x => x.id === id)?.name || id;
  const ranked = rankTeams(S.teams).map(x => ({ ...x, votes: counts[x.id] || 0 }))
    .sort((a, b) => b.votes - a.votes);

  return `<div class="card">
    <h2>Round 5 — Reverse Prompt</h2>
    <p class="faint">Every team plays. Generate one image with Copilot beforehand, upload it
      here, keep your prompt secret. Ideas: ${esc(SEMI.imageIdeas[0])}</p>

    <div class="row">
      <button class="btn btn--sm" id="semiImgBtn">${S.semiImage ? 'Replace image' : 'Upload image'}</button>
      <input type="file" accept="image/*" id="semiImgFile" class="hide">
      ${S.semiImage ? `<img src="${esc(S.semiImage)}" alt="" style="height:54px;border-radius:8px;border:1px solid var(--line)">` : '<span class="faint">no image yet</span>'}
    </div>

    <div class="row" style="margin-top:10px">
      <button class="btn btn--sm btn--ghost" id="semiStart">Make this round live</button>
      <span class="faint">Switches every phone to this round.</span>
    </div>

    <div class="row" style="margin-top:10px">
      <span class="faint">Minutes</span><input type="number" id="semiMin" value="6" min="1" max="15">
      <button class="btn btn--sm btn--pink" data-sphase="creating">Start</button>
      <button class="btn btn--sm" data-sphase="voting">Open voting</button>
      <button class="btn btn--sm btn--ghost" data-sphase="results">Results</button>
      <button class="btn btn--sm btn--ghost" data-sphase="idle">Reset</button>
    </div>
    <p class="faint" style="margin-top:10px">phase: <b>${esc(s.phase || 'idle')}</b> ·
      entries ${S.semi.length} / ${S.teams.length} · votes ${S.semivotes.length}
      ${S.event.semiAward ? '· <b style="color:var(--green)">points applied</b>' : '· votes are counted but not yet scored'}</p>

    <div class="scroll" style="max-height:220px">
      <table><tbody>
      ${ranked.map(x => `<tr>
        <td><span class="dot" style="background:${teamColor(x.id)};display:inline-block;margin-right:6px"></span>${esc(x.name || x.id)}</td>
        <td class="faint">${S.semi.some(e => e.id === x.id) ? 'submitted' : '—'}</td>
        <td class="lb__pts" style="text-align:right">${x.votes}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>

    <div class="row" style="margin-top:12px">
      <button class="btn btn--sm" id="semiApply">${S.event.semiAward ? 'Re-apply' : 'Apply'} points (1 vote = 1 point)</button>
      <button class="btn btn--sm btn--ghost" id="toFinal">Move on to the final</button>
      <button class="btn btn--sm btn--danger" id="semiClear">Clear entries &amp; votes</button>
    </div>
  </div>`;
}

function finaleCard() {
  const f = S.event.finale || {};
  const counts = countVotes(S.votes);
  const ranked = rankTeams(S.teams).map(x => ({ ...x, votes: counts[x.id] || 0 }))
    .sort((a, b) => b.votes - a.votes);

  return `<div class="card">
    <h2>Final — Prompt Battle</h2>
    <p class="faint">Every team plays. Pick a theme, reveal it when the timer starts.</p>
    <label class="field"><span>Theme</span>
      <select id="themeSel">
        <option value="">— pick a theme —</option>
        ${FINALE_THEMES.map((th, i) => `<option value="${i}" ${themeText(f.theme) === th ? 'selected' : ''}>${esc(th)}</option>`).join('')}
      </select></label>
    <div class="row" style="margin-top:12px">
      <span class="faint">Minutes</span><input type="number" id="fmin" value="4" min="1" max="15">
      <button class="btn btn--sm btn--pink" data-phase="creating">Start creating</button>
      <button class="btn btn--sm" data-phase="voting">Open voting</button>
      <button class="btn btn--sm btn--ghost" data-phase="results">Show results</button>
      <button class="btn btn--sm btn--ghost" data-phase="idle">Reset phase</button>
    </div>
    <p class="faint" style="margin-top:10px">phase: <b>${esc(f.phase || 'idle')}</b> ·
      entries ${S.finale.length} / ${S.teams.length} · votes ${S.votes.length}
      ${S.event.finalAward ? '· <b style="color:var(--green)">points applied</b>' : '· votes are counted but not yet scored'}</p>

    <div class="scroll" style="max-height:220px">
      <table><tbody>
      ${ranked.map(x => `<tr>
        <td><span class="dot" style="background:${teamColor(x.id)};display:inline-block;margin-right:6px"></span>${esc(x.name || x.id)}</td>
        <td class="faint">${S.finale.some(e => e.id === x.id) ? 'submitted' : '—'}</td>
        <td class="lb__pts" style="text-align:right">${x.votes}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>

    <div class="row" style="margin-top:12px">
      <button class="btn btn--sm" id="applyFin">${S.event.finalAward ? 'Re-apply' : 'Apply'} points (1 vote = 1 point)</button>
      <button class="btn btn--sm btn--danger" id="clearFin">Clear entries &amp; votes</button>
    </div>
  </div>`;
}

function endCard() {
  const done = S.event.phase === 'done';
  const ranked = rankTeams(S.teams).slice(0, 3);
  return `<div class="card">
    <h2>End of event</h2>
    ${done
      ? `<p class="faint">The event is finished. Players see their final placing; the big screen shows the podium.</p>
         <div class="lb" style="margin-bottom:12px">
           ${ranked.map((x, i) => `<div class="lb__row">
             <div class="lb__rank">${['🥇','🥈','🥉'][i] || x.rank}</div>
             <div class="lb__name"><span class="dot" style="background:${teamColor(x.id)}"></span><span>${esc(x.name || x.id)}</span></div>
             <div class="lb__pts">${Number(x.points || 0)}</div></div>`).join('')}
         </div>
         <button class="btn btn--sm btn--ghost" id="reopenEvent">Reopen the event</button>`
      : `<p class="faint">Closes any open task, clears the board and puts every phone on its final placing.
          The big screen switches to the podium. Apply the final points first.</p>
         <button class="btn btn--pink" id="endEvent">End event &amp; show winners</button>`}
  </div>`;
}

function teamsCard() {
  const ranked = rankTeams(S.teams);
  return `<div class="card">
    <h2>Leaderboard</h2>
    <table><thead><tr><th>#</th><th>Team</th><th>Members</th><th>Bonus</th><th>Points</th></tr></thead><tbody>
    ${ranked.map(x => `<tr>
      <td class="mono">${x.rank}</td>
      <td><span class="dot" style="background:${teamColor(x.id)};display:inline-block;margin-right:6px"></span>${esc(x.name || x.id)}</td>
      <td class="faint">${S.participants.filter(p => p.teamId === x.id).map(p => esc(p.username)).join(', ')}</td>
      <td><input type="number" class="bonus" data-team="${esc(x.id)}" value="${Number(x.bonus || 0)}"></td>
      <td class="lb__pts">${Number(x.points || 0)}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

// --------------------------------------------------------------------- wire -
function wire() {
  const on = (sel, ev, fn) => root().querySelectorAll(sel).forEach(n => n.addEventListener(ev, fn));

  $('#seed')?.addEventListener('click', seedTasks);
  $('#noTask')?.addEventListener('click', () => setEvent({ activeTaskId: null }));
  $('#autoJoin')?.addEventListener('change', e => setEvent({ autoJoin: e.target.checked }));
  $('#filter')?.addEventListener('input', e => {
    S.filter = e.target.value;
    paint();
    const next = root().querySelector('#filter');
    if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
  });
  $('#addAll')?.addEventListener('click', () =>
    addUsersToEvent(playerUsers().filter(u => !S.participants.some(p => p.id === u.id)).map(u => u.id)));
  $('#addSel')?.addEventListener('click', () =>
    addUsersToEvent(Array.from(root().querySelectorAll('.upick:checked')).map(c => c.value)));
  $('#shuffle')?.addEventListener('click', () => {
    if (confirm('Re-shuffle everyone into new teams? Points are not reset.')) {
      shuffleTeams(Number($('#tsize').value) || 5);
    }
  });
  on('[data-rm]', 'click', e => removeParticipant(e.currentTarget.dataset.rm));
  $('#openPrep')?.addEventListener('click', openPrep);
  $('#closePrep')?.addEventListener('click', closePrep);
  on('[data-showcase]', 'click', e => showcase(e.currentTarget.dataset.showcase || null));

  const toggleHost = async (uid) => {
    const u = S.users.find(x => x.id === uid);
    const isHost = S.hosts.includes(uid);
    if (isHost && S.hosts.length === 1) {
      return toast('That is the only host — promote someone else first.', 'err');
    }
    if (!confirm(isHost
      ? `Remove host rights from ${u?.username || uid}?`
      : `Make ${u?.username || uid} a host? They will be able to run the event.`)) return;
    try {
      if (isHost) await deleteDoc(doc(db, 'admins', uid));
      else await setDoc(doc(db, 'admins', uid), { role: 'host', username: u?.username || '' });
      toast(isHost ? 'Host rights removed' : 'Host added');
    } catch (err) {
      toast('Could not change host rights: ' + err.message, 'err');
    }
  };
  on('[data-unhost]', 'click', e => toggleHost(e.currentTarget.dataset.unhost));
  $('#purgeUsers')?.addEventListener('click', () => {
    const n = S.users.length - S.hosts.length;
    if (!confirm(`Remove ${n} non-host account record(s)?\n\nHosts are kept. This does not delete the logins in Firebase Authentication, so those people could register again — but they will disappear from the roster and stop being auto-joined.\n\nThis cannot be undone.`)) return;
    purgeNonHostAccounts();
  });
  $('#makeHost')?.addEventListener('click', () => {
    const uid = $('#hostPick')?.value;
    if (!uid) return toast('Pick an account first', 'err');
    toggleHost(uid);
  });

  $('#howMany')?.addEventListener('input', e => {
    S.howMany = Math.max(1, Math.min(120, Number(e.target.value) || 1));
  });
  $('#makeTesters')?.addEventListener('click', async () => {
    const count = Math.max(1, Math.min(120, Number($('#howMany')?.value) || S.howMany));
    S.howMany = count;
    const names = testerNames(count);
    const password = prompt(
      `Password for all ${count} tester accounts.\n\nThey will be tester01 … ${names[names.length - 1]}.`,
      '');
    if (!password) return;
    if (password.length < 6) return toast('Firebase needs 6+ characters', 'err');

    S.busy = 'Starting…';
    paint();
    try {
      const res = await createAccounts(names, password, (done, total, label) => {
        S.busy = `Creating ${done}/${total}${label ? ' — ' + label : ''}…`;
        const node = root().querySelector('#makeTesters');
        if (node) node.textContent = `${done}/${total}`;
      });
      S.busy = '';
      paint();
      toast(`${res.made.length} created, ${res.existed.length} already existed`
        + (res.failed.length ? `, ${res.failed.length} failed` : ''));
      if (res.failed.length) console.warn('HAI ARENA — failed accounts:', res.failed);
    } catch (err) {
      S.busy = '';
      paint();
      toast('Account creation stopped: ' + err.message, 'err');
    }
  });

  on('[data-open]', 'click', e => {
    const id = e.currentTarget.dataset.open;
    openTask(id, Number(root().querySelector(`.tmin[data-task="${id}"]`)?.value) || 6);
  });
  on('[data-close]', 'click', e => closeTask(e.currentTarget.dataset.close));
  on('[data-review]', 'click', e => { S.selectedTask = e.currentTarget.dataset.review; paint(); });
  $('#closeReview')?.addEventListener('click', () => { S.selectedTask = null; paint(); });
  on('[data-grade]', 'click', e => gradeAndPublish(e.currentTarget.dataset.grade));

  on('[data-accept]', 'click', async e => {
    const team = e.currentTarget.dataset.accept;
    await setKeyField(S.selectedTask, ['accepted', team], S.keys[S.selectedTask]?.accepted?.[team] !== true);
  });
  on('.award', 'change', async e => {
    const raw = e.currentTarget.value.trim();
    await setKeyField(S.selectedTask, ['awards', e.currentTarget.dataset.team],
      raw === '' ? null : (Number(raw) || 0));
  });
  on('.bonus', 'change', e => setTeamBonus(e.currentTarget.dataset.team, Number(e.currentTarget.value) || 0));

  // ---- semi-final
  $('#semiStart')?.addEventListener('click', () =>
    setEvent({ phase: 'semi' }).then(() => toast('Round 5 is live for every team')));
  $('#semiImgBtn')?.addEventListener('click', () => $('#semiImgFile').click());
  $('#semiImgFile')?.addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { await uploadSemiImage(f); } catch { toast('Could not process that image', 'err'); }
  });
  on('[data-sphase]', 'click', e => {
    const phase = e.currentTarget.dataset.sphase;
    const patch = { ...(S.event.semi || {}), phase };
    if (phase === 'creating') patch.endsAt = new Date(Date.now() + (Number($('#semiMin')?.value) || 5) * 60000);
    setEvent({ semi: patch, phase: phase === 'idle' ? 'part1' : 'semi' });
  });
  $('#semiApply')?.addEventListener('click', () =>
    applyVotedRound('semiAward', S.teams.map(x => x.id), countVotes(S.semivotes), 'Round 5'));
  $('#toFinal')?.addEventListener('click', () =>
    setEvent({ phase: 'finale', finale: { ...(S.event.finale || {}), phase: 'idle' } })
      .then(() => toast('Moved on to the final — everyone plays')));
  $('#semiClear')?.addEventListener('click', () => {
    if (confirm('Delete all semi-final entries and votes?')) clearRound('semi');
  });

  // ---- final

  $('#themeSel')?.addEventListener('change', e => {
    const i = e.target.value;
    setEvent({ finale: { ...(S.event.finale || {}), theme: i === '' ? null : FINALE_THEMES[Number(i)] } });
  });
  on('[data-phase]', 'click', e => {
    const phase = e.currentTarget.dataset.phase;
    const patch = { ...(S.event.finale || {}), phase };
    if (phase === 'creating') patch.endsAt = new Date(Date.now() + (Number($('#fmin')?.value) || 3) * 60000);
    setEvent({ finale: patch, phase: phase === 'idle' ? 'part1' : 'finale' });
  });
  $('#applyFin')?.addEventListener('click', () =>
    applyVotedRound('finalAward', S.teams.map(x => x.id), countVotes(S.votes), 'Final'));
  $('#endEvent')?.addEventListener('click', () => {
    const unapplied = (S.event.finalistTeamIds || []).length && S.votes.length;
    const warn = unapplied
      ? 'End the event now?\n\nThere are final votes recorded — if you have not clicked "Apply final points" yet, do that first or the winner will be wrong.'
      : 'End the event now? Players will see their final placing and the big screen switches to the podium.';
    if (confirm(warn)) endEvent();
  });
  $('#reopenEvent')?.addEventListener('click', reopenEvent);

  $('#clearFin')?.addEventListener('click', () => {
    if (confirm('Delete all final images and votes?')) clearRound('final');
  });
}
