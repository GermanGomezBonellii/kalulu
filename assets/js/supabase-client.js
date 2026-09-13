// Cliente Supabase único y compartido para todo el sitio público (Hero,
// Noticias, Qué ofrecemos y las próximas secciones editables). Antes cada
// script creaba su propio "supabase.createClient(...)" apuntando al mismo
// localStorage de sesión, lo que disparaba en consola la advertencia
// "Multiple GoTrueClient instances detected". Ahora se crea UNA sola vez
// acá y se reutiliza siempre la misma instancia.
//
// Debe cargarse (con "defer", en el <head> o antes que los demás scripts
// de assets/js/) después de supabase-config.js y del script del SDK de
// Supabase, y antes de hero.js / noticias.js / ofrecemos.js / cualquier
// otro script que necesite hablar con Supabase.
(function () {
    'use strict';

    var cliente = null;
    var seIntento = false;

    function obtenerClienteKalulu() {
        if (cliente) return cliente;
        if (seIntento) return null; // ya se intentó antes y faltaba config/SDK

        seIntento = true;

        var cfg = window.KALULU_SUPABASE_CONFIG;
        if (!cfg || typeof supabase === 'undefined' || !supabase.createClient) {
            return null;
        }

        cliente = supabase.createClient(cfg.url, cfg.publishableKey);
        window.KALULU_SUPABASE_CLIENT = cliente;
        return cliente;
    }

    window.obtenerClienteKalulu = obtenerClienteKalulu;
})();
