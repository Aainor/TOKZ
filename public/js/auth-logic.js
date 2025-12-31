/* Archivo: public/js/auth-logic.js */
import { auth, provider } from './firebase.js'; // <--- Importante
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a tus elementos visuales
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewRecovery = document.getElementById('view-recovery');
    const googleBtn = document.querySelector('.google-btn'); // <--- TU BOTÓN

    // Función para cambiar pantallas
    function switchView(viewToShow) {
        [viewLogin, viewRegister, viewUser, viewRecovery].forEach(el => {
            if(el) el.classList.add('hidden');
        });
        if(viewToShow) viewToShow.classList.remove('hidden');
    }

    // 1. ESCUCHADOR DE SESIÓN (Detecta si entraste)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Usuario detectado:", user.displayName);
            // Llenamos el nombre en el HTML si existe el elemento
            const userNameDisplay = document.getElementById('user-name-display');
            if(userNameDisplay) userNameDisplay.textContent = user.displayName;
            switchView(viewUser);
        } else {
            switchView(viewLogin);
        }
    });

    // 2. BOTÓN DE GOOGLE
    if (googleBtn) {
        googleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("Intentando abrir Google..."); // <--- Mensaje de control
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Error al entrar:", error);
                alert("Error: " + error.message);
            }
        });
    } else {
        console.error("⚠️ NO ENCUENTRO EL BOTÓN .google-btn");
    }
    // --- 3. LOGICA DE CERRAR SESIÓN (Agrega esto al final) ---
    const btnLogout = document.getElementById('btn-logout');

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
                console.log("Sesión cerrada");
                alert("Has cerrado sesión correctamente 👋");
                // La función onAuthStateChanged detectará el cambio y te llevará al Login solo
            } catch (error) {
                console.error("Error al salir:", error);
            }
        });
    } else {
        console.warn("El botón de logout no se encontró en el HTML");
    }
});