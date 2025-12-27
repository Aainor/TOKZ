document.addEventListener('DOMContentLoaded', () => {

    const items = document.querySelectorAll('.gallery-item');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const btnLoadMore = document.getElementById('btnLoadMore');
    const lightbox = document.getElementById('lightbox');
    const lightboxContent = document.getElementById('lightboxContent');

    let currentVisible = 9;
    const step = 9;

    function updateDisplay(filter = 'all') {
        const matched = [];

        items.forEach(item => {
            if (filter === 'all' || item.classList.contains(filter)) {
                matched.push(item);
            } else {
                item.classList.add('hidden');
            }
        });

        matched.forEach((item, i) => {
            item.classList.toggle('hidden', i >= currentVisible);
        });

        if (btnLoadMore) {
            btnLoadMore.style.display =
                currentVisible >= matched.length ? 'none' : 'inline-block';
        }
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentVisible = step;
            updateDisplay(btn.dataset.filter);
        });
    });

    if (btnLoadMore) {
        btnLoadMore.addEventListener('click', () => {
            currentVisible += step;
            const active = document.querySelector('.filter-btn.active').dataset.filter;
            updateDisplay(active);
        });
    }

    items.forEach(item => {
        item.addEventListener('click', () => {
            let content = '';

            if (item.classList.contains('video')) {
                content = `
                    <video controls autoplay>
                        <source src="${item.querySelector('source').src}">
                    </video>`;
            } else {
                content = `<img src="${item.querySelector('img').src}">`;
            }

            lightboxContent.innerHTML = `
                <span class="close-lightbox">&times;</span>
                ${content}
            `;

            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';

            lightboxContent.querySelector('.close-lightbox')
                .onclick = closeLightbox;
        });
    });

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
        lightboxContent.innerHTML = '';
    }

    lightbox.onclick = e => {
        if (e.target === lightbox) closeLightbox();
    };

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeLightbox();
    });

    updateDisplay();
});
