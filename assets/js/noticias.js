// Sección Noticias — reutiliza tal cual la tabla "noticias" existente en
// Supabase (no crea ninguna tabla nueva). Mismo criterio de datos que la
// versión anterior del sitio: SELECT id, titulo, descripcion, fecha,
// imagen_url, link WHERE publicada = true ORDER BY fecha DESC.
(function () {
    'use strict';

    function formatearFecha(fechaStr) {
        // Una fecha "YYYY-MM-DD" (tipo date de Postgres) se parsea como fecha
        // calendario LOCAL, nunca UTC, para evitar el corrimiento de un día
        // en timezones negativos como Argentina.
        var soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaStr);
        var fecha;
        if (soloFecha) {
            fecha = new Date(parseInt(soloFecha[1], 10), parseInt(soloFecha[2], 10) - 1, parseInt(soloFecha[3], 10));
        } else {
            fecha = new Date(fechaStr);
        }
        if (isNaN(fecha.getTime())) return '';
        return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function urlValida(valor) {
        if (!valor) return false;
        try {
            var u = new URL(valor, window.location.href);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    function crearTarjeta(noticia, destacada) {
        var card = document.createElement('article');
        card.className = destacada ? 'noticia-card noticia-card--destacada' : 'noticia-card';

        if (noticia.imagen_url && urlValida(noticia.imagen_url)) {
            var img = document.createElement('img');
            img.src = noticia.imagen_url;
            img.alt = noticia.titulo || 'Noticia de Kalulu';
            img.loading = 'lazy';
            img.onerror = function () { img.remove(); };
            card.appendChild(img);
        }

        var contenido = document.createElement('div');
        contenido.className = 'noticia-card__contenido';

        var titulo = document.createElement('h3');
        titulo.textContent = noticia.titulo || 'Sin título';
        contenido.appendChild(titulo);

        var fechaTexto = noticia.fecha ? formatearFecha(noticia.fecha) : '';
        if (fechaTexto) {
            var fecha = document.createElement('span');
            fecha.className = 'noticia-card__fecha';
            fecha.textContent = fechaTexto;
            contenido.appendChild(fecha);
        }

        if (noticia.descripcion) {
            var descripcion = document.createElement('p');
            descripcion.textContent = noticia.descripcion;
            contenido.appendChild(descripcion);
        }

        if (noticia.link && urlValida(noticia.link)) {
            var enlace = document.createElement('a');
            enlace.href = noticia.link;
            enlace.target = '_blank';
            enlace.rel = 'noopener noreferrer';
            enlace.className = 'btn btn--fantasma noticia-card__cta';
            enlace.textContent = 'Leer más';
            contenido.appendChild(enlace);
        }

        card.appendChild(contenido);
        return card;
    }

    function mostrarMensaje(contenedor, mensaje, esError) {
        contenedor.innerHTML = '';
        var p = document.createElement('p');
        p.className = esError ? 'noticias__estado noticias__estado--error' : 'noticias__estado';
        p.textContent = mensaje;
        contenedor.appendChild(p);
    }

    async function cargarNoticias() {
        var contenedor = document.getElementById('noticias-contenedor');
        if (!contenedor) return;

        var client = window.obtenerClienteKalulu && window.obtenerClienteKalulu();
        if (!client) {
            mostrarMensaje(contenedor, 'No pudimos cargar las noticias en este momento. Intentá más tarde.', true);
            return;
        }

        try {
            var resp = await client
                .from('noticias')
                .select('id, titulo, descripcion, fecha, imagen_url, link')
                .eq('publicada', true)
                .order('fecha', { ascending: false });

            if (resp.error) throw resp.error;

            var noticias = resp.data || [];
            if (noticias.length === 0) {
                mostrarMensaje(contenedor, 'Todavía no hay noticias publicadas. ¡Volvé pronto!', false);
                return;
            }

            var destacada = noticias[0];
            var resto = noticias.slice(1);

            contenedor.innerHTML = '';
            var bento = document.createElement('div');
            bento.className = 'noticias__bento';
            bento.appendChild(crearTarjeta(destacada, true));

            if (resto.length > 0) {
                var grid = document.createElement('div');
                grid.className = 'noticias__grid-secundaria';
                resto.slice(0, 3).forEach(function (n) { grid.appendChild(crearTarjeta(n, false)); });
                bento.appendChild(grid);
            }

            contenedor.appendChild(bento);
        } catch (err) {
            console.error('Error al cargar noticias desde Supabase:', err);
            mostrarMensaje(contenedor, 'No pudimos cargar las noticias en este momento. Intentá más tarde.', true);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cargarNoticias);
    } else {
        cargarNoticias();
    }
})();
