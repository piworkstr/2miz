import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Panelin (tarayıcı) Firebase kurulumu. Ayar boot.ts'de barındırmadan okunur.
const cfg = (globalThis as { __FB?: FirebaseOptions }).__FB as FirebaseOptions;
export const app = getApps().length ? getApp() : initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);
