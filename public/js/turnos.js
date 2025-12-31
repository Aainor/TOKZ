  // 1. Importación de módulos necesarios (Auth y Firestore)
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
  import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
  import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

  // 2. Configuración del proyecto
  const firebaseConfig = {
    apiKey: "AIzaSyDkVou02bXWq2qX0QSF1WMVrJMfsW903rM",
    authDomain: "tokz-barber.firebaseapp.com",
    projectId: "tokz-barber",
    storageBucket: "tokz-barber.firebasestorage.app",
    messagingSenderId: "949051520274",
    appId: "1:949051520274:web:24b6887eeb15627333efcb",
    measurementId: "G-4Q111E9FDQ"
  };

  // 3. Inicialización de servicios
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // 4. Referencia al botón de envío en su formulario
  // NOTA: Reemplace 'btnConfirmar' por el ID real de su botón en el HTML.
  const botonReservar = document.getElementById('btnConfirmar');

  // 5. Función de envío de datos a Firestore
  botonReservar.addEventListener('click', async (e) => {
      e.preventDefault(); // Evita que la página se recargue si el botón está dentro de un <form>

      const usuario = auth.currentUser;

      // Validación de sesión activa
      if (!usuario) {
          alert("Error: Debe iniciar sesión para realizar una reserva.");
          return;
      }

      // Captura de datos desde la interfaz
      // NOTA: Reemplace 'inputFecha' y 'selectServicio' por los IDs de sus inputs.
      const fechaSeleccionada = document.getElementById('inputFecha').value;
      const servicioSeleccionado = document.getElementById('selectServicio').value;

      // Validación de campos vacíos
      if (!fechaSeleccionada || !servicioSeleccionado) {
          alert("Por favor, complete todos los campos del turno.");
          return;
      }

      try {
          // Escritura en la base de datos
          const docRef = await addDoc(collection(db, "turnos"), {
              // Vinculación con el usuario (Crucial para las reglas de seguridad)
              id_cliente: usuario.uid,
              cliente_nombre: usuario.displayName,
              cliente_email: usuario.email,

              // Datos del servicio
              fecha: fechaSeleccionada,
              servicio: servicioSeleccionado,
              
              // Metadatos adicionales
              estado: "pendiente",
              fecha_creacion: new Date()
          });

          console.log("Documento escrito con ID: ", docRef.id);
          alert("Reserva registrada correctamente.");

      } catch (error) {
          console.error("Error al registrar en la base de datos:", error);
          
          if (error.code === 'permission-denied') {
              alert("Permiso denegado: Verifique que ha iniciado sesión correctamente.");
          } else {
              alert("Hubo un error al procesar la solicitud.");
          }
      }
  });