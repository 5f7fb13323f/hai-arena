// Create many accounts from the host panel without losing your own session.
//
// Firebase signs you in as each account you create, which would kick the host
// out. So this runs on a SECOND, throwaway Firebase app instance: the sign-ins
// happen over there, the host's own session on the main instance is untouched.
// Each user document is written by that new user itself, which is exactly what
// the security rules allow.

import {
  initializeApp, deleteApp, getAuth, getFirestore,
  createUserWithEmailAndPassword, signOut, doc, setDoc, serverTimestamp
} from './firebase.js';
import { firebaseConfig, LOGIN_EMAIL_DOMAIN } from './firebase-config.js';

export const testerNames = (count, prefix = 'tester') =>
  Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);

// Firebase can leave a call hanging instead of failing: a throttled sign-up, a
// Firestore write that never gets its server ack. One stuck account used to
// freeze the whole run with no way out but a reload, so every step now has a
// deadline and a bad account is recorded and stepped over.
const STEP_MS = 15000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(label), { code: 'timeout/' + label })), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

/**
 * @param {string[]} usernames
 * @param {string} password        the same password for all of them
 * @param {(done:number,total:number,label:string)=>void} [onProgress]
 * @returns {Promise<{made:string[], existed:string[], failed:{username:string,why:string}[]}>}
 */
export async function createAccounts(usernames, password, onProgress) {
  const app = initializeApp(firebaseConfig, 'bulk-' + Date.now());
  const auth = getAuth(app);
  const db = getFirestore(app);

  const made = [], existed = [], failed = [];
  try {
    for (const [i, username] of usernames.entries()) {
      onProgress?.(i, usernames.length, username);
      const email = `${username.toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
      try {
        const cred = await withTimeout(
          createUserWithEmailAndPassword(auth, email, password), STEP_MS, 'sign-up');
        try {
          await withTimeout(setDoc(doc(db, 'users', cred.user.uid), {
            username,
            usernameLower: username.toLowerCase(),
            createdAt: serverTimestamp()
          }), STEP_MS, 'profile');
          made.push(username);
        } catch (e) {
          // The login exists, only its roster row is missing. It heals itself
          // the first time that person signs in, so this is not a failure.
          made.push(username);
          console.warn('HAI ARENA — profile row deferred for', username, e?.code || e);
        }
      } catch (e) {
        if (e?.code === 'auth/email-already-in-use') existed.push(username);
        else failed.push({ username, why: e?.code || e?.message || 'unknown' });
      }
      // A breath between sign-ups: 30 in a burst from one address is what
      // trips Firebase's abuse protection in the first place.
      await sleep(120);
    }
  } finally {
    // These can hang on a half-finished write too, and by now the accounts
    // that matter are made — never let the cleanup hold the panel.
    await withTimeout(signOut(auth), 4000, 'sign-out').catch(() => {});
    await withTimeout(deleteApp(app), 4000, 'close').catch(() => {});
  }
  onProgress?.(usernames.length, usernames.length, '');
  return { made, existed, failed };
}
