document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos del DOM (Vistas)
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');
    const viewRecovery = document.getElementById('view-recovery'); 

    // 2. Elementos de Navegación (Links/Botones)
    const linkToRegister = document.getElementById('link-to-register');
    const linkToLogin = document.getElementById('link-to-login');
    const linkForgotPass = document.querySelector('.forgot-pass'); 
    const linkBackLogin = document.getElementById('link-back-login'); 
    const btnLogout = document.getElementById('btn-logout');

    // 3. Formularios
    const loginForm = viewLogin.querySelector('form');
    const recoveryForm = viewRecovery.querySelector('form'); 

    // --- FUNCIÓN MAESTRA DE CAMBIO DE VISTA ---
    function switchView(viewToShow) {
        // Ocultamos todas primero (fuerza bruta para evitar errores)
        [viewLogin, viewRegister, viewUser, viewRecovery].forEach(el => {
            el.classList.add('hidden');
        });
        
        // Mostramos la elegida
        viewToShow.classList.remove('hidden');
    }

    // --- EVENT LISTENERS DE NAVEGACIÓN ---
    
    // Ir a Registro
    linkToRegister.addEventListener('click', () => switchView(viewRegister));

    // Ir a Login (desde Registro)
    linkToLogin.addEventListener('click', () => switchView(viewLogin));

    // Ir a Recuperar Contraseña 
    linkForgotPass.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que el link # recargue
        switchView(viewRecovery);
    });

    // Volver a Login (desde Recuperar) 
    linkBackLogin.addEventListener('click', () => switchView(viewLogin));

    // --- LÓGICA SIMULADA ---

    // Login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('login-user').value;
        document.getElementById('user-name-display').textContent = usernameInput || "CLIENTE";
        switchView(viewUser);
    });

    // Logout
    btnLogout.addEventListener('click', () => {
        loginForm.reset();
        switchView(viewLogin);
    });

    // Recuperación de contraseña (Simulación)
    recoveryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailRec = document.getElementById('rec-email').value;
        
        // ACÁ IRÍA LA LLAMADA A BACKEND (Resend/Brevo)
        
        // Feedback visual para el usuario
        alert(`Hemos enviado un correo de recuperación a: ${emailRec}\n(Revisa tu bandeja de entrada o spam)`);
        
        // Opcional: devolver al usuario al login automáticamente
        recoveryForm.reset();
        switchView(viewLogin);
    });
});