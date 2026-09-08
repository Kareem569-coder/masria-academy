import { initializeApp, getApps, getApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminAuthInstance: any = null;
let adminDbInstance: any = null;
let initialized = false;

function initializeAdminSDK() {
  if (initialized) return;
  
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
  } catch (error) {
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${error}`);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  adminAuthInstance = getAuth();
  adminDbInstance = getFirestore();
  initialized = true;
}

export function ensureAdminSDK() {
  initializeAdminSDK();
}

export function getAdminAuth() {
  initializeAdminSDK();
  return adminAuthInstance;
}

export function getAdminDb() {
  initializeAdminSDK();
  return adminDbInstance;
}
