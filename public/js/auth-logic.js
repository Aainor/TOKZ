// ==========================================
// 1. IMPORTACIONES
// ==========================================
import { auth, provider, db } from './firebase.js';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 2. CONFIGURACIÓN GLOBAL
// ==========================================

const EMAIL_SERVICE_ID = "service_hdoerpa";
const EMAIL_TEMPLATE_ID = "template_16dkj9g";

// STAFF: Si el email coincide, entra como Barbero
const STAFF_EMAILS = {
    "jonathanrimada9@icloud.com": "Jonathan",
    "lautabarber.17@gmail.com": "Lautaro",
    "marsanzmos@gmail.com": "Alejandra"
};

// ADMIN: Si el email coincide, entra al Panel de Control
const ADMIN_EMAILS = [
    "nicolasruibals4@gmail.com"
];

// VARIABLES GLOBALES
let currentUser = null;
let calendarInstance = null;
let BARBERS_CONFIG = []; // Se llena desde barberos.json
let PRICES_DB = {};
let myTurnos = [];


// ==========================================
// 3. UTILIDADES
// ==========================================

function getLocalDateISO(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localTime = new Date(dateObj.getTime() - offset);
    return localTime.toISOString().split('T')[0];
}

// --- UTILIDAD: Formatear Dinero ---
function formatMoney(amount) {
    if (!amount || amount === 0 || amount === '0') return '$ -';
    return '$' + Number(amount).toLocaleString('es-AR');
}

// FUNCIÓN GOOGLE CALENDAR
window.abrirLinkGoogleCalendar = function (turnoData) {
    if (!turnoData) return;
    const nombreBarbero = turnoData.barbero || turnoData.barberoNombre;

    // Emails para invitación a calendario
    const EMAILS_BARBEROS = {
        "Jonathan": "jonathanrimada9@icloud.com",
        "Jonatan Rimada": "jonathanrimada9@icloud.com",
        "Lautaro": "lautabarber.17@gmail.com",
        "Lautaro Ribeiro": "lautabarber.17@gmail.com",
        "Alejandra": "marsanzmos@gmail.com",
        "Alejandra Sanchez": "marsanzmos@gmail.com",
        "Nicolás": "fnvillalva.17@gmail.com",
        "Nicolás Ruibal": "fnvillalva.17@gmail.com"
    };

    // Buscar email exacto o parcial
    let emailBarbero = EMAILS_BARBEROS[nombreBarbero];
    if (!emailBarbero) {
        const key = Object.keys(EMAILS_BARBEROS).find(k => nombreBarbero.includes(k));
        if (key) emailBarbero = EMAILS_BARBEROS[key];
    }

    const fechaLimpia = turnoData.fecha.replace(/-/g, '');
    const horaLimpia = turnoData.hora.replace(/:/g, '') + '00';
    const fechasGoogle = `${fechaLimpia}T${horaLimpia}/${fechaLimpia}T${horaLimpia}`;

    const baseUrl = "https://calendar.google.com/calendar/render";
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: `Corte con ${nombreBarbero} - Tokz Barber`,
        details: `Servicio: ${turnoData.servicio}.`,
        dates: fechasGoogle,
        location: "Tokz Barber Shop"
    });
    if (emailBarbero) params.append('add', emailBarbero);
    window.open(`${baseUrl}?${params.toString()}`, '_blank');
}

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
                    <div class="info-row"><span class="info-label">Cliente</span><span class="info-value" id="modal-cliente">...</span></div>
                    <div class="info-row"><span class="info-label">Servicio</span><span class="info-value" id="modal-servicio">...</span></div>
                    <div class="info-row"><span class="info-label">Horario</span><span class="info-value" id="modal-horario">...</span></div>
                    <div class="info-row"><span class="info-label">Precio Estimado</span><span class="info-value" id="modal-precio">...</span></div>
                    <div class="info-row"><span class="info-label">Contacto</span><span class="info-value email" id="modal-email">...</span></div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        setTimeout(() => {
            const overlay = document.getElementById('modal-detalle-overlay');
            if (overlay) overlay.addEventListener('click', (e) => { if (e.target.id === 'modal-detalle-overlay') closeDetalleModal(); });
        }, 500);
    }
}
window.closeDetalleModal = function () { const el = document.getElementById('modal-detalle-overlay'); if (el) el.classList.remove('active'); }


// ==========================================
// 🚀 INICIO DE LA APP
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("⚡ Iniciando Auth Logic (Unificado Final)...");

    // ------------------------------------------
    // A. LÓGICA DE LOGIN CON GOOGLE
    // ------------------------------------------
    const googleBtn = document.querySelector('.google-btn');
    if (googleBtn) {
        const newGoogleBtn = googleBtn.cloneNode(true);
        googleBtn.parentNode.replaceChild(newGoogleBtn, googleBtn);

        newGoogleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Error Google:", error);
                alert("Error de acceso: " + error.message);
            }
        });
    }

    // ------------------------------------------
    // B. ELEMENTOS DOM (VISTAS)
    // ------------------------------------------
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewBooking = document.getElementById('booking-mod');
    const viewBarber = document.getElementById('view-barber');
    const viewAdmin = document.getElementById('view-admin');

    // --- FUNCIÓN SWITCH VIEW CORREGIDA (FIX PANTALLA NEGRA) ---
    function switchView(viewToShow) {
        if (!viewLogin) return;

        // 1. Ocultar todo y resetear clases
        [viewLogin, viewRegister, viewUser, viewBooking, viewBarber, viewAdmin].forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('fade-in', 'appear');
                el.style.display = '';
            }
        });

        // 2. Mostrar la vista elegida
        if (viewToShow) {
            viewToShow.classList.remove('hidden');

            // Si es Admin o Barbero, display block directo (sin fade)
            if (viewToShow === viewBarber || viewToShow === viewAdmin) {
                viewToShow.style.display = 'block';
            } else {
                // Si es Login/User, usar animación
                viewToShow.classList.add('fade-in');
                setTimeout(() => { viewToShow.classList.add('appear'); }, 10);
            }
        }
    }

    // ==========================================
    // 4. AUTENTICACIÓN (ROLES)
    // ==========================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("✅ Usuario:", user.email);
            currentUser = user;

            // Lógica de redirección solo si estamos en login.html
            if (viewLogin) {
                try {
                    const userRef = doc(db, "Clientes", user.uid);
                    const userSnap = await getDoc(userRef);
                    let rol = 'cliente';
                    let nombreOficial = user.displayName;

                    if (STAFF_EMAILS.hasOwnProperty(user.email)) {
                        rol = 'barbero';
                        nombreOficial = STAFF_EMAILS[user.email];
                    } else if (ADMIN_EMAILS.includes(user.email)) {
                        rol = 'admin';
                    }

                    if (!userSnap.exists()) {
                        await setDoc(userRef, { Nombre: nombreOficial, Email: user.email, Cortes_Totales: 0, Fecha_Registro: new Date(), rol: rol });
                    }

                    if (rol === 'admin') {
                        switchView(viewAdmin);
                        initAdminLogic();
                    } else if (rol === 'barbero') {
                        const bName = document.getElementById('barber-name-display');
                        if (bName) bName.textContent = nombreOficial;
                        loadBarberAgenda(nombreOficial);
                        switchView(viewBarber);
                    } else {
                        loadUserBookings(user.uid);
                        const uName = document.getElementById('user-name-display');
                        if (uName) uName.textContent = user.displayName;
                        switchView(viewUser);
                    }
                } catch (e) { console.error("Error Auth:", e); }
            }
            if (typeof updateUI === 'function') updateUI();

        } else {
            console.log("⚪ Sin usuario.");
            currentUser = null;
            // Si estamos en login.html, mostramos el login
            if (viewLogin) switchView(viewLogin);
            if (typeof updateUI === 'function') updateUI();
        }
    });

    // ==========================================
    // 5. LÓGICA DEL PANEL DE ADMIN
    // ==========================================
    function initAdminLogic() {
        const configRef = doc(db, "configuracion", "textos_landing");
        async function cargarDatosEditor() {
            const inputPromo = document.getElementById('admin-promo');
            if (!inputPromo) return;
            try {
                const docSnap = await getDoc(configRef);
                if (docSnap.exists()) {
                    const d = docSnap.data();
                    document.getElementById('admin-promo').value = d.promo_texto || "";
                    document.getElementById('admin-serv-titulo').value = d.serv_titulo || "";
                    document.getElementById('admin-serv-desc').value = d.serv_desc || "";
                    document.getElementById('admin-turnos-titulo').value = d.turnos_titulo || "";
                    document.getElementById('admin-turnos-desc').value = d.turnos_desc || "";
                    document.getElementById('admin-edu-titulo').value = d.edu_titulo || "";
                    document.getElementById('admin-edu-desc').value = d.edu_desc || "";
                }
            } catch (e) { console.error(e); }
        }
        cargarDatosEditor();

        const btnGuardarTodo = document.getElementById('btn-guardar-todo');
        if (btnGuardarTodo) {
            const nuevoBtn = btnGuardarTodo.cloneNode(true);
            btnGuardarTodo.parentNode.replaceChild(nuevoBtn, btnGuardarTodo);

            nuevoBtn.addEventListener('click', async () => {
                const txtOriginal = nuevoBtn.innerHTML;
                nuevoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
                nuevoBtn.disabled = true;
                const data = {
                    promo_texto: document.getElementById('admin-promo').value,
                    serv_titulo: document.getElementById('admin-serv-titulo').value,
                    serv_desc: document.getElementById('admin-serv-desc').value,
                    turnos_titulo: document.getElementById('admin-turnos-titulo').value,
                    turnos_desc: document.getElementById('admin-turnos-desc').value,
                    edu_titulo: document.getElementById('admin-edu-titulo').value,
                    edu_desc: document.getElementById('admin-edu-desc').value
                };
                try {
                    await setDoc(configRef, data, { merge: true });
                    alert("¡Cambios guardados correctamente en la web!");
                } catch (e) { alert("Error al guardar."); }
                finally {
                    nuevoBtn.innerHTML = txtOriginal;
                    nuevoBtn.disabled = false;
                }
            });
        }
    }

    const btnAdminRefresh = document.getElementById('btn-admin-refresh');
    if (btnAdminRefresh) {
        btnAdminRefresh.addEventListener('click', () => {
            const f = document.getElementById('admin-date-picker').value;
            if (f) loadAdminDashboard(f);
            else alert("Seleccioná una fecha");
        });
    }

    const btnLogoutAdmin = document.getElementById('btn-logout-admin');
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener('click', () => signOut(auth));
    const btnLogoutBarber = document.getElementById('btn-logout-barber');
    if (btnLogoutBarber) btnLogoutBarber.addEventListener('click', () => signOut(auth));

    // Admin -> Agenda
    const btnGoCalendar = document.getElementById('btn-go-calendar');
    const btnBackAdmin = document.getElementById('btn-back-admin');
    if (btnGoCalendar) {
        btnGoCalendar.onclick = () => {
            const nombreAgenda = "Nicolás";
            loadBarberAgenda(nombreAgenda);
            const bName = document.getElementById('barber-name-display');
            if (bName) bName.textContent = nombreAgenda;
            switchView(viewBarber);
            if (btnBackAdmin) btnBackAdmin.classList.remove('hidden');
        };
    }
    if (btnBackAdmin) btnBackAdmin.onclick = () => switchView(viewAdmin);

    // ==========================================
    // LÓGICA DE CARGA MANUAL (MEJORADA)
    // ==========================================
    const manualModal = document.getElementById('manual-modal-overlay');
    const btnOpenManual = document.getElementById('btn-add-manual');
    const btnCloseManual = document.getElementById('close-manual-btn');
    const btnSaveManual = document.getElementById('btn-save-manual');

    // Inputs del modal
    const inpManualName = document.getElementById('manual-client-name');
    const inpManualContact = document.getElementById('manual-client-contact');
    const inpManualService = document.getElementById('manual-service-select');
    const inpManualDate = document.getElementById('manual-date-picker');
    const gridManualTime = document.getElementById('manual-time-grid');

    let manualTimeSelected = null;

    if (btnOpenManual && manualModal) {

        // 1. ABRIR MODAL
        btnOpenManual.addEventListener('click', () => {
            // Limpiar campos
            inpManualName.value = '';
            inpManualContact.value = '';
            inpManualDate.value = getLocalDateISO(new Date()); // Fecha de hoy por defecto
            manualTimeSelected = null;
            btnSaveManual.disabled = true;
            btnSaveManual.style.opacity = '0.5';

            // Cargar horarios para hoy automáticamente
            loadManualTimeSlots();

            manualModal.classList.remove('hidden');
            manualModal.classList.add('active'); // Usar clase active si la tenés en CSS para fade
        });

        // 2. CERRAR MODAL
        btnCloseManual.addEventListener('click', () => {
            manualModal.classList.add('hidden');
            manualModal.classList.remove('active');
        });

        // 3. CAMBIO DE FECHA -> RECARGAR HORARIOS
        inpManualDate.addEventListener('change', loadManualTimeSlots);

        // 4. FUNCIÓN CARGAR HORARIOS DEL BARBERO ACTUAL
        // 4. FUNCIÓN CARGAR HORARIOS DEL BARBERO ACTUAL (CORREGIDA)
        async function loadManualTimeSlots() {
            gridManualTime.innerHTML = '<p style="color:#888; font-size:0.8rem;">Cargando horarios...</p>';

            const dateStr = inpManualDate.value;
            if (!dateStr) return;

            // --- CORRECCIÓN CLAVE: Cargar JSON si está vacío ---
            if (!BARBERS_CONFIG || BARBERS_CONFIG.length === 0) {
                try {
                    const res = await fetch('/public/components/barberos.json');
                    BARBERS_CONFIG = await res.json();
                    console.log("✅ JSON cargado para manual:", BARBERS_CONFIG);
                } catch (e) {
                    console.error("Error cargando JSON:", e);
                    gridManualTime.innerHTML = '<p style="color:red;">Error de configuración</p>';
                    return;
                }
            }

            // Obtenemos nombre del barbero (o Admin)
            const barberNameDisplay = document.getElementById('barber-name-display');
            const currentBarberName = barberNameDisplay ? barberNameDisplay.textContent : "Staff";

            // Calculamos día de la semana
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayIdx = dateObj.getDay();

            // Recopilamos horarios válidos
            // SI es un barbero específico, usamos solo sus horas.
            // SI no encuentra el nombre (ej: Admin), sumamos TODOS los horarios de ese día.
            let validHours = new Set();
            const specificBarber = BARBERS_CONFIG.find(b => b.name === currentBarberName);

            if (specificBarber) {
                if (specificBarber.days.includes(dayIdx)) {
                    specificBarber.hours.forEach(h => validHours.add(h));
                } else {
                    gridManualTime.innerHTML = '<p style="color:#AE0E30; font-size:0.9rem;">No trabajás este día.</p>';
                    return;
                }
            } else {
                // Modo Admin: Mostrar horarios de cualquiera que trabaje hoy
                BARBERS_CONFIG.forEach(b => {
                    if (b.days.includes(dayIdx)) {
                        b.hours.forEach(h => validHours.add(h));
                    }
                });
            }

            // Ordenamos horarios (09:30, 10:00, 10:30...)
            const sortedHours = Array.from(validHours).sort();

            if (sortedHours.length === 0) {
                gridManualTime.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">Local cerrado este día.</p>';
                return;
            }

            // Buscar ocupados en Firebase
            try {
                // Si es un barbero específico, filtramos por él. Si es Admin, vemos todo.
                let q;
                if (specificBarber) {
                    q = query(collection(db, "turnos"), where("date", "==", dateStr), where("pro", "==", currentBarberName));
                } else {
                    q = query(collection(db, "turnos"), where("date", "==", dateStr));
                }

                const snap = await getDocs(q);
                const takenSlots = snap.docs.map(doc => doc.data().time);

                gridManualTime.innerHTML = '';

                sortedHours.forEach(h => {
                    const btn = document.createElement('button');

                    // CLASE BASE: Solo asignamos la clase, sin estilos .style aquí
                    btn.className = 'time-btn';
                    btn.textContent = h;

                    if (takenSlots.includes(h)) {
                        // SI ESTÁ OCUPADO
                        btn.classList.add('taken');
                        btn.disabled = true;
                    } else {
                        // SI ESTÁ LIBRE
                        btn.addEventListener('click', () => {
                            // Limpiar selección previa
                            document.querySelectorAll('#manual-time-grid .time-btn').forEach(b => {
                                b.classList.remove('active');
                            });

                            // Activar el actual
                            btn.classList.add('active');
                            manualTimeSelected = h;

                            // Habilitar botón de guardar
                            btnSaveManual.disabled = false;
                            btnSaveManual.style.opacity = '1';
                        });
                    }
                    gridManualTime.appendChild(btn);
                });

            } catch (error) {
                console.error("Error manual slots:", error);
                gridManualTime.innerHTML = '<p>Error de conexión</p>';
            }
        }

        // 5. GUARDAR TURNO
        if (btnSaveManual) {
            btnSaveManual.addEventListener('click', async () => {
                const name = inpManualName.value.trim();
                const contact = inpManualContact.value.trim();
                const service = inpManualService.value;
                const date = inpManualDate.value;

                if (!name || !manualTimeSelected) {
                    alert("Faltan datos: Asegurate de poner nombre y elegir un horario.");
                    return;
                }

                // Obtener nombre del barbero actual
                const barberNameDisplay = document.getElementById('barber-name-display');
                const currentBarberName = barberNameDisplay ? barberNameDisplay.textContent : "Staff";

                btnSaveManual.textContent = "Guardando...";
                btnSaveManual.disabled = true;

                // --- MAPA DE PRECIOS MANUALES ---
                // Acá definimos cuánto vale cada cosa cuando lo cargás a mano
                const PRECIOS_MANUALES = {
                    "Corte de Cabello": 16000,
                    "Barba": 10000,
                    "Corte + Barba": 18000,
                    "Color": 25000 // Ajustalo al valor real
                };

                // Si el servicio no está en la lista, pone 0
                const precioFinal = PRECIOS_MANUALES[service] || 0;

                try {
                    await addDoc(collection(db, "turnos"), {
                        clientName: name,
                        clientEmail: contact || "No especificado",
                        services: [service],
                        date: date,
                        time: manualTimeSelected,
                        pro: currentBarberName,
                        total: precioFinal, // <--- ACÁ SE GUARDA EL PRECIO CORRECTO
                        status: "confirmed",
                        type: "manual_admin",
                        created_at: new Date()
                    });

                    // ============================================================
                    // 2. NUEVO: ENVIAR EMAIL AL CLIENTE (Si tiene email puesto)
                    // ============================================================
                    if (contact && contact.includes('@')) {
                        console.log("📧 Enviando confirmación a:", contact);
                        
                        // Usamos las constantes que ya tenés definidas arriba en el archivo
                        await emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, {
                            to_name: name,
                            to_email: contact,
                            service_list: service,
                            date_info: date + " " + manualTimeSelected,
                            professional: currentBarberName,
                            total_price: "$" + precioFinal,
                            message: "Turno reservado manualmente por el staff."
                        });
                        console.log("✅ Email enviado correctamente");
                    }

                    // ============================================================
                    // 3. NUEVO: ABRIR GOOGLE CALENDAR (RECORDATORIO PARA EL BARBERO)
                    // ============================================================
                    // Esto abrirá la pestaña que mostraste en la foto con los datos precargados
                    if (typeof window.abrirLinkGoogleCalendar === 'function') {
                        window.abrirLinkGoogleCalendar({
                            fecha: date,
                            hora: manualTimeSelected,
                            barbero: currentBarberName,
                            // Truco: Agregamos el nombre del cliente al servicio para que se lea en la descripción
                            servicio: `${service} - Cliente: ${name}`
                        });
                    }

                    alert(`¡Turno guardado! Precio registrado: $${precioFinal}`);
                    manualModal.classList.add('hidden');
                    manualModal.classList.remove('active');

                    // Recargar la agenda para ver el cambio
                    loadBarberAgenda(currentBarberName);

                } catch (e) {
                    console.error("Error guardando manual:", e);
                    alert("Error al guardar en la base de datos.");
                } finally {
                    btnSaveManual.textContent = "Confirmar Turno";
                    btnSaveManual.disabled = false;
                }
            });
        }
    }

    // ==========================================
    // 6. LÓGICA CLIENTE (MIS TURNOS)
    // ==========================================
    const bookingsListContainer = document.querySelector('.bookings-list');
    const btnViewBookings = document.getElementById('btn-view-bookings');
    const btnBackDashboard = document.getElementById('btn-back-dashboard');
    const btnLogout = document.getElementById('btn-logout');

    if (bookingsListContainer) {
        if (btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

        if (btnViewBookings) btnViewBookings.addEventListener('click', () => { renderBookings(); switchView(viewBooking); });
        if (btnBackDashboard) btnBackDashboard.addEventListener('click', () => switchView(viewUser));
    }

    async function loadUserBookings(uid) {
        if (!bookingsListContainer) return;
        try {
            const q = query(collection(db, "turnos"), where("uid", "==", uid));
            const snap = await getDocs(q);
            myTurnos = [];
            snap.forEach(d => myTurnos.push({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); }
    }

    function renderBookings() {
        if (!bookingsListContainer) return;
        bookingsListContainer.innerHTML = '';
        if (myTurnos.length === 0) { bookingsListContainer.innerHTML = '<p style="color:#777; text-align:center;">No tenés turnos.</p>'; return; }
        myTurnos.sort((a, b) => new Date(a.date) - new Date(b.date));
        myTurnos.forEach(t => {
            bookingsListContainer.innerHTML += `
            <div class="booking-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:10px; border-left:3px solid #AE0E30;">
                <div style="text-align:left;">
                    <h4 style="color:white; margin:0;">${Array.isArray(t.services) ? t.services.join(" + ") : t.services}</h4>
                    <small style="color:#aaa;">📅 ${t.date} - ${t.time} | 💈 ${t.pro}</small>
                </div>
                <button class="btn-delete-booking" data-id="${t.id}" style="background:none; border:none; color:#ff4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
        document.querySelectorAll('.btn-delete-booking').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!confirm("¿Cancelar turno?")) return;
                const id = e.currentTarget.getAttribute('data-id');
                try {
                    await deleteDoc(doc(db, "turnos", id));
                    myTurnos = myTurnos.filter(t => t.id !== id);
                    renderBookings();
                } catch (e) { alert("Error al cancelar"); }
            });
        });
    }


    // AGENDA BARBERO
    // ==========================================
    // AGENDA BARBERO (VISUALIZACIÓN)
    // ==========================================
    async function loadBarberAgenda(nombreBarbero) {
        const calendarEl = document.getElementById('calendar-barber');
        if (!calendarEl) return;
        calendarEl.innerHTML = '';
        injectModalHTML();

        try {
            const q = query(collection(db, "turnos"), where("pro", "==", nombreBarbero));
            const snap = await getDocs(q);
            let eventos = [];

            snap.forEach(d => {
                const data = d.data();
                if (data.date && data.time) {
                    const start = `${data.date}T${data.time}:00`;
                    // Calculamos fin (30 mins por defecto)
                    const end = new Date(new Date(start).getTime() + 30 * 60000).toISOString();

                    eventos.push({
                        id: d.id,
                        title: data.clientName || 'Cliente',
                        start: start,
                        end: end,
                        backgroundColor: '#AE0E30',
                        borderColor: '#ffffff',
                        textColor: '#ffffff',
                        extendedProps: {
                            servicio: Array.isArray(data.services) ? data.services.join(" + ") : data.services,
                            email: data.clientEmail || 'No especificado',
                            // ACÁ USAMOS LA FUNCIÓN NUEVA PARA QUE SE VEA EL $
                            precio: formatMoney(data.total)
                        }
                    });
                }
            });

            if (calendarInstance) calendarInstance.destroy();

            calendarInstance = new FullCalendar.Calendar(calendarEl, {
                initialView: window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek',
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
                locale: 'es',
                slotMinTime: '09:00:00',
                slotMaxTime: '21:00:00',
                allDaySlot: false,
                height: '100%',
                contentHeight: 'auto',
                slotDuration: '00:30:00',
                eventContent: function (arg) {
                    return {
                        html: `
                            <div class="turno-card">
                                <div class="turno-header"><span class="turno-hora">${arg.timeText}</span></div>
                                <div class="turno-body"><span class="turno-servicio">${arg.event.extendedProps.servicio}</span></div>
                            </div>`
                    };
                },
                events: eventos,
                eventClick: function (info) {
                    const p = info.event.extendedProps;
                    // Llenamos el modal negro con los datos
                    document.getElementById('modal-cliente').textContent = info.event.title;
                    document.getElementById('modal-servicio').textContent = p.servicio;
                    document.getElementById('modal-precio').textContent = p.precio; // Ya viene con formato $
                    document.getElementById('modal-email').textContent = p.email;

                    const fechaObj = info.event.start;
                    const horaStr = fechaObj.getHours().toString().padStart(2, '0') + ':' + fechaObj.getMinutes().toString().padStart(2, '0');
                    document.getElementById('modal-horario').textContent = `${horaStr} hs`;

                    document.getElementById('modal-detalle-overlay').classList.add('active');
                },
                windowResize: function (arg) {
                    const newView = window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek';
                    if (calendarInstance.view.type !== newView) calendarInstance.changeView(newView);
                }
            });
            calendarInstance.render();
        } catch (e) { console.error("Error calendario:", e); }
    }

    // ADMIN DASHBOARD
    async function loadAdminDashboard(fecha) {
        const tbody = document.getElementById('admin-table-body');
        if (!tbody) return;
        tbody.innerHTML = 'Cargando...';
        try {
            const snap = await getDocs(collection(db, "turnos"));
            tbody.innerHTML = '';
            let total = 0;
            const [y, m, d] = fecha.split('-');
            const format1 = `${y}-${m}-${d}`;

            let turnos = [];
            snap.forEach(doc => {
                const data = doc.data();
                if (data.date === format1) turnos.push(data);
            });

            if (turnos.length === 0) { tbody.innerHTML = '<tr><td colspan="5">No hay turnos</td></tr>'; return; }
            turnos.sort((a, b) => a.time.localeCompare(b.time));

            turnos.forEach(data => {
                const price = Number(data.total) || 0;
                total += price;
                tbody.innerHTML += `
                <tr>
                    <td>${data.time}</td>
                    <td>${data.clientName}</td>
                    <td>${Array.isArray(data.services) ? data.services.join("+") : data.services}</td>
                    <td>${data.pro}</td>
                    <td style="color:#4CAF50; font-weight:bold;">$${price}</td>
                </tr>`;
            });
            tbody.innerHTML += `<tr style="background:#333; font-weight:bold;"><td colspan="4" style="text-align:right;">TOTAL:</td><td style="color:#AE0E30;">$${total}</td></tr>`;
        } catch (e) { console.error(e); }
    }
});