import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    connectFirestoreEmulator // <--- NUEVO
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    GoogleAuthProvider,
    onAuthStateChanged,
    connectAuthEmulator // <--- NUEVO
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. IMPORTAMOS LAS CREDENCIALES (Mantenemos esto igual)
import { firebaseConfig } from './Keys-secret.js';

// 2. INICIALIZACIÓN
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
//
// --- ESTO ES LO NUEVO: CONEXIÓN AL EMULADOR ---
// Si la página se abrió en "localhost" o "127.0.0.1", usamos el emulador.
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    console.log("🛠️ Usando EMULADORES Locales");
    // Conectamos Firestore al puerto 8080 (Defecto)
   connectFirestoreEmulator(db, '127.0.0.1', 8084);
    // Conectamos Auth al puerto 9099 (Defecto)
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
} else {
    console.log("☁️ Usando Firebase PRODUCCIÓN");
}
// ----------------------------------------------

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