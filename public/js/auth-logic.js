document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos del DOM
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const viewUser = document.getElementById('view-user');

    const linkToRegister = document.getElementById('link-to-register');
    const linkToLogin = document.getElementById('link-to-login');
    const btnLogout = document.getElementById('btn-logout');

    // FORMULARIOS (Para prevenir el envío real y simular login por ahora)
    const loginForm = viewLogin.querySelector('form');
    const registerForm = viewRegister.querySelector('form');

    // 2. Funciones de cambio de vista
    function switchView(viewToShow) {
        viewLogin.classList.add('hidden');
        viewRegister.classList.add('hidden');
        viewUser.classList.add('hidden');
        viewToShow.classList.remove('hidden');
    }

    // 3. Event Listeners para cambiar entre Login y Registro
    linkToRegister.addEventListener('click', () => {
        switchView(viewRegister);
    });

    linkToLogin.addEventListener('click', () => {
        switchView(viewLogin);
    });

    // 4. Lógica SIMULADA de Login (Aquí conectarías con tu Backend real)
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Simulamos que el login fue exitoso:
        const usernameInput = document.getElementById('login-user').value;
        document.getElementById('user-name-display').textContent = usernameInput || "CLIENTE";
        
        switchView(viewUser);
    });

    // 5. Lógica de Logout
    btnLogout.addEventListener('click', () => {
        loginForm.reset();
        switchView(viewLogin);
    });
});