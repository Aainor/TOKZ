document.addEventListener("DOMContentLoaded", () => {
            const backBtn = document.querySelector('.back-arrow');

            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    if (document.referrer && document.referrer.includes(window.location.hostname)) {
                        
                        e.preventDefault(); 
                        window.history.back();       
                    }
                });
            }
        });