// 1. IMPORTACIONES 
import { auth, provider } from './firebase.js'; 
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando App Integrada...");

    // --- REFERENCIAS DOM  ---
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewRecovery = document.getElementById('view-recovery');
    const viewBooking = document.getElementById('booking-mod'); 
    
    const googleBtn = document.querySelector('.google-btn');
    const btnLogout = document.getElementById('btn-logout');
    
    const btnViewBookings = document.getElementById('btn-view-bookings');
    const btnBackDashboard = document.getElementById('btn-back-dashboard');
    const bookingsListContainer = document.querySelector('.bookings-list'); 

    // --- DATOS MOCK ---
    //ESTOS DATOS DEBEN VENIR AUTOMATIZADOS DE FIREBASE, LOS ESCRITOS ACÁ SON DE PRUEBA PARA CSS
    let mockTurnos = [
        { id: 1, servicio: "Corte Degradado", fecha: "15/01", hora: "16:30hs", barber:"Nico" },
        { id: 2, servicio: "Barba & Perfilado", fecha: "22/01", hora: "10:00hs", barber:"Maurice" }
    ];

    // --- GESTIÓN DE VISTAS ---
    function switchView(viewToShow) {
        // Ocultamos todas las posibles vistas
        [viewLogin, viewRegister, viewUser, viewRecovery, viewBooking].forEach(el => {
            if(el) el.classList.add('hidden');
        });
        
        // Mostramos la elegida
        if(viewToShow) {
            viewToShow.classList.remove('hidden');
            viewToShow.classList.add('fade-in', 'appear'); 
        }
    }

    // =================
    // AUTENTICACIÓN 
    // =================

    // 1. ESCUCHADOR DE SESIÓN
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Usuario autenticado:", user.displayName);
            
            // Lógica UI de usuario
            const userNameDisplay = document.getElementById('user-name-display');
            if(userNameDisplay) userNameDisplay.textContent = user.displayName;
            
            // IMPORTANTE: Si estamos logueados, vamos al Dashboard (viewUser)
            // No forzamos viewBooking todavía, el usuario debe navegar ahí.
            switchView(viewUser);
        } else {
            console.log("No hay usuario, mandando al Login");
            switchView(viewLogin);
        }
    });

    // 2. LOGIN GOOGLE
    if (googleBtn) {
        googleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Error Auth:", error);
                alert("Error: " + error.message);
            }
        });
    }

    // 3. LOGOUT
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
                // onAuthStateChanged se encargará de llevar al login
            } catch (error) {
                console.error("Error Logout:", error);
            }
        });
    }

    // ==========================================
    // GESTIÓN DE TURNOS UI
    // ==========================================

    // Variables globales para el modal
    let itemToDeleteId = null;
    const deleteModal = document.getElementById('delete-modal');
    const modalText = document.getElementById('modal-text');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');

    // Función de renderizado 
    function renderBookings() {
        if (!bookingsListContainer) return;
        bookingsListContainer.innerHTML = ''; 

        if (mockTurnos.length === 0) {
            bookingsListContainer.innerHTML = '<p style="color: #777; text-align: center;">No hay turnos reservados.</p>';
            return;
        }

        mockTurnos.forEach(turno => {
            const itemHTML = `
                <div class="booking-item" id="turno-${turno.id}" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #AE0E30;">
                    <div class="booking-info" style="text-align: left;">
                        <h4 style="color:white; margin:0 0 5px 0;">${turno.servicio}</h4>
                        <div style="color:#aaa; font-size:0.8rem;">
                            <div><i class="fa-regular fa-calendar"></i> ${turno.fecha} - ${turno.hora}</div>
                            <div style="color: #888;">Barbero: ${turno.barber}</div>
                        </div>
                    </div>
                    <button class="btn-delete-booking" data-id="${turno.id}" style="background:none; border:none; color: #ff4444; cursor:pointer; padding: 10px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            bookingsListContainer.innerHTML += itemHTML;
        });

        // Re-asignar eventos a los nuevos botones de borrar
        attachDeleteEvents();
    }

    function attachDeleteEvents() {
        document.querySelectorAll('.btn-delete-booking').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                itemToDeleteId = id;
                const turnoData = mockTurnos.find(t => t.id === id);
                if(modalText && turnoData) {
                    modalText.innerHTML = `Vas a eliminar el turno de <b>${turnoData.servicio}</b><br>el día ${turnoData.fecha}.<br><br>¿Estás seguro?`;
                    if(deleteModal) deleteModal.classList.add('active');
                }
            });
        });
    }

    // Listeners del Modal
    if(btnModalConfirm) {
        btnModalConfirm.addEventListener('click', () => {
            if (itemToDeleteId !== null) {
                mockTurnos = mockTurnos.filter(t => t.id !== itemToDeleteId);
                console.log("Turno borrado ID:", itemToDeleteId);
                itemToDeleteId = null;
                if(deleteModal) deleteModal.classList.remove('active');
                renderBookings();
            }
        });
    }

    if(btnModalCancel) {
        btnModalCancel.addEventListener('click', () => {
            itemToDeleteId = null;
            if(deleteModal) deleteModal.classList.remove('active');
        });
    }

    // --- LISTENERS DE NAVEGACIÓN INTERNA ---
    if (btnViewBookings) {
        btnViewBookings.addEventListener('click', () => {
            renderBookings(); // Renderizamos justo antes de mostrar
            switchView(viewBooking);
        });
    }

    if (btnBackDashboard) {
        btnBackDashboard.addEventListener('click', () => {
            switchView(viewUser); // Volver al dashboard
        });
    }
});