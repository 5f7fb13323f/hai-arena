// HAI ARENA — default event content.
// Seeded into Firestore by the host panel ("Seed default tasks"), so you can
// also edit the wording in the Firebase console afterwards without redeploying.

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
  { min: '0–5',   en: 'Log in, teams revealed, teams rename themselves' },
  { min: '5–11',  en: 'Task 1 — The Turing Taste Test' },
  { min: '11–18', en: 'Task 2 — Hallucination Hunt' },
  { min: '18–26', en: 'Task 3 — Prompt Golf' },
  { min: '26–35', en: "Task 4 — MacGyver's Inventory" },
  { min: '35–38', en: 'Scores · TOP 5 announced' },
  { min: '38–46', en: 'SEMI-FINAL — Reverse Prompt (5 min), room votes (3 min)' },
  { min: '46–49', en: 'Semi results · TOP 3 to the final' },
  { min: '49–57', en: 'FINAL — Prompt Battle (3 min), room votes (3 min)' },
  { min: '57–60', en: 'Winners, wrap-up' }
];

export const FINALE_THEMES = [
  'A cyberpunk Mona Lisa eating a hotdog in a brewery',
  'A medieval knight losing a duel to a rogue bottling robot',
  'The last beer in the universe — movie poster',
  'A corporate team photo where every colleague is a different farm animal',
  'A vending machine that dispenses ideas — 1950s advertisement',
  'A brewery on Mars at sunrise, painted in oil'
];

// ---------------------------------------------------------------------------
// The semi-final is a stage, not a task: the host uploads one image made with
// Copilot, the TOP 5 teams race to reconstruct the prompt behind it, and
// everyone else votes for the best reconstruction.
// ---------------------------------------------------------------------------
export const SEMI = {
  title: 'SEMI-FINAL — Reverse Prompt',
  intro: 'One image. Five teams. Work out the prompt that produced it, run your guess through an AI, and submit both your prompt and the picture it gave you. The rest of the room votes for whoever got closest.',
  steps: [
    'Look at the image above. Note the subject, the style, the setting, the lighting and the mood.',
    'Write the prompt you think produced it — as you would actually type it into an AI.',
    'Run your prompt in Copilot and download the image it generates.',
    'Paste your prompt below and upload that image.',
    'Voters see your prompt and your picture side by side with the original.'
  ],
  hint: 'Style words carry more weight than object words. "Oil painting, dramatic light" gets you closer than listing everything in the frame.',
  voteHint: 'Which prompt would actually produce that picture?',
  // Ideas for the image you generate beforehand with Copilot. Pick one, keep the
  // prompt to yourself, and reveal it against the winner's guess at the end.
  imageIdeas: [
    'A Victorian gentleman octopus operating a brewery control panel, oil painting, dramatic light',
    'An astronaut sharing a beer with a polar bear on an ice floe, golden hour, photorealistic',
    'A cathedral built entirely from stacked beer kegs, wide angle, morning fog',
    'A 1920s jazz band of robots playing in a brewery cellar, sepia photograph'
  ]
};

// The final — the host picks a theme and reveals it when the timer starts.
export const FINAL = {
  title: 'FINAL — Prompt Battle',
  intro: 'Three teams, one surprise theme, three minutes. Make the best image you can and upload it. The whole room votes.',
  steps: [
    'Read the theme above. It was only revealed just now — nobody had a head start.',
    'Open Copilot and write a prompt for it. Iterate as many times as the clock allows.',
    'Download the image you are proudest of.',
    'Upload it below and paste the prompt you used.',
    'When the host opens voting, your image goes on the big screen for the room to judge.'
  ],
  voterNote: 'You are the jury. The finalists are creating now — get ready to vote for the image that best captures the theme.'
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
    title: 'The Turing Taste Test',
    intro: 'Six snippets. For each one decide: written by a HUMAN, or generated by AI? Watch for the tells — perfectly balanced sentences, "delve", "tapestry", "in today\'s rapidly evolving landscape", three adjectives where one would do. Humans are messier.',
    points: { perItem: 2 },
    options: [
      { id: 'human', label: 'Human' },
      { id: 'ai', label: 'AI' }
    ],
    payload: {
      steps: [
        'Read each snippet with your team.',
        'Tap Human or AI. One tap sets the answer for the whole team.',
        'Change your mind as often as you like until the timer runs out.'
      ],
      items: [
        { id: 'i1', text: 'In today\'s rapidly evolving digital landscape, organisations must delve into the rich tapestry of emerging technologies to unlock unprecedented value and drive meaningful transformation across the enterprise.' },
        { id: 'i2', text: 'ok so the new line software crashed twice before lunch on tuesday, then ran fine the whole rest of the week. nobody touched anything. i don\'t love it but i\'m not going to poke it either' },
        { id: 'i3', text: 'Our solution seamlessly integrates robust, scalable architecture with an intuitive user experience, empowering teams to make data-driven decisions with confidence. It\'s not just a tool — it\'s a partner in your journey.' },
        { id: 'i4', text: 'Hi — quick one. Can someone remind me why we have two asset lists? I found a third one today in a shared drive from 2021. I am choosing to believe it is a backup. Please tell me it is a backup.' },
        { id: 'i5', text: 'Coffee is more than a beverage; it is a ritual, a pause, a quiet conversation with the morning. Whether you prefer a bold espresso or a gentle pour-over, there is a cup out there that is uniquely yours.' },
        { id: 'i6', text: 'Third attempt at this email. Short version: the vendor wants permanent remote access, I said no, they escalated, and now I am the one writing the risk justification. Send help (or snacks).' }
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
    title: 'Hallucination Hunt',
    intro: 'An AI was asked to write a confident piece about beer and about the company you work for. Four of these eight statements are wrong. Tick only the FALSE ones.',
    points: { correct: 3, wrong: -2 },
    payload: {
      steps: [
        'Read all eight statements first — do not tick as you go.',
        'Fact-check the ones you are unsure about. Any tool, any search engine, Copilot included.',
        'Tick ONLY the statements you believe are false.',
        '+3 for each hallucination you catch, −2 for each true statement you wrongly accuse. Guessing costs you.'
      ],
      lead: 'From "Beer, Briefly Explained", generated by an AI assistant:',
      items: [
        { id: 'c1', text: 'Heineken began in 1864, when 22-year-old Gerard Adriaan Heineken bought an existing Amsterdam brewery called De Hooiberg — "The Haystack".' },
        { id: 'c2', text: 'Heineken bottles are green because green glass shields beer from light better than brown glass does.' },
        { id: 'c3', text: 'In 1886 a researcher named Dr Elion, who had studied under Louis Pasteur, isolated the "A-yeast" that Heineken still uses today.' },
        { id: 'c4', text: 'Lager gets its clean, crisp character because it ferments warmer and faster than ale.' },
        { id: 'c5', text: 'Hops were originally added to beer largely as a preservative, centuries before anyone understood the chemistry behind it.' },
        { id: 'c6', text: 'Heineken has owned Guinness since acquiring it in 2005.' },
        { id: 'c7', text: 'In Poland, Heineken owns Grupa Żywiec — the brewer behind Żywiec, Warka and Tatra — and completed a full buyout of it in 2022.' },
        { id: 'c8', text: 'The Bavarian purity law of 1516 named four permitted ingredients: water, barley, hops and yeast.' }
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
    title: 'Prompt Golf',
    intro: 'Like golf, the lowest score wins — here that means the FEWEST CHARACTERS. Your job is to make an AI produce the text described below, using the shortest prompt you can get away with.',
    points: { accepted: 4, rankBonus: [10, 7, 5, 3, 2] },
    payload: {
      steps: [
        'Open Copilot in another tab.',
        'Write a prompt that makes it produce a text matching the target below — all three rules, not two.',
        'Check the output really obeys all three rules. If it does not, you score nothing however short your prompt was.',
        'Now make the prompt shorter and try again. Drop "please", drop full sentences, drop anything the AI does not need.',
        'When you are happy, paste your final prompt and the text it produced into the boxes below.'
      ],
      target: 'Exactly 3 lines · every line starts with the letter B · it is about a brewery at night',
      rules: 'The counter under your prompt shows its length — every character counts, spaces included. Among the entries whose output passes, the shortest prompt scores highest: 4 points for passing, plus 10 / 7 / 5 / 3 / 2 by rank.',
      warning: 'A very short prompt that produces the wrong text scores zero. Correct first, then short.'
    }
  },

  // ---------------------------------------------------------------- Task 4 --
  {
    id: 't4-macgyver',
    order: 4,
    type: 'open',
    minutes: 9,
    title: "MacGyver's Inventory",
    intro: 'Your team has these five things and nothing else. Get an AI to design ONE invention that solves a real, everyday problem in a brewery — using only these items.',
    points: { max: 10 },
    payload: {
      steps: [
        'Pick a real problem a brewery might have. Something small and specific beats something grand.',
        'Ask an AI to design a solution using ONLY the five items listed. Push back if it smuggles in extra parts.',
        'Fill in the invention name, how it works, and the prompt you used.',
        'Finish the description with one sentence naming the part most likely to fail, and why.'
      ],
      items: [
        'An empty 50-litre beer keg',
        'A roll of duct tape',
        'A bicycle',
        'A garden hose',
        'A bathroom scale'
      ],
      scoring: 'The host scores 0–10: does it actually work, does it solve a real problem, and did it make the room laugh?',
      hint: 'THE LAST STEP IS WORTH A POINT ON ITS OWN. Any AI will happily describe a machine that could never work, in a confident tone, and it takes a human to notice. So end with something like "the duct tape seal will fail first, because it is holding back liquid under pressure". Naming the weak point proves you read the answer instead of pasting it.'
    }
  }
];
