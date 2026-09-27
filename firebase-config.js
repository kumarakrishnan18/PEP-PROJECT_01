import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAnalytics,
  isSupported,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  addDoc,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUZYDiRHKJPf-hAQuRKm4wCjml7h7vda0",
  authDomain: "mern-e367f.firebaseapp.com",
  projectId: "mern-e367f",
  storageBucket: "mern-e367f.firebasestorage.app",
  messagingSenderId: "356711634055",
  appId: "1:356711634055:web:def232770fabfbcca41422",
  measurementId: "G-7QPYHT9YVF",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export let analytics = null;

export {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  onSnapshot,
  query,
  ref,
  serverTimestamp,
  setDoc,
  updateDoc,
  uploadBytes,
  getDownloadURL,
  increment,
  where,
};

isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(() => {
  // Analytics is optional and may be unavailable in local or restricted browsers.
});
