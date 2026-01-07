import { db, auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const filterSelect = document.getElementById('barber-filter');
    let allEvents = [];
    let calendar = null; // Guardamos la referencia del calendario

    // 1. Configuración del Calendario
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        locale: 'es',
        slotMinTime: '09:00:00',
        slotMaxTime: '21:00:00',
        allDaySlot: false,
        height: 'auto',
        contentHeight: 700,
        nowIndicator: true,
        eventContent: function (arg) {
            // CORRECCIÓN 2: Agregamos ${arg.timeText} para mostrar la hora explícita
            return {
                html: `
                    <div style="font-size:0.85em; margin-bottom:2px; color:rgba(255,255,255,0.8);">
                        🕒 ${arg.timeText}
                    </div>
                    <div style="font-weight:bold; font-size:0.95em; line-height:1.2; margin-bottom:4px;">
                        ${arg.event.title}
                    </div>
                    <div style="font-size:0.8em; opacity:0.9; border-top:1px solid rgba(255,255,255,0.2); padding-top:2px;">
                        ✂️ ${arg.event.extendedProps.services}
                    </div>
                    ${arg.view.type !== 'timeGridWeek' ? '' : `
                    <div style="font-size:0.75em; margin-top:4px; background:rgba(0,0,0,0.3); padding:2px 5px; border-radius:4px; display:inline-block;">
                        💈 ${arg.event.extendedProps.pro}
                    </div>`}
                `
            };
        }
    });

    calendar.render(); // Renderizamos el calendario vacío primero para que se vea la estructura

    // CORRECCIÓN 1: Esperar al Login antes de pedir datos
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Admin detectado:", user.email);
            // Solo cargamos los turnos si hay usuario
            await fetchAndRender();
        } else {
            console.log("No hay usuario logueado");
            // Opcional: Redirigir al login o mostrar aviso
            calendarEl.innerHTML = `
                <div style="text-align:center; padding:50px; color:white;">
                    <h2>🔒 Acceso Restringido</h2>
                    <p>Necesitas iniciar sesión para ver la agenda.</p>
                    <a href="/pages/login.html" style="color:#AE0E30; text-decoration:underline;">Ir al Login</a>
                </div>
             `;
        }
    });

    // 2. Función Maestra: Cargar Datos
    async function fetchAndRender() {
        try {
            const querySnapshot = await getDocs(collection(db, "turnos"));
            const uniqueBarbers = new Set();

            allEvents = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();

                if (data.date && data.time && data.pro) {
                    uniqueBarbers.add(data.pro);

                    const start = `${data.date}T${data.time}:00`;
                    // Calculamos 45 min de duración por defecto
                    let endDate = new Date(new Date(start).getTime() + 45 * 60000).toISOString();

                    allEvents.push({
                        id: doc.id,
                        title: data.clientName || 'Cliente',
                        start: start,
                        end: endDate,
                        backgroundColor: getColorByPro(data.pro),
                        borderColor: getColorByPro(data.pro),
                        extendedProps: {
                            pro: data.pro,
                            services: Array.isArray(data.services) ? data.services.join(', ') : data.services,
                            email: data.clientEmail
                        }
                    });
                }
            });

            // Llenar filtro si está vacío
            if (filterSelect && filterSelect.options.length <= 1) {
                uniqueBarbers.forEach(barber => {
                    const option = document.createElement('option');
                    option.value = barber;
                    option.textContent = barber;
                    filterSelect.appendChild(option);
                });
            }

            updateCalendarEvents('all');

        } catch (error) {
            console.error("Error cargando agenda:", error);
            // Si falla por permisos de Firebase, esto nos avisará
            alert("Error leyendo turnos. Verifica que estés logueado como Admin.");
        }
    }

    // 3. Filtro
    function updateCalendarEvents(barberName) {
        calendar.removeAllEvents();

        let filteredEvents = allEvents;
        if (barberName !== 'all') {
            filteredEvents = allEvents.filter(e => e.extendedProps.pro === barberName);
        }

        calendar.addEventSource(filteredEvents);
    }

    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            updateCalendarEvents(e.target.value);
        });
    }
});

function getColorByPro(proName) {
    if (!proName) return '#777';
    const name = proName.toLowerCase();
    if (name.includes('nico')) return '#AE0E30';
    if (name.includes('jonatan') || name.includes('jhonny')) return '#E91E63';
    if (name.includes('ale')) return '#9C27B0';
    if (name.includes('lau')) return '#2196F3';
    if (name.includes('juan')) return '#FF9800';
    return '#607D8B';
}