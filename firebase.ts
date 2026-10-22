import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB3bON5lFWxskQ7M89mArpuJcRiOEPHujo",
  authDomain: "vitalsign-pro-prod.firebaseapp.com",
  projectId: "vitalsign-pro-prod",
  storageBucket: "vitalsign-pro-prod.firebasestorage.app",
  messagingSenderId: "150266809424",
  appId: "1:150266809424:web:4532ce0f8bbaa4709d5555",
  measurementId: "G-RZC9F3KYPB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);

export const loginWithEmail = (email: string, pass: string) =>
  signInWithEmailAndPassword(auth, email, pass);

export const registerWithEmail = async (
  email: string,
  pass: string,
  displayName?: string
) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName && displayName.trim()) {
    await updateProfile(userCredential.user, { displayName: displayName.trim() });
  }
  return userCredential;
};
