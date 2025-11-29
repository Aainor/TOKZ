function loadComponent(elementId, filePath) {
    fetch(filePath)
        .then(response => {
            if (!response.ok) throw new Error('Error al cargar ' + filePath);
            return response.text();
        })
        .then(data => {
            document.getElementById(elementId).innerHTML = data;
            if(elementId === 'header-placeholder') {
                initHeaderLogic(); 
            }
        })
        .catch(error => console.error('Error:', error));
}

function initHeaderLogic() {
    console.log("Inicializando lógica del header..."); 

    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.header-nav');

    if(menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
        });
    }

    window.addEventListener('scroll', function() {
        const header = document.querySelector('header'); 
        if(header) {
            header.classList.toggle('header-scrolled', window.scrollY > 50);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadComponent('header-placeholder', '/public/components/header.html');
    loadComponent('footer-placeholder', '/public/components/footer.html');
});