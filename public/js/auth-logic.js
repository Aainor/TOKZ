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
    "fnvillalva.17@gmail.com" 
];

// VARIABLES GLOBALES
let currentUser = null; 
let calendarInstance = null; 
let BARBERS_CONFIG = []; // Se llena desde barberos.json
let PRICES_DB = {}; 
let myTurnos = []; 

// ESTADO DEL WIZARD DE RESERVAS
let bookingData = {
    services: [],
    totalVip: 0,
    totalRegular: 0,
    mode: 'together',
    date: null,
    time: null,
    professional: '',
    appointments: []
};
let currentStep = 1;
let serviceIndex = 0;
let guestData = null;

// ==========================================
// 3. UTILIDADES
// ==========================================

function getLocalDateISO(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localTime = new Date(dateObj.getTime() - offset);
    return localTime.toISOString().split('T')[0];
}

// FUNCIÓN GOOGLE CALENDAR
window.abrirLinkGoogleCalendar = function(turnoData) {
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
            if(typeof updateUI === 'function') updateUI();

        } else {
            console.log("⚪ Sin usuario.");
            currentUser = null;
            // Si estamos en login.html, mostramos el login
            if (viewLogin) switchView(viewLogin); 
            if(typeof updateUI === 'function') updateUI();
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
            if(f) loadAdminDashboard(f);
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
    if(btnBackAdmin) btnBackAdmin.onclick = () => switchView(viewAdmin);

    // Turno Manual
    const btnAddManual = document.getElementById('btn-add-manual');
    if (btnAddManual) {
        btnAddManual.addEventListener('click', async () => {
            const cli = prompt("Nombre del Cliente:");
            if (!cli) return;
            const hoy = new Date().toISOString().split('T')[0];
            const hora = prompt("Hora (HH:MM):", "10:00");
            const pro = document.getElementById('barber-name-display').textContent;
            try {
                await addDoc(collection(db, "turnos"), { clientName: cli, date: hoy, time: hora, pro: pro, services: ["Turno Manual"], total: "$0", status: "confirmed" });
                loadBarberAgenda(pro);
                window.abrirLinkGoogleCalendar({ fecha: hoy, hora: hora, barbero: pro, servicio: "Turno Manual" });
            } catch(e) { alert("Error"); }
        });
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
        myTurnos.sort((a,b) => new Date(a.date) - new Date(b.date));
        myTurnos.forEach(t => {
            bookingsListContainer.innerHTML += `
            <div class="booking-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:10px; border-left:3px solid #AE0E30;">
                <div style="text-align:left;">
                    <h4 style="color:white; margin:0;">${Array.isArray(t.services)?t.services.join(" + "):t.services}</h4>
                    <small style="color:#aaa;">📅 ${t.date} - ${t.time} | 💈 ${t.pro}</small>
                </div>
                <button class="btn-delete-booking" data-id="${t.id}" style="background:none; border:none; color:#ff4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
        document.querySelectorAll('.btn-delete-booking').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(!confirm("¿Cancelar turno?")) return;
                const id = e.currentTarget.getAttribute('data-id');
                try {
                    await deleteDoc(doc(db, "turnos", id));
                    myTurnos = myTurnos.filter(t => t.id !== id);
                    renderBookings();
                } catch(e) { alert("Error al cancelar"); }
            });
        });
    }

    // ==========================================
    // 7. WIZARD RESERVAS (SECCIÓN CLIENTE)
    // ==========================================
    const bookingModal = document.getElementById('booking-modal');
    if (bookingModal) {
        console.log("🛠️ Inicializando Wizard de Reservas...");
        const openBtn = document.querySelector('#reserva .cta-button'); 
        const closeBtn = document.getElementById('close-modal-btn');
        const btnNext = document.getElementById('btn-next');
        const btnBack = document.getElementById('btn-back');
        const proSelect = document.getElementById('pro-select');
        const datePicker = document.getElementById('date-picker');
        const timeGridContainer = document.getElementById('time-grid-container');
        const servicesListContainer = document.querySelector('.services-list');
        const steps = [document.getElementById('step-1'), document.getElementById('step-mode'), document.getElementById('step-2'), document.getElementById('step-3')];
        const dots = document.querySelectorAll('.step-dot');
        const serviceTitle = document.getElementById('current-service-title');

        // --- CARGA DE BARBEROS DESDE JSON ---
        async function loadBarbersConfig() {
            try {
                const response = await fetch('/public/components/barberos.json');
                if (!response.ok) throw new Error("Error HTTP al leer JSON");
                
                BARBERS_CONFIG = await response.json();
                console.log("✅ Barberos cargados:", BARBERS_CONFIG);
                
                populateBarberSelect(BARBERS_CONFIG);
            } catch (error) {
                console.error("❌ Falló carga de barberos:", error);
                // Fallback para que no se rompa la UI
                BARBERS_CONFIG = [];
                alert("Error cargando la lista de barberos. Recarga la página.");
            }
        }

        function populateBarberSelect(list) {
            if (!proSelect) return;
            proSelect.innerHTML = '';
            list.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id; 
                opt.textContent = b.name;
                proSelect.appendChild(opt);
            });
            if(proSelect.options.length > 0) {
                proSelect.selectedIndex = 0;
                bookingData.professional = proSelect.options[0].text;
            }
        }

        function filtrarBarberosPorServicio() {
             const SERVICIOS_COLOR = ["Claritos", "Color Global", "Franja"]; 
             const tieneColor = bookingData.services.some(srv => SERVICIOS_COLOR.includes(srv));
             if (tieneColor) {
                 const soloAlejandra = BARBERS_CONFIG.filter(b => b.name.toLowerCase().includes("alejandra"));
                 populateBarberSelect(soloAlejandra.length > 0 ? soloAlejandra : BARBERS_CONFIG);
             } else {
                 populateBarberSelect(BARBERS_CONFIG);
             }
         }

        // --- Carga de Servicios ---
        async function renderServicesFromJSON() {
            try {
                const res = await fetch('/public/components/precios.json');
                const precios = await res.json();
                if (servicesListContainer) servicesListContainer.innerHTML = '';

                const SERVICE_NAMES = {
                    "corte": "Corte de Cabello", "barba": "Arreglo de Barba", "corte_barba": "Corte + Barba",
                    "rapado": "Rapado Clásico", "corte_diseno": "Corte + Diseño", "femenino": "Corte Femenino",
                    "claritos": "Claritos", "global": "Color Global", "franja": "Franja", "evento": "Evento/Boda"
                };
                const keys = ['corte', 'barba', 'corte_barba', 'rapado', 'corte_diseno', 'femenino', 'claritos', 'global', 'franja'];

                keys.forEach(key => {
                    if (precios[key]) {
                        const item = precios[key];
                        let vip = Number(item.destacado) || null;
                        let reg = Number(item.accesorio) || vip;
                        const name = SERVICE_NAMES[key] || key.toUpperCase();
                        PRICES_DB[name] = { vip, regular: reg };

                        const html = `
                        <div class="service-row" data-id="${key}" data-name="${name}" data-vip="${vip}" data-reg="${reg}">
                            <div class="srv-info">
                                <span class="srv-name">${name}</span>
                                <span class="srv-price">${vip ? '$'+vip.toLocaleString() : 'A consultar'}</span>
                            </div>
                            <div class="quantity-control">
                                <button class="qty-btn minus" disabled>-</button>
                                <span class="qty-val">0</span>
                                <button class="qty-btn plus">+</button>
                            </div>
                        </div>`;
                        if(servicesListContainer) servicesListContainer.insertAdjacentHTML('beforeend', html);
                    }
                });
                attachServiceListeners();
            } catch(e) { console.error("Services error", e); }
        }

        function attachServiceListeners() {
            document.querySelectorAll('.service-row').forEach(row => {
                const minus = row.querySelector('.minus'), plus = row.querySelector('.plus'), valSpan = row.querySelector('.qty-val');
                const name = row.getAttribute('data-name');
                const vip = Number(row.getAttribute('data-vip'));
                const reg = Number(row.getAttribute('data-reg'));

                const newPlus = plus.cloneNode(true);
                plus.parentNode.replaceChild(newPlus, plus);
                const newMinus = minus.cloneNode(true);
                minus.parentNode.replaceChild(newMinus, minus);

                newPlus.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let q = parseInt(valSpan.textContent) + 1;
                    valSpan.textContent = q; newMinus.disabled = false; row.classList.add('selected-active');
                    bookingData.services.push(name);
                    bookingData.totalVip += vip || 0; bookingData.totalRegular += reg || 0;
                    checkModeCompatibility();
                    updateUI();
                });

                newMinus.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let q = parseInt(valSpan.textContent);
                    if (q > 0) {
                        q--; valSpan.textContent = q;
                        if(q===0) { newMinus.disabled=true; row.classList.remove('selected-active'); }
                        const idx = bookingData.services.indexOf(name);
                        if(idx > -1) {
                            bookingData.services.splice(idx, 1);
                            bookingData.totalVip -= vip || 0; bookingData.totalRegular -= reg || 0;
                        }
                        checkModeCompatibility();
                        updateUI();
                    }
                });
            });
        }
        
        function checkModeCompatibility() {
            const modeTogetherBtn = document.getElementById('mode-together');
            if (!modeTogetherBtn) return;
            const hasDuplicates = new Set(bookingData.services).size !== bookingData.services.length;
            if (hasDuplicates) {
                selectMode('separate');
                modeTogetherBtn.classList.add('disabled-mode');
                modeTogetherBtn.style.opacity = '0.4';
                modeTogetherBtn.style.pointerEvents = 'none';
            } else {
                modeTogetherBtn.classList.remove('disabled-mode');
                modeTogetherBtn.style.opacity = '1';
                modeTogetherBtn.style.pointerEvents = 'auto';
            }
        }

        // --- CALENDARIO ---
        async function renderTimeSlots() {
            if (!timeGridContainer) return;
            timeGridContainer.innerHTML = '<p style="color:white; text-align:center;">Cargando...</p>';
            
            const dateStr = datePicker.value; 
            if(!dateStr) {
                timeGridContainer.innerHTML = '<p style="color:white; text-align:center;">Seleccioná una fecha.</p>';
                return;
            }

            // LEEMOS DIRECTAMENTE EL SELECT (PARA QUE NO SE QUEDE PEGADO EN EL ANTERIOR)
            const proId = proSelect.value;
            const proName = proSelect.options[proSelect.selectedIndex]?.text || "Cualquiera";
            
            // BUSCAMOS EN LA CONFIG
            const barber = BARBERS_CONFIG.find(b => b.id === proId) || BARBERS_CONFIG[0];
            
            if (!barber || !barber.days) {
                timeGridContainer.innerHTML = '<p style="color:#888;">Cargando configuración...</p>';
                return;
            }

            // CALCULO DE DÍA (FIX ZONA HORARIA)
            const [y, m, d] = dateStr.split('-').map(Number);
            const fechaLocal = new Date(y, m - 1, d); 
            const dayIdx = fechaLocal.getDay(); 

            // Verificamos si trabaja ese día
            if(!barber.days.includes(dayIdx)) { 
                timeGridContainer.innerHTML = '<p style="color:#888; text-align: center;">No trabaja este día.</p>'; 
                return; 
            }

            // BUSCAMOS TURNOS OCUPADOS EN DB
            const q = query(collection(db, "turnos"), where("date", "==", dateStr), where("pro", "==", proName));
            const snap = await getDocs(q);
            const taken = snap.docs.map(d => d.data().time);

            timeGridContainer.innerHTML = '';
            
            const horasDisponibles = barber.hours || [];
            
            horasDisponibles.forEach(h => {
                const btn = document.createElement('button');
                btn.className = 'time-btn'; btn.textContent = h;
                
                const now = new Date();
                const [hSlot, mSlot] = h.split(':').map(Number);
                const esHoy = dateStr === getLocalDateISO(now);
                
                if (esHoy) {
                    if (hSlot < now.getHours() || (hSlot === now.getHours() && mSlot < now.getMinutes())) {
                        btn.disabled = true; btn.classList.add('past');
                    }
                }
                
                if (taken.includes(h)) { btn.disabled = true; btn.classList.add('taken'); }
                else {
                    btn.onclick = () => {
                        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        bookingData.time = h;
                        updateUI();
                    }
                }
                timeGridContainer.appendChild(btn);
            });
        }

        // --- Navegación ---
        if(btnNext) {
            const newNext = btnNext.cloneNode(true);
            btnNext.parentNode.replaceChild(newNext, btnNext);
            
            newNext.addEventListener('click', async () => {
                if (currentStep === 1) {
                    filtrarBarberosPorServicio();
                    if (bookingData.services.length > 1) currentStep = 2;
                    else { 
                        bookingData.mode = 'together';
                        prepareCalendarStep(); 
                        currentStep = 3; 
                    }
                    updateStep(); return;
                }
                if (currentStep === 2) {
                     if (bookingData.mode === 'separate') {
                        serviceIndex = 0; bookingData.appointments = [];
                    }
                    prepareCalendarStep();
                    currentStep = 3;
                    updateStep(); return;
                }
                if (currentStep === 3) {
                    if (bookingData.mode === 'separate') {
                         const srv = bookingData.services[serviceIndex];
                         const pro = proSelect.options[proSelect.selectedIndex].text;
                         bookingData.appointments[serviceIndex] = { service: srv, date: bookingData.date, time: bookingData.time, pro: pro };
                         
                         serviceIndex++;
                         if (serviceIndex < bookingData.services.length) {
                             prepareCalendarStep();
                             updateStep();
                             return;
                         }
                    }
                    currentStep = 4;
                    updateStep(); return;
                }
                if (currentStep === 4) {
                    await finalizarReserva(newNext);
                }
            });
        }

        if(btnBack) {
            const newBack = btnBack.cloneNode(true);
            btnBack.parentNode.replaceChild(newBack, btnBack);
            newBack.addEventListener('click', () => {
                if(currentStep === 4) currentStep = 3;
                else if(currentStep === 3) {
                    if (bookingData.mode === 'separate' && serviceIndex > 0) {
                        serviceIndex--; prepareCalendarStep(); updateStep(); return;
                    }
                    currentStep = (bookingData.services.length > 1) ? 2 : 1;
                } 
                else if(currentStep === 2) currentStep = 1;
                updateStep();
            });
        }

        function prepareCalendarStep() {
            bookingData.time = null;
            bookingData.date = datePicker.value || getLocalDateISO(new Date());
            datePicker.value = bookingData.date;
            
            if (bookingData.mode === 'separate' && serviceTitle) {
                 const srv = bookingData.services[serviceIndex];
                 serviceTitle.textContent = `Agendando: ${srv} (${serviceIndex+1}/${bookingData.services.length})`;
                 serviceTitle.style.display = 'block';
            } else if (serviceTitle) {
                 serviceTitle.textContent = bookingData.services.length > 1 ? "Agendando todo junto" : "";
            }
            renderTimeSlots();
        }

        function updateStep() {
            steps.forEach((s, i) => { if(s) s.classList.toggle('hidden', i+1 !== currentStep); });
            dots.forEach(d => { d.classList.toggle('active', parseInt(d.dataset.step) <= currentStep); });
            if(currentStep===4) renderFinalStep();
            
            const btn = document.getElementById('btn-next');
            if (btn) {
                if (currentStep === 3 && bookingData.mode === 'separate' && serviceIndex < bookingData.services.length - 1) {
                    btn.textContent = "Siguiente Turno";
                } else if (currentStep === 4) {
                    btn.textContent = "Confirmar Reserva";
                } else {
                    btn.textContent = "Siguiente";
                }
            }
            updateUI();
        }

        function renderFinalStep() {
            const step4 = document.getElementById('step-3');
            const nextBtn = document.getElementById('btn-next');
            let html = '';
            if(!currentUser && !guestData) {
                html = `<div style="text-align:center;"><p>Iniciá sesión para confirmar.</p><a href="/pages/login.html" class="cta-button">Ir al Login</a></div>`;
                nextBtn.style.display = 'none';
            } else {
                const name = currentUser ? currentUser.displayName : "Invitado";
                const total = (currentUser) ? bookingData.totalVip : bookingData.totalRegular;
                
                let resumen = "";
                if(bookingData.mode === 'together') {
                    resumen = `<p>Servicios: ${bookingData.services.join(' + ')}</p>
                               <p>📅 ${bookingData.date} - ⏰ ${bookingData.time}</p>
                               <p>💈 ${bookingData.professional}</p>`;
                } else {
                    resumen = bookingData.appointments.map(a => `<p>${a.service}: ${a.date} ${a.time} con ${a.pro}</p>`).join('');
                }

                html = `
                <div style="text-align:center;">
                    <h3>${name}, confirmá tu turno</h3>
                    ${resumen}
                    <h2 style="color:#AE0E30; margin-top:15px;">$${total}</h2>
                </div>`;
                nextBtn.style.display = 'block';
            }
            step4.innerHTML = html;
        }

        async function finalizarReserva(btnRef) {
            btnRef.textContent = "Procesando..."; btnRef.disabled = true;
            try {
                const total = (currentUser) ? bookingData.totalVip : bookingData.totalRegular;
                const baseData = {
                    uid: currentUser ? currentUser.uid : "guest",
                    clientName: currentUser ? currentUser.displayName : "Guest",
                    clientEmail: currentUser ? currentUser.email : "",
                    status: "pendiente",
                    created_at: new Date()
                };

                if (bookingData.mode === 'together') {
                    await addDoc(collection(db, "turnos"), {
                        ...baseData,
                        services: bookingData.services,
                        date: bookingData.date,
                        time: bookingData.time,
                        pro: bookingData.professional,
                        total: total
                    });
                } else {
                     const promises = bookingData.appointments.map(appt => {
                        return addDoc(collection(db, "turnos"), {
                            ...baseData,
                            services: [appt.service],
                            date: appt.date,
                            time: appt.time,
                            pro: appt.pro,
                            total: 0 
                        });
                     });
                     await Promise.all(promises);
                }
                
                if (typeof emailjs !== 'undefined') {
                     await emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, {
                        to_name: currentUser ? currentUser.displayName : "Guest",
                        to_email: currentUser ? currentUser.email : "",
                        service_list: bookingData.services.join(", "),
                        total_price: "$" + total
                    });
                }

                alert("¡Reserva Exitosa!");
                
                // Ejecutar Google Calendar al final
                if (bookingData.mode === 'together') {
                    abrirLinkGoogleCalendar({
                        fecha: bookingData.date,
                        hora: bookingData.time,
                        barbero: bookingData.professional,
                        servicio: bookingData.services.join(" + ")
                    });
                } else {
                    if(bookingData.appointments.length > 0) {
                        const primerTurno = bookingData.appointments[0];
                        abrirLinkGoogleCalendar({
                            fecha: primerTurno.date,
                            hora: primerTurno.time,
                            barbero: primerTurno.pro,
                            servicio: primerTurno.service
                        });
                    }
                }

                modal.classList.add('hidden');
                location.reload(); 
            } catch(e) { console.error(e); alert("Error al reservar"); }
        }

        // Init Wizard
        window.selectMode = function(mode) {
             document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
             document.getElementById(`mode-${mode}`).classList.add('selected');
             bookingData.mode = mode;
             updateUI();
        }
        
        loadBarbersConfig(); // CARGA EL JSON
        renderServicesFromJSON();
        if(datePicker) datePicker.min = getLocalDateISO(new Date());
        
        if(openBtn) {
            const newOpen = openBtn.cloneNode(true);
            openBtn.parentNode.replaceChild(newOpen, openBtn);
            newOpen.onclick = (e) => { e.preventDefault(); bookingModal.classList.remove('hidden'); resetBooking(); }
        }
        if(closeBtn) closeBtn.onclick = () => bookingModal.classList.add('hidden');
        if(proSelect) proSelect.onchange = () => { 
            bookingData.professional = proSelect.options[proSelect.selectedIndex].text; 
            renderTimeSlots(); 
        }
        if(datePicker) datePicker.onchange = (e) => { bookingData.date = e.target.value; renderTimeSlots(); }
    
        function resetBooking() {
            bookingData = { services: [], totalVip:0, totalRegular:0, mode:'together', date:null, time:null, professional:'', appointments: [] };
            currentStep = 1; serviceIndex = 0;
            document.querySelectorAll('.qty-val').forEach(s => s.textContent = '0');
            document.querySelectorAll('.service-row').forEach(el => el.classList.remove('selected-active'));
            document.querySelectorAll('.minus').forEach(el => el.disabled = true);
            updateStep();
        }
        
        window.updateUI = function() {
             const btn = document.getElementById('btn-next');
             const totalEl = document.getElementById('total-price');
             if(!btn) return;
             const displayPrice = (currentUser) ? bookingData.totalVip : bookingData.totalRegular;
             if(totalEl) totalEl.textContent = "$" + displayPrice;
             let ok = false;
             if (currentStep === 1) ok = bookingData.services.length > 0;
             else if (currentStep === 2) ok = true;
             else if (currentStep === 3) ok = bookingData.time !== null;
             else ok = true;
             btn.disabled = !ok;
        }
    } 

    // AGENDA BARBERO
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
                if(data.date && data.time) {
                    const start = `${data.date}T${data.time}:00`;
                    const end = new Date(new Date(start).getTime() + 30*60000).toISOString();
                    
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
                            precio: data.total || '$ -'
                        }
                    });
                }
            });

            if (calendarInstance) calendarInstance.destroy();

            calendarInstance = new FullCalendar.Calendar(calendarEl, {
                initialView: window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek',
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
                locale: 'es',
                slotMinTime: '09:00:00', // VUELVE A 9AM
                slotMaxTime: '21:00:00', // VUELVE A 21PM
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
                eventClick: function(info) {
                    const p = info.event.extendedProps;
                    document.getElementById('modal-cliente').textContent = info.event.title;
                    document.getElementById('modal-servicio').textContent = p.servicio;
                    document.getElementById('modal-precio').textContent = p.precio;
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
        } catch(e) { console.error("Error calendario:", e); }
    }

    // ADMIN DASHBOARD
    async function loadAdminDashboard(fecha) {
        const tbody = document.getElementById('admin-table-body');
        if(!tbody) return;
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
                if(data.date === format1) turnos.push(data);
            });

            if(turnos.length === 0) { tbody.innerHTML = '<tr><td colspan="5">No hay turnos</td></tr>'; return; }
            turnos.sort((a,b) => a.time.localeCompare(b.time));

            turnos.forEach(data => {
                const price = Number(data.total) || 0;
                total += price;
                tbody.innerHTML += `
                <tr>
                    <td>${data.time}</td>
                    <td>${data.clientName}</td>
                    <td>${Array.isArray(data.services)?data.services.join("+"):data.services}</td>
                    <td>${data.pro}</td>
                    <td style="color:#4CAF50; font-weight:bold;">$${price}</td>
                </tr>`;
            });
            tbody.innerHTML += `<tr style="background:#333; font-weight:bold;"><td colspan="4" style="text-align:right;">TOTAL:</td><td style="color:#AE0E30;">$${total}</td></tr>`;
        } catch(e) { console.error(e); }
    }
});