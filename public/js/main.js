function checkPromoOffset() {
    const promoBar = document.getElementById('promoBar');
    const header = document.querySelector('header');
    const brandIntro = document.querySelector('.brand-intro');
    const topMenu = document.querySelector('.intro-nav-links-top');

    const baseTopPosition = 50; 

    if (promoBar && getComputedStyle(promoBar).display !== 'none') {
        const barHeight = promoBar.offsetHeight;
        
        // Empujamos el header y el menú (que ahora contiene el acceso)
        if (header) header.style.top = `${barHeight}px`;
        if (topMenu) topMenu.style.top = `${baseTopPosition + barHeight}px`;
        
        if (brandIntro) {
            brandIntro.style.paddingTop = `${80 + barHeight}px`;
            brandIntro.style.transition = 'padding-top 0.4s ease'; 
        }

    } else {
        // Restaurar posiciones originales si no hay barra
        if (header) header.style.top = '0px';
        if (topMenu) topMenu.style.top = `${baseTopPosition}px`;
        
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
            // 1. La barra se va hacia arriba
            promoBar.style.transform = 'translateY(-100%)';
            
            // 2. Elementos que deben subir SIMULTÁNEAMENTE
            const header = document.querySelector('header');
            const topMenu = document.querySelector('.intro-nav-links-top');
            const brandIntro = document.querySelector('.brand-intro');

            if (header) {
                header.style.transition = 'top 0.4s ease'; 
                header.style.top = '0px';
            }
            
            if (topMenu) {
                topMenu.style.top = '30px'; 
            }

            if (brandIntro) {
                brandIntro.style.paddingTop = '80px';
            }

            // 3. Esperar a que termine la animación antes de ocultar
            setTimeout(() => {
                promoBar.style.display = 'none';
            }, 400); 
        });
    }

    // --- numeros ---
    const counterSection = document.getElementById('counter-section');
    if (counterSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const counters = entry.target.querySelectorAll('.counter');
                    counters.forEach((counter) => {
                        const target = +counter.getAttribute('data-target');
                        const increment = target / 50; 
                        
                        const updateCounter = () => {
                            const c = +counter.innerText.replace('+', '');
                            if (c < target) {
                                counter.innerText = `${Math.ceil(c + increment)}`;
                                setTimeout(updateCounter, 30);
                            } else {
                                counter.innerText = target;
                                if (target > 10) counter.innerText = "+" + target;
                            }
                        };
                        updateCounter();
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(counterSection);
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

// --- Lógica del Slider de Fondo VIP ---
document.addEventListener("DOMContentLoaded", () => {
    const slides = document.querySelectorAll('.bg-slide');
    let currentSlide = 0;

    if (slides.length > 0) {
        setInterval(() => {
            // Quitar clase active de la actual
            slides[currentSlide].classList.remove('active');

            // Calcular siguiente índice
            currentSlide = (currentSlide + 1) % slides.length;

            // Añadir clase active a la siguiente
            slides[currentSlide].classList.add('active');
        }, 5000); // Cambia cada 5 segundos
    }
});

function updateGallery(mainImgId, newSrc, thumbElement) {
    const mainImg = document.getElementById(mainImgId);
    if (mainImg) {
        mainImg.src = newSrc;
    }
    const siblings = thumbElement.parentElement.children;
    for (let i = 0; i < siblings.length; i++) {
        siblings[i].classList.remove('active');
    }
    thumbElement.classList.add('active');
}