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
    getDoc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 🚨 CONFIGURACIÓN DE STAFF (LISTA BLANCA)
// ==========================================
const STAFF_EMAILS = {
    "elias04baez@gmail.com": "Nicolás",
    "fnvillalva.17@gmail.com": "Maurice",
    "otro_mail@gmail.com": "Facu"
};

// ACÁ EL EMAIL DEL DUEÑO (ADMIN)
const ADMIN_EMAILS = [
    "tucorreo_admin@gmail.com",
    "otrodueño@gmail.com"
];

// Variable global para la instancia del calendario
let calendarInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando App Integrada con Agenda FullCalendar...");

    // --- REFERENCIAS DOM ---
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewRecovery = document.getElementById('view-recovery');
    const viewBooking = document.getElementById('booking-mod');

    // Referencias Staff
    const viewBarber = document.getElementById('view-barber');

    // Referencias Admin
    const viewAdmin = document.getElementById('view-admin');

    const googleBtn = document.querySelector('.google-btn');
    const btnLogout = document.getElementById('btn-logout');

    const btnViewBookings = document.getElementById('btn-view-bookings');
    const btnBackDashboard = document.getElementById('btn-back-dashboard');
    const bookingsListContainer = document.querySelector('.bookings-list');

    // --- GESTIÓN DE VISTAS (FIX PANTALLA COMPLETA) ---
    function switchView(viewToShow) {
        // 1. Ocultar todo
        [viewLogin, viewRegister, viewUser, viewRecovery, viewBooking, viewBarber, viewAdmin].forEach(el => {
            if (el) {
                el.classList.add('hidden');
                // Limpiamos clases de animación para evitar conflictos residuales
                el.classList.remove('fade-in', 'appear');

                // Reset de estilo display por si acaso
                if (el === viewBarber) el.style.display = 'none';
            }
        });

        // 2. Mostrar la vista elegida
        if (viewToShow) {
            viewToShow.classList.remove('hidden');

            // 🚨 FIX CRÍTICO: El modo Barbero usa display: flex para ocupar toda la pantalla
            if (viewToShow === viewBarber) {
                viewToShow.style.display = 'flex';

                // Actualizamos tamaño del calendario una vez visible
                if (calendarInstance) {
                    setTimeout(() => { calendarInstance.updateSize(); }, 50);
                }
            } else {
                // El resto de vistas sí usan la animación bonita
                viewToShow.classList.add('fade-in', 'appear');
            }
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

                // 1. DETERMINAR ROL
                let rolDetectado = 'cliente';
                let nombreOficial = user.displayName;

                if (STAFF_EMAILS.hasOwnProperty(user.email)) {
                    rolDetectado = 'barbero';
                    nombreOficial = STAFF_EMAILS[user.email];
                    console.log(`✅ Barbero identificado: ${nombreOficial}`);
                }
                else if (ADMIN_EMAILS.includes(user.email)) {
                    rolDetectado = 'admin';
                }

                // 2. ACTUALIZAR DB
                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        Nombre: nombreOficial,
                        Email: user.email,
                        Cortes_Totales: 0,
                        Fecha_Registro: new Date(),
                        rol: rolDetectado
                    });
                } else {
                    const dataActual = userSnap.data();
                    if (dataActual.rol !== rolDetectado || (rolDetectado === 'barbero' && dataActual.Nombre !== nombreOficial)) {
                        await updateDoc(userRef, { rol: rolDetectado, Nombre: nombreOficial });
                    }
                }

                // 3. REDIRECCIONAR
                if (rolDetectado === 'admin') {
                    switchView(viewAdmin);
                }
                else if (rolDetectado === 'barbero') {
                    const barberNameDisplay = document.getElementById('barber-name-display');
                    if (barberNameDisplay) barberNameDisplay.textContent = nombreOficial;

                    loadBarberAgenda(nombreOficial);
                    switchView(viewBarber);
                }
                else {
                    currentUserUid = user.uid;
                    loadUserBookings(currentUserUid);
                    const userNameDisplay = document.getElementById('user-name-display');
                    if (userNameDisplay) userNameDisplay.textContent = user.displayName;
                    switchView(viewUser);
                }

            } catch (error) {
                console.error("Error Auth:", error);
                switchView(viewLogin);
            }
        } else {
            switchView(viewLogin);
        }
    });

    // LISTENERS DE BOTONES
    if (btnLogout) btnLogout.addEventListener('click', async () => { try { await signOut(auth); } catch (e) { console.error(e); } });

    const btnLogoutBarber = document.getElementById('btn-logout-barber');
    if (btnLogoutBarber) btnLogoutBarber.addEventListener('click', async () => { try { await signOut(auth); } catch (e) { console.error(e); } });

    const btnRefreshBarber = document.getElementById('btn-refresh-barber');
    if (btnRefreshBarber) {
        btnRefreshBarber.addEventListener('click', () => {
            const nombre = document.getElementById('barber-name-display').textContent;
            loadBarberAgenda(nombre);
        });
    }

    if (googleBtn) {
        googleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try { await signInWithPopup(auth, provider); } catch (error) { console.error(error); alert(error.message); }
        });
    }

    // A. CARGAR TURNOS CLIENTE
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

    // B. RENDER TURNOS CLIENTE
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
            if (fechaReal.includes('-')) fechaReal = fechaReal.split('-').reverse().join('/');
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
                if (modalText && turnoData) {
                    let nombreServicio = Array.isArray(turnoData.services) ? turnoData.services[0] : turnoData.services;
                    modalText.innerHTML = `Vas a cancelar el turno de <b>${nombreServicio}</b>.<br><br>¿Estás seguro?`;
                    if (deleteModal) deleteModal.classList.add('active');
                }
            });
        });
    }

    if (btnModalConfirm) {
        btnModalConfirm.addEventListener('click', async () => {
            if (itemToDeleteId) {
                const originalText = btnModalConfirm.textContent;
                btnModalConfirm.textContent = "Borrando...";
                try {
                    await deleteDoc(doc(db, "turnos", itemToDeleteId));
                    myTurnos = myTurnos.filter(t => t.id !== itemToDeleteId);
                    renderBookings();
                    if (deleteModal) deleteModal.classList.remove('active');
                } catch (error) { alert("Error al borrar."); }
                finally { btnModalConfirm.textContent = originalText; itemToDeleteId = null; }
            }
        });
    }
    if (btnModalCancel) {
        btnModalCancel.addEventListener('click', () => {
            itemToDeleteId = null;
            if (deleteModal) deleteModal.classList.remove('active');
        });
    }

    if (btnViewBookings) btnViewBookings.addEventListener('click', () => { renderBookings(); switchView(viewBooking); });
    if (btnBackDashboard) btnBackDashboard.addEventListener('click', () => { switchView(viewUser); });

    // ==========================================
    // 3. FUNCIÓN BARBERO (CALENDARIO FIX MÓVIL)
    // ==========================================
    async function loadBarberAgenda(nombreBarbero) {
        const calendarEl = document.getElementById('calendar-barber');
        if (!calendarEl) return;

        calendarEl.innerHTML = ''; // Limpiar

        try {
            console.log(`📅 Cargando calendario para: "${nombreBarbero}"`);

            const q = query(collection(db, "turnos"), where("pro", "==", nombreBarbero));
            const querySnapshot = await getDocs(q);
            let eventos = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.date && data.time) {
                    const startStr = `${data.date}T${data.time}:00`;
                    let endDate = new Date(new Date(startStr).getTime() + 45 * 60000);
                    let serviciosTexto = Array.isArray(data.services) ? data.services.join(" + ") : data.services;

                    eventos.push({
                        id: doc.id,
                        title: data.clientName || 'Cliente',
                        start: startStr,
                        end: endDate.toISOString(),
                        backgroundColor: '#AE0E30',
                        borderColor: '#AE0E30',
                        extendedProps: {
                            servicio: serviciosTexto,
                            email: data.clientEmail,
                            precio: data.total
                        }
                    });
                }
            });

            if (calendarInstance) calendarInstance.destroy();

            // DETECCIÓN DE MÓVIL
            const isMobile = window.innerWidth < 768;

            calendarInstance = new FullCalendar.Calendar(calendarEl, {
                // Si es móvil: Muestra solo UN DÍA. Si es PC: Muestra SEMANA.
                initialView: isMobile ? 'timeGridDay' : 'timeGridWeek',

                headerToolbar: {
                    left: 'prev,next', // Navegación simple
                    center: 'title',
                    // En móvil quitamos botones que saturan la pantalla
                    right: isMobile ? 'today' : 'dayGridMonth,timeGridWeek,timeGridDay'
                },

                buttonText: {
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día'
                },

                locale: 'es',
                slotMinTime: '09:00:00',
                slotMaxTime: '21:00:00',
                allDaySlot: false,
                slotDuration: '00:30:00', // Bloques de media hora

                // --- CONFIGURACIÓN RESPONSIVE ---
                height: '100%',
                contentHeight: 'auto',
                expandRows: true,
                handleWindowResize: true,
                windowResize: function () {
                    const isMobileNow = window.innerWidth < 768;
                    calendarInstance.changeView(
                        isMobileNow ? 'timeGridDay' : 'timeGridWeek'
                    );
                },
                // --------------------------------

                nowIndicator: true,
                events: eventos,

                // Diseño de la tarjetita del turno (más limpio)
                eventContent: function (arg) {
                    return {
                        html: `
            <div class="turno-card">
                <div class="turno-hora">
                    ${arg.timeText}
                </div>
                <div class="turno-servicio">
                    ${arg.event.extendedProps.servicio}
                </div>
                <div class="turno-cliente">
                    ${arg.event.title}
                </div>
            </div>
                        `
                    };
                },
                eventClick: function (info) {
                    alert(`Cliente: ${info.event.title}\nServicio: ${info.event.extendedProps.servicio}\nEmail: ${info.event.extendedProps.email}`);
                }
            });

            calendarInstance.render();

        } catch (error) {
            console.error("Error agenda:", error);
            calendarEl.innerHTML = '<p style="color:red;">Error de carga.</p>';
        }
    }
});