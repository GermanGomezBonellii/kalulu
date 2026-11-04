// Panel de administración de Kalulu. Sin servidor ni base de datos: edita los
// JSON de /data/ y sube imágenes/archivos al repo de GitHub con la API de
// GitHub, usando un token personal que se pega al ingresar (sessionStorage).
// Cada guardado es un commit; GitHub Pages republica el sitio en 1-2 minutos.
(function () {
    'use strict';

    var API = 'https://api.github.com';
    var DEFAULT_REPO = { owner: 'GermanGomezBonellii', repo: 'kalulu', branch: 'main' };

    // ---------- Definición de secciones ----------
    // t (tipo): text | textarea | url | date | time | bool | image | file
    var SECCIONES = [
        { id: 'home', label: 'Portada (Hero)', archivo: 'home', modo: 'unico',
          nota: 'Título, subtítulo y botón de la portada. La URL puede ser una página interna, un Google Form o cualquier link.',
          campos: [
            { k: 'titulo', l: 'Título', t: 'text', req: true },
            { k: 'subtitulo', l: 'Subtítulo', t: 'textarea' },
            { k: 'texto_cta', l: 'Texto del botón', t: 'text' },
            { k: 'url_cta', l: 'URL del botón', t: 'url' },
            { k: 'imagen_url', l: 'Imagen de fondo (opcional)', t: 'image' }
          ] },
        { id: 'noticias', label: 'Noticias', archivo: 'noticias', modo: 'lista', titulo: 'titulo', orden: { k: 'fecha', desc: true }, publ: 'publicada',
          campos: [
            { k: 'titulo', l: 'Título', t: 'text', req: true },
            { k: 'descripcion', l: 'Medio / descripción corta', t: 'text' },
            { k: 'fecha', l: 'Fecha', t: 'date', req: true },
            { k: 'imagen_url', l: 'Imagen', t: 'image' },
            { k: 'link', l: 'Link de la noticia', t: 'url' },
            { k: 'publicada', l: 'Publicada', t: 'bool', def: true }
          ] },
        { id: 'eventos', label: 'Eventos', archivo: 'eventos', modo: 'lista', titulo: 'titulo', orden: { k: 'fecha', desc: true }, publ: 'publicado',
          campos: [
            { k: 'titulo', l: 'Título', t: 'text', req: true },
            { k: 'descripcion', l: 'Descripción', t: 'textarea' },
            { k: 'fecha', l: 'Fecha', t: 'date', req: true },
            { k: 'hora', l: 'Hora de inicio', t: 'time' },
            { k: 'hora_fin', l: 'Hora de fin', t: 'time' },
            { k: 'imagen_url', l: 'Imagen', t: 'image' },
            { k: 'link_inscripcion', l: 'Link de inscripción', t: 'url' },
            { k: 'publicado', l: 'Publicado', t: 'bool', def: true }
          ] },
        { id: 'ofrecemos', label: 'Qué ofrecemos', archivo: 'ofrecemos', modo: 'lista', titulo: 'titulo', orden: { k: 'orden' }, publ: 'publicado', mover: true,
          campos: [
            { k: 'titulo', l: 'Título', t: 'text', req: true },
            { k: 'descripcion', l: 'Descripción', t: 'textarea' },
            { k: 'imagen_url', l: 'Imagen o ícono', t: 'image' },
            { k: 'link', l: 'Link (opcional)', t: 'url' },
            { k: 'texto_boton', l: 'Texto del botón (opcional)', t: 'text' },
            { k: 'publicado', l: 'Publicado', t: 'bool', def: true }
          ] },
        { id: 'ciencia', label: 'Ciencia ciudadana', archivo: 'ciencia', modo: 'lista', titulo: 'pregunta', orden: { k: 'orden' }, publ: 'publicada', mover: true,
          nota: 'Preguntas abiertas que se muestran en la sección de ciencia ciudadana.',
          campos: [
            { k: 'pregunta', l: 'Pregunta', t: 'textarea', req: true },
            { k: 'descripcion', l: 'Descripción (se muestra al hacer clic en la pregunta; dejala vacía si no querés que se expanda)', t: 'textarea' },
            { k: 'publicada', l: 'Publicada', t: 'bool', def: true }
          ] },
        { id: 'equipo', label: 'Quiénes somos', archivo: 'equipo', modo: 'lista', titulo: 'nombre', orden: { k: 'orden' }, publ: 'publicada', mover: true,
          campos: [
            { k: 'nombre', l: 'Nombre', t: 'text', req: true },
            { k: 'descripcion', l: 'Cargo / descripción', t: 'textarea' },
            { k: 'imagen_url', l: 'Fotografía', t: 'image' },
            { k: 'publicada', l: 'Publicada', t: 'bool', def: true }
          ] },
        { id: 'materiales', label: 'Materiales', archivo: 'materiales', clave: 'items', modo: 'lista', titulo: 'titulo', orden: { k: 'orden' }, publ: 'publicado', mover: true,
          nota: 'Archivos para descargar (PDF, etc.). Subí el archivo desde acá; queda guardado en el repo.',
          campos: [
            { k: 'titulo', l: 'Título', t: 'text', req: true },
            { k: 'descripcion', l: 'Descripción', t: 'textarea' },
            { k: 'categoria', l: 'Categoría', t: 'text' },
            { k: 'archivo_path', l: 'Archivo', t: 'file', nombre: 'nombre_archivo' },
            { k: 'publicado', l: 'Publicado', t: 'bool', def: true }
          ] },
        { id: 'comunidad', label: 'Comunidad (WhatsApp)', archivo: 'materiales', clave: 'config', modo: 'unico',
          nota: 'Link del grupo de WhatsApp que se muestra en la página de materiales.',
          campos: [{ k: 'whatsapp_url', l: 'URL del grupo de WhatsApp', t: 'url' }] }
    ];

    // ---------- Utilidades ----------
    var $ = function (id) { return document.getElementById(id); };
    var estado = { token: null, cfg: null, usuario: '', seccion: null, preview: {} };

    function el(tag, attrs, hijos) {
        var n = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) {
            var v = attrs[k];
            if (k === 'text') n.textContent = v;
            else if (k === 'class') n.className = v;
            else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
            else if (v === true) n.setAttribute(k, '');
            else if (v !== false && v != null) n.setAttribute(k, v);
        });
        (hijos || []).forEach(function (h) { if (h) n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h); });
        return n;
    }

    var toastT;
    function toast(msg, err) {
        var t = $('toast');
        t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
        clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, err ? 7000 : 3500);
    }

    function b64DeBytes(bytes) {
        var s = '', paso = 0x8000;
        for (var i = 0; i < bytes.length; i += paso) s += String.fromCharCode.apply(null, bytes.subarray(i, i + paso));
        return btoa(s);
    }
    function b64Texto(txt) { return b64DeBytes(new TextEncoder().encode(txt)); }
    function textoDeB64(b64) {
        var bin = atob(b64.replace(/\n/g, '')), b = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(b);
    }
    function slug(s) {
        return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'archivo';
    }
    // Acepta rutas relativas del sitio y URLs http(s); rechaza javascript:, data:, etc.
    function urlSegura(v) {
        if (!v) return true;
        if (/^https?:\/\//i.test(v)) return true;
        return !/^[a-z][a-z0-9+.-]*:/i.test(v);
    }

    // ---------- API de GitHub ----------
    function gh(metodo, ruta, cuerpo) {
        var c = estado.cfg;
        return fetch(API + '/repos/' + c.owner + '/' + c.repo + ruta, {
            method: metodo,
            headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + estado.token, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
            body: cuerpo ? JSON.stringify(cuerpo) : undefined,
            cache: 'no-store'
        }).then(function (r) {
            if (r.status === 401) { cerrarSesion('El token no es válido o venció. Volvé a ingresar.'); throw new Error('Token inválido o vencido.'); }
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) { var e = new Error(j.message || ('Error ' + r.status)); e.status = r.status; throw e; }
                return j;
            });
        });
    }
    function rutaContenido(p) { return '/contents/' + p.split('/').map(encodeURIComponent).join('/'); }

    function leerArchivo(archivo) {
        return gh('GET', rutaContenido('data/' + archivo + '.json') + '?ref=' + encodeURIComponent(estado.cfg.branch))
            .then(function (j) { return { json: JSON.parse(textoDeB64(j.content)), sha: j.sha }; });
    }
    function escribirArchivo(archivo, json, mensaje, sha) {
        return gh('PUT', rutaContenido('data/' + archivo + '.json'), {
            message: mensaje, branch: estado.cfg.branch, sha: sha,
            content: b64Texto(JSON.stringify(json, null, 2) + '\n')
        });
    }
    // Lee la versión más reciente, aplica "mutar" y guarda (reintenta ante conflicto).
    function modificar(sec, mutar, mensaje, intento) {
        intento = intento || 0;
        return leerArchivo(sec.archivo).then(function (r) {
            var json = r.json, raiz;
            if (sec.clave) raiz = json[sec.clave] || (sec.modo === 'lista' ? [] : {}); else raiz = json;
            var nuevo = mutar(raiz);
            if (sec.clave) json[sec.clave] = nuevo; else json = nuevo;
            return escribirArchivo(sec.archivo, json, mensaje, r.sha).then(function () { return nuevo; });
        }).catch(function (e) {
            if ((e.status === 409 || e.status === 422) && intento < 2) return modificar(sec, mutar, mensaje, intento + 1);
            throw e;
        });
    }
    function subirBinario(ruta, b64, mensaje) {
        return gh('PUT', rutaContenido(ruta), { message: mensaje, branch: estado.cfg.branch, content: b64 });
    }

    // ---------- Imágenes ----------
    function reducirImagen(file) {
        return new Promise(function (ok, fallo) {
            if (/svg|gif/.test(file.type)) {
                file.arrayBuffer().then(function (b) { ok({ bytes: new Uint8Array(b), ext: file.type.indexOf('svg') > -1 ? 'svg' : 'gif' }); }, fallo);
                return;
            }
            var url = URL.createObjectURL(file), img = new Image();
            img.onload = function () {
                var max = 1600, esc = Math.min(1, max / Math.max(img.width, img.height));
                var cv = document.createElement('canvas');
                cv.width = Math.round(img.width * esc); cv.height = Math.round(img.height * esc);
                var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
                URL.revokeObjectURL(url);
                cv.toBlob(function (bl) { bl.arrayBuffer().then(function (b) { ok({ bytes: new Uint8Array(b), ext: 'jpg' }); }, fallo); }, 'image/jpeg', 0.85);
            };
            img.onerror = function () { URL.revokeObjectURL(url); fallo(new Error('No se pudo leer la imagen.')); };
            img.src = url;
        });
    }

    // ---------- Sesión ----------
    function mostrarLogin(msg) {
        $('panel').hidden = true; $('login').hidden = false; $('btn-logout').hidden = true; $('top-user').textContent = '';
        var c = estado.cfg || DEFAULT_REPO;
        $('login-owner').value = c.owner; $('login-repo').value = c.repo; $('login-branch').value = c.branch;
        $('login-token').value = '';
        var e = $('login-error'); e.hidden = !msg; e.textContent = msg || '';
    }

    function entrar(token, cfg) {
        estado.token = token; estado.cfg = cfg;
        return gh('GET', '').then(function (repo) {
            if (!repo.permissions || !repo.permissions.push) throw new Error('El token no tiene permiso de escritura en este repositorio (Contents: Read and write).');
            return fetch(API + '/user', { headers: { 'Authorization': 'Bearer ' + token } })
                .then(function (r) { return r.ok ? r.json() : {}; })
                .catch(function () { return {}; })
                .then(function (u) {
                    estado.usuario = u.login || '';
                    sessionStorage.setItem('kalulu_token', token);
                    try { localStorage.setItem('kalulu_repo', JSON.stringify(cfg)); } catch (e) { /* ignorar */ }
                    $('login').hidden = true; $('panel').hidden = false; $('btn-logout').hidden = false;
                    $('top-user').textContent = (estado.usuario ? estado.usuario + ' · ' : '') + cfg.owner + '/' + cfg.repo;
                    armarTabs(); abrirSeccion('noticias');
                });
        });
    }

    function cerrarSesion(msg) {
        sessionStorage.removeItem('kalulu_token'); estado.token = null;
        mostrarLogin(typeof msg === 'string' ? msg : '');
    }

    function armarTabs() {
        var nav = $('tabs'); nav.textContent = '';
        SECCIONES.forEach(function (s) {
            nav.appendChild(el('button', { type: 'button', class: 'tab', 'data-id': s.id, 'aria-selected': 'false', text: s.label, onclick: function () { abrirSeccion(s.id); } }));
        });
    }

    // ---------- Vistas ----------
    function abrirSeccion(id) {
        estado.seccion = id;
        Array.prototype.forEach.call($('tabs').children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-id') === id ? 'true' : 'false'); });
        var sec = SECCIONES.filter(function (s) { return s.id === id; })[0];
        var v = $('vista'); v.textContent = '';
        v.appendChild(el('p', { class: 'vacio', text: 'Cargando…' }));
        leerArchivo(sec.archivo).then(function (r) {
            if (estado.seccion !== id) return;
            var datos = sec.clave ? (r.json[sec.clave] || (sec.modo === 'lista' ? [] : {})) : r.json;
            if (sec.modo === 'lista') vistaLista(sec, datos); else vistaForm(sec, datos, true);
        }).catch(function (e) { v.textContent = ''; v.appendChild(el('p', { class: 'error', text: 'No se pudo cargar: ' + e.message })); });
    }

    function ordenar(sec, datos) {
        var o = sec.orden, d = datos.slice();
        d.sort(function (a, b) {
            var x = a[o.k], y = b[o.k]; if (x == null) x = ''; if (y == null) y = '';
            var r = x < y ? -1 : x > y ? 1 : 0; return o.desc ? -r : r;
        });
        return d;
    }

    function vistaLista(sec, datos) {
        var v = $('vista'); v.textContent = '';
        v.appendChild(el('div', { class: 'cab' }, [el('h2', { text: sec.label }), el('button', { type: 'button', class: 'btn btn-primary', text: 'Agregar', onclick: function () { vistaForm(sec, null, false, datos); } })]));
        if (sec.nota) v.appendChild(el('p', { class: 'nota', text: sec.nota }));
        var card = el('div', { class: 'card' });
        var lista = ordenar(sec, datos);
        if (!lista.length) card.appendChild(el('p', { class: 'vacio', text: 'Todavía no hay elementos.' }));
        lista.forEach(function (it, i) {
            var activo = it[sec.publ] !== false;
            var sub = sec.orden.k === 'fecha' ? (it.fecha || '') : 'Orden ' + (it.orden != null ? it.orden : '–');
            var acc = el('div', { class: 'fila-a' });
            if (sec.mover) {
                acc.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: '↑', 'aria-label': 'Subir', disabled: i === 0, onclick: function () { mover(sec, lista, i, -1); } }));
                acc.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: '↓', 'aria-label': 'Bajar', disabled: i === lista.length - 1, onclick: function () { mover(sec, lista, i, 1); } }));
            }
            acc.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: activo ? 'Despublicar' : 'Publicar', onclick: function () { alternar(sec, it); } }));
            acc.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: 'Editar', onclick: function () { vistaForm(sec, it, false, datos); } }));
            acc.appendChild(el('button', { type: 'button', class: 'btn btn-sm btn-danger', text: 'Eliminar', onclick: function () { eliminar(sec, it); } }));
            card.appendChild(el('div', { class: 'fila' }, [
                el('div', { class: 'fila-t' }, [
                    el('strong', {}, [String(it[sec.titulo] || '(sin título)').trim(), el('span', { class: 'badge' + (activo ? '' : ' off'), text: activo ? 'Publicado' : 'Oculto' })]),
                    el('small', { text: sub })]),
                acc]));
        });
        v.appendChild(card);
    }

    function guardarYRefrescar(sec, mutar, mensaje, aviso) {
        return modificar(sec, mutar, mensaje).then(function () {
            toast(aviso + ' El sitio se actualiza en 1-2 minutos.'); abrirSeccion(sec.id);
        }).catch(function (e) { toast('No se pudo guardar: ' + e.message, true); });
    }
    function alternar(sec, it) {
        guardarYRefrescar(sec, function (arr) {
            arr.forEach(function (x) { if (x.id === it.id) x[sec.publ] = !(x[sec.publ] !== false); }); return arr;
        }, 'Panel: ' + sec.label + ' – cambiar publicación', 'Listo.');
    }
    function eliminar(sec, it) {
        if (!window.confirm('¿Eliminar "' + (it[sec.titulo] || '') + '"? Se puede recuperar desde el historial de GitHub.')) return;
        guardarYRefrescar(sec, function (arr) { return arr.filter(function (x) { return x.id !== it.id; }); }, 'Panel: ' + sec.label + ' – eliminar', 'Eliminado.');
    }
    function mover(sec, lista, i, dir) {
        var ids = lista.map(function (x) { return x.id; }), t = ids[i]; ids[i] = ids[i + dir]; ids[i + dir] = t;
        guardarYRefrescar(sec, function (arr) {
            arr.forEach(function (x) { x.orden = (ids.indexOf(x.id) + 1) * 10; }); return arr;
        }, 'Panel: ' + sec.label + ' – reordenar', 'Orden actualizado.');
    }

    // ---------- Formulario ----------
    function vistaForm(sec, item, unico, datos) {
        var v = $('vista'); v.textContent = '';
        var nuevo = !item && !unico;
        var valores = {};
        sec.campos.forEach(function (c) {
            valores[c.k] = item && item[c.k] != null ? item[c.k] : (c.def !== undefined ? c.def : (c.t === 'bool' ? false : ''));
        });
        var ordenInicial = item && item.orden != null ? item.orden
            : ((datos || []).reduce(function (m, x) { return Math.max(m, x.orden || 0); }, 0) + 10);
        var pendientes = {}; // campo -> { ruta, b64 } aún sin subir
        var extra = {};

        v.appendChild(el('div', { class: 'cab' }, [el('h2', { text: unico ? sec.label : (nuevo ? 'Nuevo en ' : 'Editar en ') + sec.label })]));
        if (unico && sec.nota) v.appendChild(el('p', { class: 'nota', text: sec.nota }));
        var form = el('form', { class: 'card', novalidate: true });
        var campos = {};

        sec.campos.forEach(function (c) {
            var inp, cont;
            if (c.t === 'textarea') inp = el('textarea');
            else if (c.t === 'bool') inp = el('input', { type: 'checkbox' });
            else if (c.t === 'image' || c.t === 'file') inp = el('input', { type: 'text', placeholder: c.t === 'image' ? 'URL externa o subí una imagen' : 'Se completa al subir el archivo' });
            else inp = el('input', { type: c.t === 'url' ? 'text' : c.t, inputmode: c.t === 'url' ? 'url' : null });
            if (c.t === 'bool') inp.checked = !!valores[c.k]; else inp.value = valores[c.k];
            if (c.t === 'file') inp.readOnly = true;
            campos[c.k] = inp;
            cont = c.t === 'bool'
                ? el('label', { class: 'campo' }, [inp, ' ', c.l])
                : el('label', { class: 'campo' }, [el('span', { text: c.l + (c.req ? ' *' : '') }), inp]);

            if (c.t === 'image' || c.t === 'file') {
                var prev = c.t === 'image' ? el('img', { class: 'preview', alt: '', hidden: true }) : null;
                var estadoUp = el('small', { text: '' });
                var fi = el('input', { type: 'file', accept: c.t === 'image' ? 'image/*' : null, 'aria-label': 'Subir ' + c.l });
                var actualizarPrev = function () {
                    if (!prev) return;
                    var val = inp.value.trim();
                    var src = estado.preview[val] || (/^https?:/i.test(val) ? val : (val ? '../' + val : ''));
                    if (src) { prev.src = src; prev.hidden = false; } else { prev.hidden = true; }
                };
                inp.addEventListener('input', actualizarPrev);
                fi.addEventListener('change', function () {
                    var f = fi.files[0]; if (!f) return;
                    estadoUp.textContent = 'Preparando…';
                    var carga = c.t === 'image' ? reducirImagen(f) : f.arrayBuffer().then(function (b) {
                        if (b.byteLength > 20 * 1024 * 1024) throw new Error('El archivo supera los 20 MB.');
                        var m = /\.([a-z0-9]+)$/i.exec(f.name); return { bytes: new Uint8Array(b), ext: m ? m[1].toLowerCase() : 'bin' };
                    });
                    carga.then(function (r) {
                        var base = c.t === 'image' ? 'imagenes/uploads/' : 'materiales/archivos/';
                        var ruta = base + slug(f.name.replace(/\.[^.]+$/, '')) + '-' + Date.now().toString(36) + '.' + r.ext;
                        pendientes[c.k] = { ruta: ruta, b64: b64DeBytes(r.bytes) };
                        inp.value = ruta;
                        if (c.nombre) extra[c.nombre] = f.name;
                        if (c.t === 'image') estado.preview[ruta] = 'data:image/' + (r.ext === 'jpg' ? 'jpeg' : r.ext === 'svg' ? 'svg+xml' : r.ext) + ';base64,' + pendientes[c.k].b64;
                        estadoUp.textContent = 'Listo: se sube al guardar (' + Math.round(r.bytes.length / 1024) + ' KB).';
                        actualizarPrev();
                    }).catch(function (e) { estadoUp.textContent = ''; toast(e.message, true); fi.value = ''; });
                });
                cont.appendChild(el('div', { class: 'up' }, [fi]));
                cont.appendChild(estadoUp);
                if (prev) { cont.appendChild(prev); actualizarPrev(); }
            }
            form.appendChild(cont);
        });
        if (sec.mover) {
            var ord = el('input', { type: 'number', step: '1' }); ord.value = ordenInicial;
            campos.orden = ord;
            form.appendChild(el('label', { class: 'campo' }, [el('span', { text: 'Orden (menor = primero)' }), ord]));
        }
        var err = el('p', { class: 'error', hidden: true });
        var guardar = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Guardar' });
        var acciones = el('div', { class: 'acciones' }, [guardar]);
        if (!unico) acciones.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Cancelar', onclick: function () { abrirSeccion(sec.id); } }));
        form.appendChild(err); form.appendChild(acciones); v.appendChild(form);

        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var nuevoValor = {}, problema = '';
            sec.campos.forEach(function (c) {
                var i = campos[c.k], val = c.t === 'bool' ? i.checked : i.value.trim();
                if (c.req && !val) problema = 'Completá: ' + c.l + '.';
                if ((c.t === 'url' || c.t === 'image') && typeof val === 'string' && !urlSegura(val)) problema = 'La URL de "' + c.l + '" no es válida (solo http/https o rutas del sitio).';
                nuevoValor[c.k] = (val === '' && c.t !== 'bool') ? null : val;
            });
            if (sec.mover) nuevoValor.orden = campos.orden.value === '' ? 0 : Number(campos.orden.value);
            Object.keys(extra).forEach(function (k) { nuevoValor[k] = extra[k]; });
            if (problema) { err.textContent = problema; err.hidden = false; return; }
            err.hidden = true; guardar.disabled = true; guardar.textContent = 'Guardando…';

            var subidas = Object.keys(pendientes).map(function (k) {
                return subirBinario(pendientes[k].ruta, pendientes[k].b64, 'Panel: subir ' + pendientes[k].ruta);
            });
            Promise.all(subidas).then(function () {
                return modificar(sec, function (raiz) {
                    if (sec.modo === 'unico') return Object.assign({}, raiz, nuevoValor);
                    if (nuevo) {
                        nuevoValor.id = raiz.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
                        raiz.push(nuevoValor);
                    } else {
                        raiz.forEach(function (x, idx) { if (x.id === item.id) raiz[idx] = Object.assign({}, x, nuevoValor); });
                    }
                    return raiz;
                }, 'Panel: ' + sec.label + (nuevo ? ' – agregar' : ' – editar'));
            }).then(function () {
                toast('Guardado. El sitio se actualiza en 1-2 minutos.');
                abrirSeccion(sec.id);
            }).catch(function (e) {
                err.textContent = 'No se pudo guardar: ' + e.message; err.hidden = false;
                guardar.disabled = false; guardar.textContent = 'Guardar';
            });
        });
    }

    // ---------- Inicio ----------
    $('login-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var cfg = { owner: $('login-owner').value.trim(), repo: $('login-repo').value.trim(), branch: $('login-branch').value.trim() };
        var btn = ev.target.querySelector('button[type=submit]'); btn.disabled = true;
        entrar($('login-token').value.trim(), cfg).catch(function (e) {
            estado.cfg = cfg; mostrarLogin(e.message);
        }).then(function () { btn.disabled = false; });
    });
    $('btn-logout').addEventListener('click', function () { cerrarSesion(); });

    var guardado = null;
    try { guardado = JSON.parse(localStorage.getItem('kalulu_repo')); } catch (e) { /* ignorar */ }
    estado.cfg = guardado && guardado.owner ? guardado : DEFAULT_REPO;
    var tk = sessionStorage.getItem('kalulu_token');
    if (tk) entrar(tk, estado.cfg).catch(function (e) { mostrarLogin(e.message); }); else mostrarLogin();
})();
