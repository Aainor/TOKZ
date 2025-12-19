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
    console.log("Inicializando lógica del header 2.0..."); 
    
    const header = document.querySelector('header'); 
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.header-nav');
    const navLinks = document.querySelectorAll('.header-nav a'); 

    if(menuToggle && nav) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation(); 
            nav.classList.toggle('active');
        });

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active'); 
            });
        });

        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target) && !menuToggle.contains(e.target) && nav.classList.contains('active')) {
                nav.classList.remove('active');
            }
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
                
                    if (lastKnownScrollPosition > 100 && nav && nav.classList.contains('active')) {
                        nav.classList.remove('active');
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