import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    GoogleAuthProvider,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. IMPORTAMOS LAS CREDENCIALES (Mantenemos esto igual)
import { firebaseConfig } from './Keys-secret.js';

// 2. INICIALIZACIÓN
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

console.log("🔥 Firebase conectado (Full Export)");

// 3. EXPORTAMOS TODO (Esto es lo que le faltaba al turnero)
export { 
    db, 
    auth, 
    provider,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    onAuthStateChanged
};