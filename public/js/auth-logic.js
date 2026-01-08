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
// 🚨 CONFIGURACIÓN DE ROLES
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
let currentUserUid = null;
let myTurnos = [];
let itemToDeleteId = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando App Integrada con Agenda FullCalendar...");

    // --- REFERENCIAS DOM ---
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewRecovery = document.getElementById('view-recovery');
    const viewBooking = document.getElementById('booking-mod');
    const viewBarber = document.getElementById('view-barber'); // Vista Barbero
    const viewAdmin = document.getElementById('view-admin');   // Vista Admin

    // Botones Login/Logout
    const googleBtn = document.querySelector('.google-btn');
    const btnLogout = document.getElementById('btn-logout');
    const btnLogoutBarber = document.getElementById('btn-logout-barber');
    
    // Lista de reservas cliente
    const bookingsListContainer = document.querySelector('.bookings-list');

    // Modal de borrado
    const deleteModal = document.getElementById('delete-modal');
    const modalText = document.getElementById('modal-text');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');

    // ==========================================
    // GESTIÓN DE VISTAS
    // ==========================================
    function switchView(viewToShow) {
        // 1. Ocultar todas las vistas
        [viewLogin, viewRegister, viewUser, viewRecovery, viewBooking, viewBarber, viewAdmin].forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('fade-in', 'appear');
                // Reset display importante para viewBarber
                if (el === viewBarber) el.style.display = 'none'; 
            }
        });

        // 2. Mostrar la vista elegida
        if (viewToShow) {
            viewToShow.classList.remove('hidden');

            // 🚨 FIX: El modo Barbero necesita display: flex para ocupar pantalla completa
            if (viewToShow === viewBarber) {
                viewToShow.style.display = 'flex';
                
                // Recalcular tamaño del calendario
                if (calendarInstance) {
                    setTimeout(() => { calendarInstance.updateSize(); }, 50);
                }
            } else {
                // Animación suave para el resto
                viewToShow.classList.add('fade-in', 'appear');
            }
        }
    }

    // ==========================================
    // LOGICA DE AUTENTICACIÓN
    // ==========================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Usuario conectado:", user.email);

            try {
                const userRef = doc(db, "Clientes", user.uid);
                const userSnap = await getDoc(userRef);

                // 1. Identificar Rol
                let rolDetectado = 'cliente';
                let nombreOficial = user.displayName;

                if (STAFF_EMAILS.hasOwnProperty(user.email)) {
                    rolDetectado = 'barbero';
                    nombreOficial = STAFF_EMAILS[user.email];
                } 
                else if (ADMIN_EMAILS.includes(user.email)) {
                    rolDetectado = 'admin';
                }

                // 2. Guardar/Actualizar en DB
                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        Nombre: nombreOficial,
                        Email: user.email,
                        Cortes_Totales: 0,
                        Fecha_Registro: new Date(),
                        rol: rolDetectado
                    });
                } else {
                    // Actualizar rol si cambió
                    const dataActual = userSnap.data();
                    if (dataActual.rol !== rolDetectado || (rolDetectado === 'barbero' && dataActual.Nombre !== nombreOficial)) {
                        await updateDoc(userRef, { rol: rolDetectado, Nombre: nombreOficial });
                    }
                }

                // 3. Redireccionar según rol
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
                    // Es Cliente
                    currentUserUid = user.uid;
                    loadUserBookings(currentUserUid); // Cargar sus turnos
                    
                    const userNameDisplay = document.getElementById('user-name-display');
                    if (userNameDisplay) userNameDisplay.textContent = user.displayName;
                    
                    switchView(viewUser);
                }

            } catch (error) {
                console.error("Error Auth:", error);
                switchView(viewLogin);
            }
        } else {
            // No hay usuario
            switchView(viewLogin);
        }
    });

    // LISTENERS DE LOGIN/LOGOUT
    if (btnLogout) btnLogout.addEventListener('click', () => signOut(auth));
    if (btnLogoutBarber) btnLogoutBarber.addEventListener('click', () => signOut(auth));
    
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Error Google:", error);
            }
        });
    }

    // Navegación simple
    const linkRegister = document.getElementById('show-register');
    if (linkRegister) linkRegister.addEventListener('click', () => switchView(viewRegister));

    const backArrows = document.querySelectorAll('.back-arrow');
    backArrows.forEach(arrow => arrow.addEventListener('click', () => switchView(viewLogin)));
    
    // Botón refrescar agenda (Barbero)
    const btnRefreshBarber = document.getElementById('btn-refresh-barber');
    if (btnRefreshBarber) {
        btnRefreshBarber.addEventListener('click', () => {
            const nombre = document.getElementById('barber-name-display').textContent;
            loadBarberAgenda(nombre);
        });
    }

    // ==========================================
    // 3. LÓGICA DEL BARBERO (FullCalendar)
    // ==========================================
    async function loadBarberAgenda(barberName) {
        const calendarEl = document.getElementById('calendar-barber');
        if (!calendarEl) return;

        // Limpiar instancia anterior
        if (calendarInstance) calendarInstance.destroy();

        // Detectar si es Móvil para mostrar Día o Semana
        const isMobile = window.innerWidth < 768;
        const initialViewType = isMobile ? 'timeGridDay' : 'timeGridWeek';

        // @ts-ignore (FullCalendar global)
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: initialViewType,
            locale: 'es',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            slotMinTime: '08:00:00',
            slotMaxTime: '22:00:00',
            allDaySlot: false,
            height: '100%',
            expandRows: true,
            slotDuration: '00:15:00', // Bloques de 15 min

            // 🎨 RENDERIZADO PERSONALIZADO DE LA TARJETA ROJA 🎨
            eventContent: function(arg) {
                const servicio = arg.event.extendedProps.servicio || 'Turno';
                const cliente = arg.event.title || 'Cliente';
                const timeText = arg.timeText || ''; 
                
                // Usamos la clase wrapper para que el CSS (white-space: normal) haga efecto
                return { html: `
                    <div class="fc-event-content-wrapper">
                        <span class="event-service">${servicio}</span>
                        <span class="event-title">${cliente}</span>
                        <span class="event-time">${timeText}</span>
                    </div>
                `};
            },

            events: async function(info, successCallback, failureCallback) {
                try {
                    const q = query(
                        collection(db, "Turnos"),
                        where("Barbero", "==", barberName)
                    );

                    const querySnapshot = await getDocs(q);
                    let events = [];

                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        
                        let start = data.Fecha instanceof Object ? data.Fecha.toDate() : new Date(data.Fecha);
                        // Duración por defecto 45 min
                        let end = new Date(start.getTime() + 45 * 60000); 

                        events.push({
                            id: docSnap.id,
                            title: data.ClienteNombre || "Anónimo",
                            start: start,
                            end: end,
                            backgroundColor: '#AE0E30',
                            borderColor: '#AE0E30',
                            textColor: '#ffffff',
                            extendedProps: {
                                servicio: data.Servicio || "Corte",
                                telefono: data.ClienteTel || ""
                            }
                        });
                    });

                    successCallback(events);

                } catch (error) {
                    console.error("Error cargando agenda:", error);
                    failureCallback(error);
                }
            },
            
            eventClick: function(info) {
                alert(`Cliente: ${info.event.title}\nServicio: ${info.event.extendedProps.servicio}\nTel: ${info.event.extendedProps.telefono}`);
            }
        });

        calendarInstance.render();
    }

    // ==========================================
    // 4. LÓGICA DE CLIENTE (Mis Turnos)
    // ==========================================
    async function loadUserBookings(uid) {
        if (!bookingsListContainer) return;
        bookingsListContainer.innerHTML = '<p style="text-align:center; color:#666;">Cargando...</p>';

        const q = query(collection(db, "Turnos"), where("ClienteId", "==", uid));
        const querySnapshot = await getDocs(q);

        myTurnos = [];
        bookingsListContainer.innerHTML = '';

        if (querySnapshot.empty) {
            const noMsg = document.getElementById('no-bookings-msg');
            if(noMsg) noMsg.classList.remove('hidden');
        } else {
            const noMsg = document.getElementById('no-bookings-msg');
            if(noMsg) noMsg.classList.add('hidden');
            
            querySnapshot.forEach((doc) => {
                myTurnos.push({ id: doc.id, ...doc.data() });
            });

            // Ordenar: más reciente primero
            myTurnos.sort((a, b) => b.Fecha.toDate() - a.Fecha.toDate());

            myTurnos.forEach(turno => {
                const dateObj = turno.Fecha.toDate();
                const fechaStr = dateObj.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
                const horaStr = dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

                const card = document.createElement('div');
                // Estilos inline básicos para la tarjeta del cliente
                card.style = "background:#1a1a1a; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #333; display:flex; justify-content:space-between; align-items:center;";
                
                card.innerHTML = `
                    <div>
                        <div style="color:#AE0E30; font-weight:bold; font-size:0.9rem;">${fechaStr} - ${horaStr}</div>
                        <div style="color:white; font-size:1.1rem; font-weight:bold;">${turno.Servicio}</div>
                        <div style="color:#888; font-size:0.9rem;">Barbero: ${turno.Barbero}</div>
                    </div>
                    <button class="btn-cancel-turn" data-id="${turno.id}" style="background:transparent; border:1px solid #666; color:#888; padding:5px 10px; border-radius:4px; cursor:pointer;">
                        Cancelar
                    </button>
                `;

                // Botón cancelar de cada tarjeta
                const btnCancel = card.querySelector('.btn-cancel-turn');
                btnCancel.addEventListener('click', (e) => {
                    itemToDeleteId = e.target.getAttribute('data-id');
                    modalText.textContent = "¿Seguro que deseás cancelar este turno?";
                    deleteModal.classList.add('active');
                });

                bookingsListContainer.appendChild(card);
            });
        }
    }

    // --- MANEJO DEL MODAL DE BORRADO ---
    if (btnModalCancel) {
        btnModalCancel.addEventListener('click', () => deleteModal.classList.remove('active'));
    }

    if (btnModalConfirm) {
        btnModalConfirm.addEventListener('click', async () => {
            if (itemToDeleteId) {
                try {
                    await deleteDoc(doc(db, "Turnos", itemToDeleteId));
                    deleteModal.classList.remove('active');
                    // Recargar la lista
                    loadUserBookings(currentUserUid);
                } catch (error) {
                    console.error("Error al borrar:", error);
                    alert("Error al cancelar el turno.");
                }
            }
        });
    }

});