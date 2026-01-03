// ==========================================
// 1. IMPORTACIONES DE FIREBASE
// ==========================================
/*import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {getFirestore,
        collection,
        addDoc,
        query,
        where,
        getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

       mato firebase temporalmente para poder trabajar en el CSS */

// ==========================================
// 2. CONFIGURACIÓN DEL PROYECTO
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDkVou02bXWq2qX0QSF1WMVrJMfsW903rM",
    authDomain: "tokz-barber.firebaseapp.com",
    projectId: "tokz-barber",
    storageBucket: "tokz-barber.firebasestorage.app",
    messagingSenderId: "949051520274",
    appId: "1:949051520274:web:24b6887eeb15627333efcb",
    measurementId: "G-4Q111E9FDQ"
};

/*
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

silenciado para trabajar en CSS
*/

// ==========================================
// 3. CONFIGURACIÓN (CEREBRO)
// ==========================================
const SPECIAL_DATES = {
    "2025-12-25": { status: "closed", reason: "Navidad Cerrado 🎄" },
    "2025-01-01": { status: "closed", reason: "Año Nuevo" },
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
        professional: '', // FIX: Lo dejamos vacío para llenarlo dinámicamente

        appointments: [] 
    };

    let currentStep = 1;
    let serviceIndex = 0; 
    //let currentUser = null; //|| comentado para la simulación
    let guestData = null;
    let currentUser = { uid: "usuario_prueba", displayName: "Pepito" }; // Simulación

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

    // FIX: Inicializar el nombre del profesional correctamente al arrancar
    if (proSelect) {
        bookingData.professional = proSelect.options[proSelect.selectedIndex].text;
    }

    // --- FECHA MÍNIMA HOY ---
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = getLocalDateISO(tomorrow);

    if(datePicker) { 
        datePicker.min = tomorrowFormatted; 
        datePicker.value = tomorrowFormatted;
        bookingData.date = tomorrowFormatted; 
    }

    // --- AUTH --- (silenciado para trabajar en CSS)
    // onAuthStateChanged(auth, (user) => { if (user) currentUser = user; });

    // --- EVENTOS MODAL ---
    if(openBtn) openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
    });
    if(closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // ==========================================
    // 4. CARGA DE SERVICIOS (CON NOMBRES ARREGLADOS)
    // ==========================================
    async function renderServicesFromJSON() {
        try {
            const response = await fetch('/public/components/precios.json');
            if (!response.ok) throw new Error("No se pudo cargar precios.json");
            
            const precios = await response.json();
            servicesListContainer.innerHTML = ''; 

            // 1. DICCIONARIO DE NOMBRES (Acá definís cómo se ven)
            const SERVICE_NAMES = {
                "corte": "Corte de Cabello",
                "barba": "Arreglo de Barba",
                "corte_barba": "Corte + Barba (Combo)",
                "rapado": "Rapado Clásico",
                "corte_diseno": "Corte + Diseño Freestyle",
                "femenino": "Corte Femenino",
                "claritos": "Claritos / Iluminación",
                "global": "Color Global",
                "franja": "Franja / Mechón"
            };

            // Las keys que querés mostrar en el turnero
            const availableKeys = ['corte', 'barba', 'corte_barba', 'rapado', 'corte_diseno', 'femenino'];

            availableKeys.forEach(key => {
                if (precios[key]) {
                    const item = precios[key];
                    const rawPrice = (typeof item.destacado === 'number') ? item.destacado : item.precio; 
                    const price = Number(rawPrice) || 0; 

                    // FIX: Usamos el diccionario. Si no existe, usamos la key en mayúscula como plan B.
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
            console.error("Error crítico cargando servicios:", e);
            servicesListContainer.innerHTML = '<p style="color:white; text-align:center;">Error cargando servicios. Recarga la página.</p>';
        }
    }

    // ==========================================
    // 5. LÓGICA DE CONTADORES
    // ==========================================
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
    // 6. LÓGICA CALENDARIO (Render + FIX DE BUG)
    // ==========================================
    // OJO: Ahora la función tiene que ser ASYNC porque va a esperar a la base de datos
async function renderTimeSlots() {
    timeGridContainer.innerHTML = '<p style="color:white; text-align:center;">Cargando horarios...</p>'; // Feedback visual
    
    const selectedDateStr = datePicker.value;
    if (!selectedDateStr) return;

    const proId = proSelect.value;
    const currentProName = proSelect.options[proSelect.selectedIndex].text;
    const barber = BARBERS_CONFIG.find(b => b.id === proId) || BARBERS_CONFIG[0];

    // ... (validaciones de día cerrado igual que antes) ...
    const dateObj = new Date(selectedDateStr + 'T00:00:00'); 
    const dayOfWeek = dateObj.getDay(); 
    if (dayOfWeek === 0 || !barber.days.includes(dayOfWeek)) {
        // ... (tu lógica de cerrado existente)
        timeGridContainer.innerHTML = `<p style="color:#888; width:100%; text-align:center;">No disponible.</p>`;
        return;
    }

    // --- ACÁ ESTÁ LA MAGIA NUEVA ---
    
    // 1. Preparamos la consulta a Firebase
    // "Traeme todos los turnos de la colección 'turnos' donde la fecha sea X y el barbero sea Y"
    /*lo comentamos por ahora porque no tenemos la base de datos enlazada
    const q = query(
        collection(db, "turnos"),
        where("date", "==", selectedDateStr),
        where("pro", "==", currentProName) 
    );

    try {
        // 2. Ejecutamos la consulta (esto tarda unos milisegundos)
        const querySnapshot = await getDocs(q);
        
        // 3. Sacamos solo los horarios de los documentos que encontramos
        const dbTakenSlots = querySnapshot.docs.map(doc => doc.data().time);
        */
       const dbTakenSlots = ["10:00", "16:00"]; // Simulación de horarios ocupados

        // 4. Los sumamos a los que vos ya tenías seleccionados localmente
        const localTakenSlots = bookingData.appointments
            .filter(appt => appt.date === selectedDateStr && appt.pro === currentProName)
            .map(appt => appt.time);
            
        // Unimos las dos listas (los de la BD + los tuyos de ahora)
        const allTakenSlots = [...dbTakenSlots, ...localTakenSlots];

        timeGridContainer.innerHTML = ''; // Limpiamos el "Cargando..."

        // --- RENDERIZADO DE BOTONES (Igual que antes pero usando allTakenSlots) ---
        barber.hours.forEach(hora => {
            const btn = document.createElement('button');
            btn.className = 'time-btn';
            btn.textContent = hora;
            
            // Usamos la lista combinada para bloquear
            if (allTakenSlots.includes(hora)) {
                btn.disabled = true;
                btn.classList.add('taken'); // Acá entra tu CSS nuevo rojo
                btn.title = "No disponible";
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

    /*} catch (error) {
        console.error("Error buscando horarios:", error);
        timeGridContainer.innerHTML = '<p style="color:red;">Error de conexión.</p>';
    }*/
}

    if(proSelect) proSelect.addEventListener('change', () => {
        // FIX: Actualizamos inmediatamente el nombre en bookingData
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
    // 7. NAVEGACIÓN Y FLUJO
    // ==========================================
    btnNext.addEventListener('click', async () => {
        
        // ---> SALIENDO DEL PASO 1
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

        // ---> SALIENDO DEL PASO 2
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

        // ---> SALIENDO DEL PASO 3 (CALENDARIO)
        if (currentStep === 3 && bookingData.mode === 'separate') {
    const currentService = bookingData.services[serviceIndex];
    const finalProName = proSelect.options[proSelect.selectedIndex].text;

    // FIX: Asignación directa por índice. No usamos push.
    // Si el usuario volvió atrás y editó, esto actualiza la posición correcta.
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
        currentStep = 4; // Ir a resumen
    }
    updateStep();
    return;
}

        // ---> SALIENDO DEL PASO 4
        if (currentStep === 4) {
            // A. Si es un invitado que todavía no llenó los datos
            if (!currentUser && !guestData) {
                const nameInput = document.getElementById('guest-name');
                const mailInput = document.getElementById('guest-mail');

                if (!nameInput.value || !mailInput.value) {
                    alert("Por favor completá nombre y correo.");
                    return;
                }
                
                // Validación básica de email
                if (!mailInput.value.includes('@')) {
                    alert("Por favor ingresá un correo válido.");
                    return;
                }

                // GUARDAMOS LOS DATOS EN MEMORIA
                guestData = {
                    name: nameInput.value,
                    email: mailInput.value
                };

                // RE-RENDERIZAMOS EL PASO 4 (Ahora mostrará el resumen)
                renderFinalStep();
                return; // Cortamos acá, no enviamos nada todavía
            }

            // B. Si ya es VIP o ya tenemos guestData, Confirmamos de verdad
            await finalizarReserva();
        }
    });

    function prepareCalendarStep() {
        // Reseteamos tiempo para obligar a elegir de nuevo
        bookingData.time = null; 
        
        if (bookingData.mode === 'separate') {
            const srvName = bookingData.services[serviceIndex];
            serviceTitle.textContent = `Agendando: ${srvName} (Turno ${serviceIndex + 1} de ${bookingData.services.length})`;
            serviceTitle.style.display = 'block';
            serviceTitle.style.color = "#D32F2F"; // Resaltar cambio
        } else {
            serviceTitle.textContent = bookingData.services.length > 1 ? "Agendando todos los servicios juntos" : "";
            serviceTitle.style.display = bookingData.services.length > 1 ? 'block' : 'none';
        }
        
        renderTimeSlots();
        // Nota: updateUI se llama dentro de renderTimeSlots, así que el botón se deshabilitará correctamente
    }

    btnBack.addEventListener('click', () => {
        // NUEVO: Si estamos en el Resumen de Invitado, volvemos al Formulario
        if (currentStep === 4 && !currentUser && guestData !== null) {
            guestData = null; // Borramos los datos para obligar a mostrar el form
            renderFinalStep(); // Vuelve a dibujar los inputs
            return;
        }

        // --- VOLVIENDO DESDE EL RESUMEN (Paso 4 -> 3) ---
        if (currentStep === 4) {
            currentStep = 3;
            
            // ¡ACÁ ESTÁ EL FIX DEL BUG! 🐛🔫
            // Si estamos en modo "Por separado", al volver atrás tenemos que:
            // 1. Borrar el último turno que se había guardado (para no duplicarlo).
            // 2. Bajar el índice para volver a "editar" ese servicio.
            if (bookingData.mode === 'separate') {
                bookingData.appointments.pop(); // Eliminamos el último de la memoria
                serviceIndex--; // Volvemos el contador para atrás
                prepareCalendarStep(); // Actualizamos el título (Ej: "Agendando Corte...")
            }
        } 
        
        // --- VOLVIENDO DESDE CALENDARIO (Paso 3 -> 2 o 1) ---
        else if (currentStep === 3) {
        if (bookingData.mode === 'separate' && serviceIndex > 0) {
            serviceIndex--; 
            // NO HACEMOS POP. Dejamos el dato ahí. 
            // Si el usuario cambia algo y da siguiente, se sobrescribe.
            // Si no cambia nada, el dato persiste. Menos destructivo.
            prepareCalendarStep();
            updateStep();
            return; 
        }

            // Si es el primero o es modo junto, volvemos a selección de modo o servicios
            if (bookingData.services.length > 1) currentStep = 2;
            else currentStep = 1;
        } 
        
        // --- VOLVIENDO DESDE MODO (Paso 2 -> 1) ---
        else if (currentStep === 2) {
            currentStep = 1;
        }
        
        updateStep();
    });

    // ==========================================
    // 8. ENVÍO A FIREBASE
    // ==========================================
    async function finalizarReserva() {
        let finalName = "";
        let finalMail = "";

        // CASO A: Usuario Logueado
        if (currentUser && currentUser.uid !== "guest") {
            finalName = currentUser.displayName;
            finalMail = currentUser.email;
        } 
        // CASO B: Invitado (Ya validamos guestData antes)
        else {
            finalName = guestData.name;
            finalMail = guestData.email;
        }

        // Activamos modo "Cargando"
        btnNext.textContent = "Guardando...";
        btnNext.disabled = true;

        let finalProName = bookingData.professional;

        if (finalProName && finalProName.toLowerCase().includes("cualquiera")) {
            finalProName = "Cualquiera";
        }

        if (bookingData.mode === 'separate') {
            finalProName = "Varios (Ver detalles)";
        }

        const clientData = {
            uid: currentUser ? currentUser.uid : "guest",
            name: finalName,
            phone: finalMail,
            created_at: new Date(),
            status: "pendiente"
        };

        try {
            // --- AQUÍ IRÍA LA LÓGICA DE FIREBASE (COMENTADA) ---
            /*
            if (bookingData.mode === 'together') {
                await addDoc(collection(db, "turnos"), {
                    ...clientData,
                    services: bookingData.services,
                    total: bookingData.totalPrice,
                    date: bookingData.date,
                    time: bookingData.time,
                    pro: finalProName, // Usamos la variable fresca
                    type: 'pack'
                });
            } else {
                const promises = bookingData.appointments.map(appt => {
                    return addDoc(collection(db, "turnos"), {
                        ...clientData,
                        services: [appt.service], 
                        total: 0, 
                        date: appt.date,
                        time: appt.time,
                        pro: appt.pro,
                        type: 'single'
                    });
                });
                await Promise.all(promises);
            }*/

            // --- SIMULACIÓN ---
            console.log("✅ ÉXITO. DATOS ENVIADOS AL BACKEND:", {
                client: clientData,
                booking: {
                    ...bookingData,
                    pro_final: finalProName
                }
            });

            // Pequeño delay artificial para que se sienta que "pensó" (UX)
            setTimeout(() => {
                alert("¡Reserva confirmada con éxito! 🚀");
                modal.classList.add('hidden');
                // location.reload(); // Descomentar en producción
                
                // Restauramos el botón por si abren el modal de nuevo sin recargar
                btnNext.textContent = "Confirmar Reserva";
                btnNext.disabled = false;
            }, 500);

        } catch (e) {
            console.error("Error en el guardado:", e);
            alert("Hubo un error al guardar el turno.");
            btnNext.textContent = "Confirmar Reserva";
            btnNext.disabled = false;
        }
    }

    function recalculateTotal() {
    let listPrice = bookingData.totalPrice; // Precio real de lista
    let finalPrice = listPrice;
    let discountAmount = 0;

    // LÓGICA: $1000 de descuento POR CADA servicio si está logueado
    if (currentUser && currentUser.uid !== "guest") {
        // Contamos cuántos servicios hay en el array
        const quantity = bookingData.services.length; 
        
        discountAmount = quantity * 1000;
        finalPrice = listPrice - discountAmount;

        // Seguridad anti-números negativos (por las dudas)
        if (finalPrice < 0) finalPrice = 0;
    }

    // Actualizamos la vista del total en el HTML
    const totalEl = document.getElementById('total-price');
    if (totalEl) {
        if (discountAmount > 0) {
            // MODO OFERTA: Mostramos precio tachado y el precio con descuento
            totalEl.innerHTML = `
                <span style="text-decoration: line-through; color: #888; font-size: 0.8em; margin-right: 5px;">$${listPrice.toLocaleString()}</span>
                <span style="color: #D32F2F;">$${finalPrice.toLocaleString()}</span>
            `;
        } else {
            // MODO NORMAL (Invitado)
            totalEl.textContent = `$${listPrice.toLocaleString()}`;
        }
    }
    
    // Opcional: Si querés guardar el precio final en el objeto para mandarlo al back con descuento ya aplicado:
    // bookingData.finalDiscountedPrice = finalPrice; 
}

    // ==========================================
    // 9. ACTUALIZACIÓN UI
    // ==========================================
    function updateUI() {
        recalculateTotal();
        
        let ok = false;
        
        if (currentStep === 1) {
            ok = bookingData.services.length > 0;
        } 
        else if (currentStep === 2) {
            ok = true; 
        } 
        else if (currentStep === 3) {
            // FIX: El botón solo se activa si hay hora y fecha seleccionadas
            ok = bookingData.time !== null && bookingData.date !== null;
        } 
        else {
            ok = true; 
        }

        btnNext.disabled = !ok;

        // --- LÓGICA DE VISIBILIDAD DEL FOOTER (NUEVO) ---
        const footerTotal = document.querySelector('.total-display'); // El contenedor del precio abajo
        
        if (currentStep === 4) {
            // En el resumen, ocultamos el total de abajo porque ya está en la tarjeta
            if(footerTotal) footerTotal.style.opacity = '0'; 
        } else {
            // En los otros pasos, lo mostramos
            if(footerTotal) footerTotal.style.opacity = '1';
        }

        // Cambios de texto del botón
        if (currentStep === 4) {
            btnNext.textContent = "Confirmar Reserva";
            btnNext.style.backgroundColor = "#D32F2F";
        } else if (currentStep === 3 && bookingData.mode === 'separate' && serviceIndex < bookingData.services.length - 1) {
            // FIX: Texto más claro para que sepa que falta otro turno
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

    let proNameDisplay = bookingData.professional;
    if (proNameDisplay.toLowerCase().includes("cualquiera")) {
        proNameDisplay = "Cualquiera";
    }

    // --- GENERADOR DE HTML (Con Mensaje de Correo) ---
    const generateSummaryHTML = (name, isVip) => {
        let resumenHTML = '';
        
        // Calculamos precios
        const precioLista = bookingData.totalPrice;
        const precioFinal = isVip ? 
            (bookingData.totalPrice - (bookingData.services.length * 1000)) : 
            bookingData.totalPrice;

        // 1. Generar lista de servicios
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
                    <p style="color: #D32F2F; font-size: 0.8rem; text-transform: uppercase; font-weight: bold; margin-bottom: -15px;">Servicios (${bookingData.services.length}):</p>
                    <p style="color: white; margin-bottom: 10px; font-weight: 500;">${bookingData.services.join(' + ')}</p>
                    <div style="display: flex; gap: 10px; font-size: 0.9rem; color: #ccc;">
                        <span>📅 ${dateFormatted}</span>
                        <span>⏰ ${bookingData.time}</span>
                    </div>
                    <p style="color: #888; font-size: 0.9rem; margin-top: 5px;">💈 Barbero: <span style="color: #ddd;">${proNameDisplay}</span></p>
                </div>
            `;
        }

        // 2. Generar bloque de PRECIO
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

        // 3. GENERAR MENSAJE DE CORREO (Solo para invitados)
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
                <h3 style="color: white; margin: 5px 0 15px 0;">¡Hola, <span style="color: #D32F2F;">${name}</span>!</h3>
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

    // --- LOGICA DE DECISIÓN ---
    if (currentUser && currentUser.uid !== "guest") {
        formTitle.textContent = "Revisá y Confirmá";
        formContent.innerHTML = generateSummaryHTML(currentUser.displayName, true);
        btnNext.textContent = "Confirmar Reserva"; 
    } 
    else if (guestData !== null) {
        formTitle.textContent = "Revisá y Confirmá";
        formContent.innerHTML = generateSummaryHTML(guestData.name, false);
        btnNext.textContent = "Confirmar Reserva"; 
    }
    else {
        formTitle.textContent = "Tus Datos";
        formContent.innerHTML = `
            <input type="text" id="guest-name" placeholder="Nombre completo" required class="input-fecha-pro" style="margin-bottom: 10px;">
            <input type="email" id="guest-mail" placeholder="Correo electrónico" required class="input-fecha-pro">
            <div class="login-promo" style="margin-top: 15px;">
                <p style="color: #888; font-size: 0.9rem;">🔒 ¿Ya tenés cuenta? <a href="#" style="color: #D32F2F;">Ingresá</a> para ahorrar $1000.</p>
            </div>
        `;
        btnNext.textContent = "Siguiente"; 
    }
}

    function updateStep() {
        steps.forEach((s, i) => {
            if (i + 1 === currentStep) { 
                s.classList.remove('hidden'); 
                s.classList.add('active'); 
            } else { 
                s.classList.add('hidden'); 
                s.classList.remove('active'); 
            }
        });
        
        let visualStepLimit = currentStep;

        // TRUCO: Ajustamos la realidad para que coincida con lo visual
        if (currentStep === 2) visualStepLimit = 1; // Pantalla Modo -> Sigue siendo Paso 1 visualmente
        if (currentStep === 3) visualStepLimit = 2; // Pantalla Calendario -> Es el Paso 2 visualmente
        if (currentStep === 4) visualStepLimit = 3; // Pantalla Final -> Es el Paso 3 visualmente

        // Pintamos los dots usando el límite visual, no el real
        dots.forEach(d => {
            const n = parseInt(d.getAttribute('data-step'));
            if (n <= visualStepLimit) {
                d.classList.add('active');
            } else {
                d.classList.remove('active');
            }
        });
        
        // 3. Renderizado Condicional del Formulario (Esto sigue igual)
        if (currentStep === 4) {
            renderFinalStep();
        }

        // 4. Botón Atrás (Sigue igual)
        if (currentStep === 1) btnBack.classList.add('hidden'); else btnBack.classList.remove('hidden');
        
        updateUI();
    }

    renderServicesFromJSON();


    function resetBooking() {
        bookingData = {
            services: [],      
            totalPrice: 0,
            mode: 'together',  
            date: tomorrowFormatted, // Usar la variable corregida
            time: null,
            professional: 'Cualquiera', // Default seguro
            appointments: [] 
        };
        currentStep = 1;
        serviceIndex = 0;
        guestData = null;
        
        // Limpiar UI visualmente
        document.querySelectorAll('.qty-val').forEach(el => el.textContent = '0');
        document.querySelectorAll('.minus').forEach(el => el.disabled = true);
        document.querySelectorAll('.service-row').forEach(el => el.classList.remove('selected-active'));
        
        updateStep();
    }

    // Hookear al botón cerrar y al finalizar éxito
    if(closeBtn) closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        setTimeout(resetBooking, 300); // Esperar a que termine la animación de cierre
    });

});