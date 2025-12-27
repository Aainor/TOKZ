import { db } from './firebase.js';
// 1. IMPORTAMOS LAS LIBRERÍAS (Aquí agregué la de Firestore)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
      // ESTA ES LA LÍNEA NUEVA IMPORTANTE PARA LA BASE DE DATOS:
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

      // 2. TU CONFIGURACIÓN (La que me pasaste)
const firebaseConfig = {
        apiKey: "AIzaSyDkVou02bXWq2qX0QSF1WMVrJMfsW903rM",
        authDomain: "tokz-barber.firebaseapp.com",
        projectId: "tokz-barber",
        storageBucket: "tokz-barber.firebasestorage.app",
        messagingSenderId: "949051520274",
        appId: "1:949051520274:web:24b6887eeb15627333efcb",
        measurementId: "G-4Q111E9FDQ"
      };

      // 3. INICIALIZAMOS FIREBASE
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
      
      // 4. INICIALIZAMOS LA BASE DE DATOS
const db = getFirestore(app);

      // 5. CÓDIGO DEL BOTÓN (Para probar que guarda en Brasil)
document.getElementById('btnReservar').addEventListener('click', async () => {
        try {
            alert("Procesando...");
            const docRef = await addDoc(collection(db, "turnos"), {
                nombre: "Cliente desde Web",
                fecha: new Date(), // Guarda la hora actual
                servicio: "Corte y Barba"
            });
            alert("¡Funciona! Se guardó el turno con ID: " + docRef.id);
            console.log("Documento escrito con ID: ", docRef.id);
        } catch (e) {
            console.error("Error agregando documento: ", e);
            alert("Error: " + e.message);
        }
});