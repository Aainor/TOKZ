// ==========================================
// 1. IMPORTACIONES
// ==========================================

// A. TUS CONFIGURACIONES LOCALES (Lo que sí exporta tu archivo)
import { db, auth } from './firebase.js'; 

// B. HERRAMIENTAS DE AUTENTICACIÓN (Desde Google)
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// C. HERRAMIENTAS DE BASE DE DATOS (Desde Google)
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs,
    doc,        // <--- Ahora sí las traemos desde la fuente oficial
    getDoc,
    setDoc,
    updateDoc,
    increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// ==========================================
// 2. CONFIGURACIÓN Y ESTADO
// ==========================================
let BARBERS_CONFIG = [];

// Configuración de EmailJS
const EMAIL_SERVICE_ID = "service_hamvojq"; 
const EMAIL_TEMPLATE_ID = "template_qbqjfp6"; 

// === FUNCIÓN NUEVA PARA GESTIONAR CLIENTES (AUTO-GUARDADO) ===
async function gestionarCliente(nombre, email) {
    try {
        const clientesRef = collection(db, "Clientes"); 
        const q = query(clientesRef, where("Email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // Cliente Nuevo
            await addDoc(clientesRef, {
                Nombre: nombre,
                Email: email,
                Cortes_Totales: 1,
                Fecha_Registro: new Date()
            });
            console.log("✅ Nuevo cliente registrado.");
        } else {
            // Cliente Existente
            const clienteDoc = querySnapshot.docs[0];
            const clienteRef = doc(db, "Clientes", clienteDoc.id);
            const cortesActuales = clienteDoc.data().Cortes_Totales || 0;
            
            await updateDoc(clienteRef, {
                Cortes_Totales: cortesActuales + 1
            });
            console.log("🔄 Cliente recurrente actualizado.");
        }
    } catch (error) {
        console.error("❌ Error gestionando cliente:", error);
    }
}

function getLocalDateISO(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localTime = new Date(dateObj.getTime() - offset);
    return localTime.toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- ESTADO MODIFICADO PARA MANEJAR DOBLE PRECIO ---
    let bookingData = {
        services: [],      
        totalVip: 0,      // Acumulador precio con descuento (Destacado)
        totalRegular: 0,  // Acumulador precio full (Accesorio)
        mode: 'together',  
        date: null,
        time: null,
        professional: '',
        appointments: [] 
    };

    let currentStep = 1;
    let serviceIndex = 0; 
    let guestData = null;
    let currentUser = null; 

    // --- DOM ---
    const modal = document.getElementById('booking-modal');
    const openBtn = document.querySelector('.services-section .cta-button'); 
    const closeBtn = document.getElementById('close-modal-btn');
    const btnNext = document.getElementById('btn-next');
    const btnBack = document.getElementById('btn-back');
    const totalPriceEl = document.getElementById('total-price');
    const serviceTitle = document.getElementById('current-service-title');
    const servicesListContainer = document.querySelector('.services-list'); 
    const steps = [
        document.getElementById('step-1'),
        document.getElementById('step-mode'),
        document.getElementById('step-2'),
        document.getElementById('step-3')
    ];
    const dots = document.querySelectorAll('.step-dot');
    const proSelect = document.getElementById('pro-select');
    const datePicker = document.getElementById('date-picker');
    const timeGridContainer = document.getElementById('time-grid-container');

    async function loadBarbersConfig() {
        try {
            const response = await fetch('/public/components/barberos.json');
            if (!response.ok) throw new Error("No se pudo cargar barberos.json");
            
            BARBERS_CONFIG = await response.json();
            
            if(proSelect) {
                proSelect.innerHTML = ''; 
                BARBERS_CONFIG.forEach(barber => {
                    const option = document.createElement('option');
                    option.value = barber.id;
                    option.textContent = barber.name;
                    proSelect.appendChild(option);
                });
                if (bookingData) bookingData.professional = proSelect.options[proSelect.selectedIndex].text;
            }
        } catch (e) {
            console.error("Error crítico cargando configuración de barberos:", e);
            BARBERS_CONFIG = [{ id: "any", name: "Cualquiera", days: [1,2,3,4,5,6], hours: ["10:00", "18:00"] }];
        }
    }

    await loadBarbersConfig();

    if (proSelect) bookingData.professional = proSelect.options[proSelect.selectedIndex].text;

    const today = new Date();
    const todayFormatted = getLocalDateISO(today);

    if(datePicker) { 
        datePicker.min = todayFormatted; 
        datePicker.value = todayFormatted;
        bookingData.date = todayFormatted; 
    }

    onAuthStateChanged(auth, (user) => { 
        if (user) {
            currentUser = user;
            console.log("Usuario detectado:", currentUser.displayName);
        } else {
            currentUser = null;
        }
        updateUI(); 
    });

    if(openBtn) openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
    });
    if(closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // ==========================================
    // CARGA DE SERVICIOS (LÓGICA DE PRECIOS CORREGIDA)
    // ==========================================
    async function renderServicesFromJSON() {
        try {
            const response = await fetch('/public/components/precios.json');
            if (!response.ok) throw new Error("No se pudo cargar precios.json");
            const precios = await response.json();
            servicesListContainer.innerHTML = ''; 

            const SERVICE_NAMES = {
                "corte": "Corte de Cabello", "barba": "Arreglo de Barba", "corte_barba": "Corte + Barba",
                "rapado": "Rapado Clásico", "corte_diseno": "Corte + Diseño", "femenino": "Corte Femenino",
                "claritos": "Claritos", "global": "Color Global", "franja": "Franja"
            };
            const availableKeys = ['corte', 'barba', 'corte_barba', 'rapado', 'corte_diseno', 'femenino', 'claritos', 'global', 'franja'];

            availableKeys.forEach(key => {
                if (precios[key]) {
                    const item = precios[key];
                    
                    // --- NUEVA LÓGICA DE PRECIOS ---
                    // 'destacado' es el precio VIP (con descuento)
                    // 'accesorio' es el precio Regular (sin descuento)
                    // Si no hay 'accesorio', usamos 'destacado' como fallback
                    const vipPrice = Number(item.destacado) || 0;
                    const rawRegular = Number(item.accesorio);
                    const regularPrice = !isNaN(rawRegular) ? rawRegular : vipPrice;

                    const finalName = SERVICE_NAMES[key] || key.toUpperCase();

                    // Guardamos ambos precios en los atributos del HTML
                    const html = `
                        <div class="service-row" 
                             data-id="${key}" 
                             data-vip="${vipPrice}" 
                             data-regular="${regularPrice}" 
                             data-name="${finalName}">
                            <div class="srv-info">
                                <span class="srv-name">${finalName}</span>
                                <span class="srv-price">$${vipPrice.toLocaleString('es-AR')}</span>
                            </div>
                            <div class="quantity-control">
                                <button class="qty-btn minus" disabled>-</button>
                                <span class="qty-val">0</span>
                                <button class="qty-btn plus">+</button>
                            </div>
                        </div>`;
                    servicesListContainer.insertAdjacentHTML('beforeend', html);
                }
            });
            attachServiceListeners();
        } catch (e) {
            console.error("Error crítico cargando servicios:", e);
        }
    }

    function attachServiceListeners() {
        document.querySelectorAll('.service-row').forEach(row => {
            const minus = row.querySelector('.minus');
            const plus = row.querySelector('.plus');
            const valSpan = row.querySelector('.qty-val');
            const name = row.getAttribute('data-name');
            
            // Leemos los dos precios
            const vipPrice = parseInt(row.getAttribute('data-vip'));
            const regularPrice = parseInt(row.getAttribute('data-regular'));

            plus.addEventListener('click', (e) => {
                e.stopPropagation();
                let currentQty = parseInt(valSpan.textContent);
                currentQty++;
                valSpan.textContent = currentQty;
                minus.disabled = false;
                row.classList.add('selected-active'); 
                
                bookingData.services.push(name);
                
                // Sumamos a los acumuladores por separado
                bookingData.totalVip += vipPrice;
                bookingData.totalRegular += regularPrice;

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
                        
                        // Restamos de los acumuladores
                        bookingData.totalVip -= vipPrice;
                        bookingData.totalRegular -= regularPrice;
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
    // LÓGICA CALENDARIO + FIREBASE CHECK
    // ==========================================
    async function renderTimeSlots() {
        timeGridContainer.innerHTML = '<p style="color:white; text-align:center;">Cargando horarios...</p>'; 
        const selectedDateStr = datePicker.value;
        if (!selectedDateStr) return;

        const proId = proSelect.value;
        const currentProName = proSelect.options[proSelect.selectedIndex].text;
        const barber = BARBERS_CONFIG.find(b => b.id === proId) || BARBERS_CONFIG[0];

        const dateObj = new Date(selectedDateStr + 'T00:00:00'); 
        const dayOfWeek = dateObj.getDay(); 
        if (dayOfWeek === 0 || !barber.days.includes(dayOfWeek)) {
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

            const localTakenSlots = bookingData.appointments
                .filter(appt => appt.date === selectedDateStr && appt.pro === currentProName)
                .map(appt => appt.time);
                
            const allTakenSlots = [...dbTakenSlots, ...localTakenSlots];

            timeGridContainer.innerHTML = ''; 

            barber.hours.forEach(hora => {
                const btn = document.createElement('button');
                btn.className = 'time-btn';
                btn.textContent = hora;
                
                let isPastTime = false;
                const now = new Date();
                
                if (selectedDateStr === getLocalDateISO(now)) {
                    const [slotHour, slotMin] = hora.split(':').map(Number);
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();

                    if (slotHour < currentHour || (slotHour === currentHour && slotMin < currentMin)) {
                        isPastTime = true;
                    }
                }

                if (allTakenSlots.includes(hora) || isPastTime) {
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
    // NAVEGACIÓN
    // ==========================================
    btnNext.addEventListener('click', async () => {
        if (currentStep === 1) {
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
                serviceIndex = 0;
                bookingData.appointments = [];
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
                }
            }
            currentStep = 4;
            updateStep(); return;
        }

        if (currentStep === 4) {
            await finalizarReserva();
        }
    });

    btnBack.addEventListener('click', () => {
        if (currentStep === 4 && !currentUser && guestData !== null) {
            guestData = null; 
            renderFinalStep(); return;
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
                updateStep(); return; 
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
            serviceTitle.textContent = `Agendando: ${srvName} (${serviceIndex + 1}/${bookingData.services.length})`;
            serviceTitle.style.display = 'block';
            serviceTitle.style.color = "#AE0E30"; 
        } else {
            serviceTitle.textContent = bookingData.services.length > 1 ? "Agendando todo junto" : "";
            serviceTitle.style.display = bookingData.services.length > 1 ? 'block' : 'none';
        }
        renderTimeSlots();
    }

    // ==========================================
    // 8. ENVÍO A FIREBASE + EMAILJS (FINALIZAR)
    // ==========================================
    async function finalizarReserva() {
        btnNext.textContent = "Procesando...";
        btnNext.disabled = true;

        let finalName = currentUser ? currentUser.displayName : guestData.name;
        let finalMail = currentUser ? currentUser.email : guestData.email;
        let finalUid = currentUser ? currentUser.uid : "guest";

        // Determinamos el precio final real AHORA
        const isVip = currentUser && currentUser.uid !== "guest";
        const precioFinalReserva = isVip ? bookingData.totalVip : bookingData.totalRegular;

        let serviciosResumen = "";
        let fechaResumen = "";
        let proResumen = "";

        if (bookingData.mode === 'together') {
            let pName = bookingData.professional.includes("Cualquiera") ? "Cualquiera" : bookingData.professional;
            serviciosResumen = bookingData.services.join(", ");
            fechaResumen = `${bookingData.date} a las ${bookingData.time}`;
            proResumen = pName;
        } else {
            serviciosResumen = "Paquete Multi-Turno: " + bookingData.services.join(" + ");
            fechaResumen = bookingData.appointments.map(a => `${a.service} el ${a.date} (${a.time}) con ${a.pro}`).join(" || ");
            proResumen = "Varios Profesionales";
        }

        const baseData = {
            uid: finalUid,
            clientName: finalName,
            clientEmail: finalMail,
            created_at: new Date(),
            status: "pendiente"
        };

        try {
            // A. GUARDAR EN FIREBASE
            if (bookingData.mode === 'together') {
                let pName = bookingData.professional.includes("Cualquiera") ? "Cualquiera" : bookingData.professional;
                await addDoc(collection(db, "turnos"), {
                    ...baseData,
                    services: bookingData.services,
                    total: precioFinalReserva, // Precio Correcto
                    date: bookingData.date,
                    time: bookingData.time,
                    pro: pName,
                    type: 'pack'
                });
            } else {
                const promises = bookingData.appointments.map(appt => {
                    return addDoc(collection(db, "turnos"), {
                        ...baseData,
                        services: [appt.service], 
                        total: 0, // En multi-turno el precio total puede ir en 0 o dividido
                        date: appt.date,
                        time: appt.time,
                        pro: appt.pro,
                        type: 'single_from_pack'
                    });
                });
                await Promise.all(promises);
            }

           console.log("🔥 Guardado en Firebase exitoso.");
            
            // --- LÓGICA CORREGIDA PARA GESTIÓN DE CLIENTES ---
            if (currentUser) {
                try {
                    // Usamos el UID como ID del documento (Práctica recomendada en Firebase)
                    const clientRef = doc(db, "Clientes", currentUser.uid);
                    const clientSnap = await getDoc(clientRef);

                    if (clientSnap.exists()) {
                        // SI YA EXISTE: Solo incrementamos el contador atómicamente
                        await updateDoc(clientRef, {
                            Cortes_Totales: increment(1)
                        });
                        console.log("🔄 Cliente recurrente actualizado (Contador +1).");
                    } else {
                        // SI NO EXISTE: Lo creamos con datos iniciales
                        await setDoc(clientRef, {
                            Nombre: currentUser.displayName || finalName,
                            Email: currentUser.email || finalMail,
                            Cortes_Totales: 1,
                            Fecha_Registro: new Date()
                        });
                        console.log("✅ Nuevo cliente registrado en la colección Clientes.");
                    }
                } catch (e) {
                    console.error("❌ Error gestionando cliente en DB:", e);
                }
            }
 

            // B. ENVIAR EMAIL CON EMAILJS
            const templateParams = {
                to_name: finalName,
                to_email: finalMail,
                service_list: serviciosResumen,
                date_info: fechaResumen,
                professional: proResumen,
                total_price: `$${precioFinalReserva}`,
                message: "Gracias por confiar en Staff TOKZ. Te esperamos."
            };

            await emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, templateParams);
            console.log("📧 Email enviado exitosamente.");

            alert(`¡Reserva confirmada ${finalName}! Te enviamos un correo con los detalles.`);
            modal.classList.add('hidden');
            resetBooking();
            btnNext.textContent = "Confirmar Reserva";
            btnNext.disabled = false;

        } catch (e) {
            console.error("Error en el proceso:", e);
            alert("Hubo un error al guardar o enviar el correo. Por favor avisanos por WhatsApp.");
            btnNext.textContent = "Reintentar";
            btnNext.disabled = false;
        }
    }

    function recalculateTotal() {
        // Obtenemos los dos totales acumulados
        const totalVip = bookingData.totalVip;
        const totalRegular = bookingData.totalRegular;
        
        let displayPrice = totalRegular; // Por defecto mostramos precio lista
        let showCrossed = false;

        // Si es usuario VIP
        if (currentUser && currentUser.uid !== "guest") {
            displayPrice = totalVip;
            // Solo tachamos si hay diferencia real
            if (totalRegular > totalVip) {
                showCrossed = true;
            }
        }

        const totalEl = document.getElementById('total-price');
        if (totalEl) {
            if (showCrossed) {
                totalEl.innerHTML = `
                    <span style="text-decoration: line-through; color: #888; font-size: 0.8em; margin-right: 5px;">$${totalRegular.toLocaleString()}</span>
                    <span style="color: #AE0E30;">$${displayPrice.toLocaleString()}</span>
                `;
            } else {
                totalEl.textContent = `$${displayPrice.toLocaleString()}`;
            }
        }
    }

    // ==========================================
    // UI UPDATES & HELPERS
    // ==========================================
    function updateUI() {
        recalculateTotal();
        let ok = false;
        if (currentStep === 1) ok = bookingData.services.length > 0;
        else if (currentStep === 2) ok = true; 
        else if (currentStep === 3) ok = bookingData.time !== null && bookingData.date !== null;
        else ok = true; 
        if(btnNext) btnNext.style.display = 'block'; 
        btnNext.disabled = !ok;

        const footerTotal = document.querySelector('.total-display'); 
        if(footerTotal) footerTotal.style.opacity = (currentStep === 4) ? '0' : '1';

        if (currentStep === 4) {
            btnNext.textContent = "Confirmar Reserva";
            btnNext.style.backgroundColor = "#AE0E30";
        } else if (currentStep === 3 && bookingData.mode === 'separate' && serviceIndex < bookingData.services.length - 1) {
            btnNext.textContent = `Siguiente Turno`;
            btnNext.style.backgroundColor = "#333";
        } else {
            btnNext.textContent = "Siguiente";
            btnNext.style.backgroundColor = "#AE0E30";
        }
    }

    const generateSummaryHTML = (name, isVip) => {
        let resumenHTML = '';
        const proNameDisplay = bookingData.professional;
        
        // Usamos los acumuladores correctos
        const precioLista = bookingData.totalRegular;
        const precioFinal = isVip ? bookingData.totalVip : bookingData.totalRegular;

        if (bookingData.mode === 'separate') {
            let itemsHTML = bookingData.appointments.map(appt => `
                <li style="margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                    <strong style="color: #fff; display:block;">${appt.service}</strong>
                    <span style="color: #aaa; font-size: 0.85rem;">
                        📅 ${appt.date.split('-').reverse().join('/')} &nbsp;|&nbsp; ⏰ ${appt.time} &nbsp;|&nbsp; 💈 ${appt.pro}
                    </span>
                </li>
            `).join('');
            resumenHTML = `<ul style="list-style: none; padding: 0; margin: 15px 0; text-align: left;">${itemsHTML}</ul>`;
        } else {
            const dateFormatted = bookingData.date ? bookingData.date.split('-').reverse().join('/') : 'Sin fecha';
            resumenHTML = `
                <div style="padding: 15px; text-align: left; margin: 15px 0;">
                    <p style="color: #AE0E30; font-size: 0.8rem; text-transform: uppercase; font-weight: bold; margin-bottom: -15px;">Servicios (${bookingData.services.length}):</p>
                    <p style="color: white; margin-bottom: 10px; font-weight: 500;">${bookingData.services.join(' + ')}</p>
                    <div style="display: flex; gap: 10px; font-size: 0.9rem; color: #ccc;">
                        <span>📅 ${dateFormatted}</span>
                        <span>⏰ ${bookingData.time}</span>
                    </div>
                    <p style="color: #888; font-size: 0.9rem; margin-top: 5px;">💈 Barbero: <span style="color: #ddd;">${proNameDisplay}</span></p>
                </div>
            `;
        }

        let precioHTML = '';
        if (isVip && precioFinal < precioLista) {
            precioHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 20px;">
                    <span style="text-decoration: line-through; color: #666; font-size: 1.1rem; margin-bottom: -5px;">$${precioLista.toLocaleString()}</span>
                    <span style="color: #4CAF50; font-size: 2.2rem; font-weight: bold; line-height: 1.2;">$${precioFinal.toLocaleString()}</span>
                    <span style="color: #4CAF50; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Precio Socio</span>
                </div>
            `;
        } else {
            precioHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 20px;">
                    <span style="color: white; font-size: 2.2rem; font-weight: bold;">$${precioFinal.toLocaleString()}</span>
                    <span style="color: #888; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Total Final</span>
                </div>
            `;
        }

        let emailMsg = '';
        if (!isVip && guestData) {
            emailMsg = `
                <div style="margin-top: 15px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; border: 1px dashed #444;">
                    <p style="color: #aaa; font-size: 0.8rem; margin: 0;">Enviaremos la información de la reserva a:</p>
                    <p style="color: #fff; font-size: 0.95rem; margin: 3px 0 0 0; font-weight: 500;">${guestData.email}</p>
                </div>
            `;
        }

        return `
            <div class="user-summary" style="text-align: center;">
                <h3 style="color: white; margin: 5px 0 15px 0;">¡Hola, <span style="color: #AE0E30;">${name}</span>!</h3>
                <p style="color: #aaa; font-size: 0.9rem; margin-bottom: -20px;">Este es el resumen de tu reserva:</p>
                
                ${resumenHTML}
                
                <div style="border-top: 1px solid #333; margin-top: 15px; padding-top: 10px;">
                    ${precioHTML}
                </div>
                
                ${emailMsg}

                <p style="color: #555; font-size: 0.75rem; margin-top: 20px;">
                    ${isVip 
                        ? '(Si no sos vos, <a href="/pages/login.html" style="color:#666;">cerrá sesión e iniciá de nuevo.</a>)' 
                        : '(Revisá bien los datos antes de confirmar)'}
                </p>
            </div>
        `;
    };

    function renderFinalStep() {
        const finalStepContainer = document.getElementById('step-3'); 
        if (!finalStepContainer) return;

        finalStepContainer.innerHTML = ''; 
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'booking-form';

        if (currentUser) {
            contentWrapper.innerHTML = `
                <h2 class="step-title" style="text-align:center; color:white; margin-bottom:20px;">Revisá y Confirmá</h2>
                ${generateSummaryHTML(currentUser.displayName, true)}
            `;
            if(btnNext) {
                btnNext.style.display = 'block';
                btnNext.textContent = "Confirmar Reserva";
                btnNext.disabled = false;
            }
        } 
        else {
            contentWrapper.innerHTML = `
                <div style="text-align: center; padding: 30px 10px;">
                    <h3 style="color: #AE0E30; margin-bottom: 15px;">🔒 Inicio de Sesión Requerido</h3>
                    <p style="color: #ccc; margin-bottom: 25px;">
                        Para asegurar tu turno, necesitamos que ingreses a tu cuenta.
                    </p>
                    <a href="/pages/login.html" class="cta-button" style="display: inline-block; text-decoration: none; background: #AE0E30; color: white; padding: 12px 25px; border-radius: 5px; font-weight: bold;">
                        Iniciar Sesión / Registrarme
                    </a>
                </div>
            `;
            if(btnNext) btnNext.style.display = 'none';
        }
        
        finalStepContainer.appendChild(contentWrapper);
    }

    function updateStep() {
        steps.forEach((s, i) => {
            if (i + 1 === currentStep) { s.classList.remove('hidden'); s.classList.add('active'); } 
            else { s.classList.add('hidden'); s.classList.remove('active'); }
        });
        
        let visualStepLimit = currentStep;
        if (currentStep === 2) visualStepLimit = 1;
        if (currentStep === 3) visualStepLimit = 2;
        if (currentStep === 4) visualStepLimit = 3;

        dots.forEach(d => {
            const n = parseInt(d.getAttribute('data-step'));
            d.classList.toggle('active', n <= visualStepLimit);
        });
        
        if (currentStep === 4) renderFinalStep();
        btnBack.classList.toggle('hidden', currentStep === 1);
        updateUI();
    }

    function resetBooking() {
        // Reiniciamos ambos contadores
        bookingData = { services: [], totalVip: 0, totalRegular: 0, mode: 'together', date: getLocalDateISO(new Date()), time: null, professional: 'Cualquiera', appointments: [] };
        currentStep = 1; serviceIndex = 0; guestData = null;
        document.querySelectorAll('.qty-val').forEach(el => el.textContent = '0');
        document.querySelectorAll('.minus').forEach(el => el.disabled = true);
        document.querySelectorAll('.service-row').forEach(el => el.classList.remove('selected-active'));
        updateStep();
    }

    renderServicesFromJSON();
});