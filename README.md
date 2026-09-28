# HAI ARENA

**H + AI** — an AI team competition for a 1-hour workshop, built for 80–100 people in teams
of 5. Static frontend on GitHub Pages, Firebase Auth + Firestore behind it, no server and no
paid plan.

Three pages:

| Page | Who opens it | What it does |
|---|---|---|
| `index.html` | every participant, on their phone | log in, name their team, answer tasks, vote |
| `admin.html` | you, the host | build teams, open/close tasks, score, run both voted rounds |
| `screen.html` | the laptop driving the projector | leaderboard, timer, semi-final image, finale, winner |

English throughout.

---

## 0. Accounts

| Login | Role | How it is created |
|---|---|---|
| `admin1`, `admin2`, `admin3` | hosts — can open `admin.html` and run the event | registered in the app, then granted host rights (§4) |
| `tester01` … `tester30` | players | [`tools/bootstrap.mjs`](tools/bootstrap.mjs), or the panel's **Accounts** card |

**No password is ever stored in this repo.** The repo behind GitHub Pages is public, and
anyone who can read a host password can take over the panel mid-event. The tester script
reads its password from an environment variable at the moment you run it, and host accounts
are never touched by any script — you type those passwords into the app yourself.

## 1. Firebase setup (once, ~10 minutes)

1. **Create a project** at <https://console.firebase.google.com>. The free **Spark** plan is
   enough — this app never uses Cloud Functions or Storage.
2. **Authentication → Sign-in method → Email/Password → Enable.**
   Players never type an e-mail: the app turns `adrian` into
   `adrian@players.ai-arena.local` behind the scenes. **Do not change
   `LOGIN_EMAIL_DOMAIN` once anyone has registered** — existing accounts are stored against
   that domain and would stop working.
3. **Firestore Database → Create database** → production mode, region `eur3` (Europe).
4. **Firestore → Rules** → paste the whole of [`firestore.rules`](firestore.rules) → **Publish**.
   Re-paste after any update to this project; the rules changed when the semi-final was added.
5. **Project settings → General → Your apps → Web app (`</>`)** → register an app → copy the
   config into [`js/firebase-config.js`](js/firebase-config.js).
6. **Authentication → Settings → Authorized domains** → add `<your-username>.github.io`.

## 2. Deploy to GitHub Pages

Push this folder's contents to a **public** repo, then **Settings → Pages → Deploy from a
branch → `main` / root**. Your app is at `https://<you>.github.io/<repo>/`.

## 3. Create the tester accounts

**Firebase console → Project settings → Service accounts → Generate new private key**, save
the JSON next to the project, then:

```bash
npm init -y && npm i firebase-admin
export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
export HAI_TESTER_PASSWORD='…the tester password…'
node tools/bootstrap.mjs
```

It prints what it created with each UID. **Safe to run twice** — existing accounts are left
alone — so you can re-run it later with `--testers 45`. `--dry-run` shows the plan without
credentials.

Delete `service-account.json` afterwards and never commit it: that key is full admin access
to the project.

No Node? Skip this: once you have a host account (§4), the panel's **Accounts** card creates
the same testers from the browser.

## 4. Create the host accounts

Hosts are made by hand, so no host password ever goes near a script or the repo.

1. Open the app and **register `admin1`**, then `admin2` and `admin3`, with the password you
   have chosen for hosts. At this point they are ordinary players.
2. **Firebase console → Authentication → Users** → find `admin1@players.ai-arena.local` →
   copy its **User UID**.
3. **Firestore Database → Data → Start collection** → collection ID `admins` → document ID =
   that UID → add a field, e.g. `role` (string) = `host` → Save.
4. Log in as `admin1` and open `admin.html`. The panel appears.
5. In the roster, click **host** next to `admin2` and `admin3`. Done — no more UID copying.

If the panel says "Not a host", it prints the UID it is actually using; compare it with what
you pasted. A truncated copy is the usual cause.

## 5. Before the workshop

- Open `admin.html` → **New event** → **Seed default tasks**.
- **Then delete `js/answers.js` from the repo.** It is the only file holding the answer keys,
  it is loaded only by that seed button, and after seeding the keys live in Firestore where
  the rules keep them host-only. Everything still works without it.
- **Generate the semi-final image.** Ask Copilot for one striking, weird picture and **keep
  the prompt to yourself** — the teams will try to reconstruct it. `js/content.js` has four
  ideas under `SEMI.imageIdeas`. Upload it in the host panel's Semi-final card.
- Open `screen.html` on the projector laptop, signed in as your **host** account — a player
  account renders everything except the live vote counts.
- Dry-run once with two phones.

## 6. Running the hour

| Min | What happens |
|---|---|
| 0–5 | People log in. **Add everyone** → team size 5 → **Shuffle into teams** (they become Team 1, Team 2 …). Then **Open preparation** so teams can rename themselves, and **Close preparation** when you are ready to start. |
| 5–11 | **The Turing Taste Test** — 6 snippets, human or AI. Auto-scored. |
| 11–18 | **Hallucination Hunt** — 8 confident claims about beer and about Heineken, 4 false. Auto-scored, −2 for a wrong accusation. |
| 18–26 | **Prompt Golf** — shortest prompt that hits the target. You accept the valid ones; the app ranks by length. |
| 26–35 | **MacGyver's Inventory** — 5 ordinary objects, design an invention with AI. You score 0–10. |
| 35–38 | **Pick TOP 5** → semi-finalists on the screen. |
| 38–46 | **Semi-final — Reverse Prompt.** Reveal your image, **Start** (5 min). The five teams reconstruct the prompt. Then **Open voting**: everyone else picks the best reconstruction. |
| 46–49 | **Results** → read your real prompt out against the winner's. **Apply semi points**, then **Send top 3 to the final**. |
| 49–57 | **Final — Prompt Battle.** Pick a theme, **Start creating** (3 min), finalists upload their image. **Open voting**. |
| 57–60 | **Show results** → **Apply final points** → **End event & show winners**: every phone shows its team's final placing, the big screen shows the podium. |

Four Part 1 tasks plus two voted rounds is a full hour with no slack. If you want room to
breathe, drop **Prompt Golf** and give those minutes to the semi-final.

After each task: **Close** → **Review** → (accept / score where needed) → **Grade & publish**.
Points only move when you press that button, plus the **Bonus** column and the two
apply-points buttons. Grading twice is safe — totals are recomputed from scratch, never added.

## 7. The tasks

All content lives in [`js/content.js`](js/content.js) and is copied into Firestore when you
seed, so you can also edit it in the Firebase console up to the last minute. Every task and
both voted rounds carry a numbered `steps` list, which the app shows to players as a
"How to play" box — keep those updated if you change a task.

**Scoring is elastic.** Every task is worth one point per person in the event — 50 people means
a perfect answer is worth 50, split across that task's questions. The ceiling is stamped onto
the task when you open it, so late arrivals never change what an earlier round was worth.

| Task | Type | Scoring |
|---|---|---|
| The Turing Taste Test | `quiz-single` | max ÷ 6 per correct answer |
| Hallucination Hunt | `quiz-multi` | max ÷ 4 per catch, minus two-thirds of that per false accusation, floored at 0 |
| Prompt Golf | `golf` | 25% of max for a valid entry, the rest down the length ladder, **host can override** |
| MacGyver's Inventory | `open` | host scores 0–10, stretched to max |
| Round 5 — Reverse Prompt | voted round | one vote, one point |
| Final — Prompt Battle | voted round | one vote, one point |

Both voted rounds are open to **every team**, and everyone votes for any team except their
own — so their ceiling lands near the headcount too.

**Hallucination Hunt** is deliberately non-technical: the four false claims are the green-glass
myth, lager fermenting warm, Heineken owning Guinness, and yeast being named in the 1516 purity
law. The true ones — De Hooiberg in 1864, Dr Elion's A-yeast, hops as a preservative, Grupa
Żywiec — all survive fact-checking, which is what teams will do. The notes in `js/answers.js`
give you the one-line explanation for each; read them out while you grade.

**Prompt Golf** — the app counts characters and ranks accepted entries automatically. If a team
wrote the shortest prompt but the output did not obey the three rules, leave it **not accepted**
and it scores zero. The number box next to each entry overrides the computed score entirely, so
you can also give a near-miss something rather than nothing.

Participants use whatever AI they already have — Copilot on their work laptops. The app never
calls a model, which is why there is no API key anywhere and no bill at the end.

## 8. How teams answer

Each team shares **one answer sheet** per task — all five members edit the same document live.
Whoever taps an option sets it for the team; a second person tapping something else overwrites
the first. Merging is per-field, so two people filling in different boxes both survive, but two
people typing in the *same* box will lose one version. Tell each team to nominate one driver.

**Team names.** Teams are created as Team 1, Team 2, … Any member can rename their own team,
but only while the host has **preparation** open — enforced by the rules, not just hidden in
the UI. The big screen prompts them during that step.

**Late arrivals.** With **Auto-join late arrivals** ticked (on by default), anyone who registers
after the shuffle is added to the event and dropped into the smallest team automatically. This
runs from the host panel, so it only works while that page is open — which it will be.

## 9. Notes

- **Images** are downscaled in the browser to ~1100 px JPEG and stored as a data URL inside the
  Firestore document. No Firebase Storage, no Blaze plan.
- **Free-tier headroom**: the Spark plan allows 50,000 Firestore reads a day. A full session
  with 80 players works out around 20,000, so one event plus a rehearsal fits. Each extra
  **Shuffle into teams** costs roughly 3,000 reads, so shuffle once and leave it. Players
  listen only to their own team's roster, not the whole room — that single decision is worth
  about 18,000 reads per session at this size. If you want no risk at all, switch the project
  to Blaze with a budget alert: the overage price is about $0.06 per 100,000 reads, so a
  session costs pennies even if you blow past the free tier.
- **Semi-final fairness**: while teams are writing their reconstruction, the rules stop a team
  reading anyone else's entry. Everything opens up when you start voting, and voters then see
  each team's generated picture next to its prompt.
- **Ending**: "End event & show winners" closes any open task, stops auto-join and switches
  every screen to the results. "Reopen the event" undoes it.
- **The big screen** always shows which task is open, how many teams have answered and the
  time left, and ticks each team on the leaderboard as it saves. For MacGyver's Inventory,
  **Show answers on big screen** in the Review panel puts every invention up to be read.
- **Host accounts are powerful**: a host can grade, reshuffle teams and promote other hosts.
  Treat `admin1`'s password like an admin password, not a demo one.
- **Branding**: the HAI mark here — an H with the AI lit up inside it — is original work for
  this app, not an official asset. Colours are a generic brewery green. If you want the real
  brand assets, drop them in yourself and check with whoever owns the brand guidelines.

## 10. Files

```
index.html  admin.html  screen.html
css/style.css
js/  firebase-config.js   ← your Firebase keys go here
     firebase.js  auth.js  i18n.js  util.js
     content.js           ← all task text and instructions
     answers.js           ← answer keys; DELETE after seeding
     scoring.js           ← pure scoring functions
     bulk.js              ← creates accounts without signing the host out
     app.js  admin.js  screen.js
firestore.rules           ← paste into the Firebase console
tools/bootstrap.mjs       ← creates the tester accounts
```
