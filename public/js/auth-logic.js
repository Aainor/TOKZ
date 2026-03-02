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
        "Nicolás": "nicolasruibals4@gmail.com",
        "Nicolás Ruibal": "nicolasruibals4@gmail.com"
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

// ==========================================
    // 7. FUNCIONES AUXILIARES DE MODAL Y AGENDA
    // ==========================================

    // A. INYECTAR HTML DEL MODAL (Con botón de Eliminar agregado)
  // A. INYECTAR HTML DEL MODAL (CON IDs PARA OCULTAR COSAS)
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
                        <div class="info-row" id="row-cliente">
                            <span class="info-label" id="lbl-cliente">Cliente</span>
                            <span class="info-value" id="modal-cliente">...</span>
                        </div>
                        
                        <div class="info-row" id="row-servicio">
                            <span class="info-label">Servicio</span>
                            <span class="info-value" id="modal-servicio">...</span>
                        </div>

                        <div class="info-row" id="row-horario">
                            <span class="info-label">Horario</span>
                            <span class="info-value" id="modal-horario">...</span>
                        </div>

                        <div class="info-row" id="row-precio">
                            <span class="info-label">Precio Estimado</span>
                            <span class="info-value" id="modal-precio">...</span>
                        </div>

                        <div class="info-row" id="row-contacto">
                            <span class="info-label">Contacto</span>
                            <span class="info-value email" id="modal-email">...</span>
                        </div>
                        
                        <div style="margin-top: 25px; border-top: 1px solid #333; padding-top: 15px;">
                            <button id="btn-delete-event" style="width:100%; padding:12px; background:transparent; border:1px solid #ff4444; color:#ff4444; border-radius:6px; cursor:pointer; font-weight:bold; transition:all 0.3s; display:flex; align-items:center; justify-content:center; gap:8px;">
                                <i class="fa-solid fa-trash"></i> <span>CANCELAR TURNO</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            setTimeout(() => {
                const overlay = document.getElementById('modal-detalle-overlay');
                if (overlay) overlay.addEventListener('click', (e) => { 
                    if (e.target.id === 'modal-detalle-overlay') closeDetalleModal(); 
                });
                const btn = document.getElementById('btn-delete-event');
                if(btn){
                    btn.onmouseover = () => { btn.style.background = '#ff4444'; btn.style.color = 'white'; };
                    btn.onmouseout = () => { btn.style.background = 'transparent'; btn.style.color = '#ff4444'; };
                }
            }, 500);
        }
    }

    // B. FUNCIÓN PARA CERRAR EL MODAL (¡NO BORRAR ESTA LÍNEA!)
    window.closeDetalleModal = function () { 
        const el = document.getElementById('modal-detalle-overlay'); 
        if (el) el.classList.remove('active'); 
    }

    // C. CARGAR AGENDA DEL BARBERO (Con lógica de bloqueos y eliminación)
    async function loadBarberAgenda(nombreBarbero) {
        const calendarEl = document.getElementById('calendar-barber');
        if (!calendarEl) return;
        
        calendarEl.innerHTML = ''; // Limpiar calendario previo
        injectModalHTML(); // Asegurar que el modal existe

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
                    
                    // Diferenciar visualmente BLOQUEOS de TURNOS NORMALES
                    let isBlock = data.status === "blocked";
                    let bgColor = isBlock ? '#1a1a1a' : '#CC0000'; // Negro/Gris para bloqueos, Rojo para turnos
                    let borderColor = isBlock ? '#444' : '#ffffff';
                    
                    // Título: Si es bloqueo, dice "BLOQUEADO", si no, el nombre del cliente
                    let displayTitle = isBlock ? '⛔ BLOQUEADO' : (data.clientName || 'Cliente');

                    eventos.push({
                        id: d.id,
                        title: displayTitle,
                        start: start,
                        end: end,
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                        textColor: '#ffffff',
                        extendedProps: {
                            servicio: Array.isArray(data.services) ? data.services.join(" + ") : data.services,
                            email: data.clientEmail || 'No especificado',
                            precio: formatMoney(data.total), // Usa tu función formatMoney existente
                            esBloqueo: isBlock,
                            nombreReal: data.clientName // Guardamos el nombre/motivo real para el modal
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
                    // Diseño interno de la tarjeta del turno
                    return {
                        html: `
                            <div class="turno-card" style="background:${arg.event.backgroundColor}; border-left: 3px solid ${arg.event.borderColor}">
                                <div class="turno-header"><span class="turno-hora">${arg.timeText}</span></div>
                                <div class="turno-body">
                                    <span class="turno-servicio" style="font-size:0.85em; font-weight:bold;">${arg.event.extendedProps.servicio}</span>
                                    ${arg.event.extendedProps.esBloqueo ? `<br><span style="font-size:0.7em; opacity:0.8;">${arg.event.extendedProps.nombreReal}</span>` : ''}
                                </div>
                            </div>`
                    };
                },
                events: eventos,
                eventClick: function (info) {
                    const p = info.event.extendedProps;
                    
                    // 1. Llenar datos del modal negro
                    document.getElementById('modal-titulo').textContent = p.esBloqueo ? "HORARIO BLOQUEADO" : "DETALLE TURNO";
                    document.getElementById('modal-cliente').textContent = p.nombreReal; // Muestra Cliente o Motivo
                    document.getElementById('modal-servicio').textContent = p.servicio;
                    document.getElementById('modal-precio').textContent = p.precio;
                    document.getElementById('modal-email').textContent = p.email;

                    // Formatear hora para mostrar "10:00 hs"
                    const fechaObj = info.event.start;
                    const horaStr = fechaObj.getHours().toString().padStart(2, '0') + ':' + fechaObj.getMinutes().toString().padStart(2, '0');
                    document.getElementById('modal-horario').textContent = `${horaStr} hs`;

                    // 2. CONFIGURAR EL BOTÓN DE ELIMINAR/CANCELAR
                    const btnDelete = document.getElementById('btn-delete-event');
                    if (btnDelete) {
                        // Cambiar texto según si es turno o bloqueo
                        if (p.esBloqueo) {
                            btnDelete.innerHTML = '<i class="fa-solid fa-lock-open"></i> <span>DESBLOQUEAR HORARIO</span>';
                        } else {
                            btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i> <span>CANCELAR TURNO</span>';
                        }
                        
                        // Asignar la función de borrado
                        btnDelete.onclick = async function() {
                            const confirmMsg = p.esBloqueo 
                                ? "¿Seguro que querés desbloquear este horario? Quedará disponible para reservas." 
                                : `¿Seguro que querés cancelar el turno de ${p.nombreReal}? Esta acción no se puede deshacer.`;

                            if (confirm(confirmMsg)) {
                                try {
                                    btnDelete.disabled = true;
                                    btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
                                    
                                    // A) Borrar de Firebase
                                    await deleteDoc(doc(db, "turnos", info.event.id));
                                    
                                    // B) Borrar visualmente del calendario (sin recargar todo)
                                    info.event.remove();
                                    
                                    // C) Cerrar modal y avisar
                                    closeDetalleModal();
                                    // alert(p.esBloqueo ? "Horario liberado." : "Turno cancelado correctamente.");
                                    
                                } catch (error) {
                                    console.error("Error al eliminar:", error);
                                    alert("Error al intentar borrar. Revisá tu conexión.");
                                    btnDelete.disabled = false;
                                    btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i> Reintentar';
                                }
                            }
                        };
                    }

                    // 3. Mostrar el modal
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
  // ======================================================
    // ZONA DE REFERENCIAS DOM (DEFINIR TODO ACÁ ARRIBA)
    // ======================================================

    // 1. VISTAS PRINCIPALES
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewBooking = document.getElementById('booking-mod');
    const viewBarber = document.getElementById('view-barber');
    const viewAdmin = document.getElementById('view-admin');

    // 2. ELEMENTOS DEL MENÚ DESPLEGABLE (NUEVO)
    const btnNuevoTrigger = document.getElementById('btn-nuevo-trigger');
    const menuDropdown = document.getElementById('dropdown-menu-barber');
    const btnOpenReserva = document.getElementById('opt-reserva');
    const btnOpenBloqueo = document.getElementById('opt-bloqueo');

    // 3. ELEMENTOS DEL MODAL RESERVA MANUAL
    const manualModal = document.getElementById('manual-modal-overlay');
    const btnCloseManual = document.getElementById('close-manual-btn');
    const btnSaveManual = document.getElementById('btn-save-manual');
    const inpManualName = document.getElementById('manual-client-name');
    const inpManualContact = document.getElementById('manual-client-contact');
    const inpManualService = document.getElementById('manual-service-select');
    const inpManualDate = document.getElementById('manual-date-picker');
    const gridManualTime = document.getElementById('manual-time-grid');

    // 4. ELEMENTOS DEL MODAL BLOQUEO (EL QUE FALLABA)
    const blockModal = document.getElementById('block-modal-overlay');
    const btnCloseBlock = document.getElementById('close-block-btn');
    const btnCancelBlock = document.getElementById('btn-cancel-block'); // <--- AHORA SÍ EXISTE
    const btnConfirmBlock = document.getElementById('btn-confirm-block');
    const inpBlockReason = document.getElementById('block-reason');
    const inpBlockDate = document.getElementById('block-date');
    const selBlockStart = document.getElementById('block-start-time');
    const selBlockEnd = document.getElementById('block-end-time');

    // 5. VARIABLES DE ESTADO LOCAL
    let manualTimeSelected = null;

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
            try {
                const docSnap = await getDoc(configRef);
                if (docSnap.exists()) {
                    const d = docSnap.data();
                    
                    // Carga de datos con validación (si el input no existe, no hace nada)
                    const setVal = (id, val) => {
                        const el = document.getElementById(id);
                        if (el) el.value = val || "";
                    };

                    setVal('admin-promo', d.promo_texto);
                    setVal('admin-serv-titulo', d.serv_titulo);
                    setVal('admin-serv-desc', d.serv_desc);
                    
                    // NUEVO: Sección Tokz
                    setVal('admin-tokz-tag', d.tokz_tag);
                    setVal('admin-tokz-titulo', d.tokz_titulo);
                    setVal('admin-tokz-desc', d.tokz_desc);

                    // Educación
                    setVal('admin-edu-titulo', d.edu_titulo);
                    setVal('admin-edu-desc', d.edu_desc);
                }
            } catch (e) { 
                console.error("Error cargando datos del editor:", e); 
            }
        }
        cargarDatosEditor();

        const btnGuardarTodo = document.getElementById('btn-guardar-todo');
        if (btnGuardarTodo) {
            const nuevoBtn = btnGuardarTodo.cloneNode(true);
            btnGuardarTodo.parentNode.replaceChild(nuevoBtn, btnGuardarTodo);

            nuevoBtn.addEventListener('click', async (e) => {
                e.preventDefault(); // Cortamos cualquier comportamiento raro del navegador
                
                console.log("1. Botón accionado");
                const txtOriginal = nuevoBtn.innerHTML;
                nuevoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
                nuevoBtn.disabled = true;
                
                try {
                    console.log("2. Juntando la data del HTML...");
                    // Función segura para sacar valores (a prueba de navegadores viejos)
                    const getVal = (id) => {
                        const el = document.getElementById(id);
                        return el ? el.value : "";
                    };

                    const data = {
                        promo_texto: getVal('admin-promo'),
                        serv_titulo: getVal('admin-serv-titulo'),
                        serv_desc: getVal('admin-serv-desc'),
                        tokz_tag: getVal('admin-tokz-tag'),
                        tokz_titulo: getVal('admin-tokz-titulo'),
                        tokz_desc: getVal('admin-tokz-desc'),
                        edu_titulo: getVal('admin-edu-titulo'),
                        edu_desc: getVal('admin-edu-desc')
                    };
                    
                    console.log("3. Data empaquetada:", data);
                    console.log("4. Disparando a Firebase...");

                    // Armamos una carrera: O Firebase guarda, o a los 10 segundos cortamos todo (Timeout)
                    const guardarPromesa = setDoc(configRef, data, { merge: true });
                    const limiteTiempo = new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase no responde (Timeout de 10s)")), 10000));
                    
                    await Promise.race([guardarPromesa, limiteTiempo]);
                    
                    console.log("5. Éxito total");
                    alert("¡Cambios guardados correctamente en la web!");
                } catch (error) { 
                    console.error("❌ Error detectado en el proceso:", error);
                    alert("Falló el guardado: " + error.message + ".\nFijate en la consola (F12)."); 
                } finally {
                    // Pase lo que pase, devolvemos el botón a la normalidad
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
    // LÓGICA UNIFICADA: NUEVO, RESERVA Y BLOQUEO
    // ==========================================

    // A. MENÚ DESPLEGABLE (+ NUEVO)
    if (btnNuevoTrigger && menuDropdown) {
        btnNuevoTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('show');
            const icon = btnNuevoTrigger.querySelector('i');
            if (icon) icon.className = menuDropdown.classList.contains('show') ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
        });

        // Cerrar al hacer click afuera
        document.addEventListener('click', (e) => {
            if (!menuDropdown.contains(e.target) && !btnNuevoTrigger.contains(e.target)) {
                menuDropdown.classList.remove('show');
                const icon = btnNuevoTrigger.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-chevron-up';
            }
        });
    }

    // B. OPCIÓN 1: NUEVA RESERVA (MANUAL)
    if (btnOpenReserva) {
        btnOpenReserva.addEventListener('click', () => {
            if (menuDropdown) menuDropdown.classList.remove('show');

            // Resetear formulario
            if (inpManualName) inpManualName.value = '';
            if (inpManualContact) inpManualContact.value = '';
            if (inpManualDate) inpManualDate.value = getLocalDateISO(new Date());
            manualTimeSelected = null;
            
            if (btnSaveManual) {
                btnSaveManual.disabled = true;
                btnSaveManual.style.opacity = '0.5';
            }

            // Cargar horarios del día
            loadManualTimeSlots();

            if (manualModal) {
                manualModal.classList.remove('hidden');
                manualModal.classList.add('active');
            }
        });
    }

    // Cerrar modal reserva
    if (btnCloseManual && manualModal) {
        btnCloseManual.addEventListener('click', () => {
            manualModal.classList.add('hidden');
            manualModal.classList.remove('active');
        });
    }

    // Guardar Reserva (Lógica existente)
    if (btnSaveManual) {
        btnSaveManual.addEventListener('click', async () => {
            // ... (ACÁ VA TU LÓGICA DE GUARDADO EXISTENTE, NO HACE FALTA CAMBIARLA) ...
            // Solo asegurate de usar las variables que definimos arriba
            const name = inpManualName.value.trim();
            // ... resto del código de guardado ...
            // (Si querés te copio la función entera de guardado de nuevo, avisame)
            
            // PEQUEÑO RESUMEN PARA QUE NO SE ROMPA SI COPIAS Y PEGAS ESTO SOLO:
            const contact = inpManualContact.value.trim();
            const service = inpManualService.value;
            const date = inpManualDate.value;
            if (!name || !manualTimeSelected) { alert("Faltan datos"); return; }
            
            // ... (Logica de firebase addDoc) ...
            // Al final del guardado exitoso:
             const currentBarberName = document.getElementById('barber-name-display')?.textContent || "Staff";
             const PRECIOS_MANUALES = { "Corte de Cabello": 16000, "Barba": 10000, "Corte + Barba": 18000, "Color": 25000 };
             const precioFinal = PRECIOS_MANUALES[service] || 0;

             try {
                 await addDoc(collection(db, "turnos"), {
                     clientName: name, clientEmail: contact || "-", services: [service], date: date, time: manualTimeSelected,
                     pro: currentBarberName, total: precioFinal, status: "confirmed", type: "manual_admin", created_at: new Date()
                 });
                 
                 // Calendario y Email
                 if (typeof window.abrirLinkGoogleCalendar === 'function') window.abrirLinkGoogleCalendar({ fecha: date, hora: manualTimeSelected, barbero: currentBarberName, servicio: `${service} - ${name}` });
                 
                 alert("Turno guardado");
                 manualModal.classList.add('hidden'); manualModal.classList.remove('active');
                 loadBarberAgenda(currentBarberName);
             } catch(e) { console.error(e); alert("Error"); }
        });
    }

    // Cambio de fecha manual
    if (inpManualDate) inpManualDate.addEventListener('change', loadManualTimeSlots);


    // ==========================================
    // C. OPCIÓN 2: BLOQUEAR HORARIO (CORREGIDO FINAL)
    // ==========================================
    
    // Función auxiliar para llenar horas
    function llenarSelectoresHorario() {
        if (!selBlockStart || !selBlockEnd) return;
        
        let options = '';
        for (let h = 9; h < 21; h++) {
            ['00', '30'].forEach(m => {
                const time = `${h.toString().padStart(2, '0')}:${m}`;
                options += `<option value="${time}">${time} hs</option>`;
            });
        }
        options += `<option value="21:00">21:00 hs</option>`;
        
        selBlockStart.innerHTML = options;
        selBlockEnd.innerHTML = options;
        selBlockStart.value = "10:00";
        selBlockEnd.value = "11:00";
    }

    // 1. ABRIR EL MODAL
    if (btnOpenBloqueo) {
        btnOpenBloqueo.addEventListener('click', () => {
            // Cerrar menú si está abierto
            if (menuDropdown) menuDropdown.classList.remove('show');
            
            // Llenar selects si están vacíos
            if (selBlockStart && selBlockStart.innerHTML.trim() === "") {
                llenarSelectoresHorario();
            }
            
            // Resetear inputs
            if (inpBlockReason) inpBlockReason.value = "";
            if (inpBlockDate) inpBlockDate.value = getLocalDateISO(new Date());
            
            // MOSTRAR MODAL
            if (blockModal) {
                blockModal.classList.remove('hidden');
                blockModal.classList.add('active'); // Clase CSS para fade-in
                console.log("🔓 Abriendo modal de bloqueo...");
            } else {
                console.error("❌ No se encontró el modal 'block-modal-overlay' en el HTML");
            }
        });
    }

    // 2. CERRAR MODAL
    const cerrarModalBloqueo = () => {
        if (blockModal) {
            blockModal.classList.add('hidden');
            blockModal.classList.remove('active');
        }
    };

    if (btnCloseBlock) btnCloseBlock.addEventListener('click', cerrarModalBloqueo);
    // Acá usaba btnCancelBlock y fallaba porque no estaba definido arriba. ¡Ahora ya está!
    if (btnCancelBlock) btnCancelBlock.addEventListener('click', cerrarModalBloqueo);

    // 3. CONFIRMAR BLOQUEO
    if (btnConfirmBlock) {
        btnConfirmBlock.addEventListener('click', async () => {
            // Validaciones básicas
            if (!inpBlockDate || !selBlockStart || !selBlockEnd) return;
            
            const reason = inpBlockReason.value.trim() || "Bloqueado";
            const date = inpBlockDate.value;
            const start = selBlockStart.value;
            const end = selBlockEnd.value;

            if (!date) { alert("Falta seleccionar fecha"); return; }
            if (start >= end) { alert("La hora de fin debe ser mayor a la de inicio"); return; }

            if (!confirm(`¿Bloquear agenda el ${date} de ${start} a ${end}?`)) return;

            // UI Guardando
            btnConfirmBlock.disabled = true;
            const txtOriginal = btnConfirmBlock.innerHTML;
            btnConfirmBlock.innerHTML = "Guardando...";

            const barberNameDisplay = document.getElementById('barber-name-display');
            const currentBarberName = barberNameDisplay ? barberNameDisplay.textContent : "Staff";

            // Generar los slots de 30 min
            let slots = [];
            const toMins = t => parseInt(t.split(':')[0])*60 + parseInt(t.split(':')[1]);
            const toTime = m => `${Math.floor(m/60).toString().padStart(2,'0')}:${(m%60).toString().padStart(2,'0')}`;
            
            let curr = toMins(start);
            const fin = toMins(end);

            while(curr < fin) {
                slots.push(toTime(curr));
                curr += 30;
            }

            try {
                // Guardar en Firebase
                const promises = slots.map(time => addDoc(collection(db, "turnos"), {
                    clientName: reason, 
                    clientEmail: "-", 
                    services: ["BLOQUEO"], 
                    date: date, 
                    time: time,
                    pro: currentBarberName, 
                    total: 0, 
                    status: "blocked", 
                    type: "block_admin", 
                    created_at: new Date()
                }));
                
                await Promise.all(promises);
                alert(`Horario bloqueado exitosamente (${slots.length} turnos).`);
                
                cerrarModalBloqueo();
                loadBarberAgenda(currentBarberName); // Recargar calendario

            } catch (e) {
                console.error("Error bloqueando:", e);
                alert("Error al guardar bloqueo.");
            } finally {
                btnConfirmBlock.disabled = false;
                btnConfirmBlock.innerHTML = txtOriginal;
            }
        });
    }

    // ==========================================
    // D. FUNCIÓN CARGAR HORARIOS (Para Reserva Manual)
    // ==========================================
    async function loadManualTimeSlots() {
        // 1. Feedback visual de carga
        gridManualTime.innerHTML = '<p style="color:#888; font-size:0.8rem;">Cargando horarios...</p>';

        const dateStr = inpManualDate.value;
        if (!dateStr) return;

        // 2. Cargar configuración de barberos si no existe
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

        // 3. Obtener datos del día y del barbero
        const barberNameDisplay = document.getElementById('barber-name-display');
        const currentBarberName = barberNameDisplay ? barberNameDisplay.textContent : "Staff";

        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayIdx = dateObj.getDay();

        // 4. Filtrar horarios válidos según el barbero y el día
        let validHours = new Set();
        const specificBarber = BARBERS_CONFIG.find(b => b.name === currentBarberName);

        if (specificBarber) {
            if (specificBarber.days.includes(dayIdx)) {
                specificBarber.hours.forEach(h => validHours.add(h));
            } else {
                gridManualTime.innerHTML = '<p style="color:#CC0000; font-size:0.9rem;">No trabajás este día.</p>';
                return;
            }
        } else {
            // Modo Admin/General: Mostrar horarios de cualquiera que trabaje hoy
            BARBERS_CONFIG.forEach(b => {
                if (b.days.includes(dayIdx)) {
                    b.hours.forEach(h => validHours.add(h));
                }
            });
        }

        // 5. Ordenar horarios cronológicamente
        const sortedHours = Array.from(validHours).sort();

        if (sortedHours.length === 0) {
            gridManualTime.innerHTML = '<p style="color:#aaa; font-size:0.9rem;">Local cerrado este día.</p>';
            return;
        }

        // 6. Consultar Firebase para ver qué está ocupado
        try {
            let q;
            // Si es un barbero específico, buscamos solo sus turnos.
            // Si es "Staff" o admin general, buscamos todos los del día.
            if (specificBarber) {
                q = query(collection(db, "turnos"), where("date", "==", dateStr), where("pro", "==", currentBarberName));
            } else {
                q = query(collection(db, "turnos"), where("date", "==", dateStr));
            }

            const snap = await getDocs(q);
            // Creamos una lista con las horas que YA están ocupadas
            const takenSlots = snap.docs.map(doc => doc.data().time);

            // 7. Renderizar los botones
            gridManualTime.innerHTML = '';

            sortedHours.forEach(h => {
                const btn = document.createElement('button');
                btn.className = 'time-btn'; // Clase base CSS
                btn.textContent = h;

                if (takenSlots.includes(h)) {
                    // CASO: HORARIO OCUPADO (O BLOQUEADO)
                    btn.classList.add('taken');
                    btn.disabled = true;
                    btn.title = "Horario no disponible";
                } else {
                    // CASO: HORARIO LIBRE
                    btn.addEventListener('click', () => {
                        // Limpiar selección visual previa
                        document.querySelectorAll('#manual-time-grid .time-btn').forEach(b => {
                            b.classList.remove('active');
                        });

                        // Activar este botón
                        btn.classList.add('active');
                        manualTimeSelected = h;

                        // Habilitar botón de guardar
                        if(btnSaveManual) {
                            btnSaveManual.disabled = false;
                            btnSaveManual.style.opacity = '1';
                        }
                    });
                }
                gridManualTime.appendChild(btn);
            });

        } catch (error) {
            console.error("Error cargando slots:", error);
            gridManualTime.innerHTML = '<p style="color:red;">Error de conexión con la base de datos.</p>';
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
            <div class="booking-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:10px; border-left:3px solid #CC0000;">
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
            tbody.innerHTML += `<tr style="background:#333; font-weight:bold;"><td colspan="4" style="text-align:right;">TOTAL:</td><td style="color:#CC0000;">$${total}</td></tr>`;
        } catch (e) { console.error(e); }
    }
});