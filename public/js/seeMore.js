document.addEventListener("DOMContentLoaded", () => {
    const reviews = document.querySelectorAll('.review-card');

    reviews.forEach(card => {
        const textElement = card.querySelector('.review-text');
        const btn = card.querySelector('.read-more-btn');

        if (textElement && btn) {
            if (textElement.scrollHeight > textElement.clientHeight) {
                btn.style.display = 'block';
            }
        }
    });
});

function toggleReview(btn) {
    const card = btn.closest('.review-card'); 
    const text = card.querySelector('.review-text');

    text.classList.toggle('expanded');

    if (text.classList.contains('expanded')) {
        btn.textContent = "Ver menos";
    } else {
        btn.textContent = "Ver más";
    }
}