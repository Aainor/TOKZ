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
    "pepito2134@gmail.com": "Jonathan",
    "fnvillalva.17@gmail.com": "Lautaro",
    "otro_mail@gmail.com": "Alejandra"
};

// ACÁ EL EMAIL DEL DUEÑO (ADMIN)
const ADMIN_EMAILS = [
    "elias04baez@gmail.com"
];

// Variable global para la instancia del calendario
let calendarInstance = null;

// ==========================================
// 🛠️ UTILIDADES VISUALES (SENIOR FIX)
// ==========================================

// 1. Inyectar HTML del Modal automáticamente
function injectModalHTML() {
    if (!document.getElementById('modal-detalle-overlay')) {
        const modalHTML = `
        <div id="modal-detalle-overlay">
            <div class="modal-detalle-card">
                <div class="detalle-header">
                    <h2 id="modal-titulo">DETALLE TURNO</h2>
                    <button class="close-modal-btn" onclick="closeDetalleModal()">&times;</button>
                </div>
                <div class="detalle-body">
                    <div class="info-row">
                        <span class="info-label">Cliente</span>
                        <span class="info-value" id="modal-cliente">...</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Servicio</span>
                        <span class="info-value" id="modal-servicio">...</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Horario</span>
                        <span class="info-value" id="modal-horario">...</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Precio Estimado</span>
                        <span class="info-value" id="modal-precio">...</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Contacto</span>
                        <span class="info-value email" id="modal-email">...</span>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        setTimeout(() => {
            const overlay = document.getElementById('modal-detalle-overlay');
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-detalle-overlay') closeDetalleModal();
                });
            }
        }, 500);
    }
}

// 2. Función global para cerrar modal
window.closeDetalleModal = function () {
    const el = document.getElementById('modal-detalle-overlay');
    if (el) el.classList.remove('active');
}

// ==========================================
// 🚀 INICIO DE LA APP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando App Integrada con Agenda FullCalendar Optimizada...");

    injectModalHTML();

    // --- REFERENCIAS DOM ---
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewRecovery = document.getElementById('view-recovery');
    const viewBooking = document.getElementById('booking-mod');
    const viewBarber = document.getElementById('view-barber');
    const viewAdmin = document.getElementById('view-admin');

    // Botones Admin
    const btnAdminRefresh = document.getElementById('btn-admin-refresh');
    const adminDatePicker = document.getElementById('admin-date-picker');
    const btnLogoutAdmin = document.getElementById('btn-logout-admin');
    const btnGoCalendar = document.getElementById('btn-go-calendar');
    const btnBackAdmin = document.getElementById('btn-back-admin');

    // 1. Botón BUSCAR (Admin)
    if (btnAdminRefresh) {
        btnAdminRefresh.addEventListener('click', () => {
            const fechaSeleccionada = adminDatePicker.value;
            if (fechaSeleccionada) {
                loadAdminDashboard(fechaSeleccionada);
            } else {
                alert("📅 Por favor elegí una fecha primero.");
            }
        });
    }

    // 2. Botón SALIR (Admin)
    if (btnLogoutAdmin) {
        btnLogoutAdmin.addEventListener('click', async () => {
            try { await signOut(auth); } catch (error) { console.error("Error al salir:", error); }
        });
    }

    // Botones Generales
    const btnLogout = document.getElementById('btn-logout');
    const btnViewBookings = document.getElementById('btn-view-bookings');
    const btnBackDashboard = document.getElementById('btn-back-dashboard');
    const bookingsListContainer = document.querySelector('.bookings-list');
    const googleBtn = document.querySelector('.google-btn');

    // --- GESTIÓN DE VISTAS ---
    function switchView(viewToShow) {
        [viewLogin, viewRegister, viewUser, viewRecovery, viewBooking, viewBarber, viewAdmin].forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('fade-in', 'appear');
                el.style.display = '';
            }
        });

        if (viewToShow) {
            viewToShow.classList.remove('hidden');
            if (viewToShow === viewBarber || viewToShow === viewAdmin) {
                viewToShow.style.display = 'block';
            } else {
                viewToShow.classList.add('fade-in', 'appear');
            }
        }
    }

    // ==========================================
    // LOGICA DE AUTENTICACIÓN
    // ==========================================

    let currentUserUid = null;
    let myTurnos = [];
    let itemToDeleteId = null;

    // Modal Borrar Referencias
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

                    // ================================================
                    // LOGICA BOTÓN "MI AGENDA" (Admin -> Calendar)
                    // ================================================
                    if (btnGoCalendar && btnBackAdmin) {
                        btnBackAdmin.classList.remove('hidden');

                        btnGoCalendar.onclick = () => {
                            const nombreAgendaAdmin = "Nicolás";
                            console.log("Admin yendo a agenda de:", nombreAgendaAdmin);

                            loadBarberAgenda(nombreAgendaAdmin);

                            const barberNameDisplay = document.getElementById('barber-name-display');
                            if (barberNameDisplay) barberNameDisplay.textContent = nombreAgendaAdmin;

                            switchView(viewBarber);
                        };

                        btnBackAdmin.onclick = () => {
                            switchView(viewAdmin);
                        };
                    }
                }
                else if (rolDetectado === 'barbero') {
                    if (btnBackAdmin) btnBackAdmin.classList.add('hidden');

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

    // =================================================================
    // 3. FUNCIÓN BARBERO (FIX VISUAL + VISTAS + IDIOMA)
    // =================================================================
    async function loadBarberAgenda(nombreBarbero) {
        const calendarEl = document.getElementById('calendar-barber');
        if (!calendarEl) return;

        injectModalHTML();

        calendarEl.innerHTML = '';

        try {
            console.log(`📅 Cargando calendario optimizado para: "${nombreBarbero}"`);

            const q = query(collection(db, "turnos"), where("pro", "==", nombreBarbero));
            const querySnapshot = await getDocs(q);
            let eventos = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.date && data.time) {
                    const startStr = `${data.date}T${data.time}:00`;
                    // 30 minutos exactos
                    let endDate = new Date(new Date(startStr).getTime() + 30 * 60000);

                    let serviciosTexto = Array.isArray(data.services) ? data.services.join(" + ") : data.services;

                    eventos.push({
                        id: doc.id,
                        title: data.clientName || 'Cliente',
                        start: startStr,
                        end: endDate.toISOString(),
                        backgroundColor: '#AE0E30',
                        borderColor: '#ffffff', // Borde blanco para separar visualmente
                        textColor: '#ffffff',
                        extendedProps: {
                            servicio: serviciosTexto,
                            email: data.clientEmail || 'No especificado',
                            precio: data.total || '$ -'
                        }
                    });
                }
            });

            if (calendarInstance) calendarInstance.destroy();

            // DETECCIÓN INTELIGENTE DE VISTA
            const getInitialView = () => window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek';

            calendarInstance = new FullCalendar.Calendar(calendarEl, {
                initialView: getInitialView(),

                // --- FIX 1: VISTAS (MES, SEMANA, DÍA) ---
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay' // Agregado Mes
                },

                // --- FIX 2: IDIOMA BOTONES ---
                locale: 'es',
                buttonText: {
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día',
                    list: 'Lista'
                },

                slotMinTime: '09:00:00',
                slotMaxTime: '21:00:00',
                allDaySlot: false,
                slotDuration: '00:30:00',

                slotEventOverlap: false,
                eventMaxStack: 2,

                windowResize: function (arg) {
                    const newView = window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek';
                    if (calendarInstance.view.type !== newView) {
                        calendarInstance.changeView(newView);
                    }
                },

                height: '100%',
                contentHeight: 'auto',
                nowIndicator: true,
                events: eventos,

                // --- FIX 3: CONTENIDO COMPACTO (Para que entre en el cuadro) ---
                eventContent: function (arg) {
                    // Creamos un contenedor limpio y sin paddings excesivos
                    return {
                        html: `
                            <div class="turno-card">
                                <div class="turno-header">
                                    <span class="turno-hora">${arg.timeText}</span>
                                </div>
                                <div class="turno-body">
                                    <span class="turno-servicio">${arg.event.extendedProps.servicio}</span>
                                </div>
                            </div>
                        `
                    };
                },

                eventClick: function (info) {
                    const props = info.event.extendedProps;
                    document.getElementById('modal-cliente').textContent = info.event.title;
                    document.getElementById('modal-servicio').textContent = props.servicio;

                    const fechaObj = info.event.start;
                    const horaStr = fechaObj.getHours().toString().padStart(2, '0') + ':' + fechaObj.getMinutes().toString().padStart(2, '0');
                    document.getElementById('modal-horario').textContent = `${horaStr} hs`;

                    document.getElementById('modal-email').textContent = props.email;
                    document.getElementById('modal-precio').textContent = props.precio;

                    const modalOverlay = document.getElementById('modal-detalle-overlay');
                    if (modalOverlay) modalOverlay.classList.add('active');
                }
            });

            calendarInstance.render();

        } catch (error) {
            console.error("Error agenda:", error);
            calendarEl.innerHTML = '<p style="color:red;">Error de carga.</p>';
        }
    }

    // ==========================================
    // 6. FUNCIÓN ADMIN: BÚSQUEDA FLEXIBLE
    // ==========================================
    async function loadAdminDashboard(fechaSeleccionada) {
        const adminTableBody = document.getElementById('admin-table-body');
        const adminMsg = document.getElementById('admin-loading-msg');

        const [anio, mes, dia] = fechaSeleccionada.split('-');

        const formatoGuion = `${anio}-${mes}-${dia}`;
        const formatoBarra = `${dia}/${mes}/${anio}`;
        const formatoBarraCorta = `${Number(dia)}/${Number(mes)}/${anio}`;

        console.log(`🔎 Buscando turnos con: ${formatoGuion} O ${formatoBarra} O ${formatoBarraCorta}`);

        if (!adminTableBody) return;
        adminTableBody.innerHTML = '';
        if (adminMsg) {
            adminMsg.style.display = 'block';
            adminMsg.textContent = 'Buscando en la base de datos...';
        }

        try {
            const turnosRef = collection(db, "turnos");
            const querySnapshot = await getDocs(turnosRef);

            let turnosDelDia = [];
            let cajaTotal = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let esDelDia = false;

                if (data.Fecha && data.Fecha.toDate) {
                    const fechaObj = data.Fecha.toDate();
                    const fechaIso = fechaObj.toISOString().split('T')[0];
                    if (fechaIso === formatoGuion) esDelDia = true;
                }
                else {
                    const fechaString = data.date || data.fecha || data.Fecha || "";
                    if (fechaString === formatoGuion ||
                        fechaString === formatoBarra ||
                        fechaString === formatoBarraCorta) {
                        esDelDia = true;
                    }
                }

                if (esDelDia) {
                    const hora = data.time || data.hora || "00:00";
                    const nombre = data.clientName || data.cliente || "Cliente";
                    const profesional = data.pro || data.barbero || "Barbero";

                    let servicios = "Corte";
                    if (Array.isArray(data.services)) servicios = data.services.join(" + ");
                    else if (data.services) servicios = data.services;
                    else if (data.service) servicios = data.service;

                    let precioRaw = data.total || data.precio || data.price || 0;
                    let precioNum = 0;
                    if (typeof precioRaw === 'string') {
                        precioNum = Number(precioRaw.replace('$', '').replace('.', ''));
                    } else {
                        precioNum = Number(precioRaw);
                    }

                    turnosDelDia.push({
                        id: doc.id,
                        hora,
                        nombre,
                        servicios,
                        profesional,
                        precio: precioNum
                    });

                    cajaTotal += precioNum;
                }
            });

            if (adminMsg) adminMsg.style.display = 'none';

            if (turnosDelDia.length === 0) {
                adminTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:20px; color:#888;">
                            ❌ No hay turnos para la fecha <b>${formatoBarra}</b>.<br>
                            <small>Probé buscando "${formatoGuion}", "${formatoBarra}" y "${formatoBarraCorta}".</small>
                        </td>
                    </tr>`;
                return;
            }

            turnosDelDia.sort((a, b) => a.hora.localeCompare(b.hora));

            turnosDelDia.forEach(t => {
                let colorPro = "#666";
                if (t.profesional.includes('Nico')) colorPro = "#2196F3";
                else if (t.profesional.includes('Lautaro')) colorPro = "#FF9800";

                const row = `
                    <tr style="border-bottom: 1px solid #333;">
                        <td data-label="Hora" style="padding:10px; color:white;">${t.hora}</td>
                        <td data-label="Cliente" style="padding:10px; font-weight:bold; color:white;">${t.nombre}</td>
                        <td data-label="Servicio" style="padding:10px; color:#ccc;">${t.servicios}</td>
                        <td data-label="Barbero" style="padding:10px;">
                            <span style="background:${colorPro}; color:white; padding:3px 8px; border-radius:4px; font-size:0.8rem;">${t.profesional}</span>
                        </td>
                        <td data-label="Precio" style="padding:10px; color:#4CAF50; font-weight:bold; text-align:right;">$${t.precio.toLocaleString()}</td>
                    </tr>
                `;
                adminTableBody.insertAdjacentHTML('beforeend', row);
            });

            const totalRow = `
                <tr class="total-row">
                    <td colspan="4" data-label="Resumen" style="text-align: right;">TOTAL DEL DÍA:</td>
                    <td data-label="Total Caja" class="price-cell" style="font-size:1.2rem;">$${cajaTotal.toLocaleString()}</td>
                </tr>
            `;
            adminTableBody.insertAdjacentHTML('beforeend', totalRow);

        } catch (error) {
            console.error("Error Admin:", error);
            if (adminMsg) adminMsg.innerHTML = `<span style="color:red">Error: ${error.message}</span>`;
        }
    }
});