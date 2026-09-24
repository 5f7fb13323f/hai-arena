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
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', cred.user.uid), {
          username,
          usernameLower: username.toLowerCase(),
          createdAt: serverTimestamp()
        });
        made.push(username);
      } catch (e) {
        if (e?.code === 'auth/email-already-in-use') existed.push(username);
        else failed.push({ username, why: e?.code || e?.message || 'unknown' });
      }
    }
  } finally {
    await signOut(auth).catch(() => {});
    await deleteApp(app).catch(() => {});
  }
  onProgress?.(usernames.length, usernames.length, '');
  return { made, existed, failed };
}
