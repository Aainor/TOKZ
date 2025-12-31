/* Ubicación: public/js/reservas.js
   Función: Lógica para guardar turnos en la base de datos.
*/

// 1. Importamos la conexión QUE ACABAMOS DE CREAR (Nota el ./ y el .js)
import { db } from './firebase.js';

// 2. Importamos las funciones para GUARDAR datos (addDoc)
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("✅ Sistema de Reservas listo para operar");

// 3. Buscamos el botón en el HTML (Asegúrate que tu botón tenga id="btnReservar")
const btnReservar = document.getElementById('btnReservar');

if (btnReservar) {
    btnReservar.addEventListener('click', async () => {
        try {
            // Feedback visual simple
            const textoOriginal = btnReservar.innerText;
            btnReservar.innerText = "Procesando...";
            btnReservar.disabled = true;

            // Guardar en la colección "turnos"
            const docRef = await addDoc(collection(db, "turnos"), {
                nombre: "Cliente Web (Prueba)",
                fecha: new Date(),
                servicio: "Corte y Barba",
                estado: "Pendiente"
            });

            console.log("Turno guardado con ID: ", docRef.id);
            alert("¡Turno reservado con éxito! ID: " + docRef.id);

        } catch (e) {
            console.error("Error al reservar: ", e);
            alert("Error: Hubo un problema al guardar el turno.");
        } finally {
            // Restaurar botón
            btnReservar.innerText = "Reservar Turno";
            btnReservar.disabled = false;
        }
    });
} else {
    // Esto es normal si estás en una página que no tiene el botón de reservar
    console.log("ℹ️ No se encontró botón de reserva en esta página.");
}