// Cliente de datos del sitio Kalulu: lee archivos JSON de /data/ (sin base
// de datos ni servicios externos). Expone la misma interfaz mínima que usaban
// los scripts con Supabase (from/select/eq/order/maybeSingle y
// storage.from().getPublicUrl) para que hero.js, noticias.js, etc. sigan igual.
// Los JSON los edita el panel /admin (que hace commits al repo).
(function () {
    'use strict';

    // Raíz del sitio, deducida de la URL de este script (assets/js/data-client.js).
    var actual = document.currentScript && document.currentScript.src;
    var RAIZ = actual ? new URL('../../', actual).href : new URL('/', window.location.href).href;

    // tabla (nombre histórico) -> { archivo, clave opcional dentro del JSON }
    var ORIGEN = {
        noticias: { archivo: 'noticias' },
        eventos: { archivo: 'eventos' },
        home_config: { archivo: 'home' },
        recursos_destacados: { archivo: 'ofrecemos' },
        preguntas_ciencia_ciudadana: { archivo: 'ciencia' },
        equipo: { archivo: 'equipo' },
        materiales: { archivo: 'materiales', clave: 'items' },
        materiales_config: { archivo: 'materiales', clave: 'config' }
    };

    var cache = {};

    function leer(archivo) {
        if (!cache[archivo]) {
            cache[archivo] = fetch(RAIZ + 'data/' + archivo + '.json', { cache: 'no-cache' })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status + ' al leer data/' + archivo + '.json');
                    return r.json();
                });
        }
        return cache[archivo];
    }

    function Consulta(tabla) {
        this.tabla = tabla;
        this.filtros = [];
        this.orden = [];
    }
    Consulta.prototype.select = function () { return this; };
    Consulta.prototype.eq = function (campo, valor) { this.filtros.push([campo, valor]); return this; };
    Consulta.prototype.order = function (campo, opts) {
        this.orden.push([campo, !(opts && opts.ascending === false)]);
        return this;
    };
    Consulta.prototype.ejecutar = function () {
        var o = ORIGEN[this.tabla];
        var self = this;
        if (!o) return Promise.resolve({ data: null, error: new Error('Tabla desconocida: ' + this.tabla) });
        return leer(o.archivo).then(function (json) {
            var datos = o.clave ? json[o.clave] : json;
            var filas = Array.isArray(datos) ? datos.slice() : (datos ? [datos] : []);
            self.filtros.forEach(function (f) {
                filas = filas.filter(function (fila) { return fila[f[0]] === f[1] || (f[0] === 'id' && datos && !Array.isArray(datos)); });
            });
            self.orden.slice().reverse().forEach(function (ord) {
                var c = ord[0], asc = ord[1];
                filas.sort(function (a, b) {
                    var x = a[c], y = b[c];
                    if (x == null && y == null) return 0;
                    if (x == null) return 1;
                    if (y == null) return -1;
                    var r = x < y ? -1 : x > y ? 1 : 0;
                    return asc ? r : -r;
                });
            });
            return { data: filas, error: null };
        }).catch(function (error) { return { data: null, error: error }; });
    };
    Consulta.prototype.maybeSingle = function () {
        return this.ejecutar().then(function (r) {
            return r.error ? r : { data: (r.data && r.data[0]) || null, error: null };
        });
    };
    Consulta.prototype.then = function (ok, err) { return this.ejecutar().then(ok, err); };

    var cliente = {
        from: function (tabla) { return new Consulta(tabla); },
        storage: {
            from: function () {
                return {
                    // Los archivos subidos viven en el repo; archivo_path es relativo a la raíz del sitio.
                    getPublicUrl: function (ruta) {
                        return { data: { publicUrl: /^https?:/i.test(ruta) ? ruta : RAIZ + encodeURI(ruta) } };
                    }
                };
            }
        }
    };

    window.obtenerClienteKalulu = function () { return cliente; };
})();
