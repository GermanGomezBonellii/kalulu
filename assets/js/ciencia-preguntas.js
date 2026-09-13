// Sección "Ciencia ciudadana" (parte 1: preguntas abiertas) — las 4
// preguntas se muestran como tarjetas editoriales numeradas (nunca como
// botones). Se alimentan desde la tabla "preguntas_ciencia_ciudadana"
// (ver sql/redesign_03_...sql). Si esa tabla todavía no existe, está
// vacía, o Supabase no responde, se usa el mismo contenido de reserva que
// ya tenía el sitio (nunca se inventan preguntas nuevas).
(function () {
    'use strict';

    var FALLBACK = [
        { pregunta: '¿Debemos enseñar la cursiva desde el principio?' },
        { pregunta: '¿Sirve usar una letra de cada color o es mejor todo en negro?' },
        { pregunta: '¿Vale la pena usar textos con letras más espaciadas?' },
        { pregunta: '¿Qué precursores de la lectura podemos enseñar en sala de 5?' }
    ];

    function numeroFormateado(indice, total) {
        var n = String(indice + 1);
        if (n.length < 2) n = '0' + n;
        return n;
    }

    function crearPregunta(item, indice, total) {
        var div = document.createElement('div');
        div.className = 'ciencia-preguntas__tarjeta';

        var numero = document.createElement('span');
        numero.className = 'ciencia-preguntas__tarjeta-num';
        numero.setAttribute('aria-hidden', 'true');
        numero.textContent = numeroFormateado(indice, total);
        div.appendChild(numero);

        var texto = document.createElement('p');
        texto.className = 'ciencia-preguntas__tarjeta-texto';
        texto.textContent = item.pregunta || '';
        div.appendChild(texto);

        return div;
    }

    function renderizar(lista) {
        var contenedor = document.getElementById('ciencia-preguntas-contenedor');
        if (!contenedor) return;
        contenedor.innerHTML = '';
        lista.forEach(function (item, indice) {
            contenedor.appendChild(crearPregunta(item, indice, lista.length));
        });
    }

    async function cargarPreguntas() {
        var client = window.obtenerClienteKalulu && window.obtenerClienteKalulu();

        if (!client) {
            renderizar(FALLBACK);
            return;
        }

        try {
            var resp = await client
                .from('preguntas_ciencia_ciudadana')
                .select('id, pregunta, orden')
                .eq('publicada', true)
                .order('orden', { ascending: true });

            if (resp.error) throw resp.error;

            var preguntas = resp.data || [];
            renderizar(preguntas.length > 0 ? preguntas : FALLBACK);
        } catch (err) {
            // Tabla todavía no creada (ver sql/redesign_03_...sql), sin
            // conexión, etc.: se conserva el contenido de reserva.
            console.warn('No se pudieron cargar las preguntas de Ciencia ciudadana desde Supabase, se usa el contenido por defecto:', err);
            renderizar(FALLBACK);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cargarPreguntas);
    } else {
        cargarPreguntas();
    }
})();
