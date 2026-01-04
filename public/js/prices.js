async function cargarPrecios() {
    try {
        const respuesta = await fetch('/public/components/precios.json');
        const precios = await respuesta.json();
        
        const tarjetas = document.querySelectorAll('.price-details[data-id]');

        tarjetas.forEach(tarjeta => {
            const id = tarjeta.getAttribute('data-id');
            const data = precios[id];

            if (data) {
                const elemDestacado = tarjeta.querySelector('.promo-price');
                const elemAccesorio = tarjeta.querySelector('.old-price'); // Puede ser null

                // 1. PRECIO DESTACADO
                if (elemDestacado && data.destacado) { // Verificamos que exista el elemento
                    elemDestacado.textContent = typeof data.destacado === 'number' 
                        ? `$${data.destacado.toLocaleString('es-AR')}` 
                        : data.destacado;
                }

                // 2. PRECIO ACCESORIO (Solo si existe el elemento en el HTML)
                if (elemAccesorio) {
                    if (data.accesorio) {
                        const textoAccesorio = typeof data.accesorio === 'number' 
                            ? `$${data.accesorio.toLocaleString('es-AR')}` 
                            : data.accesorio;
                        
                        elemAccesorio.textContent = textoAccesorio;
                        elemAccesorio.style.display = 'block';

                        if (data.tachar === true) {
                            elemAccesorio.style.textDecoration = 'line-through';
                            elemAccesorio.style.color = '#888'; 
                        } else {
                            elemAccesorio.style.textDecoration = 'none'; 
                            elemAccesorio.style.color = '#aaa'; 
                            elemAccesorio.style.fontSize = '12px'; 
                        }
                    } else {
                        // Si no hay dato accesorio, lo ocultamos
                        elemAccesorio.style.display = 'none';
                    }
                }
            }
        });

    } catch (error) {
        console.error("Error cargando precios:", error);
    }
}

document.addEventListener('DOMContentLoaded', cargarPrecios);