// Panel de administración de Noticias — Kalulu Argentina.
// HTML/CSS/JS vanilla, sin frameworks. Habla directo con Supabase usando la
// Publishable Key (pública por diseño). La seguridad real la hacen las
// políticas de Row Level Security configuradas en Supabase: este archivo
// nunca decide "quién puede escribir", solo pide y muestra lo que Supabase
// permite o rechaza.
(function () {
    'use strict';

    var BUCKET_NAME = 'noticias-imagenes';
    var BUCKET_NAME_EVENTOS = 'eventos-imagenes';
    var TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
    var TAMANO_IMAGEN_MAXIMO = 5 * 1024 * 1024; // 5MB

    var client = null;

    // Estado en memoria del panel — Noticias
    var noticiasCache = [];
    var imagenSeleccionada = null; // File nuevo elegido en el formulario
    var imagenEliminada = false;   // true si el admin apretó "Quitar imagen"

    // Estado en memoria del panel — Eventos
    var eventosCache = [];
    var imagenSeleccionadaEvento = null;
    var imagenEliminadaEvento = false;

    // ---- Referencias al DOM ----
    var el = {};

    function cachearElementos() {
        el.btnLogout = document.getElementById('btn-logout');

        el.loginSection = document.getElementById('login-section');
        el.loginForm = document.getElementById('login-form');
        el.loginEmail = document.getElementById('login-email');
        el.loginPassword = document.getElementById('login-password');
        el.loginError = document.getElementById('login-error');
        el.btnLogin = document.getElementById('btn-login');

        el.panelSection = document.getElementById('panel-section');
        el.panelMensaje = document.getElementById('panel-mensaje');
        el.panelCargando = document.getElementById('panel-cargando');
        el.btnNuevaNoticia = document.getElementById('btn-nueva-noticia');
        el.tabla = document.getElementById('tabla-noticias');
        el.tablaBody = document.getElementById('tabla-noticias-body');
        el.listaVacia = document.getElementById('lista-vacia');

        el.formOverlay = document.getElementById('form-noticia-overlay');
        el.form = document.getElementById('form-noticia');
        el.formTitulo = document.getElementById('form-noticia-titulo');
        el.campoId = document.getElementById('campo-id');
        el.campoImagenUrlActual = document.getElementById('campo-imagen-url-actual');
        el.campoTitulo = document.getElementById('campo-titulo');
        el.campoDescripcion = document.getElementById('campo-descripcion');
        el.campoFecha = document.getElementById('campo-fecha');
        el.campoLink = document.getElementById('campo-link');
        el.campoImagen = document.getElementById('campo-imagen');
        el.imagenError = document.getElementById('imagen-error');
        el.previewWrap = document.getElementById('preview-imagen-wrap');
        el.previewImg = document.getElementById('preview-imagen');
        el.btnQuitarImagen = document.getElementById('btn-quitar-imagen');
        el.campoPublicada = document.getElementById('campo-publicada');
        el.formError = document.getElementById('form-error');
        el.formGuardando = document.getElementById('form-guardando');
        el.btnGuardar = document.getElementById('btn-guardar');
        el.btnCancelar = document.getElementById('btn-cancelar');

        // Tabs
        el.tabNoticias = document.getElementById('tab-noticias');
        el.tabEventos = document.getElementById('tab-eventos');
        el.panelNoticias = document.getElementById('panel-noticias');
        el.panelEventos = document.getElementById('panel-eventos');

        // Eventos — listado
        el.panelEventosMensaje = document.getElementById('panel-eventos-mensaje');
        el.panelEventosAccion = document.getElementById('panel-eventos-accion');
        el.panelEventosCargando = document.getElementById('panel-eventos-cargando');
        el.btnNuevoEvento = document.getElementById('btn-nuevo-evento');
        el.tablaEventos = document.getElementById('tabla-eventos');
        el.tablaEventosBody = document.getElementById('tabla-eventos-body');
        el.listaEventosVacia = document.getElementById('lista-eventos-vacia');

        // Eventos — formulario
        el.formEventoOverlay = document.getElementById('form-evento-overlay');
        el.formEvento = document.getElementById('form-evento');
        el.formEventoTitulo = document.getElementById('form-evento-titulo');
        el.campoEventoId = document.getElementById('campo-evento-id');
        el.campoEventoImagenUrlActual = document.getElementById('campo-evento-imagen-url-actual');
        el.campoEventoTitulo = document.getElementById('campo-evento-titulo');
        el.campoEventoDescripcion = document.getElementById('campo-evento-descripcion');
        el.campoEventoFecha = document.getElementById('campo-evento-fecha');
        el.campoEventoHora = document.getElementById('campo-evento-hora');
        el.campoEventoHoraFin = document.getElementById('campo-evento-hora-fin');
        el.horaFinError = document.getElementById('hora-fin-error');
        el.campoEventoLink = document.getElementById('campo-evento-link');
        el.campoEventoImagen = document.getElementById('campo-evento-imagen');
        el.imagenEventoError = document.getElementById('imagen-evento-error');
        el.previewEventoWrap = document.getElementById('preview-imagen-evento-wrap');
        el.previewEventoImg = document.getElementById('preview-imagen-evento');
        el.btnQuitarImagenEvento = document.getElementById('btn-quitar-imagen-evento');
        el.campoEventoPublicado = document.getElementById('campo-evento-publicado');
        el.formEventoError = document.getElementById('form-evento-error');
        el.formEventoGuardando = document.getElementById('form-evento-guardando');
        el.btnGuardarEvento = document.getElementById('btn-guardar-evento');
        el.btnCancelarEvento = document.getElementById('btn-cancelar-evento');
    }

    // ---- Utilidades ----

    function formatearFecha(fechaStr) {
        // Mismo criterio que el sitio público: una fecha YYYY-MM-DD se parsea
        // como fecha calendario LOCAL, nunca como UTC (evita el corrimiento
        // de un día en timezones negativos, como Argentina).
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

    function formatearHora(horaStr) {
        // "hora" viene de Postgres como "HH:MM:SS" (o vacío/null si no se cargó).
        var m = /^(\d{2}):(\d{2})/.exec(horaStr || '');
        return m ? (m[1] + ':' + m[2] + ' hs') : '';
    }

    function formatearFechaHora(fechaStr, horaStr, horaFinStr) {
        var fecha = formatearFecha(fechaStr);
        var hora = formatearHora(horaStr);
        var horaFin = formatearHora(horaFinStr);
        if (!fecha) return '';
        if (!hora) return fecha;
        // "19:00 hs" + "21:00 hs" -> "19:00 – 21:00 hs" (evita repetir "hs" dos veces).
        var horaTexto = horaFin ? (hora.replace(' hs', '') + ' – ' + horaFin) : hora;
        return fecha + ' · ' + horaTexto;
    }

    function hoyLocalISO() {
        var d = new Date();
        var mes = String(d.getMonth() + 1).padStart(2, '0');
        var dia = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + mes + '-' + dia;
    }

    function mostrar(elemento) { elemento.hidden = false; }
    function ocultar(elemento) { elemento.hidden = true; }

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
        // Traduce los errores más comunes a algo legible; si no lo reconoce,
        // muestra un mensaje genérico (nunca texto crudo de Postgres al admin).
        if (!err) return 'Ocurrió un error inesperado.';
        var msg = (err.message || '').toLowerCase();
        if (msg.indexOf('invalid login credentials') !== -1) {
            return 'Email o contraseña incorrectos.';
        }
        if (msg.indexOf('row-level security') !== -1 || err.code === '42501' || err.code === 'PGRST301') {
            return 'No tenés permisos para realizar esta acción.';
        }
        if (msg.indexOf('failed to fetch') !== -1 || msg.indexOf('networkerror') !== -1) {
            return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
        }
        return 'Ocurrió un error: ' + (err.message || 'intentá de nuevo.');
    }

    function extraerPathDeUrlPublica(url, bucketName) {
        // Convierte una URL pública de Storage en el "path" interno del bucket,
        // para poder borrar el archivo. Si la URL no pertenece a nuestro bucket
        // (por ejemplo, alguien cargó una imagen externa a mano), devuelve null.
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

    function urlHttpValida(url) {
        // Mismo criterio que ya usa index.html (esUrlHttpValida) para decidir
        // si muestra el botón "Inscribite": solo http/https son válidos.
        if (!url) return false;
        try {
            var u = new URL(url, window.location.href);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    // ---- Autenticación ----

    function iniciarClienteSupabase() {
        var cfg = window.KALULU_SUPABASE_CONFIG;
        if (!cfg || typeof supabase === 'undefined' || !supabase.createClient) {
            mostrarErrorEn(el.loginError, 'No pudimos inicializar la conexión con Supabase. Recargá la página.');
            el.btnLogin.disabled = true;
            return false;
        }
        client = supabase.createClient(cfg.url, cfg.publishableKey);
        // Se expone en window para que admin-extra.js reutilice esta MISMA
        // instancia en vez de crear la suya propia: dos clientes separados
        // sobre el mismo localStorage disparaban la advertencia "Multiple
        // GoTrueClient instances detected".
        window.KALULU_ADMIN_CLIENT = client;
        return true;
    }

    async function manejarLogin(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.loginError);
        el.btnLogin.disabled = true;
        el.btnLogin.textContent = 'Ingresando...';

        try {
            var resp = await client.auth.signInWithPassword({
                email: el.loginEmail.value.trim(),
                password: el.loginPassword.value
            });
            if (resp.error) throw resp.error;
            // El listener onAuthStateChange se encarga de mostrar el panel.
        } catch (err) {
            mostrarErrorEn(el.loginError, mensajeErrorSupabase(err));
        } finally {
            el.btnLogin.disabled = false;
            el.btnLogin.textContent = 'Ingresar';
        }
    }

    async function manejarLogout() {
        try {
            await client.auth.signOut();
        } catch (err) {
            console.error('Error al cerrar sesión:', err);
        }
        // onAuthStateChange se encarga de volver a mostrar el login.
    }

    async function esAdmin() {
        try {
            var resp = await client.rpc('is_admin');
            if (resp.error) throw resp.error;
            return resp.data === true;
        } catch (err) {
            console.error('Error verificando permisos de administrador:', err);
            return false;
        }
    }

    async function alIniciarSesionValida() {
        mostrar(el.btnLogout);
        ocultar(el.loginSection);
        mostrar(el.panelSection);
        ocultar(el.panelMensaje);
        mostrar(el.panelCargando);
        ocultar(el.tabla);
        ocultar(el.listaVacia);

        var admin = await esAdmin();
        if (!admin) {
            // No puede hacer nada útil en el panel: lo desconectamos y mostramos
            // el motivo en la pantalla de login (a la que vuelve tras el signOut,
            // que además deja oculto el panel donde estaba este mensaje).
            await client.auth.signOut();
            mostrarErrorEn(el.loginError, 'Tu cuenta no tiene permisos de administrador. Contactá a quien gestiona el sitio.');
            return;
        }

        cambiarTab('noticias');
        await cargarNoticias();
        await cargarEventos();
    }

    function alCerrarSesion() {
        ocultar(el.btnLogout);
        ocultar(el.panelSection);
        mostrar(el.loginSection);
        cerrarFormulario();
        cerrarFormularioEvento();
        cambiarTab('noticias');
        el.loginForm.reset();
        ocultarErrorEn(el.loginError);
    }

    // ---- Listado de noticias ----

    async function cargarNoticias() {
        ocultar(el.panelMensaje);
        mostrar(el.panelCargando);
        ocultar(el.tabla);
        ocultar(el.listaVacia);

        try {
            var resp = await client
                .from('noticias')
                .select('id, titulo, descripcion, fecha, imagen_url, link, publicada')
                .order('fecha', { ascending: false });

            if (resp.error) throw resp.error;

            noticiasCache = resp.data || [];
            ocultar(el.panelCargando);

            if (noticiasCache.length === 0) {
                el.tablaBody.innerHTML = '';
                mostrar(el.listaVacia);
                return;
            }

            renderizarTabla();
            mostrar(el.tabla);
        } catch (err) {
            console.error('Error al cargar noticias:', err);
            ocultar(el.panelCargando);
            mostrarErrorPanel(el.panelMensaje, mensajeErrorSupabase(err));
        }
    }

    function renderizarTabla() {
        el.tablaBody.innerHTML = '';

        noticiasCache.forEach(function (noticia) {
            var tr = document.createElement('tr');

            // Imagen
            var tdImg = document.createElement('td');
            if (noticia.imagen_url) {
                var img = document.createElement('img');
                img.src = noticia.imagen_url;
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

            // Título
            var tdTitulo = document.createElement('td');
            tdTitulo.textContent = noticia.titulo || '(sin título)';
            tr.appendChild(tdTitulo);

            // Fecha
            var tdFecha = document.createElement('td');
            tdFecha.textContent = formatearFecha(noticia.fecha);
            tr.appendChild(tdFecha);

            // Estado
            var tdEstado = document.createElement('td');
            var estado = document.createElement('span');
            estado.className = 'admin-estado ' + (noticia.publicada ? 'publicada' : 'borrador');
            estado.textContent = noticia.publicada ? 'Publicada' : 'Borrador';
            tdEstado.appendChild(estado);
            tr.appendChild(tdEstado);

            // Acciones
            var tdAcciones = document.createElement('td');

            var btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'btn-admin-chico';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', function () { abrirFormularioEdicion(noticia); });
            tdAcciones.appendChild(btnEditar);

            var btnToggle = document.createElement('button');
            btnToggle.type = 'button';
            btnToggle.className = 'btn-admin-chico';
            btnToggle.textContent = noticia.publicada ? 'Despublicar' : 'Publicar';
            btnToggle.addEventListener('click', function () { alternarPublicada(noticia); });
            tdAcciones.appendChild(btnToggle);

            var btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'btn-admin-chico peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', function () { eliminarNoticia(noticia); });
            tdAcciones.appendChild(btnEliminar);

            tr.appendChild(tdAcciones);

            el.tablaBody.appendChild(tr);
        });
    }

    // ---- Publicar / despublicar ----

    async function alternarPublicada(noticia) {
        var nuevoValor = !noticia.publicada;
        try {
            var resp = await client
                .from('noticias')
                .update({ publicada: nuevoValor })
                .eq('id', noticia.id);
            if (resp.error) throw resp.error;
            await cargarNoticias();
        } catch (err) {
            console.error('Error al publicar/despublicar:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    // ---- Eliminar ----

    async function eliminarNoticia(noticia) {
        var confirmado = window.confirm(
            'Vas a eliminar la noticia "' + (noticia.titulo || 'sin título') + '".\n' +
            'Esta acción no se puede deshacer. ¿Confirmás?'
        );
        if (!confirmado) return;

        try {
            var resp = await client.from('noticias').delete().eq('id', noticia.id);
            if (resp.error) throw resp.error;

            // Intento best-effort de borrar la imagen asociada en Storage.
            var path = extraerPathDeUrlPublica(noticia.imagen_url, BUCKET_NAME);
            if (path) {
                try {
                    await client.storage.from(BUCKET_NAME).remove([path]);
                } catch (errImg) {
                    console.warn('No se pudo eliminar la imagen asociada en Storage:', errImg);
                }
            }

            await cargarNoticias();
        } catch (err) {
            console.error('Error al eliminar noticia:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    // ---- Formulario crear / editar ----

    function resetearFormulario() {
        el.form.reset();
        el.campoId.value = '';
        el.campoImagenUrlActual.value = '';
        el.campoFecha.value = hoyLocalISO();
        imagenSeleccionada = null;
        imagenEliminada = false;
        ocultarErrorEn(el.imagenError);
        ocultarErrorEn(el.formError);
        ocultar(el.formGuardando);
        ocultar(el.previewWrap);
        el.previewImg.src = '';
    }

    function abrirFormularioNueva() {
        resetearFormulario();
        el.formTitulo.textContent = 'Nueva noticia';
        mostrar(el.formOverlay);
        el.campoTitulo.focus();
    }

    function abrirFormularioEdicion(noticia) {
        resetearFormulario();
        el.formTitulo.textContent = 'Editar noticia';
        el.campoId.value = noticia.id;
        el.campoImagenUrlActual.value = noticia.imagen_url || '';
        el.campoTitulo.value = noticia.titulo || '';
        el.campoDescripcion.value = noticia.descripcion || '';
        el.campoFecha.value = noticia.fecha || hoyLocalISO();
        el.campoLink.value = noticia.link || '';
        el.campoPublicada.checked = !!noticia.publicada;

        if (noticia.imagen_url) {
            el.previewImg.src = noticia.imagen_url;
            mostrar(el.previewWrap);
        }

        mostrar(el.formOverlay);
        el.campoTitulo.focus();
    }

    function cerrarFormulario() {
        ocultar(el.formOverlay);
        resetearFormulario();
    }

    function manejarCambioImagen() {
        ocultarErrorEn(el.imagenError);
        var file = el.campoImagen.files && el.campoImagen.files[0];
        if (!file) return;

        var errorValidacion = validarImagen(file);
        if (errorValidacion) {
            mostrarErrorEn(el.imagenError, errorValidacion);
            el.campoImagen.value = '';
            imagenSeleccionada = null;
            return;
        }

        imagenSeleccionada = file;
        imagenEliminada = false;
        el.previewImg.src = URL.createObjectURL(file);
        mostrar(el.previewWrap);
    }

    function manejarQuitarImagen() {
        imagenSeleccionada = null;
        imagenEliminada = true;
        el.campoImagen.value = '';
        el.previewImg.src = '';
        ocultar(el.previewWrap);
        ocultarErrorEn(el.imagenError);
    }

    async function manejarSubmitFormulario(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.formError);

        var titulo = el.campoTitulo.value.trim();
        var fecha = el.campoFecha.value;

        if (!titulo) {
            mostrarErrorEn(el.formError, 'El título es obligatorio.');
            return;
        }
        if (!fecha) {
            mostrarErrorEn(el.formError, 'La fecha es obligatoria.');
            return;
        }

        // Revalidamos la imagen por las dudas (defensa en profundidad, además
        // de la validación que ya se hizo al elegir el archivo).
        if (imagenSeleccionada) {
            var errorValidacion = validarImagen(imagenSeleccionada);
            if (errorValidacion) {
                mostrarErrorEn(el.formError, errorValidacion);
                return;
            }
        }

        el.btnGuardar.disabled = true;
        mostrar(el.formGuardando);

        try {
            var imagenUrlFinal = el.campoImagenUrlActual.value || null;

            if (imagenSeleccionada) {
                var path = generarNombreArchivo('noticias', imagenSeleccionada);
                var subida = await client.storage
                    .from(BUCKET_NAME)
                    .upload(path, imagenSeleccionada, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: imagenSeleccionada.type
                    });
                if (subida.error) throw subida.error;

                var urlPublica = client.storage.from(BUCKET_NAME).getPublicUrl(path);
                imagenUrlFinal = urlPublica.data.publicUrl;
            } else if (imagenEliminada) {
                imagenUrlFinal = null;
            }

            var payload = {
                titulo: titulo,
                descripcion: el.campoDescripcion.value.trim() || null,
                fecha: fecha,
                link: el.campoLink.value.trim() || null,
                imagen_url: imagenUrlFinal,
                publicada: el.campoPublicada.checked
            };

            var idExistente = el.campoId.value;
            var resp;
            if (idExistente) {
                resp = await client.from('noticias').update(payload).eq('id', idExistente);
            } else {
                resp = await client.from('noticias').insert(payload);
            }
            if (resp.error) throw resp.error;

            cerrarFormulario();
            await cargarNoticias();
        } catch (err) {
            console.error('Error al guardar la noticia:', err);
            mostrarErrorEn(el.formError, mensajeErrorSupabase(err));
        } finally {
            el.btnGuardar.disabled = false;
            ocultar(el.formGuardando);
        }
    }

    // ---- Tabs (Noticias / Eventos) ----

    function cambiarTab(nombre) {
        var esNoticias = nombre === 'noticias';
        el.tabNoticias.classList.toggle('activa', esNoticias);
        el.tabEventos.classList.toggle('activa', !esNoticias);
        el.tabNoticias.setAttribute('aria-selected', esNoticias ? 'true' : 'false');
        el.tabEventos.setAttribute('aria-selected', esNoticias ? 'false' : 'true');
        el.panelNoticias.hidden = !esNoticias;
        el.panelEventos.hidden = esNoticias;
    }

    // ---- Feedback de acciones sobre eventos (crear/editar/publicar/eliminar) ----
    // Mensaje breve de confirmación, separado del mensaje de error de carga
    // (panelEventosMensaje) para que no se pisen entre sí: uno informa el
    // resultado de "cargar la lista", el otro el resultado de "la última
    // acción que hizo el admin".

    var timeoutMensajeEventoAccion = null;

    function mostrarExitoEventoAccion(mensaje) {
        if (timeoutMensajeEventoAccion) clearTimeout(timeoutMensajeEventoAccion);
        el.panelEventosAccion.textContent = mensaje;
        mostrar(el.panelEventosAccion);
        timeoutMensajeEventoAccion = setTimeout(function () {
            ocultar(el.panelEventosAccion);
        }, 3000);
    }

    // ---- Listado de eventos ----

    async function cargarEventos() {
        ocultar(el.panelEventosMensaje);
        ocultar(el.panelEventosAccion);
        mostrar(el.panelEventosCargando);
        ocultar(el.tablaEventos);
        ocultar(el.listaEventosVacia);

        try {
            var resp = await client
                .from('eventos')
                .select('id, titulo, descripcion, fecha, hora, hora_fin, imagen_url, link_inscripcion, publicado')
                .order('fecha', { ascending: false });

            if (resp.error) throw resp.error;

            eventosCache = resp.data || [];
            ocultar(el.panelEventosCargando);

            if (eventosCache.length === 0) {
                el.tablaEventosBody.innerHTML = '';
                mostrar(el.listaEventosVacia);
                return;
            }

            renderizarTablaEventos();
            mostrar(el.tablaEventos);
        } catch (err) {
            console.error('Error al cargar eventos:', err);
            ocultar(el.panelEventosCargando);
            mostrarErrorPanel(el.panelEventosMensaje, mensajeErrorSupabase(err));
        }
    }

    function renderizarTablaEventos() {
        el.tablaEventosBody.innerHTML = '';

        eventosCache.forEach(function (evento) {
            var tr = document.createElement('tr');

            // Imagen
            var tdImg = document.createElement('td');
            if (evento.imagen_url) {
                var img = document.createElement('img');
                img.src = evento.imagen_url;
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

            // Título
            var tdTitulo = document.createElement('td');
            tdTitulo.textContent = evento.titulo || '(sin título)';
            tr.appendChild(tdTitulo);

            // Fecha (+ hora si tiene)
            var tdFecha = document.createElement('td');
            tdFecha.textContent = formatearFechaHora(evento.fecha, evento.hora, evento.hora_fin);
            tr.appendChild(tdFecha);

            // Estado
            var tdEstado = document.createElement('td');
            var estado = document.createElement('span');
            estado.className = 'admin-estado ' + (evento.publicado ? 'publicada' : 'borrador');
            estado.textContent = evento.publicado ? 'Publicado' : 'Borrador';
            tdEstado.appendChild(estado);
            tr.appendChild(tdEstado);

            // Acciones
            var tdAcciones = document.createElement('td');

            var btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'btn-admin-chico';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', function () { abrirFormularioEdicionEvento(evento); });
            tdAcciones.appendChild(btnEditar);

            var btnToggle = document.createElement('button');
            btnToggle.type = 'button';
            btnToggle.className = 'btn-admin-chico';
            btnToggle.textContent = evento.publicado ? 'Despublicar' : 'Publicar';
            btnToggle.addEventListener('click', function () { alternarPublicadoEvento(evento); });
            tdAcciones.appendChild(btnToggle);

            var btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'btn-admin-chico peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', function () { eliminarEvento(evento); });
            tdAcciones.appendChild(btnEliminar);

            tr.appendChild(tdAcciones);

            el.tablaEventosBody.appendChild(tr);
        });
    }

    // ---- Publicar / despublicar evento ----

    async function alternarPublicadoEvento(evento) {
        var nuevoValor = !evento.publicado;
        try {
            var resp = await client
                .from('eventos')
                .update({ publicado: nuevoValor })
                .eq('id', evento.id);
            if (resp.error) throw resp.error;
            await cargarEventos();
            mostrarExitoEventoAccion(nuevoValor ? 'Evento publicado.' : 'Evento despublicado.');
        } catch (err) {
            console.error('Error al publicar/despublicar evento:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    // ---- Eliminar evento ----

    async function eliminarEvento(evento) {
        var confirmado = window.confirm(
            'Vas a eliminar el evento "' + (evento.titulo || 'sin título') + '".\n' +
            'Esta acción no se puede deshacer. ¿Confirmás?'
        );
        if (!confirmado) return;

        try {
            var resp = await client.from('eventos').delete().eq('id', evento.id);
            if (resp.error) throw resp.error;

            // Intento best-effort de borrar la imagen asociada en Storage.
            var path = extraerPathDeUrlPublica(evento.imagen_url, BUCKET_NAME_EVENTOS);
            if (path) {
                try {
                    await client.storage.from(BUCKET_NAME_EVENTOS).remove([path]);
                } catch (errImg) {
                    console.warn('No se pudo eliminar la imagen asociada en Storage:', errImg);
                }
            }

            await cargarEventos();
            mostrarExitoEventoAccion('Evento eliminado correctamente.');
        } catch (err) {
            console.error('Error al eliminar evento:', err);
            alert(mensajeErrorSupabase(err));
        }
    }

    // ---- Formulario crear / editar evento ----

    function resetearFormularioEvento() {
        el.formEvento.reset();
        el.campoEventoId.value = '';
        el.campoEventoImagenUrlActual.value = '';
        el.campoEventoFecha.value = hoyLocalISO();
        el.campoEventoHora.value = '';
        el.campoEventoHoraFin.value = '';
        el.campoEventoPublicado.checked = true; // "publicado" es true por defecto (ver etapa3_eventos_setup.sql)
        imagenSeleccionadaEvento = null;
        imagenEliminadaEvento = false;
        ocultarErrorEn(el.imagenEventoError);
        ocultarErrorEn(el.horaFinError);
        ocultarErrorEn(el.formEventoError);
        ocultar(el.formEventoGuardando);
        ocultar(el.previewEventoWrap);
        el.previewEventoImg.src = '';
    }

    function abrirFormularioNuevaEvento() {
        resetearFormularioEvento();
        el.formEventoTitulo.textContent = 'Nuevo evento';
        mostrar(el.formEventoOverlay);
        el.campoEventoTitulo.focus();
    }

    function abrirFormularioEdicionEvento(evento) {
        resetearFormularioEvento();
        el.formEventoTitulo.textContent = 'Editar evento';
        el.campoEventoId.value = evento.id;
        el.campoEventoImagenUrlActual.value = evento.imagen_url || '';
        el.campoEventoTitulo.value = evento.titulo || '';
        el.campoEventoDescripcion.value = evento.descripcion || '';
        el.campoEventoFecha.value = evento.fecha || hoyLocalISO();
        // "hora"/"hora_fin" vienen de Postgres como "HH:MM:SS"; <input type="time"> espera "HH:MM".
        el.campoEventoHora.value = evento.hora ? evento.hora.slice(0, 5) : '';
        el.campoEventoHoraFin.value = evento.hora_fin ? evento.hora_fin.slice(0, 5) : '';
        el.campoEventoLink.value = evento.link_inscripcion || '';
        el.campoEventoPublicado.checked = !!evento.publicado;

        if (evento.imagen_url) {
            el.previewEventoImg.src = evento.imagen_url;
            mostrar(el.previewEventoWrap);
        }

        mostrar(el.formEventoOverlay);
        el.campoEventoTitulo.focus();
    }

    function cerrarFormularioEvento() {
        ocultar(el.formEventoOverlay);
        resetearFormularioEvento();
    }

    function manejarCambioImagenEvento() {
        ocultarErrorEn(el.imagenEventoError);
        var file = el.campoEventoImagen.files && el.campoEventoImagen.files[0];
        if (!file) return;

        var errorValidacion = validarImagen(file);
        if (errorValidacion) {
            mostrarErrorEn(el.imagenEventoError, errorValidacion);
            el.campoEventoImagen.value = '';
            imagenSeleccionadaEvento = null;
            return;
        }

        imagenSeleccionadaEvento = file;
        imagenEliminadaEvento = false;
        el.previewEventoImg.src = URL.createObjectURL(file);
        mostrar(el.previewEventoWrap);
    }

    function manejarQuitarImagenEvento() {
        imagenSeleccionadaEvento = null;
        imagenEliminadaEvento = true;
        el.campoEventoImagen.value = '';
        el.previewEventoImg.src = '';
        ocultar(el.previewEventoWrap);
        ocultarErrorEn(el.imagenEventoError);
    }

    async function manejarSubmitFormularioEvento(evento) {
        evento.preventDefault();
        ocultarErrorEn(el.formEventoError);
        ocultarErrorEn(el.horaFinError);

        var titulo = el.campoEventoTitulo.value.trim();
        var fecha = el.campoEventoFecha.value;
        var hora = el.campoEventoHora.value; // "" si está vacío
        var horaFin = el.campoEventoHoraFin.value; // "" si está vacío

        if (!titulo) {
            mostrarErrorEn(el.formEventoError, 'El título es obligatorio.');
            return;
        }
        if (!fecha) {
            mostrarErrorEn(el.formEventoError, 'La fecha es obligatoria.');
            return;
        }
        // Ambas son horas del mismo día (todavía no soportamos eventos que
        // crucen la medianoche), así que alcanza con comparar "HH:MM" como texto.
        if (hora && horaFin && horaFin <= hora) {
            mostrarErrorEn(el.horaFinError, 'La hora de finalización debe ser posterior a la hora de inicio.');
            return;
        }

        var linkInscripcion = el.campoEventoLink.value.trim();
        if (linkInscripcion && !urlHttpValida(linkInscripcion)) {
            mostrarErrorEn(el.formEventoError, 'El link de inscripción debe ser una URL http o https válida.');
            return;
        }

        // Revalidamos la imagen por las dudas (defensa en profundidad, además
        // de la validación que ya se hizo al elegir el archivo).
        if (imagenSeleccionadaEvento) {
            var errorValidacion = validarImagen(imagenSeleccionadaEvento);
            if (errorValidacion) {
                mostrarErrorEn(el.formEventoError, errorValidacion);
                return;
            }
        }

        el.btnGuardarEvento.disabled = true;
        mostrar(el.formEventoGuardando);

        try {
            var imagenUrlFinal = el.campoEventoImagenUrlActual.value || null;

            if (imagenSeleccionadaEvento) {
                var path = generarNombreArchivo('eventos', imagenSeleccionadaEvento);
                var subida = await client.storage
                    .from(BUCKET_NAME_EVENTOS)
                    .upload(path, imagenSeleccionadaEvento, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: imagenSeleccionadaEvento.type
                    });
                if (subida.error) throw subida.error;

                var urlPublica = client.storage.from(BUCKET_NAME_EVENTOS).getPublicUrl(path);
                imagenUrlFinal = urlPublica.data.publicUrl;
            } else if (imagenEliminadaEvento) {
                imagenUrlFinal = null;
            }

            var payload = {
                titulo: titulo,
                descripcion: el.campoEventoDescripcion.value.trim() || null,
                fecha: fecha,
                hora: hora || null,
                hora_fin: horaFin || null,
                link_inscripcion: linkInscripcion || null,
                imagen_url: imagenUrlFinal,
                publicado: el.campoEventoPublicado.checked
            };

            var idExistente = el.campoEventoId.value;
            var eraEdicion = !!idExistente;
            var resp;
            if (idExistente) {
                resp = await client.from('eventos').update(payload).eq('id', idExistente);
            } else {
                resp = await client.from('eventos').insert(payload);
            }
            if (resp.error) throw resp.error;

            cerrarFormularioEvento();
            await cargarEventos();
            mostrarExitoEventoAccion(eraEdicion ? 'Evento actualizado correctamente.' : 'Evento creado correctamente.');
        } catch (err) {
            console.error('Error al guardar el evento:', err);
            mostrarErrorEn(el.formEventoError, mensajeErrorSupabase(err));
        } finally {
            el.btnGuardarEvento.disabled = false;
            ocultar(el.formEventoGuardando);
        }
    }

    // ---- Inicialización ----

    function iniciar() {
        cachearElementos();

        if (!iniciarClienteSupabase()) return;

        el.loginForm.addEventListener('submit', manejarLogin);
        el.btnLogout.addEventListener('click', manejarLogout);
        el.btnNuevaNoticia.addEventListener('click', abrirFormularioNueva);
        el.btnCancelar.addEventListener('click', cerrarFormulario);
        el.form.addEventListener('submit', manejarSubmitFormulario);
        el.campoImagen.addEventListener('change', manejarCambioImagen);
        el.btnQuitarImagen.addEventListener('click', manejarQuitarImagen);

        // Cerrar el formulario si se hace click fuera de la tarjeta (en el fondo oscuro).
        el.formOverlay.addEventListener('click', function (evento) {
            if (evento.target === el.formOverlay) cerrarFormulario();
        });

        // Tabs
        el.tabNoticias.addEventListener('click', function () { cambiarTab('noticias'); });
        el.tabEventos.addEventListener('click', function () { cambiarTab('eventos'); });

        // Eventos
        el.btnNuevoEvento.addEventListener('click', abrirFormularioNuevaEvento);
        el.btnCancelarEvento.addEventListener('click', cerrarFormularioEvento);
        el.formEvento.addEventListener('submit', manejarSubmitFormularioEvento);
        el.campoEventoImagen.addEventListener('change', manejarCambioImagenEvento);
        el.btnQuitarImagenEvento.addEventListener('click', manejarQuitarImagenEvento);

        el.formEventoOverlay.addEventListener('click', function (evento) {
            if (evento.target === el.formEventoOverlay) cerrarFormularioEvento();
        });

        client.auth.onAuthStateChange(function (evento, sesion) {
            // Importante: este callback también se dispara en eventos como
            // "TOKEN_REFRESHED" (renovación automática del token en segundo
            // plano, cada ~1 hora). Si reaccionáramos a cualquier sesión no
            // nula, recargaríamos el panel y perderíamos un formulario a
            // medio completar. Solo reaccionamos a login/logout reales.
            if (!sesion || evento === 'SIGNED_OUT') {
                alCerrarSesion();
                return;
            }
            if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') {
                alIniciarSesionValida();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
