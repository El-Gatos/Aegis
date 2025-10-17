import * as admin from 'firebase-admin';

// IMPORTANT: Make sure the path to your service account key is correct
const serviceAccount = require('../../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('[INFO] Successfully connected to Firestore.');

export { db };