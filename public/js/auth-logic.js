// 1. IMPORTACIONES
import { auth, provider, db } from './firebase.js'; 
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando App Integrada...");

    // --- REFERENCIAS DOM ---
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

    // --- GESTIÓN DE VISTAS (Necesaria para navegar) ---
    function switchView(viewToShow) {
        [viewLogin, viewRegister, viewUser, viewRecovery, viewBooking].forEach(el => {
            if(el) el.classList.add('hidden');
        });
        if(viewToShow) {
            viewToShow.classList.remove('hidden');
            viewToShow.classList.add('fade-in', 'appear'); 
        }
    }

    // ==========================================
    // LOGICA REAL DE FIREBASE
    // ==========================================
    
    let currentUserUid = null;
    let myTurnos = []; 
    
    // Referencias del Modal
    let itemToDeleteId = null; 
    const deleteModal = document.getElementById('delete-modal');
    const modalText = document.getElementById('modal-text');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');

    // ==========================================
    // 1. AUTENTICACIÓN (LO QUE NO ENCONTRABAS)
    // ==========================================
    
    // ESCUCHADOR DE SESIÓN: Este es el portero del edificio
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Usuario autenticado:", user.displayName);
            
            // 1. Guardamos quién es el usuario
            currentUserUid = user.uid;
            
            // 2. Cargamos SUS turnos reales
            loadUserBookings(currentUserUid); 

            // 3. Actualizamos nombre en pantalla
            const userNameDisplay = document.getElementById('user-name-display');
            if(userNameDisplay) userNameDisplay.textContent = user.displayName;
            
            // 4. Mostramos el panel de usuario
            switchView(viewUser);
        } else {
            console.log("No hay usuario, mandando al Login");
            switchView(viewLogin);
        }
    });

    // BOTÓN LOGIN GOOGLE
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

    // BOTÓN LOGOUT
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
                // El onAuthStateChanged nos llevará al login automáticamente
            } catch (error) {
                console.error("Error Logout:", error);
            }
        });
    }

    // ==========================================
    // 2. GESTIÓN DE TURNOS (CARGA Y BORRADO)
    // ==========================================

    // A. FUNCIÓN PARA CARGAR TURNOS DE FIREBASE
    async function loadUserBookings(uid) {
        if (!bookingsListContainer) return;
        bookingsListContainer.innerHTML = '<p style="text-align:center; color:#888;">Cargando tus turnos...</p>';

        try {
          
            const q = query(collection(db, "turnos"), where("uid", "==", uid));
            const querySnapshot = await getDocs(q);

            myTurnos = []; 
            
            querySnapshot.forEach((doc) => {
                myTurnos.push({ 
                    id: doc.id, 
                    ...doc.data() 
                });
            });

            renderBookings();

        } catch (error) {
            console.error("Error cargando turnos:", error);
            bookingsListContainer.innerHTML = '<p style="color:red;">Error al cargar turnos.</p>';
        }
    }

    // B. FUNCIÓN DE RENDERIZADO
    // B. FUNCIÓN DE RENDERIZADO (V2 - A Prueba de Fallos)
    function renderBookings() {
        bookingsListContainer.innerHTML = ''; 

        if (myTurnos.length === 0) {
            bookingsListContainer.innerHTML = '<p style="color: #777; text-align: center;">No tenés turnos reservados.</p>';
            return;
        }

        // Ordenamos por fecha (intentando leer ambos campos)
        myTurnos.sort((a, b) => {
            const dateA = new Date(a.fecha || a.date);
            const dateB = new Date(b.fecha || b.date);
            return dateA - dateB;
        });

        myTurnos.forEach(turno => {
            // 1. TRUCO: Leemos en español O en inglés (El Traductor)
            let fechaReal = turno.fecha || turno.date || "Sin fecha";
            let horaReal = turno.hora || turno.time || "--:--";
            let barberoReal = turno.barbero || turno.pro || "Cualquiera";
            let serviciosReal = turno.services || turno.service || "Servicio";

            // Formateo de fecha lindo (DD/MM/YYYY)
            if(fechaReal.includes('-')) {
                fechaReal = fechaReal.split('-').reverse().join('/');
            }

            // Manejo de array de servicios
            let nombreServicio = Array.isArray(serviciosReal) ? serviciosReal.join(" + ") : serviciosReal;

            const itemHTML = `
                <div class="booking-item" id="card-${turno.id}" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #AE0E30;">
                    <div class="booking-info" style="text-align: left;">
                        <h4 style="color:white; margin:0 0 5px 0;">${nombreServicio}</h4>
                        <div style="color:#aaa; font-size:0.8rem;">
                            <div><i class="fa-regular fa-calendar"></i> ${fechaReal} - ${horaReal}</div>
                            <div style="color: #888;">Barbero: ${barberoReal}</div>
                        </div>
                    </div>
                    <button class="btn-delete-booking" data-id="${turno.id}" style="background:none; border:none; color: #ff4444; cursor:pointer; padding: 10px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            bookingsListContainer.innerHTML += itemHTML;
        });

        attachDeleteEvents();
    }

    // C. EVENTOS DE LOS BOTONES DE BASURA
    function attachDeleteEvents() {
        document.querySelectorAll('.btn-delete-booking').forEach(btn => {
            btn.addEventListener('click', (e) => {
                itemToDeleteId = e.currentTarget.getAttribute('data-id');
                const turnoData = myTurnos.find(t => t.id === itemToDeleteId);
                
                if(modalText && turnoData) {
                    let nombreServicio = Array.isArray(turnoData.services) ? turnoData.services[0] : turnoData.services;
                    modalText.innerHTML = `Vas a cancelar el turno de <b>${nombreServicio}</b>.<br><br>¿Estás seguro?`;
                    if(deleteModal) deleteModal.classList.add('active');
                }
            });
        });
    }

    // D. CONFIRMAR BORRADO (REAL EN FIREBASE)
    if(btnModalConfirm) {
        btnModalConfirm.addEventListener('click', async () => {
            if (itemToDeleteId) {
                const originalText = btnModalConfirm.textContent;
                btnModalConfirm.textContent = "Borrando...";

                try {
                    // Borrar de Firebase
                    await deleteDoc(doc(db, "turnos", itemToDeleteId));
                    console.log("Turno eliminado de DB:", itemToDeleteId);

                    // Borrar de la lista local
                    myTurnos = myTurnos.filter(t => t.id !== itemToDeleteId);
                    
                    renderBookings();
                    
                    if(deleteModal) deleteModal.classList.remove('active');

                } catch (error) {
                    console.error("Error al borrar:", error);
                    alert("No se pudo borrar el turno. Revisá tu conexión.");
                } finally {
                    btnModalConfirm.textContent = originalText;
                    itemToDeleteId = null;
                }
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
            renderBookings(); 
            switchView(viewBooking);
        });
    }

    if (btnBackDashboard) {
        btnBackDashboard.addEventListener('click', () => {
            switchView(viewUser); 
        });
    }
});