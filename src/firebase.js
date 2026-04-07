import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // TODO: Add your Firebase project configuration here
  apiKey: "DUMMY_KEY_REPLACE_ME",
  authDomain: "guardian-ai-lite.firebaseapp.com",
  projectId: "guardian-ai-lite",
  storageBucket: "guardian-ai-lite.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase initialization failed. Please check setup.", e);
  db = null;
}

export { db };
