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
      i1: 'AI — "delve", "tapestry", "unprecedented", zero concrete detail.',
      i2: 'Human — lowercase, specific day, unresolved and honest about it.',
      i3: 'AI — marketing triplets and the "not just X, it\'s Y" construction.',
      i4: 'Human — a real, slightly panicked question with a joke in it.',
      i5: 'AI — semicolon rhythm, "more than a beverage", flawless balance.',
      i6: 'Human — self-aware, chronological mess, asks for snacks.'
    }
  },

  // The four false ones are c2, c4, c6, c8. Read the notes out when you grade —
  // the green-bottle one and the 1516 one reliably get an argument going.
  't2-hallucination': {
    falseIds: ['c2', 'c4', 'c6', 'c8'],
    notes: {
      c1: 'TRUE — 1864, De Hooiberg, Amsterdam.',
      c2: 'FALSE — it is the other way round. Brown glass blocks far more of the light that skunks beer; green bottles spread during WWII when brown glass ran short, and stayed as a premium signature.',
      c3: 'TRUE — Dr Elion, a Pasteur student, isolated the A-yeast in 1886.',
      c4: 'FALSE — lager ferments COLDER and slower than ale. That long cold fermentation is exactly what gives it the clean taste.',
      c5: 'TRUE — hops preserved beer long before anyone could explain why.',
      c6: 'FALSE — Guinness belongs to Diageo, not Heineken.',
      c7: 'TRUE — Heineken completed the buyout of Grupa Żywiec in 2022.',
      c8: 'FALSE — the 1516 law listed water, barley and hops. Yeast was not named: nobody knew it existed. Pasteur explained fermentation three centuries later.'
    }
  }
};

// No slot-scoped secrets any more — AI Telephone was replaced by the
// semi-final, where the host simply shows one image to the whole room.
export const SECRETS = {};
