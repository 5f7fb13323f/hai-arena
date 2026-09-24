// HAI ARENA — default event content (EN / PL).
// Everything here is seeded into Firestore by the host panel ("Seed tasks"),
// so you can edit wording in the Firebase console afterwards without redeploying.

export const TEAM_NAMES = [
  'Hop Tokens', 'Malt Vectors', 'Prompt Pilsner', 'Silicon Brewers',
  'Hallucination Hunters', 'Context Window', 'Neural Nets', 'Stochastic Parrots',
  'Cold Fermented', 'Latent Lager', 'Beam Search', 'Zero Shot',
  'Backprop Bandits', 'Temperature 0.9', 'The Embeddings', 'Attention Heads',
  'Fine Tuners', 'Edge Cases', 'Rubber Ducks', 'Greedy Decoders',
  'Barrel Aged Bots', 'Few Shot Heroes', 'Loss Function', 'Chain of Thought'
];

// Suggested run of show for a 60 minute workshop with ~20 teams.
// Four Part 1 tasks plus a semi-final and a final is a full hour with no slack —
// if you want room to breathe, drop one Part 1 task (Prompt Golf is the easiest
// to cut) and give the minutes to the semi-final.
export const RUN_OF_SHOW = [
  { min: '0–5',   en: 'Log in, teams revealed, teams rename themselves', pl: 'Logowanie, ujawnienie zespołów, zmiana nazw' },
  { min: '5–11',  en: 'Task 1 — The Turing Taste Test',        pl: 'Zadanie 1 — Test smaku Turinga' },
  { min: '11–18', en: 'Task 2 — Hallucination Hunt',           pl: 'Zadanie 2 — Polowanie na halucynacje' },
  { min: '18–26', en: 'Task 3 — Prompt Golf',                  pl: 'Zadanie 3 — Prompt Golf' },
  { min: '26–35', en: "Task 4 — MacGyver's Inventory",         pl: 'Zadanie 4 — Magazyn MacGyvera' },
  { min: '35–38', en: 'Scores · TOP 5 announced',              pl: 'Punkty · ogłoszenie TOP 5' },
  { min: '38–46', en: 'SEMI-FINAL — Reverse Prompt (5 min), room votes (3 min)', pl: 'PÓŁFINAŁ — Odwrotny prompt (5 min), głosowanie (3 min)' },
  { min: '46–49', en: 'Semi results · TOP 3 to the final',      pl: 'Wyniki półfinału · TOP 3 do finału' },
  { min: '49–57', en: 'FINAL — Prompt Battle (3 min), room votes (3 min)', pl: 'FINAŁ — Prompt Battle (3 min), głosowanie (3 min)' },
  { min: '57–60', en: 'Winners, wrap-up',                      pl: 'Zwycięzcy, podsumowanie' }
];

export const FINALE_THEMES = [
  { en: 'A cyberpunk Mona Lisa eating a hotdog in a brewery',
    pl: 'Cyberpunkowa Mona Lisa jedząca hot doga w browarze' },
  { en: 'A medieval knight losing a duel to a rogue bottling robot',
    pl: 'Średniowieczny rycerz przegrywający pojedynek ze zbuntowanym robotem rozlewni' },
  { en: 'The last beer in the universe — movie poster',
    pl: 'Ostatnie piwo we wszechświecie — plakat filmowy' },
  { en: 'A corporate team photo where every colleague is a different farm animal',
    pl: 'Firmowe zdjęcie zespołu, gdzie każdy kolega to inne zwierzę hodowlane' },
  { en: 'A vending machine that dispenses ideas — 1950s advertisement',
    pl: 'Automat wydający pomysły — reklama z lat 50.' },
  { en: 'A brewery on Mars at sunrise, painted in oil',
    pl: 'Browar na Marsie o wschodzie słońca, malowany olejem' }
];

// ---------------------------------------------------------------------------
// The semi-final is a stage, not a task: the host uploads one image made with
// Copilot, the TOP 5 teams race to reconstruct the prompt behind it, and
// everyone else votes for the best reconstruction.
// ---------------------------------------------------------------------------
export const SEMI = {
  title: { en: 'SEMI-FINAL — Reverse Prompt', pl: 'PÓŁFINAŁ — Odwrotny prompt' },
  intro: {
    en: 'One image. Five teams. Work out the prompt that produced it and write it exactly as you would type it into an AI. The rest of the room decides whose reconstruction is closest.',
    pl: 'Jeden obraz. Pięć zespołów. Odgadnijcie prompt, który go stworzył, i zapiszcie go dokładnie tak, jak wpisalibyście go do AI. Reszta sali zdecyduje, czyja rekonstrukcja jest najbliższa.'
  },
  hint: {
    en: 'Describe subject, style, setting, lighting and mood — that is usually where the points are.',
    pl: 'Opiszcie temat, styl, scenerię, światło i nastrój — tam zwykle kryją się punkty.'
  },
  voteHint: {
    en: 'Which prompt would actually produce that picture?',
    pl: 'Który prompt naprawdę stworzyłby ten obraz?'
  },
  // Ideas for the image you generate beforehand with Copilot. Pick one, keep the
  // prompt to yourself, and reveal the winner's guess against yours at the end.
  imageIdeas: [
    'A Victorian gentleman octopus operating a brewery control panel, oil painting, dramatic light',
    'An astronaut sharing a beer with a polar bear on an ice floe, golden hour, photorealistic',
    'A cathedral built entirely from stacked beer kegs, wide angle, morning fog',
    'A 1920s jazz band of robots playing in a brewery cellar, sepia photograph'
  ]
};

// ---------------------------------------------------------------------------
// Part 1 tasks. status: 'locked' until the host opens them.
// type: quiz-single | quiz-multi | golf | open
// ---------------------------------------------------------------------------

export const TASKS = [
  // ---------------------------------------------------------------- Task 1 --
  {
    id: 't1-turing',
    order: 1,
    type: 'quiz-single',
    minutes: 5,
    title: { en: 'The Turing Taste Test', pl: 'Test smaku Turinga' },
    intro: {
      en: 'Six snippets. For each one decide: written by a HUMAN, or generated by AI? Watch for the tells — perfectly balanced sentences, "delve", "tapestry", "in today\'s rapidly evolving landscape", three adjectives where one would do. Humans are messier.',
      pl: 'Sześć fragmentów. Przy każdym zdecydujcie: napisał to CZŁOWIEK czy wygenerowała AI? Szukajcie tropów — idealnie wyważone zdania, „zagłębmy się”, „w dzisiejszym dynamicznie zmieniającym się świecie”, trzy przymiotniki tam, gdzie wystarczy jeden. Ludzie piszą bardziej chaotycznie.'
    },
    points: { perItem: 2 },
    options: [
      { id: 'human', label: { en: 'Human', pl: 'Człowiek' } },
      { id: 'ai', label: { en: 'AI', pl: 'AI' } }
    ],
    payload: {
      items: [
        { id: 'i1', text: {
          en: 'In today\'s rapidly evolving digital landscape, organisations must delve into the rich tapestry of emerging technologies to unlock unprecedented value and drive meaningful transformation across the enterprise.',
          pl: 'W dzisiejszym dynamicznie zmieniającym się krajobrazie cyfrowym organizacje muszą zagłębić się w bogatą mozaikę nowych technologii, aby odblokować bezprecedensową wartość i napędzić znaczącą transformację całego przedsiębiorstwa.' } },
        { id: 'i2', text: {
          en: 'ok so the new line software crashed twice before lunch on tuesday, then ran fine the whole rest of the week. nobody touched anything. i don\'t love it but i\'m not going to poke it either',
          pl: 'no więc nowy soft na linii wywalił się dwa razy przed obiadem we wtorek, a potem chodził bez problemu do końca tygodnia. nikt nic nie ruszał. nie podoba mi się to, ale ruszać też nie zamierzam' } },
        { id: 'i3', text: {
          en: 'Our solution seamlessly integrates robust, scalable architecture with an intuitive user experience, empowering teams to make data-driven decisions with confidence. It\'s not just a tool — it\'s a partner in your journey.',
          pl: 'Nasze rozwiązanie płynnie łączy solidną, skalowalną architekturę z intuicyjnym doświadczeniem użytkownika, umożliwiając zespołom podejmowanie decyzji opartych na danych. To nie tylko narzędzie — to partner w Twojej podróży.' } },
        { id: 'i4', text: {
          en: 'Hi — quick one. Can someone remind me why we have two asset lists? I found a third one today in a shared drive from 2021. I am choosing to believe it is a backup. Please tell me it is a backup.',
          pl: 'Cześć — szybkie pytanie. Może mi ktoś przypomnieć, czemu mamy dwie listy assetów? Dziś znalazłem trzecią, na dysku współdzielonym z 2021. Postanowiłem wierzyć, że to backup. Powiedzcie, że to backup.' } },
        { id: 'i5', text: {
          en: 'Coffee is more than a beverage; it is a ritual, a pause, a quiet conversation with the morning. Whether you prefer a bold espresso or a gentle pour-over, there is a cup out there that is uniquely yours.',
          pl: 'Kawa to więcej niż napój; to rytuał, pauza, cicha rozmowa z porankiem. Niezależnie od tego, czy wolisz mocne espresso, czy delikatny przelew, gdzieś czeka filiżanka wyjątkowo Twoja.' } },
        { id: 'i6', text: {
          en: 'Third attempt at this email. Short version: the vendor wants permanent remote access, I said no, they escalated, and now I am the one writing the risk justification. Send help (or snacks).',
          pl: 'Trzecie podejście do tego maila. W skrócie: dostawca chce stałego zdalnego dostępu, powiedziałem nie, poszli wyżej i teraz to ja piszę uzasadnienie ryzyka. Ratunku (albo przynieście ciastka).' } }
      ]
    }
    // answer key lives in js/answers.js
  },

  // ---------------------------------------------------------------- Task 2 --
  {
    id: 't2-hallucination',
    order: 2,
    type: 'quiz-multi',
    minutes: 7,
    title: { en: 'Hallucination Hunt', pl: 'Polowanie na halucynacje' },
    intro: {
      en: 'An AI was asked to write a confident piece about beer and about the company you work for. Four of these eight statements are wrong. Tick only the FALSE ones. +3 for each hallucination you catch, −2 for each true statement you wrongly accuse. Fact-check with any tool you like — that is the whole point.',
      pl: 'AI poproszono o pewny siebie tekst o piwie i o firmie, w której pracujecie. Cztery z ośmiu zdań są błędne. Zaznaczcie tylko FAŁSZYWE. +3 za każdą złapaną halucynację, −2 za każde prawdziwe zdanie oskarżone niesłusznie. Sprawdzajcie fakty dowolnym narzędziem — o to właśnie chodzi.'
    },
    points: { correct: 3, wrong: -2 },
    payload: {
      lead: {
        en: 'From "Beer, Briefly Explained", generated by an AI assistant:',
        pl: 'Z „Piwo w skrócie”, wygenerowanego przez asystenta AI:'
      },
      items: [
        { id: 'c1', text: {
          en: 'Heineken began in 1864, when 22-year-old Gerard Adriaan Heineken bought an existing Amsterdam brewery called De Hooiberg — "The Haystack".',
          pl: 'Heineken zaczął się w 1864 roku, gdy 22-letni Gerard Adriaan Heineken kupił istniejący amsterdamski browar De Hooiberg — „Stóg siana”.' } },
        { id: 'c2', text: {
          en: 'Heineken bottles are green because green glass shields beer from light better than brown glass does.',
          pl: 'Butelki Heinekena są zielone, ponieważ zielone szkło chroni piwo przed światłem lepiej niż brązowe.' } },
        { id: 'c3', text: {
          en: 'In 1886 a researcher named Dr Elion, who had studied under Louis Pasteur, isolated the "A-yeast" that Heineken still uses today.',
          pl: 'W 1886 roku badacz dr Elion, uczeń Ludwika Pasteura, wyizolował „drożdże A”, których Heineken używa do dziś.' } },
        { id: 'c4', text: {
          en: 'Lager gets its clean, crisp character because it ferments warmer and faster than ale.',
          pl: 'Lager zawdzięcza swój czysty, rześki charakter temu, że fermentuje cieplej i szybciej niż ale.' } },
        { id: 'c5', text: {
          en: 'Hops were originally added to beer largely as a preservative, centuries before anyone understood the chemistry behind it.',
          pl: 'Chmiel dodawano do piwa pierwotnie głównie jako konserwant — wieki przed tym, jak ktokolwiek zrozumiał stojącą za tym chemię.' } },
        { id: 'c6', text: {
          en: 'Heineken has owned Guinness since acquiring it in 2005.',
          pl: 'Heineken jest właścicielem Guinnessa, przejętego w 2005 roku.' } },
        { id: 'c7', text: {
          en: 'In Poland, Heineken owns Grupa Żywiec — the brewer behind Żywiec, Warka and Tatra — and completed a full buyout of it in 2022.',
          pl: 'W Polsce Heineken jest właścicielem Grupy Żywiec — browaru stojącego za markami Żywiec, Warka i Tatra — a pełne wykupienie zakończył w 2022 roku.' } },
        { id: 'c8', text: {
          en: 'The Bavarian purity law of 1516 named four permitted ingredients: water, barley, hops and yeast.',
          pl: 'Bawarskie prawo czystości z 1516 roku wymieniało cztery dozwolone składniki: wodę, jęczmień, chmiel i drożdże.' } }
      ]
    }
    // answer key lives in js/answers.js
  },

  // ---------------------------------------------------------------- Task 3 --
  {
    id: 't3-golf',
    order: 3,
    type: 'golf',
    minutes: 8,
    title: { en: 'Prompt Golf', pl: 'Prompt Golf' },
    intro: {
      en: 'Lowest score wins. Get any AI assistant to produce a text that meets ALL THREE rules below, using the shortest prompt you can. Paste in your prompt and what the AI gave back. The host checks that the output really obeys the rules; among the entries that pass, the shortest prompt takes the most points.',
      pl: 'Wygrywa najkrótszy. Zmuście dowolnego asystenta AI, żeby wyprodukował tekst spełniający WSZYSTKIE TRZY zasady poniżej — najkrótszym promptem, jaki potraficie. Wklejcie prompt i to, co odpowiedziała AI. Host sprawdza, czy wynik naprawdę spełnia zasady; wśród zaakceptowanych najkrótszy prompt dostaje najwięcej punktów.'
    },
    points: { accepted: 4, rankBonus: [10, 7, 5, 3, 2] },
    payload: {
      target: {
        en: 'Exactly 3 lines · every line starts with the letter B · it is about a brewery at night',
        pl: 'Dokładnie 3 linijki · każda linijka zaczyna się na literę B · rzecz dzieje się w browarze nocą'
      },
      rules: {
        en: 'Characters count, spaces included — the app measures your prompt for you. A short prompt that produces the wrong text scores nothing, so check the output before you stop.',
        pl: 'Liczą się znaki, ze spacjami — aplikacja mierzy prompt za was. Krótki prompt, który daje zły tekst, nie dostaje nic, więc sprawdźcie wynik, zanim skończycie.'
      }
    }
  },

  // ---------------------------------------------------------------- Task 4 --
  {
    id: 't4-macgyver',
    order: 4,
    type: 'open',
    minutes: 9,
    title: { en: "MacGyver's Inventory", pl: 'Magazyn MacGyvera' },
    intro: {
      en: 'Your team has these five things and nothing else. Get an AI to design ONE invention that solves a real, everyday problem in a brewery — using only these items. Send us the name, how it works, and the prompt you used.',
      pl: 'Wasz zespół ma te pięć rzeczy i nic więcej. Namówcie AI, żeby zaprojektowała JEDEN wynalazek rozwiązujący prawdziwy, codzienny problem w browarze — używając wyłącznie tych przedmiotów. Przyślijcie nazwę, zasadę działania i użyty prompt.'
    },
    points: { max: 10 },
    payload: {
      items: {
        en: ['An empty 50-litre beer keg', 'A roll of duct tape', 'A bicycle', 'A garden hose', 'A bathroom scale'],
        pl: ['Pusty keg 50 l', 'Rolka taśmy klejącej', 'Rower', 'Wąż ogrodowy', 'Waga łazienkowa']
      },
      scoring: {
        en: 'The host scores 0–10: does it actually work, does it solve a real problem, and did it make the room laugh?',
        pl: 'Host ocenia 0–10: czy to naprawdę zadziała, czy rozwiązuje prawdziwy problem i czy rozbawiło salę?'
      },
      hint: {
        en: 'Worth an extra point: finish with one line on what would break first, and why. Confident nonsense is easy — AI is very good at it. Spotting the weak point is the hard part.',
        pl: 'Dodatkowy punkt: zakończcie jednym zdaniem o tym, co zepsuje się pierwsze i dlaczego. Pewna siebie bzdura jest łatwa — AI jest w tym świetna. Trudniej wskazać słaby punkt.'
      }
    }
  }
];
