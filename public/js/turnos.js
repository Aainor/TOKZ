// ==========================================
// 1. IMPORTACIONES (Conectado a tu Backend)
// ==========================================
// Importamos la conexión segura que ya tenías
import { db, auth } from './firebase.js'; 

import { collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ==========================================
// 2. CONFIGURACIÓN
// ==========================================
const SPECIAL_DATES = {
    "2025-12-25": { status: "closed", reason: "Navidad Cerrado 🎄" },
    "2026-01-01": { status: "closed", reason: "Año Nuevo" },
};

const BARBERS_CONFIG = [
    { id: "any", name: "Cualquiera", days: [1, 2, 3, 4, 5, 6], hours: ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"] },
    { id: "nico", name: "Nico", days: [2, 3, 4, 5, 6], hours: ["10:00", "11:00", "12:00", "16:00", "17:00", "18:00", "19:00"] },
    { id: "juan", name: "Juan", days: [4, 5, 6], hours: ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"] },
    { id: "leo", name: "Leo", days: [1, 2, 3, 4, 5], hours: ["09:00", "10:00", "11:00", "12:00", "13:00"] }
];

function getLocalDateISO(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localTime = new Date(dateObj.getTime() - offset);
    return localTime.toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', () => {
    
    // --- ESTADO ---
    let bookingData = {
        services: [],      
        totalPrice: 0,
        mode: 'together',  
        date: null,
        time: null,
        professional: '',
        appointments: [] 
    };

    let currentStep = 1;
    let serviceIndex = 0; 
    let guestData = null;
    let currentUser = null; // EMPEZAMOS VACÍO (Esperando a Firebase)

    // --- DOM ---
    const modal = document.getElementById('booking-modal');
    const openBtn = document.querySelector('.services-section .cta-button'); 
    const closeBtn = document.getElementById('close-modal-btn');
    const btnNext = document.getElementById('btn-next');
    const btnBack = document.getElementById('btn-back');
    const proSelect = document.getElementById('pro-select');
    const datePicker = document.getElementById('date-picker');
    const timeGridContainer = document.getElementById('time-grid-container');
    const servicesListContainer = document.querySelector('.services-list');
    const steps = [
        document.getElementById('step-1'),
        document.getElementById('step-mode'),
        document.getElementById('step-2'),
        document.getElementById('step-3')
    ];
    const dots = document.querySelectorAll('.step-dot');

    if (proSelect) bookingData.professional = proSelect.options[proSelect.selectedIndex].text;

    // FECHA MÍNIMA (Mañana)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = getLocalDateISO(tomorrow);

    if(datePicker) { 
        datePicker.min = tomorrowFormatted; 
        datePicker.value = tomorrowFormatted;
        bookingData.date = tomorrowFormatted; 
    }

    // --- 3. AUTENTICACIÓN REAL ---
    onAuthStateChanged(auth, (user) => { 
        if (user) {
            currentUser = user;
            console.log("Usuario detectado:", currentUser.email);
            updateUI(); // Para actualizar precios VIP si aplica
        } else {
            currentUser = null;
            console.log("Visitante anónimo");
        }
    });

    // --- EVENTOS MODAL ---
    if(openBtn) openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
    });
    if(closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // ==========================================
    // 4. CARGA DE SERVICIOS
    // ==========================================
    async function renderServicesFromJSON() {
        try {
            // Asegúrate que este archivo exista en tu carpeta publica
            const response = await fetch('/public/components/precios.json');
            if (!response.ok) throw new Error("Falta precios.json");
            
            const precios = await response.json();
            servicesListContainer.innerHTML = ''; 

            const SERVICE_NAMES = {
                "corte": "Corte de Cabello",
                "barba": "Arreglo de Barba",
                "corte_barba": "Corte + Barba (Combo)",
                "rapado": "Rapado Clásico",
                "corte_diseno": "Corte + Diseño",
                "femenino": "Corte Femenino"
            };

            const availableKeys = ['corte', 'barba', 'corte_barba', 'rapado', 'corte_diseno', 'femenino'];

            availableKeys.forEach(key => {
                if (precios[key]) {
                    const item = precios[key];
                    const rawPrice = (typeof item.destacado === 'number') ? item.destacado : item.precio; 
                    const price = Number(rawPrice) || 0; 
                    const finalName = SERVICE_NAMES[key] || key.toUpperCase();

                    const html = `
                        <div class="service-row" data-id="${key}" data-price="${price}" data-name="${finalName}">
                            <div class="srv-info">
                                <span class="srv-name">${finalName}</span>
                                <span class="srv-price">$${price.toLocaleString('es-AR')}</span>
                            </div>
                            <div class="quantity-control">
                                <button class="qty-btn minus" disabled>-</button>
                                <span class="qty-val">0</span>
                                <button class="qty-btn plus">+</button>
                            </div>
                        </div>
                    `;
                    servicesListContainer.insertAdjacentHTML('beforeend', html);
                }
            });
            attachServiceListeners();

        } catch (e) {
            console.error("Error:", e);
            servicesListContainer.innerHTML = '<p style="color:white; text-align:center;">Cargando precios...</p>';
        }
    }

    function attachServiceListeners() {
        document.querySelectorAll('.service-row').forEach(row => {
            const minus = row.querySelector('.minus');
            const plus = row.querySelector('.plus');
            const valSpan = row.querySelector('.qty-val');
            const name = row.getAttribute('data-name');
            const price = parseInt(row.getAttribute('data-price'));

            plus.addEventListener('click', (e) => {
                e.stopPropagation();
                let currentQty = parseInt(valSpan.textContent);
                currentQty++;
                valSpan.textContent = currentQty;
                minus.disabled = false;
                row.classList.add('selected-active'); 
                bookingData.services.push(name);
                bookingData.totalPrice += price;
                checkModeCompatibility();
                updateUI();
            });

            minus.addEventListener('click', (e) => {
                e.stopPropagation();
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
                        bookingData.totalPrice -= price;
                    }
                    checkModeCompatibility();
                    updateUI();
                }
            });
        });
    }

    function checkModeCompatibility() {
        const modeTogetherBtn = document.getElementById('mode-together');
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

    window.selectMode = function(mode) {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        document.getElementById(`mode-${mode}`).classList.add('selected');
        bookingData.mode = mode;
        updateUI(); 
    }

    // ==========================================
    // 5. CALENDARIO CON BASE DE DATOS REAL
    // ==========================================
    async function renderTimeSlots() {
        timeGridContainer.innerHTML = '<p style="color:white; text-align:center;">Cargando...</p>';
        
        const selectedDateStr = datePicker.value;
        if (!selectedDateStr) return;

        const proId = proSelect.value;
        const currentProName = proSelect.options[proSelect.selectedIndex].text;
        const barber = BARBERS_CONFIG.find(b => b.id === proId) || BARBERS_CONFIG[0];

        // Días bloqueados
        const dateObj = new Date(selectedDateStr + 'T00:00:00'); 
        const dayOfWeek = dateObj.getDay(); 
        if (dayOfWeek === 0 || !barber.days.includes(dayOfWeek)) {
            timeGridContainer.innerHTML = `<p style="color:#888; width:100%; text-align:center;">${currentProName} no atiende este día.</p>`;
            return;
        }

        try {
            // --- 1. BUSCAR OCUPADOS EN FIREBASE ---
            const q = query(
                collection(db, "turnos"),
                where("fecha", "==", selectedDateStr),
                where("barbero", "==", currentProName) 
            );

            const querySnapshot = await getDocs(q);
            const dbTakenSlots = [];
            querySnapshot.forEach(doc => {
                dbTakenSlots.push(doc.data().hora);
            });

            // --- 2. SUMAR LOS OCUPADOS DE LA SESIÓN ACTUAL ---
            const localTakenSlots = bookingData.appointments
                .filter(appt => appt.date === selectedDateStr && appt.pro === currentProName)
                .map(appt => appt.time);
                
            const allTakenSlots = [...dbTakenSlots, ...localTakenSlots];

            // --- 3. DIBUJAR ---
            timeGridContainer.innerHTML = ''; 
            barber.hours.forEach(hora => {
                const btn = document.createElement('button');
                btn.className = 'time-btn';
                btn.textContent = hora;
                
                if (allTakenSlots.includes(hora)) {
                    btn.disabled = true;
                    btn.classList.add('taken');
                    btn.title = "Ocupado";
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
            console.error("Error buscando horarios:", error);
            timeGridContainer.innerHTML = '<p style="color:red;">Error de conexión.</p>';
        }
    }

    if(proSelect) proSelect.addEventListener('change', () => {
        bookingData.professional = proSelect.options[proSelect.selectedIndex].text;
        bookingData.time = null;
        renderTimeSlots();
    });

    if(datePicker) datePicker.addEventListener('change', (e) => {
        bookingData.date = e.target.value;
        bookingData.time = null;
        renderTimeSlots();
    });

    // ==========================================
    // 6. NAVEGACIÓN (Siguiente/Atrás)
    // ==========================================
    btnNext.addEventListener('click', async () => {
        if (currentStep === 1) {
            if (bookingData.services.length > 1) {
                currentStep = 2; 
            } else {
                bookingData.mode = 'together'; 
                prepareCalendarStep();
                currentStep = 3; 
            }
            updateStep();
            return;
        }
        if (currentStep === 2) {
            if (bookingData.mode === 'separate') {
                serviceIndex = 0;
                bookingData.appointments = [];
            }
            prepareCalendarStep();
            currentStep = 3;
            updateStep();
            return;
        }
        if (currentStep === 3 && bookingData.mode === 'separate') {
            const currentService = bookingData.services[serviceIndex];
            const finalProName = proSelect.options[proSelect.selectedIndex].text;
            bookingData.appointments[serviceIndex] = {
                service: currentService,
                date: bookingData.date,
                time: bookingData.time,
                pro: finalProName
            };
            serviceIndex++; 
            if (serviceIndex < bookingData.services.length) {
                prepareCalendarStep(); 
                updateStep(); 
                return; 
            } else {
                currentStep = 4;
            }
            updateStep();
            return;
        }
        if (currentStep === 4) {
            // Validación Invitado
            if (!currentUser && !guestData) {
                const nameInput = document.getElementById('guest-name');
                const mailInput = document.getElementById('guest-mail');
                if (!nameInput.value || !mailInput.value.includes('@')) {
                    alert("Por favor completa tus datos correctamente.");
                    return;
                }
                guestData = { name: nameInput.value, email: mailInput.value };
                renderFinalStep();
                return; 
            }
            // Confirmar de verdad
            await finalizarReserva();
        }
    });

    function prepareCalendarStep() {
        bookingData.time = null; 
        const titleEl = document.getElementById('current-service-title');
        if (bookingData.mode === 'separate') {
            const srvName = bookingData.services[serviceIndex];
            titleEl.textContent = `Agendando: ${srvName} (${serviceIndex + 1}/${bookingData.services.length})`;
            titleEl.style.display = 'block';
        } else {
            titleEl.textContent = bookingData.services.length > 1 ? "Agendando todos los servicios" : "";
            titleEl.style.display = bookingData.services.length > 1 ? 'block' : 'none';
        }
        renderTimeSlots();
    }

    btnBack.addEventListener('click', () => {
        if (currentStep === 4 && !currentUser && guestData !== null) {
            guestData = null; 
            renderFinalStep(); 
            return;
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
                serviceIndex--; 
                prepareCalendarStep();
                updateStep();
                return; 
            }
            if (bookingData.services.length > 1) currentStep = 2; else currentStep = 1;
        } else if (currentStep === 2) {
            currentStep = 1;
        }
        updateStep();
    });

    // ==========================================
    // 7. ENVÍO A FIREBASE + EMAILJS (La Magia Final)
    // ==========================================
    async function finalizarReserva() {
        let finalName = currentUser ? currentUser.displayName : guestData.name;
        let finalMail = currentUser ? currentUser.email : guestData.email;
        let finalUid  = currentUser ? currentUser.uid : "guest";

        btnNext.textContent = "Guardando...";
        btnNext.disabled = true;

        let finalProName = bookingData.professional;
        if (bookingData.mode === 'separate') finalProName = "Varios (Ver detalles)";

        try {
            // A) PREPARAR DATOS COMUNES
            const baseData = {
                id_cliente: finalUid,
                cliente_nombre: finalName,
                cliente_email: finalMail,
                creado_en: new Date(),
                estado: "pendiente"
            };

            // B) GUARDAR EN FIREBASE
            if (bookingData.mode === 'together') {
                await addDoc(collection(db, "turnos"), {
                    ...baseData,
                    services: bookingData.services,
                    fecha: bookingData.date,
                    hora: bookingData.time,
                    barbero: finalProName
                });
            } else {
                // Guardar múltiples turnos si es modo separado
                const promises = bookingData.appointments.map(appt => {
                    return addDoc(collection(db, "turnos"), {
                        ...baseData,
                        services: [appt.service], 
                        fecha: appt.date,
                        hora: appt.time,
                        barbero: appt.pro
                    });
                });
                await Promise.all(promises);
            }

            console.log("✅ Guardado en Firestore");

            // C) ENVIAR EMAIL (Usando tus IDs)
            if (window.emailjs) {
                const paramsEmail = {
                    nombre_cliente: finalName,
                    to_email: finalMail,
                    fecha: bookingData.date || "Varios días",
                    hora: bookingData.time || "Varios horarios",
                    barbero: finalProName,
                    servicios: bookingData.services.join(', ')
                };
                
                // REEMPLAZA CON LOS IDs DE MAURI
                await emailjs.send("service_hamvojq", "template_qbqjfp6", paramsEmail);
                console.log("✅ Email enviado");
            }

            alert("¡Reserva confirmada con éxito! Revisa tu correo.");
            location.reload();

        } catch (e) {
            console.error("Error:", e);
            alert("Hubo un error al guardar: " + e.message);
            btnNext.textContent = "Reintentar";
            btnNext.disabled = false;
        }
    }

    function recalculateTotal() {
        let listPrice = bookingData.totalPrice; 
        let finalPrice = listPrice;
        let discountAmount = 0;

        if (currentUser) { // Descuento VIP
            discountAmount = bookingData.services.length * 1000;
            finalPrice = listPrice - discountAmount;
            if (finalPrice < 0) finalPrice = 0;
        }

        const totalEl = document.getElementById('total-price');
        if (totalEl) {
            if (discountAmount > 0) {
                totalEl.innerHTML = `<span style="text-decoration: line-through; color: #888; font-size: 0.8em;">$${listPrice}</span> <span style="color: #D32F2F;">$${finalPrice}</span>`;
            } else {
                totalEl.textContent = `$${listPrice}`;
            }
        }
    }

    function updateUI() {
        recalculateTotal();
        let ok = false;
        if (currentStep === 1) ok = bookingData.services.length > 0;
        else if (currentStep === 2) ok = true; 
        else if (currentStep === 3) ok = bookingData.time !== null && bookingData.date !== null;
        else ok = true; 

        btnNext.disabled = !ok;
        
        const footerTotal = document.querySelector('.total-display');
        if(footerTotal) footerTotal.style.opacity = (currentStep === 4) ? '0' : '1';

        if (currentStep === 4) {
            btnNext.textContent = "Confirmar Reserva";
            btnNext.style.backgroundColor = "#D32F2F";
        } else if (currentStep === 3 && bookingData.mode === 'separate' && serviceIndex < bookingData.services.length - 1) {
            btnNext.textContent = `Siguiente Turno`;
            btnNext.style.backgroundColor = "#333";
        } else {
            btnNext.textContent = "Siguiente";
            btnNext.style.backgroundColor = "#D32F2F";
        }
    }

    function renderFinalStep() {
        const step3Container = document.getElementById('step-3'); 
        const formTitle = step3Container.querySelector('.step-title');
        const formContent = step3Container.querySelector('.booking-form');

        let displayUser = currentUser ? currentUser.displayName : (guestData ? guestData.name : null);
        
        if (displayUser) {
            formTitle.textContent = "Confirmar";
            // Lógica simple de resumen... (puedes expandir si quieres el detalle HTML completo de Oriana)
            formContent.innerHTML = `<p style="color:white; text-align:center;">Usuario: <b>${displayUser}</b><br>Servicios: ${bookingData.services.join(', ')}</p>`;
        } else {
            formTitle.textContent = "Tus Datos";
            formContent.innerHTML = `
                <input type="text" id="guest-name" placeholder="Nombre completo" required class="input-fecha-pro">
                <input type="email" id="guest-mail" placeholder="Correo" required class="input-fecha-pro">
                <p style="color:#888; font-size:0.8rem; margin-top:10px;">Inicia sesión para tener descuento.</p>
            `;
        }
    }

    function updateStep() {
        steps.forEach((s, i) => {
            if (i + 1 === currentStep) { s.classList.remove('hidden'); s.classList.add('active'); }
            else { s.classList.add('hidden'); s.classList.remove('active'); }
        });
        dots.forEach((d, i) => {
            if (i < currentStep) d.classList.add('active'); else d.classList.remove('active');
        });
        if (currentStep === 4) renderFinalStep();
        updateUI();
    }

    renderServicesFromJSON();
});