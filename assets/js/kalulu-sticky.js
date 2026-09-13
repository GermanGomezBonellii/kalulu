// Sección interactiva "Sobre Kalulu": una única pantalla que queda fija
// (position: sticky, ver styles.css) mientras dura el scroll de su
// "track" de 300vh, y dentro de esa pantalla fija hay 3 pasos
// (.kalulu-sticky__par), pero SOLO UNO puede estar visible a la vez.
//
// Lógica (estados discretos, sin interpolación continua):
//   1. progreso 0-1 = qué tan avanzado está el recorrido del track dentro
//      del viewport: progreso = -trackRect.top / (trackRect.height - vh),
//      clamped a [0,1].
//   2. El recorrido se divide en 3 tercios iguales y cada uno mapea a un
//      único "activeStep" entero (0, 1 o 2):
//         0%  ───────── 33%   -> activeStep = 0
//         33% ──────── 66%   -> activeStep = 1
//         66% ─────── 100%   -> activeStep = 2
//      No hay ningún valor intermedio: en cualquier posición estable del
//      scroll hay exactamente un "activeStep".
//   3. El panel que coincide con "activeStep" recibe la clase
//      ".is-active"; todos los demás la pierden. El propio CSS (no este
//      script) define cómo se ve cada estado: el activo en
//      opacity:1/visibility:visible/pointer-events:auto y el resto en
//      opacity:0/visibility:hidden/pointer-events:none, con una
//      transición corta (300-400ms) para el crossfade breve entre un
//      paso y el siguiente. Este script nunca calcula ni escribe
//      opacidades parciales.
//
// Sin scroll-jacking: JS solo LEE la posición de scroll (scroll/resize
// pasivos) y escribe una clase; el navegador sigue manejando el scroll.
// Se desactiva por completo en mobile/tablet angosta (ahí el CSS ya pasa
// los paneles a bloques normales apilados, todos visibles a la vez) y
// cuando el usuario prefiere menos movimiento.
(function () {
    'use strict';

    var SELECTOR_MEDIA_ACTIVA = '(min-width: 901px)';
    var CLASE_ACTIVO = 'is-active';
    var CLASE_PUNTO_ACTIVO = 'kalulu-sticky__punto--activo';

    function iniciar() {
        var track = document.getElementById('kalulu-sticky-track');
        var pegado = document.getElementById('kalulu-sticky-pegado');
        if (!track || !pegado) return;

        var paneles = Array.prototype.slice.call(pegado.querySelectorAll('.kalulu-sticky__par[data-panel-index]'));
        if (!paneles.length) return;

        var puntos = Array.prototype.slice.call(pegado.querySelectorAll('.kalulu-sticky__punto'));

        var mqDesktop = window.matchMedia(SELECTOR_MEDIA_ACTIVA);
        var mqReducida = window.matchMedia('(prefers-reduced-motion: reduce)');

        var activo = false;
        var actualizando = false;
        var pasoActualAplicado = -1;

        function aplicarPaso(paso) {
            if (paso === pasoActualAplicado) return;
            pasoActualAplicado = paso;

            paneles.forEach(function (panel, indice) {
                panel.classList.toggle(CLASE_ACTIVO, indice === paso);
            });
            puntos.forEach(function (punto, indice) {
                punto.classList.toggle(CLASE_PUNTO_ACTIVO, indice === paso);
            });
        }

        function calcularEstado() {
            actualizando = false;

            var n = paneles.length;
            var rectTrack = track.getBoundingClientRect();
            var alturaViewport = window.innerHeight;
            var recorrido = rectTrack.height - alturaViewport;

            var progreso = recorrido > 0 ? (-rectTrack.top / recorrido) : 0;
            if (progreso < 0) progreso = 0;
            if (progreso > 1) progreso = 1;

            // Un único índice entero por posición de scroll: nunca un
            // valor a mitad de camino entre dos pasos.
            var paso = Math.floor(progreso * n);
            if (paso >= n) paso = n - 1;
            if (paso < 0) paso = 0;

            aplicarPaso(paso);
        }

        function solicitarActualizacion() {
            if (actualizando) return;
            actualizando = true;
            window.requestAnimationFrame(calcularEstado);
        }

        function activar() {
            if (activo) return;
            activo = true;
            window.addEventListener('scroll', solicitarActualizacion, { passive: true });
            window.addEventListener('resize', solicitarActualizacion, { passive: true });
            solicitarActualizacion();
        }

        function desactivar() {
            if (!activo) return;
            activo = false;
            window.removeEventListener('scroll', solicitarActualizacion);
            window.removeEventListener('resize', solicitarActualizacion);
            // En mobile/tablet y con "reduced motion" el CSS fuerza a todos
            // los paneles a verse (bloques apilados normales), así que la
            // clase ".is-active" deja de tener efecto visual; igual se deja
            // sólo el primer paso marcado para que el DOM quede consistente
            // si el usuario vuelve a un ancho/preferencia donde sí importa.
            pasoActualAplicado = -1;
            aplicarPaso(0);
        }

        function evaluarCondiciones() {
            if (mqDesktop.matches && !mqReducida.matches) {
                activar();
            } else {
                desactivar();
            }
        }

        function suscribir(mq, manejador) {
            if (typeof mq.addEventListener === 'function') {
                mq.addEventListener('change', manejador);
            } else if (typeof mq.addListener === 'function') {
                // Safari antiguo / navegadores sin addEventListener en MediaQueryList.
                mq.addListener(manejador);
            }
        }

        suscribir(mqDesktop, evaluarCondiciones);
        suscribir(mqReducida, evaluarCondiciones);

        evaluarCondiciones();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
