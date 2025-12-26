document.addEventListener('DOMContentLoaded', () => {
    const track = document.getElementById('track');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressBar = document.getElementById('progressBar');
    const cards = document.querySelectorAll('.review-card');
    
    let currentIndex = 0;
    let autoPlayInterval;
    
    const cardCount = cards.length;
    const isMobile = () => window.innerWidth <= 768;
    const getVisibleCards = () => isMobile() ? 1 : 3;
    
    function updateCarousel() {
        const visibleCards = getVisibleCards();
        const maxIndex = cardCount - visibleCards;
        
        if (currentIndex > maxIndex) currentIndex = 0;
        if (currentIndex < 0) currentIndex = maxIndex;

        const cardWidth = cards[0].getBoundingClientRect().width;
        
        const style = window.getComputedStyle(track);
        const gap = parseFloat(style.gap) || 20; 

        const moveAmount = (cardWidth + gap) * currentIndex;
        
        track.style.transform = `translateX(-${moveAmount}px)`;
        
        const progressPercentage = ((currentIndex + 1) / (maxIndex + 1)) * 100;
        progressBar.style.width = `${Math.min(progressPercentage, 100)}%`;
    }

    nextBtn.addEventListener('click', () => {
        currentIndex++;
        updateCarousel();
        resetAutoPlay();
    });

    prevBtn.addEventListener('click', () => {
        currentIndex--;
        updateCarousel();
        resetAutoPlay();
    });

    function startAutoPlay() {
        autoPlayInterval = setInterval(() => {
            currentIndex++;
            updateCarousel();
        }, 4000); 
    }

    function resetAutoPlay() {
        clearInterval(autoPlayInterval);
        startAutoPlay();
    }

    track.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
    track.addEventListener('mouseleave', startAutoPlay);

    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        clearInterval(autoPlayInterval); 
    }, {passive: true});

    track.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
        startAutoPlay(); 
    }, {passive: true});

    function handleSwipe() {
        const threshold = 50; 
        if (touchEndX < touchStartX - threshold) {
            currentIndex++;
        }
        if (touchEndX > touchStartX + threshold) {
            currentIndex--;
        }
        updateCarousel();
    }

    window.addEventListener('resize', updateCarousel);

    startAutoPlay();
    updateCarousel(); 
});