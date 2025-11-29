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
    console.log("Inicializando lógica del header optimizada..."); 
    
    const header = document.querySelector('header'); 
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.header-nav');

    if(menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
        });
    }

    if(header) {
        let lastKnownScrollPosition = 0;
        let ticking = false;

        window.addEventListener('scroll', function() {
            lastKnownScrollPosition = window.scrollY;

            if (!ticking) {
                window.requestAnimationFrame(function() {
                    if (lastKnownScrollPosition > 50) {
                        header.classList.add('header-scrolled');
                    } else {
                        header.classList.remove('header-scrolled');
                    }
                    ticking = false;
                });

                ticking = true;
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadComponent('header-placeholder', '/public/components/header.html');
    loadComponent('footer-placeholder', '/public/components/footer.html');
});