
function checkPromoOffset() {
    const promoBar = document.getElementById('promoBar');
    const header = document.querySelector('header');
    const accessBtn = document.querySelector('.access-btn');
    const brandIntro = document.querySelector('.brand-intro');

    if (promoBar && getComputedStyle(promoBar).display !== 'none') {
        const barHeight = promoBar.offsetHeight;
        
        if (header) {
            header.style.top = `${barHeight}px`;
        }
        
        if (accessBtn) {
            accessBtn.style.top = `${30 + barHeight}px`; 
        }

        if (brandIntro) {
            brandIntro.style.paddingTop = `${80 + barHeight}px`;
            brandIntro.style.transition = 'padding-top 0.4s ease'; 
        }

    } else {
        
        if (header) header.style.top = '0px';
        
        if (accessBtn) accessBtn.style.top = '30px';
        
        if (brandIntro) {
            brandIntro.style.paddingTop = '80px'; 
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const promoBar = document.getElementById('promoBar');
    const closeBtn = document.getElementById('closePromo');

    checkPromoOffset();

    if (closeBtn && promoBar) {
        closeBtn.addEventListener('click', () => {
            promoBar.style.transform = 'translateY(-100%)';
            
            const header = document.querySelector('header');
            if (header) {
                header.style.transition = 'top 0.4s ease'; 
                header.style.top = '0px';
            }

            const accessBtn = document.querySelector('.access-btn');
            if (accessBtn) {
                accessBtn.style.top = '30px'; 
            }

            const brandIntro = document.querySelector('.brand-intro');
            if (brandIntro) {

                brandIntro.style.paddingTop = '80px';
            }

            setTimeout(() => {
                promoBar.style.display = 'none';
            }, 300);
        });
    }
});

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
                checkPromoOffset();
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
    const isHome = window.location.pathname === '/' || window.location.pathname.includes('index.html');

    navLinks.forEach(link => {
        const target = link.getAttribute('href');
        if (target && target.startsWith('#') && !isHome) {
            link.href = '/index.html' + target;
        }
    });

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