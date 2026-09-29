// Delete player logins from Firebase Authentication in bulk.
//
// The host panel can only remove roster rows; deleting a login needs admin
// credentials, which must never live in a static site. This script is the
// other half: run it yourself, by hand, when you want the old accounts gone
// — for example before handing out a new password.
//
// EASIEST WAY TO RUN IT — Google Cloud Shell, no installs on your laptop:
//
//   1. Open https://console.cloud.google.com and pick the same project.
//   2. Click the terminal icon, top right ("Activate Cloud Shell").
//   3. Paste:
//
//        mkdir -p purge && cd purge && npm init -y && npm i firebase-admin
//        nano purge-auth.mjs        # paste this file, Ctrl+O, Enter, Ctrl+X
//        node purge-auth.mjs --project YOUR-PROJECT-ID --keep admin1,admin2,admin3
//
//      It lists what it would delete and stops. Add --yes to actually delete.
//
// Cloud Shell is already signed in as you, so there is no key file to
// download, and nothing sensitive is ever stored in this repo.

import admin from 'firebase-admin';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? (process.argv[i + 1] ?? true) : fallback;
};

const PROJECT = arg('project', process.env.GOOGLE_CLOUD_PROJECT);
const DOMAIN = arg('domain', 'players.ai-arena.local');
const KEEP = String(arg('keep', '')).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const GO = process.argv.includes('--yes');

if (!PROJECT) {
  console.error('Which project? Pass --project YOUR-PROJECT-ID (it is in the Firebase URL).');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
const auth = admin.auth();

const victims = [];
let page;
do {
  const res = await auth.listUsers(1000, page);
  for (const u of res.users) {
    const email = (u.email || '').toLowerCase();
    if (!email.endsWith('@' + DOMAIN)) continue;         // never touch anything else
    const username = email.split('@')[0];
    if (KEEP.includes(username)) continue;               // your host accounts
    victims.push({ uid: u.uid, username });
  }
  page = res.pageToken;
} while (page);

if (!victims.length) {
  console.log('Nothing to delete.');
  process.exit(0);
}

console.log(`${victims.length} login(s) on @${DOMAIN}:`);
console.log('  ' + victims.map(v => v.username).sort().join(', '));
if (KEEP.length) console.log(`Keeping: ${KEEP.join(', ')}`);

if (!GO) {
  console.log('\nDry run — nothing was deleted. Add --yes to go ahead.');
  process.exit(0);
}

let done = 0;
for (let i = 0; i < victims.length; i += 1000) {
  const batch = victims.slice(i, i + 1000);
  const res = await auth.deleteUsers(batch.map(v => v.uid));
  done += res.successCount;
  for (const err of res.errors) console.warn('  failed:', batch[err.index]?.username, err.error.message);
}
console.log(`\n${done} login(s) deleted.`);
console.log('Their roster rows are already gone, or go with "Remove all non-host accounts" in the panel.');
