/* Ubicación: public/js/firebase.js
   Función: Configuración central de Firebase.
   NOTA: No agregar lógica de botones ni diseño aquí.
*/

// 1. Importamos las herramientas de Firebase (Usamos la versión 10.7.1 para consistencia)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Credenciales (Las de tu proyecto TOKZ)
const firebaseConfig = {
  apiKey: "AIzaSyDkVou02bXWq2qX0QSF1WMVrJMfsW903rM",
  authDomain: "tokz-barber.firebaseapp.com",
  projectId: "tokz-barber",
  storageBucket: "tokz-barber.firebasestorage.app",
  messagingSenderId: "949051520274",
  appId: "1:949051520274:web:24b6887eeb15627333efcb",
  measurementId: "G-4Q111E9FDQ"
};

// 3. Inicializar
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. Exportar la base de datos para usarla en otros archivos
console.log("🔥 Configuración de Firebase cargada exitosamente.");
export { db };