import {
  auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp
} from './firebase.js';
import { LOGIN_EMAIL_DOMAIN } from './firebase-config.js';
import { t } from './i18n.js';
import { esc } from './util.js';

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,30}$/;

export const emailFor = (username) => `${username.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
export const watchAuth = (cb) => onAuthStateChanged(auth, cb);
export const logout = () => signOut(auth);

export async function isAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch { return false; }
}

export async function getUserDoc(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch { return null; }
}

/**
 * Renders the login / register card into `container`.
 * Calls onDone(user) once the user is signed in.
 */
export function renderAuth(container, { onDone } = {}) {
  let mode = 'login';

  const paint = () => {
    const reg = mode === 'register';
    container.innerHTML = `
      <div class="card">
        <h2>${reg ? esc(t('register')) : esc(t('login'))}</h2>
        <form id="authForm" class="stack" autocomplete="on" novalidate>
          <label class="field">
            <span>${esc(t('username'))}</span>
            <input id="au" type="text" autocapitalize="none" autocorrect="off"
                   spellcheck="false" autocomplete="username" required>
          </label>
          ${reg ? `<p class="faint" style="margin:6px 0 0">${esc(t('pickUsername'))}</p>` : ''}
          <label class="field">
            <span>${esc(t('password'))}</span>
            <input id="ap" type="password"
                   autocomplete="${reg ? 'new-password' : 'current-password'}" required>
          </label>
          ${reg ? `
          <label class="field">
            <span>${esc(t('password2'))}</span>
            <input id="ap2" type="password" autocomplete="new-password" required>
          </label>` : ''}
          <p id="aerr" class="faint" style="color:var(--red);min-height:1em;margin:4px 0 0"></p>
          <button class="btn btn--wide" id="asubmit" type="submit">
            ${reg ? esc(t('register')) : esc(t('login'))}
          </button>
        </form>
        <p class="center" style="margin:14px 0 0">
          <button class="btn btn--ghost btn--sm" id="atoggle" type="button">
            ${reg ? esc(t('haveAccount')) : esc(t('needAccount'))}
          </button>
        </p>
      </div>`;

    const form = container.querySelector('#authForm');
    const err = container.querySelector('#aerr');
    const btn = container.querySelector('#asubmit');

    container.querySelector('#atoggle').addEventListener('click', () => {
      mode = reg ? 'login' : 'register';
      paint();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const username = container.querySelector('#au').value.trim();
      const pass = container.querySelector('#ap').value;

      if (!USERNAME_RE.test(username)) { err.textContent = t('errUser'); return; }
      if (pass.length < 6) { err.textContent = t('errShort'); return; }
      if (reg && pass !== container.querySelector('#ap2').value) {
        err.textContent = t('errMatch'); return;
      }

      btn.disabled = true;
      btn.textContent = t('loggingIn');
      try {
        let cred;
        if (reg) {
          cred = await createUserWithEmailAndPassword(auth, emailFor(username), pass);
          await setDoc(doc(db, 'users', cred.user.uid), {
            username,
            usernameLower: username.toLowerCase(),
            createdAt: serverTimestamp()
          });
        } else {
          cred = await signInWithEmailAndPassword(auth, emailFor(username), pass);
        }
        onDone?.(cred.user);
      } catch (ex) {
        err.textContent = authMessage(ex);
        btn.disabled = false;
        btn.textContent = reg ? t('register') : t('login');
      }
    });
  };

  paint();
}

function authMessage(ex) {
  const code = ex?.code || '';
  if (code === 'auth/email-already-in-use') return t('errTaken');
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return t('errBadLogin');
  if (code === 'auth/user-not-found') return t('errNoUser');
  if (code === 'auth/weak-password') return t('errShort');
  if (code === 'auth/too-many-requests') return 'Too many attempts — wait a moment.';
  if (code === 'auth/operation-not-allowed') return 'Enable Email/Password sign-in in the Firebase console.';
  if (code === 'auth/network-request-failed') return 'Network problem — check the connection.';
  return ex?.message || 'Something went wrong.';
}
