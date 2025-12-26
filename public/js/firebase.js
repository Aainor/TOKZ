
// 1. Importamos las herramientas desde la nube (CDN)
// IMPORTANTE: Usamos enlaces https:// para que el navegador los entienda
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Tu configuración (Copiada de tu foto)
const firebaseConfig = {
  apiKey: "AIzaSyDkVou02bXWq2qX0QSF1WMVrJMfsW903rM",
  authDomain: "tokz-barber.firebaseapp.com",
  projectId: "tokz-barber",
  storageBucket: "tokz-barber.firebasestorage.app",
  messagingSenderId: "949051520274",
  appId: "1:949051520274:web:24b6887eeb15627333efcb",
  measurementId: "G-4Q111E9FDQ"
};

// 3. Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Iniciamos la base de datos

// 4. Exportamos la "db" para que otros archivos la puedan usar
console.log("🔥 Firebase conectado correctamente");
export { db };