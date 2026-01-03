/* Ubicación: public/js/booking.js */

// 1. IMPORTAMOS LA CONEXIÓN QUE YA TIENES (Sin repetir claves)
// Esto trae la 'db' y 'auth' que ya configuraste con tus keys secretas.
import { db, auth } from './firebase.js'; 

// 2. IMPORTAMOS SOLO LO QUE NECESITAMOS DE FIRESTORE
import { collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

console.log("📅 Sistema de Reservas cargado correctamente");

// ==========================================
// 3. VARIABLES GLOBALES
// ==========================================
const TODOS_LOS_BARBEROS = ["Ale", "Nico", "Jony", "Mauri", "Lauti"]; 

let reserva = {
    fecha: null,
    hora: null,
    barbero: null
};

// Elementos del HTML
const wizardContainer = document.getElementById('booking-wizard');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');

// ==========================================
// 4. VERIFICAR SI EL USUARIO ESTÁ LOGUEADO
// ==========================================
// En booking.js
onAuthStateChanged(auth, (user) => {
    const loginWarning = document.getElementById('login-warning');
    
    if (user) {
        if(wizardContainer) wizardContainer.style.display = 'block';
        if(loginWarning) loginWarning.style.display = 'none'; // Ocultar advertencia
        console.log("Usuario:", user.email);
    } else {
        if(wizardContainer) wizardContainer.style.display = 'none';
        if(loginWarning) loginWarning.style.display = 'block'; // Mostrar advertencia
        console.log("Esperando login...");
    }
});


// ==========================================
// 5. PASO 1 -> PASO 2 (BUSCAR DISPONIBILIDAD)
// ==========================================
const btnStep2 = document.getElementById('btn-to-step-2');
if(btnStep2){
    btnStep2.addEventListener('click', async () => {
        const fechaInput = document.getElementById('inputDate').value;
        const horaInput = document.getElementById('selectTime').value;

        if (!fechaInput || !horaInput) {
            alert("Por favor selecciona una fecha y un horario.");
            return;
        }

        // Guardamos selección
        reserva.fecha = fechaInput;
        reserva.hora = horaInput;

        // UI: Mostrar carga
        const containerBarberos = document.getElementById('barber-list-container');
        containerBarberos.innerHTML = "<p>🔄 Buscando barberos disponibles...</p>";
        
        // Cambiar pantalla
        step1.style.display = 'none';
        step2.style.display = 'block';
        
        // Llenar resumen parcial
        document.getElementById('summary-date').innerText = fechaInput;
        document.getElementById('summary-time').innerText = horaInput;

        try {
            // --- CONSULTA A LA BASE DE DATOS ---
            const q = query(
                collection(db, "turnos"), 
                where("fecha", "==", fechaInput),
                where("hora", "==", horaInput)
            );
            
            const querySnapshot = await getDocs(q);
            
            // Ver quiénes están ocupados
            const barberosOcupados = [];
            querySnapshot.forEach((doc) => {
                barberosOcupados.push(doc.data().barbero);
            });

            // Filtrar los libres
            const barberosDisponibles = TODOS_LOS_BARBEROS.filter(
                b => !barberosOcupados.includes(b)
            );

            // Dibujar botones
            containerBarberos.innerHTML = "";
            
            if (barberosDisponibles.length === 0) {
                containerBarberos.innerHTML = "<p style='color:red'>⛔ Todos ocupados a esa hora.</p>";
            } else {
                barberosDisponibles.forEach(barbero => {
                    const btn = document.createElement('button');
                    btn.innerText = "✂️ " + barbero;
                    btn.className = "btn-barbero"; 
                    btn.style = "margin:5px; padding:10px; cursor:pointer;";
                    
                    btn.onclick = () => irAlPaso3(barbero);
                    
                    containerBarberos.appendChild(btn);
                });
            }

        } catch (error) {
            console.error("Error al buscar disponibilidad:", error);
            containerBarberos.innerHTML = "<p>Error de conexión. Intenta de nuevo.</p>";
        }
    });
}

// ==========================================
// 6. PASO 2 -> PASO 3 (RESUMEN FINAL)
// ==========================================
function irAlPaso3(nombreBarbero) {
    reserva.barbero = nombreBarbero;
    step2.style.display = 'none';
    step3.style.display = 'block';

    document.getElementById('final-date').innerText = reserva.fecha;
    document.getElementById('final-time').innerText = reserva.hora;
    document.getElementById('final-barber').innerText = reserva.barbero;
}

// ==========================================
// 7. CONFIRMACIÓN Y ENVÍO DE EMAIL
// ==========================================
const btnConfirm = document.getElementById('btn-confirm-booking');
if(btnConfirm){
    btnConfirm.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return alert("Tu sesión expiró. Por favor recarga la página.");

        btnConfirm.disabled = true;
        btnConfirm.innerText = "⏳ Confirmando...";

        try {
            // A) GUARDAR EN BASE DE DATOS
            await addDoc(collection(db, "turnos"), {
                id_cliente: user.uid,
                cliente_nombre: user.displayName || "Cliente Web",
                cliente_email: user.email,
                fecha: reserva.fecha,
                hora: reserva.hora,
                barbero: reserva.barbero,
                servicio: "Corte Clásico",
                creado_en: new Date()
            });

            // B) ENVIAR EMAIL (EmailJS)
            if (window.emailjs) {
                const paramsEmail = {
                    nombre_cliente: user.displayName,
                    to_email: user.email,
                    fecha: reserva.fecha,
                    hora: reserva.hora,
                    barbero: reserva.barbero
                };
                
                // RECUERDA: Aquí van tus IDs de EmailJS (Service ID, Template ID)
                await emailjs.send("service_hamvojq", "template_qbqjfp6", paramsEmail);
            }

            alert("¡Reserva Confirmada! Te enviamos un correo con los detalles.");
            location.reload(); 

        } catch (error) {
            console.error("Error al confirmar:", error);
            alert("Hubo un error: " + error.message);
            btnConfirm.disabled = false;
            btnConfirm.innerText = "Intentar de nuevo";
        }
    });
}

// Botones para volver atrás
const btnBack1 = document.getElementById('btn-back-1');
const btnBack2 = document.getElementById('btn-back-2');

if(btnBack1) btnBack1.addEventListener('click', () => {
    step2.style.display = 'none';
    step1.style.display = 'block';
});
if(btnBack2) btnBack2.addEventListener('click', () => {
    step3.style.display = 'none';
    step2.style.display = 'block';
});