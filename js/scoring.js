// Pure scoring functions — no Firebase in here, so they can be unit-tested.
//
// SCORING IS ELASTIC. Every task is worth the number of people in the event:
// 50 people in the room means a perfect answer is worth 50 points, split across
// that task's questions. The host panel stamps `maxPoints` onto the task the
// moment it is opened, so a task is always scored against the headcount it was
// played with — late joiners never change what an earlier round was worth.
//
// The two voted rounds price themselves: one vote is one point.
//
// A submission looks like:
//   { taskId, teamId, by, answers:{}, flagged:[], prompt, output, name, text }
// A key doc looks like:
//   { answers:{}, falseIds:[], accepted:{teamId:true}, awards:{teamId:0..10} }

// Falls back to the old fixed ceilings for tasks seeded before this change.
export function taskMax(task) {
  const stamped = Number(task?.maxPoints);
  if (Number.isFinite(stamped) && stamped > 0) return stamped;
  if (task?.type === 'quiz-single') return (task.points?.perItem ?? 2) * 6;
  if (task?.type === 'quiz-multi') return (task.points?.correct ?? 3) * 4;
  if (task?.type === 'golf') return (task.points?.accepted ?? 4) + 10;
  return task?.points?.max ?? 10;
}

export function gradeQuizSingle(task, key, sub) {
  const max = taskMax(task);
  const correctKey = key?.answers || {};
  const total = Object.keys(correctKey).length || 1;
  const answers = sub?.answers || {};
  let correct = 0, answered = 0;
  for (const [itemId, want] of Object.entries(correctKey)) {
    const got = answers[itemId];
    if (got != null && got !== '') answered++;
    if (got === want) correct++;
  }
  return {
    points: Math.round(max * correct / total),
    detail: `${correct}/${total} correct · ${answered} answered · max ${max}`
  };
}

// Catching a hallucination is worth a full share; a wrong accusation costs
// two thirds of one, which is the ratio the fixed +3 / −2 scoring used.
export function gradeQuizMulti(task, key, sub) {
  const max = taskMax(task);
  const falseIds = new Set(key?.falseIds || []);
  const share = max / (falseIds.size || 1);
  const flagged = Array.isArray(sub?.flagged) ? sub.flagged : [];
  let hits = 0, misses = 0;
  for (const id of flagged) (falseIds.has(id) ? hits++ : misses++);
  const points = Math.max(0, Math.round(hits * share - misses * share * (2 / 3)));
  return { points, detail: `${hits} caught · ${misses} wrong accusation(s) · max ${max}` };
}

// Accepted entries are ranked by prompt length, shortest first. Getting in at
// all is worth a quarter of the task; the ladder shares out the other three
// quarters. A number in the host's override box replaces the lot.
export function gradeGolf(task, key, subs) {
  const max = taskMax(task);
  const base = Math.round(max * 0.25);
  const spread = max - base;
  const weights = [1, 0.7, 0.5, 0.3, 0.2];
  const accepted = key?.accepted || {};
  const overrides = key?.awards || {};
  const out = {};

  const ranked = subs
    .filter(s => accepted[s.teamId] === true)
    .map(s => ({ teamId: s.teamId, len: (s.prompt || '').length }))
    .sort((a, b) => a.len - b.len || String(a.teamId).localeCompare(String(b.teamId)));

  for (const s of subs) {
    out[s.teamId] = {
      points: 0,
      detail: accepted[s.teamId] === true ? 'accepted' : 'rejected — output missed the target'
    };
  }
  ranked.forEach((r, i) => {
    const extra = Math.round(spread * (weights[i] ?? 0));
    out[r.teamId] = {
      points: base + extra,
      detail: `accepted · ${r.len} chars · rank ${i + 1} (${base} + ${extra}) · max ${max}`
    };
  });

  for (const s of subs) {
    const manual = overrides[s.teamId];
    if (typeof manual === 'number' && Number.isFinite(manual)) {
      out[s.teamId] = { points: Math.max(0, Math.round(manual)), detail: `host override (${manual})` };
    }
  }
  return out;
}

// The host still judges on a familiar 0–10 scale; we stretch it to the task's
// elastic ceiling so it weighs the same as every other round.
export function gradeManual(task, key, sub) {
  const max = taskMax(task);
  const raw = Math.max(0, Math.min(10, Number(key?.awards?.[sub.teamId] ?? 0)));
  return {
    points: Math.round(max * raw / 10),
    detail: `host score ${raw}/10 → ${Math.round(max * raw / 10)} of ${max}`
  };
}

export function gradeTask(task, key, subs) {
  const result = {};
  if (task.type === 'golf') return gradeGolf(task, key, subs);
  for (const sub of subs) {
    if (task.type === 'quiz-single') result[sub.teamId] = gradeQuizSingle(task, key, sub);
    else if (task.type === 'quiz-multi') result[sub.teamId] = gradeQuizMulti(task, key, sub);
    else result[sub.teamId] = gradeManual(task, key, sub);
  }
  return result;
}

// team.points = sum of awarded points on that team's submissions + manual bonus
export function totalsFromSubmissions(subs, bonusByTeam = {}) {
  const totals = {};
  for (const s of subs) {
    if (typeof s.awarded !== 'number') continue;
    totals[s.teamId] = (totals[s.teamId] || 0) + s.awarded;
  }
  for (const [teamId, bonus] of Object.entries(bonusByTeam)) {
    if (typeof bonus === 'number' && bonus !== 0) {
      totals[teamId] = (totals[teamId] || 0) + bonus;
    }
  }
  return totals;
}

export function rankTeams(teams) {
  const sorted = teams.slice().sort((a, b) =>
    (b.points || 0) - (a.points || 0) || String(a.name || '').localeCompare(String(b.name || '')));
  let lastPoints = null, lastRank = 0;
  return sorted.map((teamDoc, i) => {
    const pts = teamDoc.points || 0;
    const rank = pts === lastPoints ? lastRank : i + 1;
    lastPoints = pts; lastRank = rank;
    return { ...teamDoc, rank };
  });
}

// Voted rounds price themselves: one vote, one point. With 50 people in the
// room the ceiling is about 50, which is exactly what a task is worth.
export function awardByVotes(teamIds, counts) {
  const ranked = teamIds
    .map(id => ({ id, votes: counts[id] || 0 }))
    .sort((a, b) => b.votes - a.votes || String(a.id).localeCompare(String(b.id)));
  const award = {};
  for (const id of teamIds) award[id] = counts[id] || 0;
  return { ranked, award };
}

// Split n players into teams of `size`, never leaving a team of 1.
export function makeTeams(playerIds, size = 5) {
  const n = playerIds.length;
  if (n === 0) return [];
  let count = Math.max(1, Math.round(n / size));
  if (n / count > size + 1) count = Math.ceil(n / (size + 1));
  const teams = Array.from({ length: count }, () => []);
  playerIds.forEach((id, i) => teams[i % count].push(id));
  return teams;
}
