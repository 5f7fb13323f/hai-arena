// 1) Firebase console -> Project settings -> General -> Your apps -> Web app -> SDK setup (Config)
// 2) Paste the values below and commit.
// These web keys are not secrets — access is controlled by firestore.rules.

export const firebaseConfig = {
  apiKey: "AIzaSyANB8aE54TITdAmF2o-08YkT7xZ7OcyxYA",
  authDomain: "hai-arena.firebaseapp.com",
  projectId: "hai-arena",
  storageBucket: "hai-arena.firebasestorage.app",
  messagingSenderId: "502130541745",
  appId: "1:502130541745:web:b473795f7555272ebf4e90"
};

// Usernames are turned into login e-mails behind the scenes.
// Nobody needs a real mailbox — this domain never receives mail.
// DO NOT change this after anyone has registered: existing accounts are stored
// against this domain and would stop being able to log in.
export const LOGIN_EMAIL_DOMAIN = "players.ai-arena.local";

export const APP_TITLE = "HAI ARENA";
