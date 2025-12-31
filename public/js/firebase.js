import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. IMPORTAMOS LAS CREDENCIALES DEL ARCHIVO SECRETO
import { firebaseConfig } from './Keys-secret.js';

// 2. Usamos la variable importada
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

console.log("🔥 Firebase conectado (Credenciales protegidas)");

export { db, auth, provider };

"modificamos el archivo y agregamos la auntentificacion de google"