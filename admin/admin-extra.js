// Panel de administración — Extensión para el rediseño de Kalulu.
//
// Este archivo es completamente aditivo: NUNCA toca admin.js ni sus
// funciones (Noticias, Eventos, login/logout siguen intactos). Habla con
// Supabase usando la misma Publishable Key pública; la seguridad real la
// dan las policies de RLS de home_config y recursos_destacados (ver
// /redesign/sql/). Agrega dos secciones nuevas al panel:
//   - "Home": edita la fila única de public.home_config (Hero).
//   - "Qué ofrecemos": CRUD completo sobre public.recursos_destacados,
//     con el mismo patrón de subida de imágenes que ya usan Noticias/Eventos.
(function () {
    'use strict';

    var BUCKET_NAME_RECURSOS = 'recursos-imagenes';
    var BUCKET_NAME_EQUIPO = 'equipo-imagenes';
    var BUCKET_NAME_MATERIALES = 'materiales-archivos';
    var TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
    var TAMANO_IMAGEN_MAXIMO = 5 * 1024 * 1024; // 5MB
    var TIPOS_ARCHIVO_MATERIAL_PERMITIDOS = ['application/pdf'];
    var TAMANO_ARCHIVO_MATERIAL_MAXIMO = 15 * 1024 * 1024; // 15MB

    var client = null;
    var recursosCache = [];
    var imagenSeleccionadaRecurso = null;
    var imagenEliminadaRecurso = false;

    var cienciaCache = [];
    var equipoCache = [];
    var imagenSeleccionadaIntegrante = null;
    var imagenEliminadaIntegrante = false;

    var materialesCache = [];
    var archivoSeleccionadoMaterial = null;
    var archivoEliminadoMaterial = false;

    var el = {};

    function cachearElementos() {
        el.tabHome = document.getElementById('tab-home');
        el.tabNoticias = document.getElementById('tab-noticias');
        el.tabEventos = document.getElementById('tab-eventos');
        el.tabOfrecemos = document.getElementById('tab-ofrecemos');
        el.tabCiencia = document.getElementById('tab-ciencia');
        el.tabEquipo = document.getElementById('tab-equipo');
        el.tabMateriales = document.getElementById('tab-materiales');

        el.panelHome = document.getElementById('panel-home');
        el.panelNoticias = document.getElementById('panel-noticias');
        el.panelEventos = document.getElementById('panel-eventos');
        el.panelOfrecemos = document.getElementById('panel-ofrecemos');
        el.panelCiencia = document.getElementById('panel-ciencia');
        el.panelEquipo = document.getElementById('panel-equipo');
        el.panelMateriales = document.getElementById('panel-materiales');

        el.panelSection = document.getElementById('panel-section');

        // Home
        el.homeMensaje = document.getElementById('home-mensaje');
        el.homeExito = document.getElementById('home-exito');
        el.homeCargando = document.getElementById('home-cargando');
        el.formHome = document.getElementById('form-home');
        el.homeTitulo = document.getElementById('home-titulo');
        el.homeSubtitulo = document.getElementById('home-subtitulo');
        el.homeCtaTexto = document.getElementById('home-cta-texto');
        el.homeCtaUrl = document.getElementById('home-cta-url');
        el.homeImagenUrl = document.getElementById('home-imagen-url');
        el.homeFormError = document.getElementById('home-form-error');
        el.homeFormGuardando = document.getElementById('home-form-guardando');
        el.btnGuardarHome = document.getElementById('btn-guardar-home');

        // Ofrecemos — listado
        el.btnNuevoRecurso = document.getElementById('btn-nuevo-recurso');
        el.panelOfrecemosMensaje = document.getElementById('panel-ofrecemos-mensaje');
        el.panelOfrecemosAccion = document.getElementById('panel-ofrecemos-accion');
        el.panelOfrecemosCargando = document.getElementById('panel-ofrecemos-cargando');
        el.tablaOfrecemos = document.getElementById('tabla-ofrecemos');
        el.tablaOfrecemosBody = document.getElementById('tabla-ofrecemos-body');
        el.listaOfrecemosVacia = document.getElementById('lista-ofrecemos-vacia');

        // Ofrecemos — formulario
        el.formRecursoOverlay = document.getElementById('form-recurso-overlay');
        el.formRecurso = document.getElementById('form-recurso');
        el.formRecursoTitulo = document.getElementById('form-recurso-titulo');
        el.campoRecursoId = document.getElementById('campo-recurso-id');
        el.campoRecursoImagenUrlActual = document.getElementById('campo-recurso-imagen-url-actual');
        el.campoRecursoTitulo = document.getElementById('campo-recurso-titulo');
        el.campoRecursoDescripcion = document.getElementById('campo-recurso-descripcion');
        el.campoRecursoLink = document.getElementById('campo-recurso-link');
        el.campoRecursoCtaTexto = document.getElementById('campo-recurso-cta-texto');
        el.campoRecursoOrden = document.getElementById('campo-recurso-orden');
        el.campoRecursoImagen = document.getElementById('campo-recurso-imagen');
        el.imagenRecursoError = document.getElementById('imagen-recurso-error');
        el.previewRecursoWrap = document.getElementById('preview-imagen-recurso-wrap');
        el.previewRecursoImg = document.getElementById('preview-imagen-recurso');
        el.btnQuitarImagenRecurso = document.getElementById('btn-quitar-imagen-recurso');
        el.campoRecursoPublicado = document.getElementById('campo-recurso-publicado');
        el.formRecursoError = document.getElementById('form-recurso-error');
        el.formRecursoGuardando = document.getElementById('form-recurso-guardando');
        el.btnGuardarRecurso = document.getElementById('btn-guardar-recurso');
        el.btnCancelarRecurso = document.getElementById('btn-cancelar-recurso');

        // Ciencia ciudadana — listado
        el.btnNuevaPregunta = document.getElementById('btn-nueva-pregunta');
        el.panelCienciaMensaje = document.getElementById('panel-ciencia-mensaje');
        el.panelCienciaAccion = document.getElementById('panel-ciencia-accion');
        el.panelCienciaCargando = document.getElementById('panel-ciencia-cargando');
        el.tablaCiencia = document.getElementById('tabla-ciencia');
        el.tablaCienciaBody = document.getElementById('tabla-ciencia-body');
        el.listaCienciaVacia = document.getElementById('lista-ciencia-vacia');

        // Ciencia ciudadana — formulario
        el.formPreguntaOverlay = document.getElementById('form-pregunta-overlay');
        el.formPregunta = document.getElementById('form-pregunta');
        el.formPreguntaTitulo = document.getElementById('form-pregunta-titulo');
        el.campoPreguntaId = document.getElementById('campo-pregunta-id');
        el.campoPreguntaTexto = document.getElementById('campo-pregunta-texto');
        el.campoPreguntaOrden = document.getElementById('campo-pregunta-orden');
        el.campoPreguntaPublicada = document.getElementById('campo-pregunta-publicada');
        el.formPreguntaError = document.getElementById('form-pregunta-error');
        el.formPreguntaGuardando = document.getElementById('form-pregunta-guardando');
        el.btnGuardarPregunta = document.getElementById('btn-guardar-pregunta');
        el.btnCancelarPregunta = document.getElementById('btn-cancelar-pregunta');

        // Equipo — listado
        el.btnNuevoIntegrante = document.getElementById('btn-nuevo-integrante');
        el.panelEquipoMensaje = document.getElementById('panel-equipo-mensaje');
        el.panelEquipoAccion = document.getElementById('panel-equipo-accion');
        el.panelEquipoCargando = document.getElementById('panel-equipo-cargando');
        el.tablaEquipo = document.getElementById('tabla-equipo');
        el.tablaEquipoBody = document.getElementById('tabla-equipo-body');
        el.listaEquipoVacia = document.getElementById('lista-equipo-vacia');

        // Equipo — formulario
        el.formIntegranteOverlay = document.getElementById('form-integrante-overlay');
        el.formIntegrante = document.getElementById('form-integrante');
        el.formIntegranteTitulo = document.getElementById('form-integrante-titulo');
        el.campoIntegranteId = document.getElementById('campo-integrante-id');
        el.campoIntegranteImagenUrlActual = document.getElementById('campo-integrante-imagen-url-actual');
        el.campoIntegranteNombre = document.getElementById('campo-integrante-nombre');
        el.campoIntegranteDescripcion = document.getElementById('campo-integrante-descripcion');
        el.campoIntegranteLink = document.getElementById('campo-integrante-link');
        el.campoIntegranteOrden = document.getElementById('campo-integrante-orden');
        el.campoIntegranteImagen = document.getElementById('campo-integrante-imagen');
        el.imagenIntegranteError = document.getElementById('imagen-integrante-error');
        el.previewIntegranteWrap = document.getElementById('preview-imagen-integrante-wrap');
        el.previewIntegranteImg = document.getElementById('preview-imagen-integrante');
        el.btnQuitarImagenIntegrante = document.getElementById('btn-quitar-imagen-integrante');
        el.campoIntegrantePublicada = document.getElementById('campo-integrante-publicada');
        el.formIntegranteError = document.getElementById('form-integrante-error');
        el.formIntegranteGuardando = document.getElementById('form-integrante-guardando');
        el.btnGuardarIntegrante = document.getElementById('btn-guardar-integrante');
        el.btnCancelarIntegrante = document.getElementById('btn-cancelar-integrante');

        // Materiales — configuración (WhatsApp / contacto)
        el.materialesConfigMensaje = document.getElementById('materiales-config-mensaje');
        el.materialesConfigExito = document.getElementById('materiales-config-exito');
        el.materialesConfigCargando = document.getElementById('materiales-config-cargando');
        el.formMaterialesConfig = document.getElementById('form-materiales-config');
        el.materialesConfigWhatsapp = document.getElementById('materiales-config-whatsapp');
        el.materialesConfigEmail = document.getElementById('materiales-config-email');
        el.materialesConfigFormError = document.getElementById('materiales-config-form-error');
        el.materialesConfigFormGuardando = document.getElementById('materiales-config-form-guardando');
        el.btnGuardarMaterialesConfig = document.getElementById('btn-guardar-materiales-config');

        // Materiales — listado de documentos
        el.btnNuevoMaterial = document.getElementById('btn-nuevo-material');
        el.panelMaterialesMensaje = document.getElementById('panel-materiales-mensaje');
        el.panelMaterialesAccion = document.getElementById('panel-materiales-accion');
        el.panelMaterialesCargando = document.getElementById('panel-materiales-cargando');
        el.tablaMateriales = document.getElementById('tabla-materiales');
        el.tablaMaterialesBody = document.getElementById('tabla-materiales-body');
        el.listaMaterialesVacia = document.getElementById('lista-materiales-vacia');

        // Materiales — formulario
        el.formMaterialOverlay = document.getElementById('form-material-overlay');
        el.formMaterial = document.getElementById('form-material');
        el.formMaterialTitulo = document.getElementById('form-material-titulo');
        el.campoMaterialId = document.getElementById('campo-material-id');
        el.campoMaterialArchivoPathActual = document.getElementById('campo-material-archivo-path-actual');
        el.campoMaterialNombreArchivoActual = document.getElementById('campo-material-nombre-archivo-actual');
        el.campoMaterialTitulo = document.getElementById('campo-material-titulo');
        el.campoMaterialDescripcion = document.getElementById('campo-material-descripcion');
        el.campoMaterialCategoria = document.getElementById('campo-material-categoria');
        el.campoMaterialOrden = document.getElementById('campo-material-orden');
        el.campoMaterialArchivo = document.getElementById('campo-material-archivo');
        el.archivoMaterialError = document.getElementById('archivo-material-error');
        el.archivoMaterialActualWrap = document.getElementById('archivo-material-actual-wrap');
        el.archivoMaterialActualNombre = document.getElementById('archivo-material-actual-nombre');
        el.btnQuitarArchivoMaterial = document.getElementById('btn-quitar-archivo-material');
        el.campoMaterialPublicado = document.getElementById('campo-material-publicado');
        el.formMaterialError = document.getElementById('form-material-error');
        el.formMaterialGuardando = document.getElementById('form-material-guardando');
        el.btnGuardarMaterial = document.getElementById('btn-guardar-material');
        el.btnCancelarMaterial = document.getElementById('btn-cancelar-material');
    }

    // Etiquetas de categoría para mostrar en la tabla del admin (mismo
    // orden/textos que assets/js/materiales-lista.js en el frontend).
    var ETIQUETAS_CATEGORIA_MATERIAL = {
        cuadernillos: 'Cuadernillos',
        impresion: 'Cuadernillos para imprimir',
        guias: 'Guías',
        juegos: 'Juegos'
    };

    // ---- Utilidades (duplicadas a propósito: este archivo no depende de
    // funciones privadas de admin.js, para no acoplarse a su código interno) ----

    function mostrar(elemento) { if (elemento) elemento.hidden = false; }
    function ocultar(elemento) { if (elemento) elemento.hidden = true; }

    function mostrarErrorEn(elemento, mensaje) {
        elemento.textContent = mensaje;
        mostrar(elemento);
    }
    function ocultarErrorEn(elemento) {
        elemento.textContent = '';
        ocultar(elemento);
    }
    function mostrarErrorPanel(elementoMensaje, mensaje) {
        elementoMensaje.textContent = mensaje;
        elementoMensaje.classList.add('admin-error');
        mostrar(elementoMensaje);
    }

    function mensajeErrorSupabase(err) {
        if (!err) return 'Ocurrió un error inesperado.';
        var msg = (err.message || '').toLowerCase();
        if (msg.indexOf('row-level security') !== -1 || err.code === '42501' || err.code === 'PGRST301') {
            return 'No tenés permisos para realizar esta acción.';
        }
        if (msg.indexOf('failed to fetch') !== -1 || msg.indexOf('networkerror') !== -1) {
            return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
        }
        if (msg.indexOf('relation') !== -1 && msg.indexOf('does not exist') !== -1) {
            return 'Todavía no se corrió el SQL de esta sección (ver /redesign/sql/). Pedile a quien administra Supabase que lo ejecute.';
        }
        return 'Ocurrió un error: ' + (err.message || 'intentá de nuevo.');
    }

    function extraerPathDeUrlPublica(url, bucketName) {
        if (!url) return null;
        var marcador = '/storage/v1/object/public/' + bucketName + '/';
        var idx = url.indexOf(marcador);
        if (idx === -1) return null;
        return url.substring(idx + marcador.length);
    }

    function generarNombreArchivo(carpeta, file) {
        var extension = 'jpg';
        var partes = (file.name || '').split('.');
        if (partes.length > 1) {
            extension = partes.pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        }
        var idUnico = (window.crypto && window.crypto.randomUUID)
            ? window.crypto.randomUUID()
            : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
        return carpeta + '/' + idUnico + '.' + extension;
    }

    function validarImagen(file) {
        if (!file) return null;
        if (TIPOS_IMAGEN_PERMITIDOS.indexOf(file.type) === -1) {
            return 'Formato no permitido. Usá una imagen JPG, PNG o WEBP.';
        }
        if (file.size > TAMANO_IMAGEN_MAXIMO) {
            return 'La imagen supera el tamaño máximo permitido (5MB).';
        }
        return null;
    }

    function urlValida(url) {
        if (!url) return false;
        try {
            var u = new URL(url, window.location.href);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    // ---- Tabs: controlador único para las 4 pestañas (Home / Noticias /
    // Eventos / Qué ofrecemos). admin.js sigue manejando su propio toggle
    // de Noticias/Eventos de forma independiente; este handler corre
    // además y deja el estado final consistente entre las 4. ----

    function cambiarTabCompleta(nombre) {
        var tabs = {
            home: el.tabHome, noticias: el.tabNoticias, eventos: el.tabEventos,
            ofrecemos: el.tabOfrecemos, ciencia: el.tabCiencia, equipo: el.tabEquipo,
            materiales: el.tabMateriales
        };
        var paneles = {
            home: el.panelHome, noticias: el.panelNoticias, eventos: el.panelEventos,
            ofrecemos: el.panelOfrecemos, ciencia: el.panelCiencia, equipo: el.panelEquipo,
            materiales: el.panelMateriales
        };

        Object.keys(tabs).forEach(function (nombreTab) {
            var esActiva = nombreTab === nombre;
            if (tabs[nombreTab]) {
                tabs[nombreTab].classList.toggle('activa', esActiva);
                tabs[nombreTab].setAttribute('aria-selected', esActiva ? 'true' : 'false');
            }
            if (paneles[nombreTab]) paneles[nombreTab].hidden = !esActiva;
        });
    }

    function iniciarTabs() {
        if (el.tabHome) el.tabHome.addEventListener('click', function () { cambiarTabCompleta('home'); });
        if (el.tabNoticias) el.tabNoticias.addEventListener('click', function () { cambiarTabCompleta('noticias'); });
        if (el.tabEventos) el.tabEventos.addEventListener('click', function () { cambiarTabCompleta('eventos'); });
        if (el.tabOfrecemos) el.tabOfrecemos.addEventListener('click', function () { cambiarTabCompleta('ofrecemos'); });
        if (el.tabCiencia) el.tabCiencia.addEventListener('click', function () { cambiarTabCompleta('ciencia'); });
        if (el.tabEquipo) el.tabEquipo.addEventListener('click', function () { cambiarTabCompleta('equipo'); });
        if (el.tabMateriales) el.tabMateriales.addEventListener('click', function () { cambiarTabCompleta('materiales'); });
    }

    // ---- Home (Hero) ----

    async function cargarHome() {
        ocultar(el.homeMensaje);
        ocultar(el.homeExito);
        mostrar(el.homeCargando);
        ocultar(el.formHome);

        try {
            // Columnas reales de public.home_config (verificadas con
            // information_schema.columns): id, titulo, subtitulo, texto_cta,
            // url_cta, imagen_url, updated_at. NO son "hero_*".
            var resp = await client
                .from('home_config')
                .select('titulo, subtitulo, texto_cta, url_cta, imagen_url')
                .eq('id', 1)
                .maybeSingle();

            if (resp.error) throw resp.error;

            var cfg = resp.data || {};
            el.homeTitulo.value = cfg.titulo || '';
            el.homeSubtitulo.value = cfg.subtitulo || '';
            el.homeCtaTexto.value = cfg.texto_cta || '';
            el.homeCtaUrl.value = cfg.url_cta || '';
            el.homeImagenUrl.value = cfg.imagen_url || '';

            ocultar(el.homeCargando);
            mostrar(el.formHome);
        } catch (err) {
            console.error('Error al cargar la configuración de Home:', err);
            ocultar(el.homeCargando);
            mostrarErrorPanel(el.homeMensaje, mensajeErrorSupabase(err));
        }
    }

    async function guardarHome(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.homeFormError);
        ocultar(el.homeExito);

        var titulo = el.homeTitulo.value.trim();
        var subtitulo = el.homeSubtitulo.value.trim();
        var ctaTexto = el.homeCtaTexto.value.trim();
        var ctaUrl = el.homeCtaUrl.value.trim();
        var imagenUrl = el.homeImagenUrl.value.trim();

        if (!titulo || !subtitulo || !ctaTexto || !ctaUrl) {
            mostrarErrorEn(el.homeFormError, 'Completá título, subtítulo, texto del botón y URL del botón.');
            return;
        }
        // La URL del botón admite tanto rutas internas ("/materiales/") como
        // links externos completos (Google Forms, convocatorias, etc.).
        var esRutaInterna = ctaUrl.indexOf('/') === 0;
        if (!esRutaInterna && !urlValida(ctaUrl)) {
            mostrarErrorEn(el.homeFormError, 'La URL del botón debe empezar con "/" (página interna) o ser un link http/https válido.');
            return;
        }
        if (imagenUrl && !urlValida(imagenUrl)) {
            mostrarErrorEn(el.homeFormError, 'La URL de la imagen de fondo debe ser http/https válida (o dejarse en blanco).');
            return;
        }

        el.btnGuardarHome.disabled = true;
        mostrar(el.homeFormGuardando);

        try {
            var payload = {
                id: 1,
                titulo: titulo,
                subtitulo: subtitulo,
                texto_cta: ctaTexto,
                url_cta: ctaUrl,
                imagen_url: imagenUrl || null
            };
            var resp = await client.from('home_config').upsert(payload, { onConflict: 'id' });
            if (resp.error) throw resp.error;

            var exito = document.getElementById('home-exito');
            exito.textContent = 'Cambios guardados. Ya se ven en la Home.';
            mostrar(exito);
        } catch (err) {
            console.error('Error al guardar Home:', err);
            mostrarErrorEn(el.homeFormError, mensajeErrorSupabase(err));
        } finally {
            el.btnGuardarHome.disabled = false;
            ocultar(el.homeFormGuardando);
        }
    }

    // ---- Qué ofrecemos (recursos_destacados) ----

    async function cargarOfrecemos() {
        ocultar(el.panelOfrecemosMensaje);
        ocultar(el.panelOfrecemosAccion);
        mostrar(el.panelOfrecemosCargando);
        ocultar(el.tablaOfrecemos);
        ocultar(el.listaOfrecemosVacia);

        try {
            var resp = await client
                .from('recursos_destacados')
                // Columna real: "texto_boton" (verificada con information_schema.columns), no "cta_texto".
                .select('id, titulo, descripcion, imagen_url, link, texto_boton, publicado, orden')
                .order('orden', { ascending: true });

            if (resp.error) throw resp.error;

            recursosCache = resp.data || [];
            ocultar(el.panelOfrecemosCargando);

            if (recursosCache.length === 0) {
                el.tablaOfrecemosBody.innerHTML = '';
                mostrar(el.listaOfrecemosVacia);
                return;
            }

            renderizarTablaOfrecemos();
            mostrar(el.tablaOfrecemos);
        } catch (err) {
            console.error('Error al cargar "Qué ofrecemos":', err);
            ocultar(el.panelOfrecemosCargando);
            mostrarErrorPanel(el.panelOfrecemosMensaje, mensajeErrorSupabase(err));
        }
    }

    function mostrarExitoOfrecemos(mensaje) {
        el.panelOfrecemosAccion.textContent = mensaje;
        mostrar(el.panelOfrecemosAccion);
        setTimeout(function () { ocultar(el.panelOfrecemosAccion); }, 3000);
    }

    function renderizarTablaOfrecemos() {
        el.tablaOfrecemosBody.innerHTML = '';

        recursosCache.forEach(function (recurso) {
            var tr = document.createElement('tr');

            var tdImg = document.createElement('td');
            if (recurso.imagen_url) {
                var img = document.createElement('img');
                img.src = recurso.imagen_url;
                img.alt = '';
                img.className = 'admin-tabla-imagen';
                img.onerror = function () {
                    img.remove();
                    var span = document.createElement('span');
                    span.className = 'admin-tabla-sin-imagen';
                    span.textContent = 'Sin imagen';
                    tdImg.appendChild(span);
                };
                tdImg.appendChild(img);
            } else {
                var span2 = document.createElement('span');
                span2.className = 'admin-tabla-sin-imagen';
                span2.textContent = 'Sin imagen';
                tdImg.appendChild(span2);
            }
            tr.appendChild(tdImg);

            var tdTitulo = document.createElement('td');
            tdTitulo.textContent = recurso.titulo || '(sin título)';
            tr.appendChild(tdTitulo);

            var tdOrden = document.createElement('td');
            tdOrden.textContent = String(recurso.orden);
            tr.appendChild(tdOrden);

            var tdEstado = document.createElement('td');
            var estado = document.createElement('span');
            estado.className = 'admin-estado ' + (recurso.publicado ? 'publicada' : 'borrador');
            estado.textContent = recurso.publicado ? 'Publicada' : 'Borrador';
            tdEstado.appendChild(estado);
            tr.appendChild(tdEstado);

            var tdAcciones = document.createElement('td');

            var btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'btn-admin-chico';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', function () { abrirFormularioEdicionRecurso(recurso); });
            tdAcciones.appendChild(btnEditar);

            var btnToggle = document.createElement('button');
            btnToggle.type = 'button';
            btnToggle.className = 'btn-admin-chico';
            btnToggle.textContent = recurso.publicado ? 'Despublicar' : 'Publicar';
            btnToggle.addEventListener('click', function () { alternarPublicadoRecurso(recurso); });
            tdAcciones.appendChild(btnToggle);

            var btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'btn-admin-chico peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', function () { eliminarRecurso(recurso); });
            tdAcciones.appendChild(btnEliminar);

            tr.appendChild(tdAcciones);
            el.tablaOfrecemosBody.appendChild(tr);
        });
    }

    async function alternarPublicadoRecurso(recurso) {
        var nuevoValor = !recurso.publicado;
        try {
            var resp = await client.from('recursos_destacados').update({ publicado: nuevoValor }).eq('id', recurso.id);
            if (resp.error) throw resp.error;
            await cargarOfrecemos();
            mostrarExitoOfrecemos(nuevoValor ? 'Tarjeta publicada.' : 'Tarjeta despublicada.');
        } catch (err) {
            console.error('Error al publicar/despublicar recurso:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    async function eliminarRecurso(recurso) {
        var confirmado = window.confirm(
            'Vas a eliminar la tarjeta "' + (recurso.titulo || 'sin título') + '".\n' +
            'Esta acción no se puede deshacer. ¿Confirmás?'
        );
        if (!confirmado) return;

        try {
            var resp = await client.from('recursos_destacados').delete().eq('id', recurso.id);
            if (resp.error) throw resp.error;

            var path = extraerPathDeUrlPublica(recurso.imagen_url, BUCKET_NAME_RECURSOS);
            if (path) {
                try { await client.storage.from(BUCKET_NAME_RECURSOS).remove([path]); }
                catch (errImg) { console.warn('No se pudo eliminar la imagen asociada en Storage:', errImg); }
            }

            await cargarOfrecemos();
            mostrarExitoOfrecemos('Tarjeta eliminada correctamente.');
        } catch (err) {
            console.error('Error al eliminar recurso:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    function resetearFormularioRecurso() {
        el.formRecurso.reset();
        el.campoRecursoId.value = '';
        el.campoRecursoImagenUrlActual.value = '';
        el.campoRecursoOrden.value = String(recursosCache.length);
        el.campoRecursoPublicado.checked = false;
        imagenSeleccionadaRecurso = null;
        imagenEliminadaRecurso = false;
        ocultarErrorEn(el.imagenRecursoError);
        ocultarErrorEn(el.formRecursoError);
        ocultar(el.formRecursoGuardando);
        ocultar(el.previewRecursoWrap);
        el.previewRecursoImg.src = '';
    }

    function abrirFormularioNuevoRecurso() {
        resetearFormularioRecurso();
        el.formRecursoTitulo.textContent = 'Nueva tarjeta';
        mostrar(el.formRecursoOverlay);
        el.campoRecursoTitulo.focus();
    }

    function abrirFormularioEdicionRecurso(recurso) {
        resetearFormularioRecurso();
        el.formRecursoTitulo.textContent = 'Editar tarjeta';
        el.campoRecursoId.value = recurso.id;
        el.campoRecursoImagenUrlActual.value = recurso.imagen_url || '';
        el.campoRecursoTitulo.value = recurso.titulo || '';
        el.campoRecursoDescripcion.value = recurso.descripcion || '';
        el.campoRecursoLink.value = recurso.link || '';
        el.campoRecursoCtaTexto.value = recurso.texto_boton || '';
        el.campoRecursoOrden.value = String(recurso.orden);
        el.campoRecursoPublicado.checked = !!recurso.publicado;

        if (recurso.imagen_url) {
            el.previewRecursoImg.src = recurso.imagen_url;
            mostrar(el.previewRecursoWrap);
        }

        mostrar(el.formRecursoOverlay);
        el.campoRecursoTitulo.focus();
    }

    function cerrarFormularioRecurso() {
        ocultar(el.formRecursoOverlay);
        resetearFormularioRecurso();
    }

    function manejarCambioImagenRecurso() {
        ocultarErrorEn(el.imagenRecursoError);
        var file = el.campoRecursoImagen.files && el.campoRecursoImagen.files[0];
        if (!file) return;

        var errorValidacion = validarImagen(file);
        if (errorValidacion) {
            mostrarErrorEn(el.imagenRecursoError, errorValidacion);
            el.campoRecursoImagen.value = '';
            imagenSeleccionadaRecurso = null;
            return;
        }

        imagenSeleccionadaRecurso = file;
        imagenEliminadaRecurso = false;
        el.previewRecursoImg.src = URL.createObjectURL(file);
        mostrar(el.previewRecursoWrap);
    }

    function manejarQuitarImagenRecurso() {
        imagenSeleccionadaRecurso = null;
        imagenEliminadaRecurso = true;
        el.campoRecursoImagen.value = '';
        el.previewRecursoImg.src = '';
        ocultar(el.previewRecursoWrap);
        ocultarErrorEn(el.imagenRecursoError);
    }

    async function manejarSubmitFormularioRecurso(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.formRecursoError);

        var titulo = el.campoRecursoTitulo.value.trim();
        var orden = parseInt(el.campoRecursoOrden.value, 10);
        var link = el.campoRecursoLink.value.trim();

        if (!titulo) {
            mostrarErrorEn(el.formRecursoError, 'El título es obligatorio.');
            return;
        }
        if (isNaN(orden) || orden < 0) {
            mostrarErrorEn(el.formRecursoError, 'El orden debe ser un número mayor o igual a 0.');
            return;
        }
        if (link && !urlValida(link)) {
            mostrarErrorEn(el.formRecursoError, 'El link debe ser una URL http o https válida.');
            return;
        }
        if (imagenSeleccionadaRecurso) {
            var errorValidacion = validarImagen(imagenSeleccionadaRecurso);
            if (errorValidacion) {
                mostrarErrorEn(el.formRecursoError, errorValidacion);
                return;
            }
        }

        el.btnGuardarRecurso.disabled = true;
        mostrar(el.formRecursoGuardando);

        try {
            var imagenUrlFinal = el.campoRecursoImagenUrlActual.value || null;

            if (imagenSeleccionadaRecurso) {
                var path = generarNombreArchivo('recursos', imagenSeleccionadaRecurso);
                var subida = await client.storage
                    .from(BUCKET_NAME_RECURSOS)
                    .upload(path, imagenSeleccionadaRecurso, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: imagenSeleccionadaRecurso.type
                    });
                if (subida.error) throw subida.error;

                var urlPublica = client.storage.from(BUCKET_NAME_RECURSOS).getPublicUrl(path);
                imagenUrlFinal = urlPublica.data.publicUrl;
            } else if (imagenEliminadaRecurso) {
                imagenUrlFinal = null;
            }

            var payload = {
                titulo: titulo,
                descripcion: el.campoRecursoDescripcion.value.trim() || null,
                link: link || null,
                texto_boton: el.campoRecursoCtaTexto.value.trim() || null,
                orden: orden,
                imagen_url: imagenUrlFinal,
                publicado: el.campoRecursoPublicado.checked
            };

            var idExistente = el.campoRecursoId.value;
            var resp;
            if (idExistente) {
                resp = await client.from('recursos_destacados').update(payload).eq('id', idExistente);
            } else {
                resp = await client.from('recursos_destacados').insert(payload);
            }
            if (resp.error) throw resp.error;

            cerrarFormularioRecurso();
            await cargarOfrecemos();
            mostrarExitoOfrecemos(idExistente ? 'Tarjeta actualizada correctamente.' : 'Tarjeta creada correctamente.');
        } catch (err) {
            console.error('Error al guardar la tarjeta:', err);
            mostrarErrorEn(el.formRecursoError, mensajeErrorSupabase(err));
        } finally {
            el.btnGuardarRecurso.disabled = false;
            ocultar(el.formRecursoGuardando);
        }
    }

    // ---- Ciencia ciudadana (preguntas_ciencia_ciudadana) ----

    async function cargarCiencia() {
        ocultar(el.panelCienciaMensaje);
        ocultar(el.panelCienciaAccion);
        mostrar(el.panelCienciaCargando);
        ocultar(el.tablaCiencia);
        ocultar(el.listaCienciaVacia);

        try {
            var resp = await client
                .from('preguntas_ciencia_ciudadana')
                .select('id, pregunta, orden, publicada')
                .order('orden', { ascending: true });

            if (resp.error) throw resp.error;

            cienciaCache = resp.data || [];
            ocultar(el.panelCienciaCargando);

            if (cienciaCache.length === 0) {
                el.tablaCienciaBody.innerHTML = '';
                mostrar(el.listaCienciaVacia);
                return;
            }

            renderizarTablaCiencia();
            mostrar(el.tablaCiencia);
        } catch (err) {
            console.error('Error al cargar "Ciencia ciudadana":', err);
            ocultar(el.panelCienciaCargando);
            mostrarErrorPanel(el.panelCienciaMensaje, mensajeErrorSupabase(err));
        }
    }

    function mostrarExitoCiencia(mensaje) {
        el.panelCienciaAccion.textContent = mensaje;
        mostrar(el.panelCienciaAccion);
        setTimeout(function () { ocultar(el.panelCienciaAccion); }, 3000);
    }

    function renderizarTablaCiencia() {
        el.tablaCienciaBody.innerHTML = '';

        cienciaCache.forEach(function (pregunta) {
            var tr = document.createElement('tr');

            var tdTexto = document.createElement('td');
            tdTexto.textContent = pregunta.pregunta || '(sin texto)';
            tr.appendChild(tdTexto);

            var tdOrden = document.createElement('td');
            tdOrden.textContent = String(pregunta.orden);
            tr.appendChild(tdOrden);

            var tdEstado = document.createElement('td');
            var estado = document.createElement('span');
            estado.className = 'admin-estado ' + (pregunta.publicada ? 'publicada' : 'borrador');
            estado.textContent = pregunta.publicada ? 'Publicada' : 'Borrador';
            tdEstado.appendChild(estado);
            tr.appendChild(tdEstado);

            var tdAcciones = document.createElement('td');

            var btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'btn-admin-chico';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', function () { abrirFormularioEdicionPregunta(pregunta); });
            tdAcciones.appendChild(btnEditar);

            var btnToggle = document.createElement('button');
            btnToggle.type = 'button';
            btnToggle.className = 'btn-admin-chico';
            btnToggle.textContent = pregunta.publicada ? 'Despublicar' : 'Publicar';
            btnToggle.addEventListener('click', function () { alternarPublicadaPregunta(pregunta); });
            tdAcciones.appendChild(btnToggle);

            var btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'btn-admin-chico peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', function () { eliminarPregunta(pregunta); });
            tdAcciones.appendChild(btnEliminar);

            tr.appendChild(tdAcciones);
            el.tablaCienciaBody.appendChild(tr);
        });
    }

    async function alternarPublicadaPregunta(pregunta) {
        var nuevoValor = !pregunta.publicada;
        try {
            var resp = await client.from('preguntas_ciencia_ciudadana').update({ publicada: nuevoValor, updated_at: new Date().toISOString() }).eq('id', pregunta.id);
            if (resp.error) throw resp.error;
            await cargarCiencia();
            mostrarExitoCiencia(nuevoValor ? 'Pregunta publicada.' : 'Pregunta despublicada.');
        } catch (err) {
            console.error('Error al publicar/despublicar pregunta:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    async function eliminarPregunta(pregunta) {
        var confirmado = window.confirm(
            'Vas a eliminar la pregunta "' + (pregunta.pregunta || 'sin texto') + '".\n' +
            'Esta acción no se puede deshacer. ¿Confirmás?'
        );
        if (!confirmado) return;

        try {
            var resp = await client.from('preguntas_ciencia_ciudadana').delete().eq('id', pregunta.id);
            if (resp.error) throw resp.error;
            await cargarCiencia();
            mostrarExitoCiencia('Pregunta eliminada correctamente.');
        } catch (err) {
            console.error('Error al eliminar pregunta:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    function resetearFormularioPregunta() {
        el.formPregunta.reset();
        el.campoPreguntaId.value = '';
        el.campoPreguntaOrden.value = String(cienciaCache.length);
        el.campoPreguntaPublicada.checked = false;
        ocultarErrorEn(el.formPreguntaError);
        ocultar(el.formPreguntaGuardando);
    }

    function abrirFormularioNuevaPregunta() {
        resetearFormularioPregunta();
        el.formPreguntaTitulo.textContent = 'Nueva pregunta';
        mostrar(el.formPreguntaOverlay);
        el.campoPreguntaTexto.focus();
    }

    function abrirFormularioEdicionPregunta(pregunta) {
        resetearFormularioPregunta();
        el.formPreguntaTitulo.textContent = 'Editar pregunta';
        el.campoPreguntaId.value = pregunta.id;
        el.campoPreguntaTexto.value = pregunta.pregunta || '';
        el.campoPreguntaOrden.value = String(pregunta.orden);
        el.campoPreguntaPublicada.checked = !!pregunta.publicada;
        mostrar(el.formPreguntaOverlay);
        el.campoPreguntaTexto.focus();
    }

    function cerrarFormularioPregunta() {
        ocultar(el.formPreguntaOverlay);
        resetearFormularioPregunta();
    }

    async function manejarSubmitFormularioPregunta(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.formPreguntaError);

        var texto = el.campoPreguntaTexto.value.trim();
        var orden = parseInt(el.campoPreguntaOrden.value, 10);

        if (!texto) {
            mostrarErrorEn(el.formPreguntaError, 'La pregunta es obligatoria.');
            return;
        }
        if (isNaN(orden) || orden < 0) {
            mostrarErrorEn(el.formPreguntaError, 'El orden debe ser un número mayor o igual a 0.');
            return;
        }

        el.btnGuardarPregunta.disabled = true;
        mostrar(el.formPreguntaGuardando);

        try {
            var payload = {
                pregunta: texto,
                orden: orden,
                publicada: el.campoPreguntaPublicada.checked,
                updated_at: new Date().toISOString()
            };

            var idExistente = el.campoPreguntaId.value;
            var resp;
            if (idExistente) {
                resp = await client.from('preguntas_ciencia_ciudadana').update(payload).eq('id', idExistente);
            } else {
                resp = await client.from('preguntas_ciencia_ciudadana').insert(payload);
            }
            if (resp.error) throw resp.error;

            cerrarFormularioPregunta();
            await cargarCiencia();
            mostrarExitoCiencia(idExistente ? 'Pregunta actualizada correctamente.' : 'Pregunta creada correctamente.');
        } catch (err) {
            console.error('Error al guardar la pregunta:', err);
            mostrarErrorEn(el.formPreguntaError, mensajeErrorSupabase(err));
        } finally {
            el.btnGuardarPregunta.disabled = false;
            ocultar(el.formPreguntaGuardando);
        }
    }

    // ---- Equipo ----

    async function cargarEquipo() {
        ocultar(el.panelEquipoMensaje);
        ocultar(el.panelEquipoAccion);
        mostrar(el.panelEquipoCargando);
        ocultar(el.tablaEquipo);
        ocultar(el.listaEquipoVacia);

        try {
            var resp = await client
                .from('equipo')
                .select('id, nombre, descripcion, imagen_url, link, orden, publicada')
                .order('orden', { ascending: true });

            if (resp.error) throw resp.error;

            equipoCache = resp.data || [];
            ocultar(el.panelEquipoCargando);

            if (equipoCache.length === 0) {
                el.tablaEquipoBody.innerHTML = '';
                mostrar(el.listaEquipoVacia);
                return;
            }

            renderizarTablaEquipo();
            mostrar(el.tablaEquipo);
        } catch (err) {
            console.error('Error al cargar "Equipo":', err);
            ocultar(el.panelEquipoCargando);
            mostrarErrorPanel(el.panelEquipoMensaje, mensajeErrorSupabase(err));
        }
    }

    function mostrarExitoEquipo(mensaje) {
        el.panelEquipoAccion.textContent = mensaje;
        mostrar(el.panelEquipoAccion);
        setTimeout(function () { ocultar(el.panelEquipoAccion); }, 3000);
    }

    function renderizarTablaEquipo() {
        el.tablaEquipoBody.innerHTML = '';

        equipoCache.forEach(function (persona) {
            var tr = document.createElement('tr');

            var tdImg = document.createElement('td');
            if (persona.imagen_url) {
                var img = document.createElement('img');
                img.src = persona.imagen_url;
                img.alt = '';
                img.className = 'admin-tabla-imagen';
                img.onerror = function () {
                    img.remove();
                    var span = document.createElement('span');
                    span.className = 'admin-tabla-sin-imagen';
                    span.textContent = 'Sin foto en Storage (usa la local)';
                    tdImg.appendChild(span);
                };
                tdImg.appendChild(img);
            } else {
                var span2 = document.createElement('span');
                span2.className = 'admin-tabla-sin-imagen';
                span2.textContent = 'Usa la foto local actual';
                tdImg.appendChild(span2);
            }
            tr.appendChild(tdImg);

            var tdNombre = document.createElement('td');
            tdNombre.textContent = persona.nombre || '(sin nombre)';
            tr.appendChild(tdNombre);

            var tdOrden = document.createElement('td');
            tdOrden.textContent = String(persona.orden);
            tr.appendChild(tdOrden);

            var tdEstado = document.createElement('td');
            var estado = document.createElement('span');
            estado.className = 'admin-estado ' + (persona.publicada ? 'publicada' : 'borrador');
            estado.textContent = persona.publicada ? 'Publicado' : 'Borrador';
            tdEstado.appendChild(estado);
            tr.appendChild(tdEstado);

            var tdAcciones = document.createElement('td');

            var btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'btn-admin-chico';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', function () { abrirFormularioEdicionIntegrante(persona); });
            tdAcciones.appendChild(btnEditar);

            var btnToggle = document.createElement('button');
            btnToggle.type = 'button';
            btnToggle.className = 'btn-admin-chico';
            btnToggle.textContent = persona.publicada ? 'Despublicar' : 'Publicar';
            btnToggle.addEventListener('click', function () { alternarPublicadoIntegrante(persona); });
            tdAcciones.appendChild(btnToggle);

            var btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'btn-admin-chico peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', function () { eliminarIntegrante(persona); });
            tdAcciones.appendChild(btnEliminar);

            tr.appendChild(tdAcciones);
            el.tablaEquipoBody.appendChild(tr);
        });
    }

    async function alternarPublicadoIntegrante(persona) {
        var nuevoValor = !persona.publicada;
        try {
            var resp = await client.from('equipo').update({ publicada: nuevoValor, updated_at: new Date().toISOString() }).eq('id', persona.id);
            if (resp.error) throw resp.error;
            await cargarEquipo();
            mostrarExitoEquipo(nuevoValor ? 'Integrante publicado.' : 'Integrante despublicado.');
        } catch (err) {
            console.error('Error al publicar/despublicar integrante:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    async function eliminarIntegrante(persona) {
        var confirmado = window.confirm(
            'Vas a eliminar a "' + (persona.nombre || 'sin nombre') + '" de la lista del equipo.\n' +
            'Esta acción no se puede deshacer. ¿Confirmás?'
        );
        if (!confirmado) return;

        try {
            var resp = await client.from('equipo').delete().eq('id', persona.id);
            if (resp.error) throw resp.error;

            var path = extraerPathDeUrlPublica(persona.imagen_url, BUCKET_NAME_EQUIPO);
            if (path) {
                try { await client.storage.from(BUCKET_NAME_EQUIPO).remove([path]); }
                catch (errImg) { console.warn('No se pudo eliminar la foto asociada en Storage:', errImg); }
            }

            await cargarEquipo();
            mostrarExitoEquipo('Integrante eliminado correctamente.');
        } catch (err) {
            console.error('Error al eliminar integrante:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    function resetearFormularioIntegrante() {
        el.formIntegrante.reset();
        el.campoIntegranteId.value = '';
        el.campoIntegranteImagenUrlActual.value = '';
        el.campoIntegranteOrden.value = String(equipoCache.length);
        el.campoIntegrantePublicada.checked = false;
        imagenSeleccionadaIntegrante = null;
        imagenEliminadaIntegrante = false;
        ocultarErrorEn(el.imagenIntegranteError);
        ocultarErrorEn(el.formIntegranteError);
        ocultar(el.formIntegranteGuardando);
        ocultar(el.previewIntegranteWrap);
        el.previewIntegranteImg.src = '';
    }

    function abrirFormularioNuevoIntegrante() {
        resetearFormularioIntegrante();
        el.formIntegranteTitulo.textContent = 'Nuevo integrante';
        mostrar(el.formIntegranteOverlay);
        el.campoIntegranteNombre.focus();
    }

    function abrirFormularioEdicionIntegrante(persona) {
        resetearFormularioIntegrante();
        el.formIntegranteTitulo.textContent = 'Editar integrante';
        el.campoIntegranteId.value = persona.id;
        el.campoIntegranteImagenUrlActual.value = persona.imagen_url || '';
        el.campoIntegranteNombre.value = persona.nombre || '';
        el.campoIntegranteDescripcion.value = persona.descripcion || '';
        el.campoIntegranteLink.value = persona.link || '';
        el.campoIntegranteOrden.value = String(persona.orden);
        el.campoIntegrantePublicada.checked = !!persona.publicada;

        if (persona.imagen_url) {
            el.previewIntegranteImg.src = persona.imagen_url;
            mostrar(el.previewIntegranteWrap);
        }

        mostrar(el.formIntegranteOverlay);
        el.campoIntegranteNombre.focus();
    }

    function cerrarFormularioIntegrante() {
        ocultar(el.formIntegranteOverlay);
        resetearFormularioIntegrante();
    }

    function manejarCambioImagenIntegrante() {
        ocultarErrorEn(el.imagenIntegranteError);
        var file = el.campoIntegranteImagen.files && el.campoIntegranteImagen.files[0];
        if (!file) return;

        var errorValidacion = validarImagen(file);
        if (errorValidacion) {
            mostrarErrorEn(el.imagenIntegranteError, errorValidacion);
            el.campoIntegranteImagen.value = '';
            imagenSeleccionadaIntegrante = null;
            return;
        }

        imagenSeleccionadaIntegrante = file;
        imagenEliminadaIntegrante = false;
        el.previewIntegranteImg.src = URL.createObjectURL(file);
        mostrar(el.previewIntegranteWrap);
    }

    function manejarQuitarImagenIntegrante() {
        imagenSeleccionadaIntegrante = null;
        imagenEliminadaIntegrante = true;
        el.campoIntegranteImagen.value = '';
        el.previewIntegranteImg.src = '';
        ocultar(el.previewIntegranteWrap);
        ocultarErrorEn(el.imagenIntegranteError);
    }

    async function manejarSubmitFormularioIntegrante(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.formIntegranteError);

        var nombre = el.campoIntegranteNombre.value.trim();
        var orden = parseInt(el.campoIntegranteOrden.value, 10);
        var link = el.campoIntegranteLink.value.trim();

        if (!nombre) {
            mostrarErrorEn(el.formIntegranteError, 'El nombre es obligatorio.');
            return;
        }
        if (isNaN(orden) || orden < 0) {
            mostrarErrorEn(el.formIntegranteError, 'El orden debe ser un número mayor o igual a 0.');
            return;
        }
        if (link && !urlValida(link)) {
            mostrarErrorEn(el.formIntegranteError, 'El link debe ser una URL http o https válida.');
            return;
        }
        if (imagenSeleccionadaIntegrante) {
            var errorValidacion = validarImagen(imagenSeleccionadaIntegrante);
            if (errorValidacion) {
                mostrarErrorEn(el.formIntegranteError, errorValidacion);
                return;
            }
        }

        el.btnGuardarIntegrante.disabled = true;
        mostrar(el.formIntegranteGuardando);

        try {
            var imagenUrlFinal = el.campoIntegranteImagenUrlActual.value || null;

            if (imagenSeleccionadaIntegrante) {
                var path = generarNombreArchivo('equipo', imagenSeleccionadaIntegrante);
                var subida = await client.storage
                    .from(BUCKET_NAME_EQUIPO)
                    .upload(path, imagenSeleccionadaIntegrante, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: imagenSeleccionadaIntegrante.type
                    });
                if (subida.error) throw subida.error;

                var urlPublica = client.storage.from(BUCKET_NAME_EQUIPO).getPublicUrl(path);
                imagenUrlFinal = urlPublica.data.publicUrl;
            } else if (imagenEliminadaIntegrante) {
                // Se deja en null a propósito: el frontend usa la foto local
                // de esa persona como respaldo (ver assets/js/equipo.js), en
                // vez de quedarse sin foto o inventar una URL.
                imagenUrlFinal = null;
            }

            var payload = {
                nombre: nombre,
                descripcion: el.campoIntegranteDescripcion.value.trim() || null,
                link: link || null,
                orden: orden,
                imagen_url: imagenUrlFinal,
                publicada: el.campoIntegrantePublicada.checked,
                updated_at: new Date().toISOString()
            };

            var idExistente = el.campoIntegranteId.value;
            var resp;
            if (idExistente) {
                resp = await client.from('equipo').update(payload).eq('id', idExistente);
            } else {
                resp = await client.from('equipo').insert(payload);
            }
            if (resp.error) throw resp.error;

            cerrarFormularioIntegrante();
            await cargarEquipo();
            mostrarExitoEquipo(idExistente ? 'Integrante actualizado correctamente.' : 'Integrante creado correctamente.');
        } catch (err) {
            console.error('Error al guardar el integrante:', err);
            mostrarErrorEn(el.formIntegranteError, mensajeErrorSupabase(err));
        } finally {
            el.btnGuardarIntegrante.disabled = false;
            ocultar(el.formIntegranteGuardando);
        }
    }

    // ---- Materiales: configuración (WhatsApp / contacto) ----

    async function cargarConfigMateriales() {
        ocultar(el.materialesConfigMensaje);
        ocultar(el.materialesConfigExito);
        mostrar(el.materialesConfigCargando);
        ocultar(el.formMaterialesConfig);

        try {
            var resp = await client
                .from('materiales_config')
                .select('whatsapp_url, contacto_email')
                .eq('id', 1)
                .maybeSingle();

            if (resp.error) throw resp.error;

            var cfg = resp.data || {};
            el.materialesConfigWhatsapp.value = cfg.whatsapp_url || '';
            el.materialesConfigEmail.value = cfg.contacto_email || '';

            ocultar(el.materialesConfigCargando);
            mostrar(el.formMaterialesConfig);
        } catch (err) {
            console.error('Error al cargar la configuración de Materiales:', err);
            ocultar(el.materialesConfigCargando);
            mostrarErrorPanel(el.materialesConfigMensaje, mensajeErrorSupabase(err));
        }
    }

    async function guardarConfigMateriales(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.materialesConfigFormError);
        ocultar(el.materialesConfigExito);

        var whatsappUrl = el.materialesConfigWhatsapp.value.trim();
        var contactoEmail = el.materialesConfigEmail.value.trim();

        if (whatsappUrl && !urlValida(whatsappUrl)) {
            mostrarErrorEn(el.materialesConfigFormError, 'El link de WhatsApp debe ser una URL http o https válida (o dejarse en blanco).');
            return;
        }

        el.btnGuardarMaterialesConfig.disabled = true;
        mostrar(el.materialesConfigFormGuardando);

        try {
            var payload = {
                id: 1,
                whatsapp_url: whatsappUrl || null,
                contacto_email: contactoEmail || null,
                updated_at: new Date().toISOString()
            };
            var resp = await client.from('materiales_config').upsert(payload, { onConflict: 'id' });
            if (resp.error) throw resp.error;

            var exito = el.materialesConfigExito;
            exito.textContent = 'Cambios guardados. Ya se ven en /materiales/.';
            mostrar(exito);
        } catch (err) {
            console.error('Error al guardar la configuración de Materiales:', err);
            mostrarErrorEn(el.materialesConfigFormError, mensajeErrorSupabase(err));
        } finally {
            el.btnGuardarMaterialesConfig.disabled = false;
            ocultar(el.materialesConfigFormGuardando);
        }
    }

    // ---- Materiales: documentos (public.materiales) ----

    async function cargarMateriales() {
        ocultar(el.panelMaterialesMensaje);
        ocultar(el.panelMaterialesAccion);
        mostrar(el.panelMaterialesCargando);
        ocultar(el.tablaMateriales);
        ocultar(el.listaMaterialesVacia);

        try {
            var resp = await client
                .from('materiales')
                .select('id, titulo, descripcion, categoria, archivo_path, nombre_archivo, orden, publicado')
                .order('categoria', { ascending: true })
                .order('orden', { ascending: true });

            if (resp.error) throw resp.error;

            materialesCache = resp.data || [];
            ocultar(el.panelMaterialesCargando);

            if (materialesCache.length === 0) {
                el.tablaMaterialesBody.innerHTML = '';
                mostrar(el.listaMaterialesVacia);
                return;
            }

            renderizarTablaMateriales();
            mostrar(el.tablaMateriales);
        } catch (err) {
            console.error('Error al cargar "Materiales":', err);
            ocultar(el.panelMaterialesCargando);
            mostrarErrorPanel(el.panelMaterialesMensaje, mensajeErrorSupabase(err));
        }
    }

    function mostrarExitoMateriales(mensaje) {
        el.panelMaterialesAccion.textContent = mensaje;
        mostrar(el.panelMaterialesAccion);
        setTimeout(function () { ocultar(el.panelMaterialesAccion); }, 3000);
    }

    function renderizarTablaMateriales() {
        el.tablaMaterialesBody.innerHTML = '';

        materialesCache.forEach(function (material) {
            var tr = document.createElement('tr');

            var tdArchivo = document.createElement('td');
            if (material.archivo_path) {
                var badge = document.createElement('span');
                badge.className = 'admin-tabla-archivo';
                badge.title = material.nombre_archivo || material.archivo_path;
                badge.textContent = material.nombre_archivo || material.archivo_path;
                tdArchivo.appendChild(badge);
            } else {
                var span2 = document.createElement('span');
                span2.className = 'admin-tabla-sin-imagen';
                span2.textContent = 'Sin archivo';
                tdArchivo.appendChild(span2);
            }
            tr.appendChild(tdArchivo);

            var tdTitulo = document.createElement('td');
            tdTitulo.textContent = material.titulo || '(sin título)';
            tr.appendChild(tdTitulo);

            var tdCategoria = document.createElement('td');
            tdCategoria.textContent = ETIQUETAS_CATEGORIA_MATERIAL[material.categoria] || material.categoria;
            tr.appendChild(tdCategoria);

            var tdOrden = document.createElement('td');
            tdOrden.textContent = String(material.orden);
            tr.appendChild(tdOrden);

            var tdEstado = document.createElement('td');
            var estado = document.createElement('span');
            estado.className = 'admin-estado ' + (material.publicado ? 'publicada' : 'borrador');
            estado.textContent = material.publicado ? 'Publicado' : 'Borrador';
            tdEstado.appendChild(estado);
            tr.appendChild(tdEstado);

            var tdAcciones = document.createElement('td');

            var btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'btn-admin-chico';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', function () { abrirFormularioEdicionMaterial(material); });
            tdAcciones.appendChild(btnEditar);

            var btnToggle = document.createElement('button');
            btnToggle.type = 'button';
            btnToggle.className = 'btn-admin-chico';
            btnToggle.textContent = material.publicado ? 'Despublicar' : 'Publicar';
            btnToggle.addEventListener('click', function () { alternarPublicadoMaterial(material); });
            tdAcciones.appendChild(btnToggle);

            var btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'btn-admin-chico peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', function () { eliminarMaterial(material); });
            tdAcciones.appendChild(btnEliminar);

            tr.appendChild(tdAcciones);
            el.tablaMaterialesBody.appendChild(tr);
        });
    }

    async function alternarPublicadoMaterial(material) {
        var nuevoValor = !material.publicado;
        try {
            var resp = await client.from('materiales').update({ publicado: nuevoValor, updated_at: new Date().toISOString() }).eq('id', material.id);
            if (resp.error) throw resp.error;
            await cargarMateriales();
            mostrarExitoMateriales(nuevoValor ? 'Material publicado.' : 'Material despublicado.');
        } catch (err) {
            console.error('Error al publicar/despublicar material:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    async function eliminarMaterial(material) {
        var confirmado = window.confirm(
            'Vas a eliminar el material "' + (material.titulo || 'sin título') + '".\n' +
            'Esta acción no se puede deshacer. ¿Confirmás?'
        );
        if (!confirmado) return;

        try {
            var resp = await client.from('materiales').delete().eq('id', material.id);
            if (resp.error) throw resp.error;

            // El path se guarda directo en la fila (no hay que extraerlo de
            // una URL pública como en imágenes): se borra el archivo real
            // de Storage para no dejarlo huérfano.
            if (material.archivo_path) {
                try { await client.storage.from(BUCKET_NAME_MATERIALES).remove([material.archivo_path]); }
                catch (errArchivo) { console.warn('No se pudo eliminar el archivo asociado en Storage:', errArchivo); }
            }

            await cargarMateriales();
            mostrarExitoMateriales('Material eliminado correctamente.');
        } catch (err) {
            console.error('Error al eliminar material:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    function validarArchivoMaterial(file) {
        if (!file) return null;
        if (TIPOS_ARCHIVO_MATERIAL_PERMITIDOS.indexOf(file.type) === -1) {
            return 'Formato no permitido. Por ahora solo se aceptan archivos PDF.';
        }
        if (file.size > TAMANO_ARCHIVO_MATERIAL_MAXIMO) {
            return 'El archivo supera el tamaño máximo permitido (15MB).';
        }
        return null;
    }

    function resetearFormularioMaterial() {
        el.formMaterial.reset();
        el.campoMaterialId.value = '';
        el.campoMaterialArchivoPathActual.value = '';
        el.campoMaterialNombreArchivoActual.value = '';
        el.campoMaterialOrden.value = String(materialesCache.length);
        el.campoMaterialCategoria.value = 'cuadernillos';
        el.campoMaterialPublicado.checked = false;
        archivoSeleccionadoMaterial = null;
        archivoEliminadoMaterial = false;
        ocultarErrorEn(el.archivoMaterialError);
        ocultarErrorEn(el.formMaterialError);
        ocultar(el.formMaterialGuardando);
        ocultar(el.archivoMaterialActualWrap);
        el.archivoMaterialActualNombre.textContent = '';
    }

    function abrirFormularioNuevoMaterial() {
        resetearFormularioMaterial();
        el.formMaterialTitulo.textContent = 'Nuevo material';
        mostrar(el.formMaterialOverlay);
        el.campoMaterialTitulo.focus();
    }

    function abrirFormularioEdicionMaterial(material) {
        resetearFormularioMaterial();
        el.formMaterialTitulo.textContent = 'Editar material';
        el.campoMaterialId.value = material.id;
        el.campoMaterialArchivoPathActual.value = material.archivo_path || '';
        el.campoMaterialNombreArchivoActual.value = material.nombre_archivo || '';
        el.campoMaterialTitulo.value = material.titulo || '';
        el.campoMaterialDescripcion.value = material.descripcion || '';
        el.campoMaterialCategoria.value = material.categoria || 'cuadernillos';
        el.campoMaterialOrden.value = String(material.orden);
        el.campoMaterialPublicado.checked = !!material.publicado;

        if (material.archivo_path) {
            el.archivoMaterialActualNombre.textContent = 'Archivo actual: ' + (material.nombre_archivo || material.archivo_path);
            mostrar(el.archivoMaterialActualWrap);
        }

        mostrar(el.formMaterialOverlay);
        el.campoMaterialTitulo.focus();
    }

    function cerrarFormularioMaterial() {
        ocultar(el.formMaterialOverlay);
        resetearFormularioMaterial();
    }

    function manejarCambioArchivoMaterial() {
        ocultarErrorEn(el.archivoMaterialError);
        var file = el.campoMaterialArchivo.files && el.campoMaterialArchivo.files[0];
        if (!file) return;

        var errorValidacion = validarArchivoMaterial(file);
        if (errorValidacion) {
            mostrarErrorEn(el.archivoMaterialError, errorValidacion);
            el.campoMaterialArchivo.value = '';
            archivoSeleccionadoMaterial = null;
            return;
        }

        archivoSeleccionadoMaterial = file;
        archivoEliminadoMaterial = false;
        el.archivoMaterialActualNombre.textContent = 'Archivo nuevo: ' + file.name;
        mostrar(el.archivoMaterialActualWrap);
    }

    function manejarQuitarArchivoMaterial() {
        archivoSeleccionadoMaterial = null;
        archivoEliminadoMaterial = true;
        el.campoMaterialArchivo.value = '';
        el.archivoMaterialActualNombre.textContent = '';
        ocultar(el.archivoMaterialActualWrap);
        ocultarErrorEn(el.archivoMaterialError);
    }

    async function manejarSubmitFormularioMaterial(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.formMaterialError);

        var titulo = el.campoMaterialTitulo.value.trim();
        var categoria = el.campoMaterialCategoria.value;
        var orden = parseInt(el.campoMaterialOrden.value, 10);

        if (!titulo) {
            mostrarErrorEn(el.formMaterialError, 'El título es obligatorio.');
            return;
        }
        if (['cuadernillos', 'impresion', 'guias', 'juegos'].indexOf(categoria) === -1) {
            mostrarErrorEn(el.formMaterialError, 'Elegí una categoría válida.');
            return;
        }
        if (isNaN(orden) || orden < 0) {
            mostrarErrorEn(el.formMaterialError, 'El orden debe ser un número mayor o igual a 0.');
            return;
        }
        if (archivoSeleccionadoMaterial) {
            var errorValidacion = validarArchivoMaterial(archivoSeleccionadoMaterial);
            if (errorValidacion) {
                mostrarErrorEn(el.formMaterialError, errorValidacion);
                return;
            }
        }

        el.btnGuardarMaterial.disabled = true;
        mostrar(el.formMaterialGuardando);

        try {
            var pathActual = el.campoMaterialArchivoPathActual.value || null;
            var archivoPathFinal = pathActual;
            var nombreArchivoFinal = el.campoMaterialNombreArchivoActual.value || null;
            var pathAEliminar = null;

            if (archivoSeleccionadoMaterial) {
                var pathNuevo = generarNombreArchivo(categoria, archivoSeleccionadoMaterial);
                var subida = await client.storage
                    .from(BUCKET_NAME_MATERIALES)
                    .upload(pathNuevo, archivoSeleccionadoMaterial, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: archivoSeleccionadoMaterial.type
                    });
                if (subida.error) throw subida.error;

                archivoPathFinal = pathNuevo;
                nombreArchivoFinal = archivoSeleccionadoMaterial.name;
                // Si se estaba reemplazando un archivo existente, el
                // anterior se borra recién DESPUÉS de guardar la fila con
                // éxito (más abajo), para no quedarse sin archivo si algo
                // falla en el medio.
                if (pathActual) pathAEliminar = pathActual;
            } else if (archivoEliminadoMaterial) {
                if (pathActual) pathAEliminar = pathActual;
                archivoPathFinal = null;
                nombreArchivoFinal = null;
            }

            var payload = {
                titulo: titulo,
                descripcion: el.campoMaterialDescripcion.value.trim() || null,
                categoria: categoria,
                orden: orden,
                archivo_path: archivoPathFinal,
                nombre_archivo: nombreArchivoFinal,
                publicado: el.campoMaterialPublicado.checked,
                updated_at: new Date().toISOString()
            };

            var idExistente = el.campoMaterialId.value;
            var resp;
            if (idExistente) {
                resp = await client.from('materiales').update(payload).eq('id', idExistente);
            } else {
                resp = await client.from('materiales').insert(payload);
            }
            if (resp.error) throw resp.error;

            // Recién ahora que la fila se guardó bien se borra el archivo
            // viejo de Storage (reemplazo) para no dejarlo huérfano.
            if (pathAEliminar) {
                try { await client.storage.from(BUCKET_NAME_MATERIALES).remove([pathAEliminar]); }
                catch (errArchivo) { console.warn('No se pudo eliminar el archivo anterior en Storage:', errArchivo); }
            }

            cerrarFormularioMaterial();
            await cargarMateriales();
            mostrarExitoMateriales(idExistente ? 'Material actualizado correctamente.' : 'Material creado correctamente.');
        } catch (err) {
            console.error('Error al guardar el material:', err);
            mostrarErrorEn(el.formMaterialError, mensajeErrorSupabase(err));
        } finally {
            el.btnGuardarMaterial.disabled = false;
            ocultar(el.formMaterialGuardando);
        }
    }

    // ---- Arranque: espera a que admin.js confirme sesión + permisos de
    // admin (momento en el que muestra #panel-section) para recién ahí
    // cargar Home y Qué ofrecemos. Nunca duplica la lógica de login. ----

    var yaCargado = false;

    function alConfirmarseSesion() {
        if (yaCargado) return;
        yaCargado = true;
        cargarHome();
        cargarOfrecemos();
        cargarCiencia();
        cargarEquipo();
        cargarConfigMateriales();
        cargarMateriales();
    }

    function observarPanel() {
        if (!el.panelSection) return;

        if (!el.panelSection.hidden) {
            alConfirmarseSesion();
            return;
        }

        var observer = new MutationObserver(function () {
            if (!el.panelSection.hidden) {
                alConfirmarseSesion();
            } else {
                // Se cerró la sesión: la próxima vez que se muestre el panel,
                // se vuelve a cargar todo desde cero.
                yaCargado = false;
            }
        });
        observer.observe(el.panelSection, { attributes: true, attributeFilter: ['hidden'] });
    }

    function iniciar() {
        // Reutiliza el cliente ya creado por admin.js (mismo origen/localStorage)
        // en vez de instanciar uno nuevo, para no disparar la advertencia
        // "Multiple GoTrueClient instances detected". Si por algún motivo
        // admin.js todavía no lo creó (orden de carga distinto, error previo),
        // se crea uno propio como respaldo para no romper este panel.
        if (window.KALULU_ADMIN_CLIENT) {
            client = window.KALULU_ADMIN_CLIENT;
        } else {
            var cfg = window.KALULU_SUPABASE_CONFIG;
            if (!cfg || typeof supabase === 'undefined' || !supabase.createClient) return;
            client = supabase.createClient(cfg.url, cfg.publishableKey);
            window.KALULU_ADMIN_CLIENT = client;
        }

        cachearElementos();
        if (!el.panelSection) return; // el HTML no tiene las secciones nuevas todavía

        iniciarTabs();
        observarPanel();

        el.formHome.addEventListener('submit', guardarHome);

        el.btnNuevoRecurso.addEventListener('click', abrirFormularioNuevoRecurso);
        el.btnCancelarRecurso.addEventListener('click', cerrarFormularioRecurso);
        el.formRecurso.addEventListener('submit', manejarSubmitFormularioRecurso);
        el.campoRecursoImagen.addEventListener('change', manejarCambioImagenRecurso);
        el.btnQuitarImagenRecurso.addEventListener('click', manejarQuitarImagenRecurso);
        el.formRecursoOverlay.addEventListener('click', function (evento) {
            if (evento.target === el.formRecursoOverlay) cerrarFormularioRecurso();
        });

        if (el.btnNuevaPregunta) el.btnNuevaPregunta.addEventListener('click', abrirFormularioNuevaPregunta);
        if (el.btnCancelarPregunta) el.btnCancelarPregunta.addEventListener('click', cerrarFormularioPregunta);
        if (el.formPregunta) el.formPregunta.addEventListener('submit', manejarSubmitFormularioPregunta);
        if (el.formPreguntaOverlay) {
            el.formPreguntaOverlay.addEventListener('click', function (evento) {
                if (evento.target === el.formPreguntaOverlay) cerrarFormularioPregunta();
            });
        }

        if (el.btnNuevoIntegrante) el.btnNuevoIntegrante.addEventListener('click', abrirFormularioNuevoIntegrante);
        if (el.btnCancelarIntegrante) el.btnCancelarIntegrante.addEventListener('click', cerrarFormularioIntegrante);
        if (el.formIntegrante) el.formIntegrante.addEventListener('submit', manejarSubmitFormularioIntegrante);
        if (el.campoIntegranteImagen) el.campoIntegranteImagen.addEventListener('change', manejarCambioImagenIntegrante);
        if (el.btnQuitarImagenIntegrante) el.btnQuitarImagenIntegrante.addEventListener('click', manejarQuitarImagenIntegrante);
        if (el.formIntegranteOverlay) {
            el.formIntegranteOverlay.addEventListener('click', function (evento) {
                if (evento.target === el.formIntegranteOverlay) cerrarFormularioIntegrante();
            });
        }

        if (el.formMaterialesConfig) el.formMaterialesConfig.addEventListener('submit', guardarConfigMateriales);

        if (el.btnNuevoMaterial) el.btnNuevoMaterial.addEventListener('click', abrirFormularioNuevoMaterial);
        if (el.btnCancelarMaterial) el.btnCancelarMaterial.addEventListener('click', cerrarFormularioMaterial);
        if (el.formMaterial) el.formMaterial.addEventListener('submit', manejarSubmitFormularioMaterial);
        if (el.campoMaterialArchivo) el.campoMaterialArchivo.addEventListener('change', manejarCambioArchivoMaterial);
        if (el.btnQuitarArchivoMaterial) el.btnQuitarArchivoMaterial.addEventListener('click', manejarQuitarArchivoMaterial);
        if (el.formMaterialOverlay) {
            el.formMaterialOverlay.addEventListener('click', function (evento) {
                if (evento.target === el.formMaterialOverlay) cerrarFormularioMaterial();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
