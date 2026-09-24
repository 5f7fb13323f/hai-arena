#!/usr/bin/env node
/**
 * HAI ARENA — creates the tester accounts for a fresh Firebase project.
 *
 * Creates tester01 … tester30 (auth account + /users document).
 * Safe to run twice: accounts that already exist are left alone.
 *
 *   npm init -y && npm i firebase-admin
 *   # Firebase console -> Project settings -> Service accounts -> Generate new private key
 *   export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
 *   export HAI_TESTER_PASSWORD='…the tester password…'
 *   node tools/bootstrap.mjs
 *
 * Options:
 *   --testers 30        how many tester accounts (default 30)
 *   --domain <domain>   must match LOGIN_EMAIL_DOMAIN in js/firebase-config.js
 *   --dry-run           show what would happen, change nothing
 *
 * HOST ACCOUNTS ARE NOT CREATED HERE, on purpose. Register them through the app
 * like anyone else, then grant the first one host rights by hand in the Firebase
 * console (a document in `admins` whose ID is that user's UID). After that, the
 * host button in the roster promotes the others in one click. Keeping host
 * creation out of any script means no host password ever passes through this
 * repo, which is public behind GitHub Pages.
 */
import admin from 'firebase-admin';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const DRY = process.argv.includes('--dry-run');

const DOMAIN = arg('domain', 'players.ai-arena.local');
const TESTERS = Number(arg('testers', 30));
const TESTER_PASS = process.env.HAI_TESTER_PASSWORD;

const testerName = (n) => `tester${String(n).padStart(2, '0')}`;

if (!DRY && !TESTER_PASS) {
  console.error('Set HAI_TESTER_PASSWORD first. See the header of this file.');
  process.exit(1);
}
if (TESTER_PASS && TESTER_PASS.length < 6) { console.error('Tester password must be 6+ characters.'); process.exit(1); }

// --dry-run needs no credentials at all, so only connect when we mean business.
let auth = null, db = null;
if (!DRY) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  auth = admin.auth();
  db = admin.firestore();
}

const email = (username) => `${username.toLowerCase()}@${DOMAIN}`;

async function ensureAccount(username, password) {
  let user, created = false;

  if (DRY) return { username, uid: '(dry-run)', created: true };

  try {
    user = await auth.getUserByEmail(email(username));
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }

  if (!user) {
    if (DRY) return { username, uid: '(dry-run)', created: true, host };
    user = await auth.createUser({ email: email(username), password, displayName: username });
    created = true;
  }

  if (!DRY) {
    await db.collection('users').doc(user.uid).set({
      username,
      usernameLower: username.toLowerCase(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return { username, uid: user.uid, created };
}

const rows = [];
let failed = 0;

for (let n = 1; n <= TESTERS; n++) {
  const name = testerName(n);
  try { rows.push(await ensureAccount(name, TESTER_PASS)); }
  catch (e) { failed++; console.error(`! ${name}: ${e.message}`); }
}

const made = rows.filter(r => r.created).length;
const kept = rows.length - made;

console.log(`\n${DRY ? '[dry run] ' : ''}HAI ARENA — tester accounts on ${DOMAIN}`);
console.log('─'.repeat(58));
for (const r of rows) {
  console.log(`${r.username.padEnd(10)} ${r.created ? 'created' : 'already existed'}  ${r.uid}`);
}
console.log('─'.repeat(58));
console.log(`${made} created, ${kept} already existed${failed ? `, ${failed} failed` : ''}`);
if (!DRY) {
  console.log(`\nPlayers: ${testerName(1)} … ${testerName(TESTERS)}`);
  console.log('The password is the one you exported; it is not stored in this repo.');
  console.log('Host accounts are not created here — register them in the app, then grant');
  console.log('the first one host rights in the Firebase console (see the README).');
}
process.exit(failed ? 1 : 0);
