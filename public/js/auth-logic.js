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
    const btnAdminRefresh = document.getElementById('btn-admin-refresh');
    const adminDatePicker = document.getElementById('admin-date-picker');
    const btnLogoutAdmin = document.getElementById('btn-logout-admin');

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
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Error al salir:", error);
            }
        });
    }
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
                el.classList.remove('fade-in', 'appear');
                el.style.display = ''; 
            }
        });

        // 2. Mostrar la vista elegida
        if (viewToShow) {
            viewToShow.classList.remove('hidden');

            // Barbero y Admin usan display especial o clases propias
            if (viewToShow === viewBarber || viewToShow === viewAdmin) {
                viewToShow.style.display = 'block'; 
            } else {
                // Las vistas chicas del login usan la animación
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
                }
                else if (ADMIN_EMAILS.includes(user.email)) {
                    rolDetectado = 'admin';
                }

                // 2. ACTUALIZAR DB
                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        Nombre: nombreOficial,
                        Email: user.email,
                        rol: rolDetectado,
                        Fecha_Registro: new Date()
                    });
                } else {
                    const dataActual = userSnap.data();
                    if (dataActual.rol !== rolDetectado || (rolDetectado === 'barbero' && dataActual.Nombre !== nombreOficial)) {
                        await updateDoc(userRef, { rol: rolDetectado, Nombre: nombreOficial });
                    }
                }

                // 3. REDIRECCIONAR Y GESTIONAR VISTAS
                const btnGoCalendar = document.getElementById('btn-go-calendar');
                const btnBackAdmin = document.getElementById('btn-back-admin');

                if (rolDetectado === 'admin') {
                    // Si es admin, mostramos el panel admin primero
                    switchView(viewAdmin);

                    // LOGICA DOBLE ROL (Admin que también corta)
                    if(btnGoCalendar && btnBackAdmin) {
                        
                        // 1. Activar botón en el calendario para volver al admin
                        btnBackAdmin.classList.remove('hidden');
                        
                        // 2. Evento: Ir del Admin a la Agenda
                        btnGoCalendar.onclick = () => {
                            // ============================================================
                            // ⚠️ IMPORTANTE: SI TU CALENDARIO SALE VACÍO, REVISA ESTE NOMBRE.
                            // Tiene que ser IDÉNTICO a como aparece en la columna 'pro' de Firebase.
                            const nombreRealEnBaseDeDatos = "Nicolás"; 
                            // ============================================================

                            console.log("Cargando agenda para:", nombreRealEnBaseDeDatos);
                            
                            // Cargamos la agenda con ESE nombre específico
                            loadBarberAgenda(nombreRealEnBaseDeDatos); 
                            
                            // Actualizamos el título visual
                            const barberNameDisplay = document.getElementById('barber-name-display');
                            if (barberNameDisplay) barberNameDisplay.textContent = nombreRealEnBaseDeDatos;

                            switchView(viewBarber);
                        };

                        // 3. Evento: Volver de la Agenda al Admin
                        btnBackAdmin.onclick = () => {
                            switchView(viewAdmin);
                        };
                    }
                }
                else if (rolDetectado === 'barbero') {
                    // Barbero normal: ocultar botón de volver a admin por seguridad
                    if(btnBackAdmin) btnBackAdmin.classList.add('hidden');

                    const barberNameDisplay = document.getElementById('barber-name-display');
                    if (barberNameDisplay) barberNameDisplay.textContent = nombreOficial;

                    loadBarberAgenda(nombreOficial);
                    switchView(viewBarber);
                }
                else {
                    // Cliente normal
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
                // Si es móvil: DÍA. Si es PC: SEMANA.
                initialView: isMobile ? 'timeGridDay' : 'timeGridWeek',

                headerToolbar: {
                    left: 'prev,next', 
                    center: 'title',
                    // En móvil quitamos botones que saturan, en PC dejamos las opciones
                    right: isMobile ? '' : 'dayGridMonth,timeGridWeek,timeGridDay'
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
                // --------------------------------

                nowIndicator: true,
                events: eventos,

                // DISEÑO DE LA TARJETA DE TURNO (ORDEN CAMBIADO)
                eventContent: function (arg) {
                    return {
                        html: `
                            <div style="height:100%; display:flex; flex-direction:column; justify-content:center;">
                                <span class="event-time">${arg.timeText}</span>
                                <span class="event-service">✂️ ${arg.event.extendedProps.servicio}</span>
                                <span class="event-title">${arg.event.title}</span>
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

    // ==========================================
    // 6. FUNCIÓN ADMIN: BÚSQUEDA FLEXIBLE 🛡️
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
        if(adminMsg) {
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
                
                // A) ¿Es un Timestamp de Firebase?
                if (data.Fecha && data.Fecha.toDate) {
                    const fechaObj = data.Fecha.toDate();
                    const fechaIso = fechaObj.toISOString().split('T')[0];
                    if (fechaIso === formatoGuion) esDelDia = true;
                } 
                // B) ¿Es un Texto (String)? Comparación Flexible
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

            if(adminMsg) adminMsg.style.display = 'none';

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
                if(t.profesional.includes('Nico')) colorPro = "#2196F3"; 
                else if(t.profesional.includes('Lautaro')) colorPro = "#FF9800"; 
                
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

            // TOTAL
            const totalRow = `
                <tr class="total-row">
                    <td colspan="4" data-label="Resumen" style="text-align: right;">TOTAL DEL DÍA:</td>
                    <td data-label="Total Caja" class="price-cell" style="font-size:1.2rem;">$${cajaTotal.toLocaleString()}</td>
                </tr>
            `;
            adminTableBody.insertAdjacentHTML('beforeend', totalRow);

        } catch (error) {
            console.error("Error Admin:", error);
            if(adminMsg) adminMsg.innerHTML = `<span style="color:red">Error: ${error.message}</span>`;
        }
    }
});