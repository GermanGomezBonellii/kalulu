// Carrusel "¿Sos docente alfabetizador? Sumate y recibí todo esto gratis",
// alimentado desde la tabla nueva "recursos_destacados" (ver sql/). Si la
// tabla no existe todavía, está vacía, o Supabase no responde, se usa un
// contenido de reserva con la información real que ya existía en el sitio
// (nunca se inventan recursos nuevos).
(function () {
    'use strict';

    var FALLBACK = [
        { titulo: 'Cuadernillos y materiales', descripcion: 'Cuadernillos y materiales para todos tus alumnos.', imagen_url: 'imagenes/imagen%20(12).jpg' },
        { titulo: 'Juegos de lectura', descripcion: 'Juegos de cartas para reforzar habilidades de lectura de forma divertida.', imagen_url: 'imagenes/imagen%20(4).jpg' },
        { titulo: 'Guía pedagógica', descripcion: 'Guía pedagógica detallada para acompañar cada paso del proceso.', imagen_url: 'imagenes/imagen%20(5).jpg' },
        { titulo: 'Cursos online', descripcion: 'Acceso completo a cursos online asincrónicos y capacitaciones.', imagen_url: 'imagenes/imagen%20(6).jpg' },
        { titulo: 'Foro exclusivo', descripcion: 'Participación con voto en un foro exclusivo de docentes e investigadores.', imagen_url: 'imagenes/imagen%20(7).jpg' },
        { titulo: 'Eventos presenciales', descripcion: 'Eventos presenciales con especialistas nacionales e internacionales.', imagen_url: 'imagenes/imagen%20(8).jpg' }
    ];

    function urlValida(valor) {
        if (!valor) return false;
        try {
            var u = new URL(valor, window.location.href);
            return u.protocol === 'http:' || u.protocol === 'https:' || valor.indexOf('../') === 0;
        } catch (e) {
            return valor.indexOf('../') === 0;
        }
    }

    function crearTarjeta(recurso) {
        var card = document.createElement('article');
        card.className = 'ofrecemos__tarjeta';

        if (recurso.imagen_url) {
            var figura = document.createElement('div');
            figura.className = 'ofrecemos__tarjeta-imagen';
            var img = document.createElement('img');
            img.src = recurso.imagen_url;
            img.alt = recurso.titulo || '';
            img.loading = 'lazy';
            img.onerror = function () { figura.remove(); };
            figura.appendChild(img);
            card.appendChild(figura);
        }

        var cuerpo = document.createElement('div');
        cuerpo.className = 'ofrecemos__tarjeta-cuerpo';

        var titulo = document.createElement('h3');
        titulo.textContent = recurso.titulo || '';
        cuerpo.appendChild(titulo);

        if (recurso.descripcion) {
            var descripcion = document.createElement('p');
            descripcion.textContent = recurso.descripcion;
            cuerpo.appendChild(descripcion);
        }

        if (recurso.link && urlValida(recurso.link)) {
            var enlace = document.createElement('a');
            enlace.href = recurso.link;
            enlace.target = '_blank';
            enlace.rel = 'noopener noreferrer';
            enlace.className = 'ofrecemos__tarjeta-cta';
            // Columna real: "texto_boton" (verificado con information_schema.columns),
            // no "cta_texto".
            enlace.textContent = recurso.texto_boton && recurso.texto_boton.trim() ? recurso.texto_boton : 'Ver más';
            cuerpo.appendChild(enlace);
        }

        card.appendChild(cuerpo);
        return card;
    }

    function renderizar(lista) {
        var carrusel = document.getElementById('ofrecemos-carrusel');
        if (!carrusel) return;
        carrusel.innerHTML = '';
        lista.forEach(function (recurso) { carrusel.appendChild(crearTarjeta(recurso)); });
    }

    function mostrarMensaje(mensaje) {
        var carrusel = document.getElementById('ofrecemos-carrusel');
        if (!carrusel) return;
        carrusel.innerHTML = '';
        var p = document.createElement('p');
        p.className = 'noticias__estado';
        p.textContent = mensaje;
        carrusel.appendChild(p);
    }

    function iniciarNavegacion() {
        var carrusel = document.getElementById('ofrecemos-carrusel');
        var prev = document.getElementById('ofrecemos-prev');
        var next = document.getElementById('ofrecemos-next');
        if (!carrusel || !prev || !next) return;

        function desplazar(direccion) {
            var tarjeta = carrusel.querySelector('.ofrecemos__tarjeta');
            var delta = tarjeta ? (tarjeta.getBoundingClientRect().width + 16) : 280;
            carrusel.scrollBy({ left: direccion * delta, behavior: 'smooth' });
        }

        prev.addEventListener('click', function () { desplazar(-1); });
        next.addEventListener('click', function () { desplazar(1); });
    }

    async function cargarOfrecemos() {
        var client = window.obtenerClienteKalulu && window.obtenerClienteKalulu();

        if (!client) {
            renderizar(FALLBACK);
            iniciarNavegacion();
            return;
        }

        try {
            var resp = await client
                .from('recursos_destacados')
                .select('id, titulo, descripcion, imagen_url, link, texto_boton, orden')
                .eq('publicado', true)
                .order('orden', { ascending: true });

            if (resp.error) throw resp.error;

            var recursos = resp.data || [];
            renderizar(recursos.length > 0 ? recursos : FALLBACK);
        } catch (err) {
            console.warn('No se pudo cargar "Qué ofrecemos" desde Supabase, se usa el contenido de reserva:', err);
            renderizar(FALLBACK);
        } finally {
            iniciarNavegacion();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cargarOfrecemos);
    } else {
        cargarOfrecemos();
    }
})();
