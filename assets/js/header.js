const menuToggle = document.querySelector('.menu-toggle');
        const nav = document.querySelector('.header-nav');

        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
        });

        window.addEventListener('scroll', function() {
            const header = document.querySelector('header');
            header.classList.toggle('header-scrolled', window.scrollY > 50);
        });