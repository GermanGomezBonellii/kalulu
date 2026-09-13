// Hero editable desde Supabase (tabla "home_config", fila única id = 1).
// Si Supabase no responde, no existe la tabla todavía, o falta la fila,
// el Hero se queda con el contenido de fallback que ya viene escrito en
// el HTML — nunca se muestra vacío ni se rompe el layout.
(function () {
    'use strict';

    function elementos() {
        return {
            hero: document.getElementById('hero'),
            titulo: document.getElementById('hero-titulo'),
            subtitulo: document.getElementById('hero-subtitulo'),
            cta: document.getElementById('hero-cta')
        };
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

    function aplicarConfig(cfg, el) {
        if (!cfg) return;

        // OJO: estos nombres son las columnas REALES de la tabla public.home_config
        // (id, titulo, subtitulo, texto_cta, url_cta, imagen_url, updated_at),
        // verificadas con information_schema.columns — no los nombres
        // "hero_*" que tenía una versión anterior de este archivo.
        if (cfg.titulo && cfg.titulo.trim()) {
            el.titulo.textContent = cfg.titulo;
        }
        if (cfg.subtitulo && cfg.subtitulo.trim()) {
            el.subtitulo.textContent = cfg.subtitulo;
        }
        if (cfg.texto_cta && cfg.texto_cta.trim()) {
            el.cta.textContent = cfg.texto_cta;
        }
        if (urlValida(cfg.url_cta)) {
            el.cta.href = cfg.url_cta;
            // Los links internos (mismo origen, ej. "/materiales/") abren en
            // la misma pestaña; los externos (Google Forms, convocatorias,
            // etc.) abren en una pestaña nueva.
            try {
                var esInterno = new URL(cfg.url_cta, window.location.href).origin === window.location.origin;
                if (esInterno) {
                    el.cta.removeAttribute('target');
                    el.cta.removeAttribute('rel');
                } else {
                    el.cta.setAttribute('target', '_blank');
                    el.cta.setAttribute('rel', 'noopener noreferrer');
                }
            } catch (e) { /* deja el target que ya tenía */ }
        }
        // Arquitectura preparada para administrar la imagen de fondo desde
        // Supabase: si la columna trae una URL válida, se usa; si no, se
        // conserva la imagen definida en el proyecto.
        if (urlValida(cfg.imagen_url)) {
            el.hero.style.backgroundImage = "url('" + cfg.imagen_url + "')";
        }
    }

    async function cargarHero() {
        var el = elementos();
        if (!el.hero) return;

        var client = window.obtenerClienteKalulu && window.obtenerClienteKalulu();
        if (!client) {
            el.hero.classList.remove('hero--cargando');
            return;
        }

        try {
            var resp = await client
                .from('home_config')
                .select('titulo, subtitulo, texto_cta, url_cta, imagen_url')
                .eq('id', 1)
                .maybeSingle();

            if (resp.error) throw resp.error;
            aplicarConfig(resp.data, el);
        } catch (err) {
            // Tabla todavía no creada, RLS no configurada, sin conexión, etc.
            // Se conserva el contenido de fallback silenciosamente.
            console.warn('No se pudo cargar la configuración del Hero desde Supabase, se usa el contenido por defecto:', err);
        } finally {
            el.hero.classList.remove('hero--cargando');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cargarHero);
    } else {
        cargarHero();
    }
})();
