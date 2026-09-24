// Pure scoring functions — no Firebase in here, so they can be unit-tested.
//
// A submission looks like:
//   { taskId, teamId, by, answers:{}, flagged:[], prompt, output, name, text, text2 }
// A key doc looks like:
//   { answers:{}, falseIds:[], accepted:{teamId:true}, awards:{teamId:n}, notes:{} }

export function gradeQuizSingle(task, key, sub) {
  const per = task.points?.perItem ?? 2;
  const answers = sub?.answers || {};
  const correctKey = key?.answers || {};
  let correct = 0, answered = 0;
  for (const [itemId, want] of Object.entries(correctKey)) {
    const got = answers[itemId];
    if (got != null && got !== '') answered++;
    if (got === want) correct++;
  }
  return {
    points: correct * per,
    detail: `${correct}/${Object.keys(correctKey).length} correct · ${answered} answered`
  };
}

export function gradeQuizMulti(task, key, sub) {
  const good = task.points?.correct ?? 3;
  const bad = task.points?.wrong ?? -2;
  const falseIds = new Set(key?.falseIds || []);
  const flagged = Array.isArray(sub?.flagged) ? sub.flagged : [];
  let hits = 0, misses = 0;
  for (const id of flagged) (falseIds.has(id) ? hits++ : misses++);
  const points = Math.max(0, hits * good + misses * bad);
  return { points, detail: `${hits} caught · ${misses} wrong accusation(s)` };
}

// Accepted entries are ranked by prompt length, shortest first.
// A number typed into the host's override box beats the computed score, so a
// team whose prompt was shortest but whose output missed the target can be
// zeroed, and a near-miss can be given something.
export function gradeGolf(task, key, subs) {
  const base = task.points?.accepted ?? 4;
  const bonus = task.points?.rankBonus ?? [10, 7, 5, 3, 2];
  const accepted = key?.accepted || {};
  const overrides = key?.awards || {};
  const out = {};

  const ranked = subs
    .filter(s => accepted[s.teamId] === true)
    .map(s => ({ teamId: s.teamId, len: (s.prompt || '').length }))
    .sort((a, b) => a.len - b.len || String(a.teamId).localeCompare(String(b.teamId)));

  for (const s of subs) {
    out[s.teamId] = { points: 0, detail: accepted[s.teamId] === true ? 'accepted' : 'rejected — output missed the target' };
  }
  ranked.forEach((r, i) => {
    const extra = bonus[i] ?? 0;
    out[r.teamId] = {
      points: base + extra,
      detail: `accepted · ${r.len} chars · rank ${i + 1} (+${extra})`
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

// Points handed out for a voted round (semi-final, final), best first.
export function awardByVotes(teamIds, counts, ladder) {
  const ranked = teamIds
    .map(id => ({ id, votes: counts[id] || 0 }))
    .sort((a, b) => b.votes - a.votes || String(a.id).localeCompare(String(b.id)));
  const out = {};
  ranked.forEach((r, i) => { out[r.id] = ladder[i] ?? 0; });
  return { ranked, award: out };
}

// Host types a number per team; we just clamp it.
export function gradeManual(task, key, sub) {
  const max = task.points?.max ?? 10;
  const raw = Number(key?.awards?.[sub.teamId] ?? 0);
  const points = Math.max(0, Math.min(max, Math.round(raw)));
  return { points, detail: `host score ${points}/${max}` };
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
