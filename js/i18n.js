// Player- and screen-facing strings. The admin panel is English only.

const STRINGS = {
  en: {
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
    lobbyTitle: 'Team assigned',
    yourTeam: 'Your team', teammates: 'Teammates', you: 'you',
    slot: 'Player', task: 'Task', leaderboard: 'Leaderboard', team: 'Team',
    noTaskTitle: 'Stand by',
    noTaskBody: 'No task is open right now. Watch the big screen.',
    closedTitle: 'Time!',
    closedBody: 'This task is closed. Scores are on the big screen.',
    timeLeft: 'Time left', timeUp: "Time's up",
    save: 'Save answers', saved: 'Saved', saving: 'Saving…',
    savedBy: 'last edited by',
    sharedNote: 'Everyone on your team edits this together — you see each other live.',
    submitted: 'Submitted', points: 'pts', rank: '#',
    yourAnswer: 'Your answer', prompt: 'Prompt', output: 'What the AI produced',
    chars: 'characters', inventionName: 'Invention name', howItWorks: 'How it works',
    flagFalse: 'Tick the statements that are FALSE',
    scoreThisRound: 'This round',

    finaleTitle: 'FINALE — Prompt Battle',
    finaleTheme: 'Theme',
    finaleCreating: 'Finalists are creating. 3 minutes.',
    finaleUpload: 'Upload your image',
    finaleYourEntry: 'Your entry',
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
    semiNotIn: 'You are the jury. Study the image — you will judge the reconstructions.',
    semiVoteTitle: 'Which prompt made this image?',
    semiNoSelfVote: 'Semi-finalists do not vote.',
    semiWaiting: 'Waiting for the host…',
    renameTeam: 'Team name',
    renameHint: 'Any member can rename the team until the first task starts.',
    renameSave: 'Save name',
    renameLocked: 'Names are locked once the event starts.',
    tagline: 'Heineken + AI',
    screenTeams: 'Teams', screenPlayers: 'players',
    screenJoin: 'Join at', screenNoEvent: 'No event running',
    screenPart1: 'Part 1 — Team competition', screenFinalists: 'Finalists'
  },

  pl: {
    login: 'Zaloguj się', register: 'Załóż konto', logout: 'Wyloguj',
    username: 'Nazwa użytkownika', password: 'Hasło', password2: 'Powtórz hasło',
    haveAccount: 'Mam już konto', needAccount: 'Potrzebuję konta',
    loggingIn: 'Logowanie…',
    pickUsername: 'Cokolwiek — imię, ksywka. Będzie potrzebne, jeśli się wylogujesz.',
    errShort: 'Hasło musi mieć co najmniej 6 znaków.',
    errMatch: 'Hasła nie są takie same.',
    errUser: 'Nazwa: 2–30 znaków, litery i cyfry.',
    errTaken: 'Ta nazwa jest zajęta. Wybierz inną.',
    errBadLogin: 'Zła nazwa użytkownika lub hasło.',
    errNoUser: 'Nie ma takiego użytkownika. Najpierw załóż konto.',

    waitingTitle: 'Jesteś w grze',
    waitingBody: 'Chwilę — host zaraz przydzieli cię do zespołu. Ta strona odświeża się sama.',
    lobbyTitle: 'Zespół przydzielony',
    yourTeam: 'Twój zespół', teammates: 'Skład', you: 'ty',
    slot: 'Gracz', task: 'Zadanie', leaderboard: 'Ranking', team: 'Zespół',
    noTaskTitle: 'Czekaj',
    noTaskBody: 'Żadne zadanie nie jest teraz otwarte. Patrz na duży ekran.',
    closedTitle: 'Czas minął!',
    closedBody: 'To zadanie jest zamknięte. Wyniki na dużym ekranie.',
    timeLeft: 'Pozostało', timeUp: 'Czas minął',
    save: 'Zapisz odpowiedzi', saved: 'Zapisano', saving: 'Zapisywanie…',
    savedBy: 'ostatnio edytował',
    sharedNote: 'Cały zespół edytuje to razem — widzicie się na żywo.',
    submitted: 'Wysłane', points: 'pkt', rank: '#',
    yourAnswer: 'Wasza odpowiedź', prompt: 'Prompt', output: 'Co wygenerowała AI',
    chars: 'znaków', inventionName: 'Nazwa wynalazku', howItWorks: 'Jak działa',
    flagFalse: 'Zaznaczcie zdania FAŁSZYWE',
    scoreThisRound: 'Ta runda',

    finaleTitle: 'FINAŁ — Prompt Battle',
    finaleTheme: 'Temat',
    finaleCreating: 'Finaliści tworzą. 3 minuty.',
    finaleUpload: 'Wgraj swój obraz',
    finaleYourEntry: 'Wasza praca',
    finaleNotFinalist: 'Jesteście jury. Przygotujcie się do głosowania.',
    finaleVoteTitle: 'Zagłosuj na najlepszą',
    finaleVoteDone: 'Głos zapisany',
    finaleVoteChange: 'Możesz zmienić głos, dopóki host nie zamknie głosowania.',
    finaleNoSelfVote: 'Finaliści nie głosują.',
    finaleWaiting: 'Czekamy na hosta…',
    finaleResults: 'Wyniki',
    votes: 'głosów',
    winner: 'Zwycięzca',
    imageTooBig: 'Nie udało się przetworzyć obrazu. Spróbuj mniejszego.',
    uploading: 'Przetwarzanie obrazu…',

    semiTitle: 'PÓŁFINAŁ — Odwrotny prompt',
    semiReference: 'Obraz',
    semiYourPrompt: 'Wasza rekonstrukcja promptu',
    semiNotIn: 'Jesteście jury. Przyjrzyjcie się obrazowi — będziecie oceniać rekonstrukcje.',
    semiVoteTitle: 'Który prompt stworzył ten obraz?',
    semiNoSelfVote: 'Półfinaliści nie głosują.',
    semiWaiting: 'Czekamy na hosta…',
    renameTeam: 'Nazwa zespołu',
    renameHint: 'Każdy z zespołu może zmienić nazwę, dopóki nie ruszy pierwsze zadanie.',
    renameSave: 'Zapisz nazwę',
    renameLocked: 'Nazwy są zablokowane po starcie wydarzenia.',
    tagline: 'Heineken + AI',
    screenTeams: 'Zespoły', screenPlayers: 'graczy',
    screenJoin: 'Dołącz na', screenNoEvent: 'Brak trwającego wydarzenia',
    screenPart1: 'Część 1 — rywalizacja zespołów', screenFinalists: 'Finaliści'
  }
};

export let lang = localStorage.getItem('aiarena.lang') || 'en';

export function setLang(next) {
  lang = next === 'pl' ? 'pl' : 'en';
  localStorage.setItem('aiarena.lang', lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new CustomEvent('langchange'));
}

export function t(key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
}

// Pick the current language out of a {en, pl} content object.
export function tr(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.en ?? obj.pl ?? '';
}

export function mountLangToggle(node) {
  if (!node) return;
  const render = () => {
    node.innerHTML = '';
    for (const code of ['en', 'pl']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lang-btn' + (lang === code ? ' is-on' : '');
      b.textContent = code.toUpperCase();
      b.addEventListener('click', () => setLang(code));
      node.appendChild(b);
    }
  };
  render();
  window.addEventListener('langchange', render);
  document.documentElement.lang = lang;
}
