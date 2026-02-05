// ==========================================
// 1. IMPORTACIONES
// ==========================================
import { db, auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 2. VARIABLES GLOBALES
// ==========================================
let BARBERS_CONFIG = [];
let PRICES_DB = {};
const EMAIL_SERVICE_ID = "service_hdoerpa";
const EMAIL_TEMPLATE_ID = "template_16dkj9g";

// ==========================================
// 3. UTILIDADES
// ==========================================

// Obtener fecha local ISO (YYYY-MM-DD)
function getLocalDateISO(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localTime = new Date(dateObj.getTime() - offset);
    return localTime.toISOString().split('T')[0];
}

// Abrir Google Calendar
function abrirLinkGoogleCalendar(turnoData) {
    if (!turnoData) return;

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

    let emailBarbero = EMAILS_BARBEROS[turnoData.barbero];
    if (!emailBarbero) {
        const nombreKey = Object.keys(EMAILS_BARBEROS).find(key => turnoData.barbero.includes(key));
        if (nombreKey) emailBarbero = EMAILS_BARBEROS[nombreKey];
    }

    const fechaLimpia = turnoData.fecha.replace(/-/g, ''); 
    const horaLimpia = turnoData.hora.replace(/:/g, '') + '00'; 
    const fechasGoogle = `${fechaLimpia}T${horaLimpia}/${fechaLimpia}T${horaLimpia}`;

    const baseUrl = "https://calendar.google.com/calendar/render";
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: `Corte con ${turnoData.barbero} - Tokz Barber`,
        details: `Servicio: ${turnoData.servicio}.`,
        dates: fechasGoogle,
        location: "Tokz Barber Shop"
    });

    if (emailBarbero) params.append('add', emailBarbero);
    window.open(`${baseUrl}?${params.toString()}`, '_blank');
}

// ==========================================
// 4. LÓGICA PRINCIPAL (DOM LOADED)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Iniciando Turnos.js (Versión Corregida)...");

    // --- ESTADO ---
    let bookingData = {
        services: [],
        totalVip: 0,
        totalRegular: 0,
        mode: 'together',
        date: getLocalDateISO(new Date()),
        time: null,
        professional: '',
        appointments: []
    };

    let currentStep = 1;
    let serviceIndex = 0;
    let guestData = null;
    let currentUser = null;

    // --- ELEMENTOS DOM ---
    const modal = document.getElementById('booking-modal');
    const openBtn = document.querySelector('#reserva .cta-button'); 
    const closeBtn = document.getElementById('close-modal-btn');
    const btnNext = document.getElementById('btn-next');
    const btnBack = document.getElementById('btn-back');
    const totalPriceEl = document.getElementById('total-price');
    const serviceTitle = document.getElementById('current-service-title');
    const servicesListContainer = document.querySelector('.services-list');
    const steps = [document.getElementById('step-1'), document.getElementById('step-mode'), document.getElementById('step-2'), document.getElementById('step-3')];
    const dots = document.querySelectorAll('.step-dot');
    const proSelect = document.getElementById('pro-select');
    const datePicker = document.getElementById('date-picker');
    const timeGridContainer = document.getElementById('time-grid-container');

    if (!modal) console.error("❌ ERROR: No se encontró el modal.");

    // --- CARGAR BARBEROS ---
    async function loadBarbersConfig() {
        try {
            const response = await fetch('/public/components/barberos.json');
            if (!response.ok) throw new Error("Error HTTP JSON");
            BARBERS_CONFIG = await response.json();
            console.log("✅ Barberos cargados:", BARBERS_CONFIG);
            populateBarberSelect(BARBERS_CONFIG);
        } catch (e) {
            console.error("Error cargando barberos, usando backup:", e);
            // Backup por si falla el JSON
            BARBERS_CONFIG = [
                {id: "jonathan", name: "Jonathan", days: [1,2,3,4,5,6], hours: ["10:00","18:00"]},
                {id: "lautaro", name: "Lautaro", days: [2,3,4,5,6], hours: ["10:00","18:00"]},
                {id: "alejandra", name: "Alejandra", days: [2,3,4,5,6], hours: ["10:00","18:00"]},
                {id: "nicolas", name: "Nicolás", days: [4,5,6], hours: ["14:00","19:00"]}
            ];
            populateBarberSelect(BARBERS_CONFIG);
        }
    }

    function populateBarberSelect(barbersList) {
        if (!proSelect) return;
        proSelect.innerHTML = '';
        barbersList.forEach(barber => {
            const option = document.createElement('option');
            option.value = barber.id;
            option.textContent = barber.name;
            proSelect.appendChild(option);
        });
        
        // Seleccionar el primero por defecto
        if (proSelect.options.length > 0) {
            proSelect.selectedIndex = 0;
            bookingData.professional = proSelect.options[0].text;
        }
    }

    // --- FILTRO DE COLOR (ALEJANDRA) ---
    function filtrarBarberosPorServicio() {
        const SERVICIOS_COLOR = ["Claritos", "Color Global", "Franja"]; 
        const tieneColor = bookingData.services.some(srv => SERVICIOS_COLOR.includes(srv));

        if (tieneColor) {
            const soloAlejandra = BARBERS_CONFIG.filter(b => b.name.toLowerCase().includes("alejandra"));
            if (soloAlejandra.length > 0) populateBarberSelect(soloAlejandra);
            else populateBarberSelect(BARBERS_CONFIG); 
        } else {
            populateBarberSelect(BARBERS_CONFIG);
        }
    }

    // --- INICIALIZACIÓN ---
    await loadBarbersConfig();
    if (datePicker) {
        datePicker.min = getLocalDateISO(new Date());
        datePicker.value = getLocalDateISO(new Date());
        bookingData.date = datePicker.value;
    }

    // --- AUTH ---
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateUI();
    });

    // --- MODAL ---
    if (openBtn) openBtn.addEventListener('click', (e) => { e.preventDefault(); modal.classList.remove('hidden'); });
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // --- CARGAR SERVICIOS ---
    async function renderServicesFromJSON() {
        try {
            const response = await fetch('/public/components/precios.json');
            const precios = await response.json();
            if (servicesListContainer) servicesListContainer.innerHTML = '';

            const SERVICE_NAMES = {
                "corte": "Corte de Cabello", "barba": "Arreglo de Barba", "corte_barba": "Corte + Barba",
                "rapado": "Rapado Clásico", "corte_diseno": "Corte + Diseño", "femenino": "Corte Femenino",
                "claritos": "Claritos", "global": "Color Global", "franja": "Franja", "evento": "Evento/Boda"
            };
            const availableKeys = ['corte', 'barba', 'corte_barba', 'rapado', 'corte_diseno', 'femenino', 'claritos', 'global', 'franja'];

            availableKeys.forEach(key => {
                if (precios[key]) {
                    const item = precios[key];
                    let vipPrice = isNaN(Number(item.destacado)) ? null : Number(item.destacado);
                    let regularPrice = isNaN(Number(item.accesorio)) ? vipPrice : Number(item.accesorio);
                    const finalName = SERVICE_NAMES[key] || key.toUpperCase();

                    PRICES_DB[finalName] = { vip: vipPrice, regular: regularPrice };

                    const html = `
                        <div class="service-row" data-id="${key}" data-name="${finalName}" 
                             data-vip="${vipPrice !== null ? vipPrice : 'null'}" 
                             data-regular="${regularPrice !== null ? regularPrice : 'null'}">
                            <div class="srv-info">
                                <span class="srv-name">${finalName}</span>
                                <span class="srv-price">${vipPrice === null ? 'A consultar' : '$' + vipPrice.toLocaleString('es-AR')}</span>
                            </div>
                            <div class="quantity-control">
                                <button class="qty-btn minus" disabled>-</button>
                                <span class="qty-val">0</span>
                                <button class="qty-btn plus">+</button>
                            </div>
                        </div>`;
                    if (servicesListContainer) servicesListContainer.insertAdjacentHTML('beforeend', html);
                }
            });
            attachServiceListeners();
        } catch (e) { console.error("Error servicios:", e); }
    }

    function attachServiceListeners() {
        document.querySelectorAll('.service-row').forEach(row => {
            const minus = row.querySelector('.minus');
            const plus = row.querySelector('.plus');
            const valSpan = row.querySelector('.qty-val');
            const name = row.getAttribute('data-name');
            const vipPrice = row.getAttribute('data-vip') === 'null' ? null : Number(row.getAttribute('data-vip'));
            const regularPrice = row.getAttribute('data-regular') === 'null' ? null : Number(row.getAttribute('data-regular'));

            plus.addEventListener('click', (e) => {
                let currentQty = parseInt(valSpan.textContent) + 1;
                valSpan.textContent = currentQty;
                minus.disabled = false;
                row.classList.add('selected-active');
                bookingData.services.push(name);
                if (vipPrice !== null) bookingData.totalVip += vipPrice;
                if (regularPrice !== null) bookingData.totalRegular += regularPrice;
                checkModeCompatibility();
                updateUI();
            });

            minus.addEventListener('click', (e) => {
                let currentQty = parseInt(valSpan.textContent);
                if (currentQty > 0) {
                    currentQty--;
                    valSpan.textContent = currentQty;
                    if (currentQty === 0) {
                        minus.disabled = true;
                        row.classList.remove('selected-active');
                    }
                    const index = bookingData.services.indexOf(name);
                    if (index > -1) {
                        bookingData.services.splice(index, 1);
                        if (vipPrice !== null) bookingData.totalVip -= vipPrice;
                        if (regularPrice !== null) bookingData.totalRegular -= regularPrice;
                    }
                    checkModeCompatibility();
                    updateUI();
                }
            });
        });
    }

    function checkModeCompatibility() {
        const modeBtn = document.getElementById('mode-together');
        if (!modeBtn) return;
        const hasDuplicates = new Set(bookingData.services).size !== bookingData.services.length;
        if (hasDuplicates) {
            selectMode('separate');
            modeBtn.classList.add('disabled-mode');
            modeBtn.style.pointerEvents = 'none';
            modeBtn.style.opacity = '0.4';
        } else {
            modeBtn.classList.remove('disabled-mode');
            modeBtn.style.pointerEvents = 'auto';
            modeBtn.style.opacity = '1';
        }
    }

    window.selectMode = function (mode) {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        document.getElementById(`mode-${mode}`).classList.add('selected');
        bookingData.mode = mode;
        updateUI();
    }

    // ==========================================
    // LÓGICA CALENDARIO (CORREGIDA)
    // ==========================================
    async function renderTimeSlots() {
        if (!timeGridContainer) return;
        timeGridContainer.innerHTML = '<p style="color:white; text-align:center;">Cargando...</p>';

        const selectedDateStr = datePicker.value;
        if (!selectedDateStr) {
            timeGridContainer.innerHTML = '<p style="color:white;">Seleccioná una fecha.</p>';
            return;
        }

        // 1. LEER BARBERO SELECCIONADO EN EL MOMENTO
        const proId = proSelect.value;
        const currentProName = proSelect.options[proSelect.selectedIndex]?.text || "Cualquiera";
        
        // 2. BUSCAR EN CONFIGURACIÓN
        const barber = BARBERS_CONFIG.find(b => b.id === proId) || BARBERS_CONFIG[0];

        // 3. CALCULO DE DÍA (FIX ZONA HORARIA)
        const [y, m, d] = selectedDateStr.split('-').map(Number);
        const fechaLocal = new Date(y, m - 1, d); 
        const dayOfWeek = fechaLocal.getDay(); 

        if (!barber.days.includes(dayOfWeek)) {
            timeGridContainer.innerHTML = `<p style="color:#888; width:100%; text-align:center;">No trabaja este día.</p>`;
            return;
        }

        try {
            const q = query(
                collection(db, "turnos"),
                where("date", "==", selectedDateStr),
                where("pro", "==", currentProName)
            );

            const querySnapshot = await getDocs(q);
            const dbTakenSlots = querySnapshot.docs.map(doc => doc.data().time);
            
            // Filtrar turnos locales si estamos en modo separado
            const localTakenSlots = bookingData.appointments
                .filter(appt => appt.date === selectedDateStr && appt.pro === currentProName)
                .map(appt => appt.time);

            const allTakenTimes = [...dbTakenSlots, ...localTakenSlots];
            const DURACION_TURNO = 45;
            
            // Convertir a minutos para comparar
            const rangosOcupados = allTakenTimes.map(timeStr => {
                const [h, m] = timeStr.split(':').map(Number);
                const inicioMin = h * 60 + m;
                return { inicio: inicioMin, fin: inicioMin + DURACION_TURNO };
            });

            timeGridContainer.innerHTML = '';

            barber.hours.forEach(hora => {
                const btn = document.createElement('button');
                btn.className = 'time-btn';
                btn.textContent = hora;

                const [slotH, slotM] = hora.split(':').map(Number);
                const slotInicio = slotH * 60 + slotM;
                const slotFin = slotInicio + DURACION_TURNO;

                let isPastTime = false;
                const now = new Date();
                const esHoy = selectedDateStr === getLocalDateISO(now);

                if (esHoy) {
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();
                    if (slotH < currentHour || (slotH === currentHour && slotM < currentMin)) {
                        isPastTime = true;
                    }
                }

                const hayColision = rangosOcupados.some(ocupado => {
                    return slotInicio < ocupado.fin && slotFin > ocupado.inicio;
                });

                if (hayColision || isPastTime) {
                    btn.disabled = true;
                    if (isPastTime) {
                        btn.classList.add('past');
                        btn.title = "Horario pasado";
                    } else {
                        btn.classList.add('taken');
                        btn.title = "Ocupado";
                    }
                } else {
                    if (bookingData.time === hora) btn.classList.add('active');
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        bookingData.time = hora;
                        updateUI();
                    });
                }
                timeGridContainer.appendChild(btn);
            });
            updateUI();

        } catch (error) {
            console.error("Error horarios:", error);
            timeGridContainer.innerHTML = '<p style="color:red;">Error de conexión.</p>';
        }
    }
    
    // EVENT LISTENERS DEL CALENDARIO
    if (proSelect) proSelect.addEventListener('change', () => {
        bookingData.professional = proSelect.options[proSelect.selectedIndex].text;
        bookingData.time = null;
        renderTimeSlots();
    });

    if (datePicker) datePicker.addEventListener('change', (e) => {
        bookingData.date = e.target.value;
        bookingData.time = null;
        renderTimeSlots();
    });

    // ==========================================
    // NAVEGACIÓN
    // ==========================================
    if (btnNext) btnNext.addEventListener('click', async () => {
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
                const currentService = bookingData.services[serviceIndex];
                const finalProName = proSelect.options[proSelect.selectedIndex].text;
                bookingData.appointments[serviceIndex] = {
                    service: currentService, date: bookingData.date, time: bookingData.time, pro: finalProName
                };
                serviceIndex++;
                if (serviceIndex < bookingData.services.length) {
                    prepareCalendarStep(); updateStep(); return;
                }
            }
            currentStep = 4;
            updateStep(); return;
        }

        if (currentStep === 4) await finalizarReserva();
    });

    if (btnBack) btnBack.addEventListener('click', () => {
        if (currentStep === 4 && !currentUser && guestData !== null) {
            guestData = null; renderFinalStep(); return;
        }
        if (currentStep === 4) {
            currentStep = 3;
            if (bookingData.mode === 'separate') {
                bookingData.appointments.pop();
                serviceIndex--;
                prepareCalendarStep();
            }
        } else if (currentStep === 3) {
            if (bookingData.mode === 'separate' && serviceIndex > 0) {
                serviceIndex--; prepareCalendarStep(); updateStep(); return;
            }
            if (bookingData.services.length > 1) currentStep = 2;
            else currentStep = 1;
        } else if (currentStep === 2) {
            currentStep = 1;
        }
        updateStep();
    });

    function prepareCalendarStep() {
        bookingData.time = null;
        if (bookingData.mode === 'separate') {
            const srvName = bookingData.services[serviceIndex];
            if (serviceTitle) {
                serviceTitle.textContent = `Agendando: ${srvName} (${serviceIndex + 1}/${bookingData.services.length})`;
                serviceTitle.style.display = 'block';
                serviceTitle.style.color = "#AE0E30";
            }
        } else {
            if (serviceTitle) {
                serviceTitle.textContent = bookingData.services.length > 1 ? "Agendando todo junto" : "";
                serviceTitle.style.display = bookingData.services.length > 1 ? 'block' : 'none';
            }
        }
        renderTimeSlots();
    }

    async function finalizarReserva() {
        if (!currentUser && !guestData) return;

        btnNext.textContent = "Procesando...";
        btnNext.disabled = true;

        let finalName = (currentUser && currentUser.displayName) ? currentUser.displayName : "Cliente";
        let finalMail = (currentUser && currentUser.email) ? currentUser.email : "";
        let finalUid = currentUser ? currentUser.uid : "guest";
        const isVip = currentUser && currentUser.uid !== "guest";
        const precioFinalReserva = isVip ? bookingData.totalVip : bookingData.totalRegular;

        const baseData = { uid: finalUid, clientName: finalName, clientEmail: finalMail, created_at: new Date(), status: "pendiente" };

        try {
            if (bookingData.mode === 'together') {
                let pName = bookingData.professional.includes("Cualquiera") ? "Cualquiera" : bookingData.professional;
                await addDoc(collection(db, "turnos"), {
                    ...baseData, services: bookingData.services, total: precioFinalReserva,
                    date: bookingData.date, time: bookingData.time, pro: pName, type: 'pack'
                });
            } else {
                const promises = bookingData.appointments.map(appt => {
                    return addDoc(collection(db, "turnos"), {
                        ...baseData, services: [appt.service], total: 0, 
                        date: appt.date, time: appt.time, pro: appt.pro, type: 'single_from_pack'
                    });
                });
                await Promise.all(promises);
            }

            // EMAILJS
            let serviciosResumen = bookingData.mode === 'together' ? bookingData.services.join(", ") : "Multi-Turno";
            await emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, {
                to_name: finalName, to_email: finalMail, service_list: serviciosResumen,
                date_info: bookingData.date + " " + bookingData.time, professional: bookingData.professional,
                total_price: "$" + precioFinalReserva, message: "Gracias por confiar en TOKZ."
            });

            // GOOGLE CALENDAR
            if (bookingData.mode === 'together') {
                abrirLinkGoogleCalendar({
                    fecha: bookingData.date, hora: bookingData.time,
                    barbero: bookingData.professional, servicio: bookingData.services.join(" + ")
                });
            } else if(bookingData.appointments.length > 0) {
                abrirLinkGoogleCalendar({
                    fecha: bookingData.appointments[0].date, hora: bookingData.appointments[0].time,
                    barbero: bookingData.appointments[0].pro, servicio: bookingData.appointments[0].service
                });
            }

            alert(`¡Reserva confirmada ${finalName}!`);
            modal.classList.add('hidden');
            resetBooking();
            btnNext.textContent = "Confirmar Reserva";
            btnNext.disabled = false;

        } catch (e) {
            console.error("Error reserva:", e);
            alert("Error al procesar reserva.");
            btnNext.textContent = "Reintentar";
            btnNext.disabled = false;
        }
    }

    function updateUI() {
        // Calcular precio
        const totalVip = bookingData.totalVip;
        const totalRegular = bookingData.totalRegular;
        let displayPrice = totalRegular;
        if (currentUser) displayPrice = totalVip;
        if(totalPriceEl) totalPriceEl.textContent = "$" + displayPrice;

        // Validar botón siguiente
        let ok = false;
        if (currentStep === 1) ok = bookingData.services.length > 0;
        else if (currentStep === 2) ok = true;
        else if (currentStep === 3) ok = bookingData.time !== null;
        else ok = true;

        if (btnNext) btnNext.disabled = !ok;

        if (currentStep === 4) {
            if(btnNext) btnNext.textContent = "Confirmar Reserva";
        } else if (currentStep === 3 && bookingData.mode === 'separate' && serviceIndex < bookingData.services.length - 1) {
            if(btnNext) btnNext.textContent = `Siguiente Turno`;
        } else {
            if(btnNext) btnNext.textContent = "Siguiente";
        }
        
        if (currentStep === 4) renderFinalStep();
    }

    function renderFinalStep() {
        const finalStepContainer = document.getElementById('step-3');
        if (!finalStepContainer) return;
        finalStepContainer.innerHTML = '';
        const contentWrapper = document.createElement('div');
        
        if (currentUser) {
            contentWrapper.innerHTML = `<h2 style="color:white;text-align:center;">Revisá y Confirmá</h2><p style="color:#aaa;text-align:center;">${bookingData.services.join('+')} con ${bookingData.professional}</p>`;
            btnNext.style.display = 'block';
        } else {
            contentWrapper.innerHTML = `
                <div style="text-align:center;">
                    <h3 style="color:#AE0E30;">Iniciá Sesión</h3>
                    <p style="color:#ccc;">Necesitás una cuenta para reservar.</p>
                    <a href="/pages/login.html" class="cta-button">Ir al Login</a>
                </div>`;
            btnNext.style.display = 'none';
        }
        finalStepContainer.appendChild(contentWrapper);
    }

    function updateStep() {
        steps.forEach((s, i) => {
            if (!s) return;
            if (i + 1 === currentStep) { s.classList.remove('hidden'); s.classList.add('active'); }
            else { s.classList.add('hidden'); s.classList.remove('active'); }
        });
        if (btnBack) btnBack.classList.toggle('hidden', currentStep === 1);
        updateUI();
    }

    function resetBooking() {
        bookingData = { services: [], totalVip: 0, totalRegular: 0, mode: 'together', date: getLocalDateISO(new Date()), time: null, professional: 'Cualquiera', appointments: [] };
        currentStep = 1; serviceIndex = 0; guestData = null;
        document.querySelectorAll('.qty-val').forEach(el => el.textContent = '0');
        document.querySelectorAll('.minus').forEach(el => el.disabled = true);
        document.querySelectorAll('.service-row').forEach(el => el.classList.remove('selected-active'));
        updateStep();
    }

    renderServicesFromJSON();
});