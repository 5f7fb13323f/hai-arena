// ANSWER KEYS — read once, by the host, when you press "Seed default tasks".
//
// This file is loaded lazily (a dynamic import inside admin.js), so once the
// tasks are seeded into Firestore you can DELETE js/answers.js from the repo
// and the deployed site carries no answers at all. In Firestore the keys live
// in events/<id>/keys/<taskId>, which firestore.rules make host-readable only.
//
// Nothing else imports this file. If it is missing, every page still works.

export const ANSWERS = {
  't1-turing': {
    answers: { i1: 'ai', i2: 'human', i3: 'ai', i4: 'human', i5: 'ai', i6: 'human' },
    notes: {
      i1: { en: 'AI — "delve", "tapestry", "unprecedented", zero concrete detail.', pl: 'AI — „zagłębić się”, „mozaika”, „bezprecedensowy”, zero konkretów.' },
      i2: { en: 'Human — lowercase, specific day, unresolved and honest about it.', pl: 'Człowiek — małe litery, konkretny dzień, sprawa nierozwiązana i szczerze o tym.' },
      i3: { en: 'AI — marketing triplets and the "not just X, it\'s Y" construction.', pl: 'AI — marketingowe trójki i konstrukcja „to nie tylko X, to Y”.' },
      i4: { en: 'Human — a real, slightly panicked question with a joke in it.', pl: 'Człowiek — prawdziwe, lekko spanikowane pytanie z żartem.' },
      i5: { en: 'AI — semicolon rhythm, "more than a beverage", flawless balance.', pl: 'AI — rytm ze średnikiem, „więcej niż napój”, idealne wyważenie.' },
      i6: { en: 'Human — self-aware, chronological mess, asks for snacks.', pl: 'Człowiek — autoironia, chronologiczny bałagan, prosi o ciastka.' }
    }
  },

  // The four false ones are c2, c4, c6, c8. Read the notes out when you grade —
  // the green-bottle one and the 1516 one reliably get an argument going.
  't2-hallucination': {
    falseIds: ['c2', 'c4', 'c6', 'c8'],
    notes: {
      c1: { en: 'TRUE — 1864, De Hooiberg, Amsterdam.', pl: 'PRAWDA — 1864, De Hooiberg, Amsterdam.' },
      c2: { en: 'FALSE — it is the other way round. Brown glass blocks far more of the light that skunks beer; green bottles spread during WWII when brown glass ran short, and stayed as a premium signature.', pl: 'FAŁSZ — jest odwrotnie. Brązowe szkło blokuje znacznie więcej światła psującego piwo; zielone butelki rozpowszechniły się w czasie II wojny, gdy zabrakło brązowego szkła, i zostały jako znak rozpoznawczy.' },
      c3: { en: 'TRUE — Dr Elion, a Pasteur student, isolated the A-yeast in 1886.', pl: 'PRAWDA — dr Elion, uczeń Pasteura, wyizolował drożdże A w 1886.' },
      c4: { en: 'FALSE — lager ferments COLDER and slower than ale. That long cold fermentation is exactly what gives it the clean taste.', pl: 'FAŁSZ — lager fermentuje ZIMNIEJ i wolniej niż ale. To właśnie długa zimna fermentacja daje czysty smak.' },
      c5: { en: 'TRUE — hops preserved beer long before anyone could explain why.', pl: 'PRAWDA — chmiel konserwował piwo na długo przed wyjaśnieniem dlaczego.' },
      c6: { en: 'FALSE — Guinness belongs to Diageo, not Heineken.', pl: 'FAŁSZ — Guinness należy do Diageo, nie do Heinekena.' },
      c7: { en: 'TRUE — Heineken completed the buyout of Grupa Żywiec in 2022.', pl: 'PRAWDA — Heineken zakończył wykup Grupy Żywiec w 2022 roku.' },
      c8: { en: 'FALSE — the 1516 law listed water, barley and hops. Yeast was not named: nobody knew it existed. Pasteur explained fermentation three centuries later.', pl: 'FAŁSZ — prawo z 1516 wymieniało wodę, jęczmień i chmiel. Drożdży nie wymieniono: nikt nie wiedział, że istnieją. Pasteur wyjaśnił fermentację trzy wieki później.' }
    }
  }
};

// No slot-scoped secrets any more — AI Telephone was replaced by the
// semi-final, where the host simply shows one image to the whole room.
export const SECRETS = {};
