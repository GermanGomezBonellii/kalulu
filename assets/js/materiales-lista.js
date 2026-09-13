// Página "/redesign/materiales/" — biblioteca de documentos.
//
// Fuente de verdad: la tabla "materiales" en Supabase (ver
// sql/redesign_05_materiales.sql). Se consulta únicamente
// "publicado = true" y se ordena primero por categoría (en el orden fijo
// de CATEGORIAS, no alfabético) y después por "orden" dentro de cada
// categoría.
//
// Mientras esa tabla todavía no exista o esté vacía (o si Supabase no
// responde), se muestra el mismo catálogo como referencia (CATALOGO_
// RESPALDO) pero SIN archivo real: los botones "Ver"/"Descargar" quedan
// deshabilitados con la leyenda "Disponible próximamente" en vez de
// apuntar a una URL inventada. En cuanto haya filas publicadas con
// "archivo_path" real, esas filas reemplazan por completo al catálogo de
// referencia.
(function () {
    'use strict';

    var BUCKET_NAME = 'materiales-archivos';

    // Orden y etiquetas de categoría para el frontend (ver punto 9 del
    // pedido): la base de datos guarda el slug ("cuadernillos", etc.),
    // acá se decide en qué orden se muestran las secciones y cómo se
    // titulan, sin necesitar una tabla aparte de categorías.
    var CATEGORIAS = [
        { slug: 'cuadernillos', titulo: 'Cuadernillos' },
        { slug: 'impresion', titulo: 'Cuadernillos para imprimir' },
        { slug: 'guias', titulo: 'Guías' },
        { slug: 'juegos', titulo: 'Juegos' }
    ];

    // Catálogo de referencia: mismos documentos pedidos, agrupados por
    // categoría. "disponible: false" en todos a propósito — hoy no existe
    // ningún archivo real subido a Storage (ver sql/redesign_05_materiales.sql),
    // así que se listan como referencia de qué va a haber, sin inventar
    // ningún link de descarga.
    var CATALOGO_RESPALDO = [
        { titulo: 'Cuadernillo 1', categoria: 'cuadernillos' },
        { titulo: 'Cuadernillo 2', categoria: 'cuadernillos' },
        { titulo: 'Cuadernillo 3', categoria: 'cuadernillos' },
        { titulo: 'Cuadernillo 1 — impresión', categoria: 'impresion' },
        { titulo: 'Cuadernillo 2 — impresión', categoria: 'impresion' },
        { titulo: 'Cuadernillo 3 — impresión', categoria: 'impresion' },
        { titulo: 'Guía pedagógica', categoria: 'guias' },
        { titulo: 'Bingo', categoria: 'juegos' },
        { titulo: 'Revueltos', categoria: 'juegos' }
    ].map(function (item) {
        item.descripcion = null;
        item.disponible = false;
        return item;
    });

    function iconoParaCategoria(slug) {
        switch (slug) {
            case 'cuadernillos': return '📘';
            case 'impresion': return '🖨️';
            case 'guias': return '📋';
            case 'juegos': return '🃏';
            default: return '📄';
        }
    }

    function crearTarjeta(material) {
        var article = document.createElement('article');
        article.className = 'material-card';

        var icono = document.createElement('div');
        icono.className = 'material-card__icono';
        icono.setAttribute('aria-hidden', 'true');
        icono.textContent = iconoParaCategoria(material.categoria);
        article.appendChild(icono);

        var cuerpo = document.createElement('div');
        cuerpo.className = 'material-card__cuerpo';

        var titulo = document.createElement('h3');
        titulo.className = 'material-card__titulo';
        titulo.textContent = material.titulo || 'Documento';
        cuerpo.appendChild(titulo);

        if (material.descripcion) {
            var descripcion = document.createElement('p');
            descripcion.className = 'material-card__descripcion';
            descripcion.textContent = material.descripcion;
            cuerpo.appendChild(descripcion);
        }

        if (!material.disponible) {
            var pendiente = document.createElement('p');
            pendiente.className = 'material-card__pendiente';
            pendiente.textContent = 'Disponible próximamente.';
            cuerpo.appendChild(pendiente);
        }

        article.appendChild(cuerpo);

        var acciones = document.createElement('div');
        acciones.className = 'material-card__acciones';

        if (material.disponible && material.url) {
            var verLink = document.createElement('a');
            verLink.className = 'btn btn--fantasma material-card__accion';
            verLink.href = material.url;
            verLink.target = '_blank';
            verLink.rel = 'noopener noreferrer';
            verLink.textContent = 'Ver';
            acciones.appendChild(verLink);

            var descargarLink = document.createElement('a');
            descargarLink.className = 'btn btn--primario material-card__accion';
            descargarLink.href = material.url;
            descargarLink.download = material.nombre_archivo || '';
            descargarLink.textContent = 'Descargar';
            acciones.appendChild(descargarLink);
        } else {
            var verDeshabilitado = document.createElement('span');
            verDeshabilitado.className = 'btn btn--fantasma material-card__accion material-card__accion--deshabilitada';
            verDeshabilitado.setAttribute('aria-disabled', 'true');
            verDeshabilitado.textContent = 'Ver';
            acciones.appendChild(verDeshabilitado);

            var descargarDeshabilitado = document.createElement('span');
            descargarDeshabilitado.className = 'btn btn--primario material-card__accion material-card__accion--deshabilitada';
            descargarDeshabilitado.setAttribute('aria-disabled', 'true');
            descargarDeshabilitado.textContent = 'Descargar';
            acciones.appendChild(descargarDeshabilitado);
        }

        article.appendChild(acciones);
        return article;
    }

    function renderizar(materiales) {
        var contenedor = document.getElementById('materiales-contenedor');
        if (!contenedor) return;

        contenedor.innerHTML = '';

        var porCategoria = {};
        materiales.forEach(function (material) {
            var slug = material.categoria;
            if (!porCategoria[slug]) porCategoria[slug] = [];
            porCategoria[slug].push(material);
        });

        var huboAlguna = false;

        CATEGORIAS.forEach(function (cat) {
            var items = porCategoria[cat.slug];
            if (!items || items.length === 0) return;
            huboAlguna = true;

            var seccion = document.createElement('section');
            seccion.className = 'materiales-categoria';
            var idTitulo = 'materiales-categoria-' + cat.slug;
            seccion.setAttribute('aria-labelledby', idTitulo);

            var h2 = document.createElement('h2');
            h2.className = 'materiales-categoria__titulo';
            h2.id = idTitulo;
            h2.textContent = cat.titulo;
            seccion.appendChild(h2);

            var grid = document.createElement('div');
            grid.className = 'materiales-grid';
            items.forEach(function (material) {
                grid.appendChild(crearTarjeta(material));
            });
            seccion.appendChild(grid);

            contenedor.appendChild(seccion);
        });

        if (!huboAlguna) {
            var vacio = document.createElement('p');
            vacio.className = 'materiales-biblioteca__estado';
            vacio.textContent = 'Todavía no hay materiales publicados. ¡Volvé pronto!';
            contenedor.appendChild(vacio);
        }
    }

    function prepararRespaldo() {
        return CATALOGO_RESPALDO.map(function (item) {
            return {
                titulo: item.titulo,
                descripcion: item.descripcion,
                categoria: item.categoria,
                disponible: false,
                url: null,
                nombre_archivo: null
            };
        });
    }

    async function cargarMateriales(client) {
        if (!client) {
            renderizar(prepararRespaldo());
            return;
        }

        try {
            var resp = await client
                .from('materiales')
                .select('id, titulo, descripcion, categoria, archivo_path, nombre_archivo, orden')
                .eq('publicado', true)
                .order('categoria', { ascending: true })
                .order('orden', { ascending: true });

            if (resp.error) throw resp.error;

            var filas = resp.data || [];
            if (filas.length === 0) {
                renderizar(prepararRespaldo());
                return;
            }

            var materiales = filas.map(function (fila) {
                var url = null;
                if (fila.archivo_path) {
                    var urlPublica = client.storage.from(BUCKET_NAME).getPublicUrl(fila.archivo_path);
                    url = urlPublica && urlPublica.data ? urlPublica.data.publicUrl : null;
                }
                return {
                    titulo: fila.titulo,
                    descripcion: fila.descripcion,
                    categoria: fila.categoria,
                    disponible: !!url,
                    url: url,
                    nombre_archivo: fila.nombre_archivo
                };
            });

            renderizar(materiales);
        } catch (err) {
            // Tabla todavía no creada (ver sql/redesign_05_materiales.sql),
            // sin conexión, etc.: se usa el catálogo de referencia.
            console.warn('No se pudieron cargar los materiales desde Supabase, se usa el catálogo de referencia:', err);
            renderizar(prepararRespaldo());
        }
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

    async function cargarComunidad(client) {
        var enlace = document.getElementById('materiales-whatsapp-link');
        var pendienteNota = document.getElementById('materiales-whatsapp-pendiente');
        if (!enlace) return;

        var whatsappUrl = null;

        if (client) {
            try {
                var resp = await client
                    .from('materiales_config')
                    .select('whatsapp_url')
                    .eq('id', 1)
                    .maybeSingle();
                if (!resp.error && resp.data) {
                    whatsappUrl = resp.data.whatsapp_url;
                }
            } catch (err) {
                console.warn('No se pudo cargar la configuración de materiales (whatsapp_url):', err);
            }
        }

        if (urlValida(whatsappUrl)) {
            enlace.href = whatsappUrl;
            enlace.classList.remove('materiales-comunidad__link--pendiente');
            enlace.removeAttribute('aria-disabled');
            if (pendienteNota) pendienteNota.hidden = true;
        } else {
            // No inventamos ninguna URL: se buscó en todo el proyecto (sitio
            // en producción y /redesign) y no existe un link real de
            // WhatsApp todavía. El CTA queda visible pero no funciona como
            // enlace hasta que se cargue "whatsapp_url" en la tabla
            // "materiales_config" (desde /admin o directamente en Supabase).
            enlace.removeAttribute('href');
            enlace.classList.add('materiales-comunidad__link--pendiente');
            enlace.setAttribute('aria-disabled', 'true');
            enlace.addEventListener('click', function (evento) { evento.preventDefault(); });
            if (pendienteNota) pendienteNota.hidden = false;
        }
    }

    function iniciar() {
        var client = window.obtenerClienteKalulu && window.obtenerClienteKalulu();
        cargarMateriales(client);
        cargarComunidad(client);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
