import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA2afMg2p_8RNPkOdnyuv86t8DJqup5oUo",
  authDomain: "is216-821c0.firebaseapp.com",
  projectId: "is216-821c0",
  storageBucket: "is216-821c0.firebasestorage.app",
  messagingSenderId: "566876046099",
  appId: "1:566876046099:web:d1b2d222cad1774a7f10e6",
  measurementId: "G-VPJCPYW094",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
