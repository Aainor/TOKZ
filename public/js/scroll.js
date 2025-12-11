function checkScroll() {
    const header = document.querySelector('header');
    const introSection = document.querySelector('.brand-intro');
    const arrow = document.querySelector('.scroll-indicator'); 
    
    if (header && introSection) {
        const triggerHeight = introSection.offsetHeight - 100;
        
        if (window.scrollY > triggerHeight) {
            header.classList.add('header-visible');
        } else {
            header.classList.remove('header-visible');
        }

        if (arrow) {
            if (window.scrollY > 50) {
                arrow.classList.add('hidden');
            } else {
                arrow.classList.remove('hidden');
            }
        }
    }
}

window.addEventListener('scroll', checkScroll);
window.addEventListener('load', checkScroll);

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});