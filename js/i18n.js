// Player- and screen-facing strings. English only.
// `tr()` survives content that was seeded by an older, bilingual build.

const STRINGS = {
  login: 'Log in', register: 'Create account', logout: 'Log out',
  username: 'Username', password: 'Password', password2: 'Repeat password',
  haveAccount: 'I already have an account', needAccount: 'I need an account',
  loggingIn: 'Signing in…',
  pickUsername: 'Pick anything — your name, your nickname. You will need it again if you get logged out.',
  errShort: 'Password needs at least 6 characters.',
  errMatch: 'The two passwords do not match.',
  errUser: 'Username must be 2–30 characters, letters and numbers.',
  errTaken: 'That username is taken. Try another.',
  errBadLogin: 'Wrong username or password.',
  errNoUser: 'No such user. Create an account first.',

  waitingTitle: 'You are in',
  waitingBody: 'Hold tight — the host is about to put you on a team. This page updates by itself.',
  yourTeam: 'Your team', teammates: 'Teammates', you: 'you',
  slot: 'Player', task: 'Task', leaderboard: 'Leaderboard', team: 'Team',
  noTaskTitle: 'Stand by',
  noTaskBody: 'No task is open right now. Watch the big screen.',
  closedTitle: 'Time!',
  closedBody: 'This task is closed. Scores are on the big screen.',
  timeLeft: 'Time left', timeUp: "Time's up",
  save: 'Save answers', saved: 'Saved',
  savedBy: 'last edited by',
  sharedNote: 'Everyone on your team edits this together — you see each other live.',
  howToPlay: 'How to play',
  points: 'pts',
  prompt: 'Prompt', output: 'What the AI produced',
  chars: 'characters', inventionName: 'Invention name', howItWorks: 'How it works',
  flagFalse: 'Tick the statements that are FALSE',
  target: 'Target',

  finaleTitle: 'FINAL — Prompt Battle',
  finaleTheme: 'Theme',
  finaleUpload: 'Upload your image',
  finaleNotFinalist: 'You are the jury. Get ready to vote.',
  finaleVoteTitle: 'Vote for the best',
  finaleVoteDone: 'Vote counted',
  finaleVoteChange: 'You can change your vote until the host closes voting.',
  finaleNoSelfVote: 'Finalists do not vote.',
  finaleWaiting: 'Waiting for the host…',
  finaleResults: 'Results',
  votes: 'votes',
  winner: 'Winner',
  imageTooBig: 'That image could not be processed. Try a smaller one.',
  uploading: 'Processing image…',

  semiTitle: 'SEMI-FINAL — Reverse Prompt',
  semiReference: 'The image',
  semiYourPrompt: 'Your reconstruction of the prompt',
  semiYourImage: 'The image your prompt produced',
  semiNotIn: 'You are the jury. Study the image — you will judge the reconstructions.',
  semiVoteTitle: 'Which prompt made this image?',
  semiNoSelfVote: 'Semi-finalists do not vote.',
  semiWaiting: 'Waiting for the host…',
  semiOriginal: 'The original',

  renameTeam: 'Team name',
  renameHint: 'Any member can rename the team until the first task starts.',
  renameSave: 'Save name',
  renameLocked: 'Names are locked once the event starts.',

  endTitle: "That's a wrap",
  endThanks: 'Thanks for playing.',
  endYourTeam: 'Your team finished',
  endStandings: 'Final standings',
  endPlace: 'place',

  screenTeams: 'Teams', screenPlayers: 'players',
  screenJoin: 'Join at', screenNoEvent: 'No event running',
  screenPart1: 'Part 1 — Team competition'
};

export function t(key) {
  return STRINGS[key] || key;
}

// Content may be a plain string (current) or {en, …} (seeded by an older build).
export function tr(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj;
  return obj.en ?? '';
}
