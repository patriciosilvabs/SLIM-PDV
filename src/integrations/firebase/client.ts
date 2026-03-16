import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1";
let analyticsPromise: Promise<Analytics | null> | null = null;

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);
export const realtimeDatabase = getDatabase(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, functionsRegion);

export function getFirebaseAnalyticsInstance(): Promise<Analytics | null> {
  if (!analyticsPromise) {
    analyticsPromise =
      typeof window === "undefined"
        ? Promise.resolve(null)
        : isSupported()
            .then((supported) => (supported ? getAnalytics(app) : null))
            .catch(() => null);
  }

  return analyticsPromise;
}

void getFirebaseAnalyticsInstance();

export function getFirebaseFunctionsBaseUrl(): string {
  const explicitBaseUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_BASE_URL;
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, "");
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  return `https://${functionsRegion}-${projectId}.cloudfunctions.net`;
}

export function getFirebaseFunctionUrl(functionName: string): string {
  const normalizedFunctionName = functionName.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  return `${getFirebaseFunctionsBaseUrl()}/${normalizedFunctionName}`;
}
