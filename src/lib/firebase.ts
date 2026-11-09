import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

// Değerler .env dosyasından gelir (bkz. .env.example ve KURULUM.md).
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const firstLoad = getApps().length === 0;
export const app = firstLoad ? initializeApp(firebaseConfig) : getApp();

// Oturum telefonda saklanır; uygulama kapanıp açılınca tekrar giriş istemez.
export const auth: Auth = firstLoad
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

// Bazı Wi-Fi ağları ve operatörler Firestore'un akış bağlantısını (WebChannel) keser; o zaman
// "Could not reach Cloud Firestore backend" uyarısı çıkar. Otomatik uzun yoklama bu ağlarda da bağlanır.
export const db = firstLoad ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }) : getFirestore(app);
