// ==========================================
// 1. IMPORTACIONES
// ==========================================
import { auth, provider, db } from './firebase.js'; 
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc,
    getDoc, // Asegurate que esté getDoc
    updateDoc, // Asegurate que esté updateDoc
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 🚨 CONFIGURACIÓN DE STAFF (LISTA BLANCA)
// ==========================================
// Acá asociamos el EMAIL del barbero con su NOMBRE EXACTO en el sistema
const STAFF_EMAILS = {
    // "email_del_barbero@gmail.com" : "NombreExactoEnTurnero"
    "elias04baez@gmail.com": "Nicolás",      // Ejemplo: Si entra Elias, el sistema sabe que es Nico
    "fnvillalva.17@gmail.com": "Maurice", // Ejemplo: Tu mail es Maurice
    "otro_mail@gmail.com": "Facu" 
};

// ACÁ EL EMAIL DEL DUEÑO (ADMIN)
const ADMIN_EMAILS = [
    "tucorreo_admin@gmail.com",
    "otrodueño@gmail.com"
];

document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando App Integrada...");

    // --- REFERENCIAS DOM ---
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewRecovery = document.getElementById('view-recovery');
    const viewBooking = document.getElementById('booking-mod'); 
    
    // Referencias Staff
    const viewBarber = document.getElementById('view-barber');
    const barberListContainer = document.querySelector('.barber-bookings-list');
    
    // Referencias Admin
    const viewAdmin = document.getElementById('view-admin');
    
    const googleBtn = document.querySelector('.google-btn');
    const btnLogout = document.getElementById('btn-logout');
    
    const btnViewBookings = document.getElementById('btn-view-bookings');
    const btnBackDashboard = document.getElementById('btn-back-dashboard');
    const bookingsListContainer = document.querySelector('.bookings-list'); 

    // --- GESTIÓN DE VISTAS ---
    function switchView(viewToShow) {
        [viewLogin, viewRegister, viewUser, viewRecovery, viewBooking, viewBarber, viewAdmin].forEach(el => {
            if(el) el.classList.add('hidden');
        });
        if(viewToShow) {
            viewToShow.classList.remove('hidden');
            viewToShow.classList.add('fade-in', 'appear'); 
        }
    }

    // ==========================================
    // LOGICA DE AUTENTICACIÓN INTELIGENTE
    // ==========================================
    
    let currentUserUid = null;
    let myTurnos = []; 
    let itemToDeleteId = null; 
    
    // Modal Referencias
    const deleteModal = document.getElementById('delete-modal');
    const modalText = document.getElementById('modal-text');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');

    onAuthStateChanged(auth, async (user) => { 
        if (user) {
            console.log("Usuario detectado:", user.email);
            
            try {
                const userRef = doc(db, "Clientes", user.uid);
                const userSnap = await getDoc(userRef);
                
                // 1. DETERMINAR ROL BASADO EN EL EMAIL (AUTOMÁTICO)
                let rolDetectado = 'cliente';
                let nombreOficial = user.displayName;

                // ¿Es Barbero?
                if (STAFF_EMAILS.hasOwnProperty(user.email)) {
                    rolDetectado = 'barbero';
                    nombreOficial = STAFF_EMAILS[user.email]; // Usamos el nombre oficial del turnero
                    console.log(`✅ Barbero identificado por email: ${nombreOficial}`);
                } 
                // ¿Es Admin?
                else if (ADMIN_EMAILS.includes(user.email)) {
                    rolDetectado = 'admin';
                    console.log("✅ Administrador identificado por email");
                }

                // 2. GUARDAR O ACTUALIZAR EN BASE DE DATOS
                // Esto "asciende" al usuario automáticamente si su email está en la lista
                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        Nombre: nombreOficial,
                        Email: user.email,
                        Cortes_Totales: 0,
                        Fecha_Registro: new Date(),
                        rol: rolDetectado
                    });
                } else {
                    // Si ya existe, verificamos si hay que actualizarle el rol
                    const dataActual = userSnap.data();
                    if (dataActual.rol !== rolDetectado || (rolDetectado === 'barbero' && dataActual.Nombre !== nombreOficial)) {
                        await updateDoc(userRef, {
                            rol: rolDetectado,
                            Nombre: nombreOficial // Forzamos el nombre correcto para que coincida con la agenda
                        });
                        console.log("🔄 Perfil actualizado automáticamente según lista blanca.");
                    }
                }

                // 3. REDIRECCIONAR SEGÚN ROL
                if (rolDetectado === 'admin') {
                    switchView(viewAdmin); // Aún no está la lógica de carga, pero irá acá
                } 
                else if (rolDetectado === 'barbero') {
                    // Actualizamos título
                    const barberNameDisplay = document.getElementById('barber-name-display');
                    if(barberNameDisplay) barberNameDisplay.textContent = nombreOficial;
                    
                    // Cargamos SU agenda
                    loadBarberAgenda(nombreOficial); 
                    switchView(viewBarber);
                } 
                else {
                    // Cliente Normal
                    currentUserUid = user.uid;
                    loadUserBookings(currentUserUid);
                    
                    const userNameDisplay = document.getElementById('user-name-display');
                    if(userNameDisplay) userNameDisplay.textContent = user.displayName;
                    
                    switchView(viewUser);
                }

            } catch (error) {
                console.error("Error Auth:", error);
                switchView(viewLogin);
            }
        } else {
            console.log("No hay usuario, mandando al Login");
            switchView(viewLogin);
        }
    });

    // ... (El resto del código de Logout, Google Btn, y funciones de carga sigue igual) ...
    // ... COPIA Y PEGA TUS FUNCIONES loadUserBookings, renderBookings, loadBarberAgenda ACÁ ABAJO ...
    // ... NO TE OLVIDES DE PEGAR LAS FUNCIONES QUE YA TENÍAS ...

    // BOTÓN LOGOUT COMÚN
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => { try { await signOut(auth); } catch (e) { console.error(e); } });
    }
    // BOTÓN LOGOUT BARBERO
    const btnLogoutBarber = document.getElementById('btn-logout-barber');
    if (btnLogoutBarber) {
        btnLogoutBarber.addEventListener('click', async () => { try { await signOut(auth); } catch (e) { console.error(e); } });
    }
    // REFRESH BARBERO
    const btnRefreshBarber = document.getElementById('btn-refresh-barber');
    if (btnRefreshBarber) {
        btnRefreshBarber.addEventListener('click', () => {
             const nombre = document.getElementById('barber-name-display').textContent;
             loadBarberAgenda(nombre);
        });
    }

    // BOTÓN LOGIN GOOGLE
    if (googleBtn) {
        googleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try { await signInWithPopup(auth, provider); } catch (error) { console.error(error); alert(error.message); }
        });
    }

    // A. FUNCIÓN CLIENTE: CARGAR TURNOS
    async function loadUserBookings(uid) {
        if (!bookingsListContainer) return;
        bookingsListContainer.innerHTML = '<p style="text-align:center; color:#888;">Cargando tus turnos...</p>';
        try {
            const q = query(collection(db, "turnos"), where("uid", "==", uid));
            const querySnapshot = await getDocs(q);
            myTurnos = []; 
            querySnapshot.forEach((doc) => { myTurnos.push({ id: doc.id, ...doc.data() }); });
            renderBookings();
        } catch (error) {
            console.error(error); bookingsListContainer.innerHTML = '<p style="color:red;">Error.</p>';
        }
    }

    // B. FUNCIÓN CLIENTE: RENDERIZAR
    function renderBookings() {
        bookingsListContainer.innerHTML = ''; 
        if (myTurnos.length === 0) {
            bookingsListContainer.innerHTML = '<p style="color: #777; text-align: center;">No tenés turnos reservados.</p>';
            return;
        }
        myTurnos.sort((a, b) => {
            const dateA = new Date(a.fecha || a.date);
            const dateB = new Date(b.fecha || b.date);
            return dateA - dateB;
        });
        myTurnos.forEach(turno => {
            let fechaReal = turno.fecha || turno.date || "Sin fecha";
            if(fechaReal.includes('-')) fechaReal = fechaReal.split('-').reverse().join('/');
            let nombreServicio = Array.isArray(turno.services) ? turno.services.join(" + ") : turno.services;
            
            bookingsListContainer.innerHTML += `
                <div class="booking-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #AE0E30;">
                    <div class="booking-info" style="text-align: left;">
                        <h4 style="color:white; margin:0 0 5px 0;">${nombreServicio}</h4>
                        <div style="color:#aaa; font-size:0.8rem;">
                            <div><i class="fa-regular fa-calendar"></i> ${fechaReal} - ${turno.time || '--:--'}</div>
                            <div style="color: #888;">Barbero: ${turno.barbero || turno.pro}</div>
                        </div>
                    </div>
                    <button class="btn-delete-booking" data-id="${turno.id}" style="background:none; border:none; color: #ff4444; cursor:pointer; padding: 10px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>`;
        });
        attachDeleteEvents();
    }

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
    
    // LOGICA MODAL BORRAR
    if(btnModalConfirm) {
        btnModalConfirm.addEventListener('click', async () => {
            if (itemToDeleteId) {
                const originalText = btnModalConfirm.textContent;
                btnModalConfirm.textContent = "Borrando...";
                try {
                    await deleteDoc(doc(db, "turnos", itemToDeleteId));
                    myTurnos = myTurnos.filter(t => t.id !== itemToDeleteId);
                    renderBookings();
                    if(deleteModal) deleteModal.classList.remove('active');
                } catch (error) { alert("Error al borrar."); } 
                finally { btnModalConfirm.textContent = originalText; itemToDeleteId = null; }
            }
        });
    }
    if(btnModalCancel) {
        btnModalCancel.addEventListener('click', () => {
            itemToDeleteId = null;
            if(deleteModal) deleteModal.classList.remove('active');
        });
    }

    // --- LISTENERS NAVEGACIÓN ---
    if (btnViewBookings) {
        btnViewBookings.addEventListener('click', () => { renderBookings(); switchView(viewBooking); });
    }
    if (btnBackDashboard) {
        btnBackDashboard.addEventListener('click', () => { switchView(viewUser); });
    }

    // ==========================================
    // 3. FUNCIÓN BARBERO (AGENDA)
    // ==========================================
    async function loadBarberAgenda(nombreBarbero) {
        if (!barberListContainer) return;
        barberListContainer.innerHTML = '<p style="text-align:center; color:#888;">Cargando tu agenda...</p>';

        try {
            console.log(`📅 Buscando turnos para el profesional: "${nombreBarbero}"`);
            const q = query(collection(db, "turnos"), where("pro", "==", nombreBarbero));
            const querySnapshot = await getDocs(q);
            
            let turnos = [];
            querySnapshot.forEach((doc) => { turnos.push({ id: doc.id, ...doc.data() }); });

            turnos.sort((a, b) => {
                const dateA = new Date(a.date + 'T' + a.time);
                const dateB = new Date(b.date + 'T' + b.time);
                return dateA - dateB;
            });

            if (turnos.length === 0) {
                barberListContainer.innerHTML = `
                    <div style="text-align:center; padding: 20px; color:#888;">
                        <i class="fa-regular fa-calendar-xmark" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p>No tenés turnos asignados (aún).</p>
                    </div>`;
                return;
            }

            barberListContainer.innerHTML = '';
            
            turnos.forEach(t => {
                let fechaLinda = t.date;
                if(t.date && t.date.includes('-')) fechaLinda = t.date.split('-').reverse().join('/');
                let serviciosTexto = Array.isArray(t.services) ? t.services.join(" + ") : t.services;

                const itemHTML = `
                    <div class="booking-item" style="background: rgba(20, 20, 20, 0.8); border: 1px solid #333; border-left: 4px solid #4CAF50; padding: 15px; margin-bottom: 12px; border-radius: 6px;">
                        <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                            <div>
                                <h4 style="color:white; margin:0 0 5px 0; font-size: 1.1rem;">
                                    ${t.time} <span style="font-weight:normal; color:#aaa;">-</span> ${t.clientName}
                                </h4>
                                <div style="color:#AE0E30; font-size:0.9rem; font-weight: bold;">
                                    ${serviciosTexto}
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="color:#ccc; font-size:0.85rem;">${fechaLinda}</div>
                            </div>
                        </div>
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #333; font-size: 0.85rem; color: #888; display: flex; justify-content: space-between;">
                            <span>📧 ${t.clientEmail || 'Sin email'}</span>
                            <span style="color: #4CAF50;">$${t.total || '-'}</span>
                        </div>
                    </div>`;
                barberListContainer.innerHTML += itemHTML;
            });
        } catch (error) {
            console.error("Error cargando agenda:", error);
            barberListContainer.innerHTML = '<p style="color:red; text-align:center;">Error al cargar datos.</p>';
        }
    }
});