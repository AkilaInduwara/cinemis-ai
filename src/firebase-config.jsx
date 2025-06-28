import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";  // For Firestore database
import { getAuth } from "firebase/auth";  // For Firebase Authentication (if needed)

// Your Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyDVToouiCBUBm0LrDdGLoH4q6rXjDaroFs",
  authDomain: "cinemis-ai.firebaseapp.com",
  projectId: "cinemis-ai",
  storageBucket: "cinemis-ai.firebasestorage.app",
  messagingSenderId: "125091746967",
  appId: "1:125091746967:web:4dd077b5079f5a252985d2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firestore instance
const db = getFirestore(app);

// If you need authentication, initialize Auth
const auth = getAuth(app);

export { db, auth };
