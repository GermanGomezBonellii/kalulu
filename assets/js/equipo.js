// SecciÃ³n "QuiÃ©nes somos" â€” grilla de tarjetas del equipo.
//
// Fuente de verdad: la tabla "equipo" en Supabase (nombre, descripcion,
// imagen_url, orden, publicada). La secciÃ³n NUNCA queda hardcodeada en el
// HTML â€” este script es siempre el que dibuja la grilla, ya sea con datos
// reales de Supabase o, si la tabla todavÃ­a no existe / estÃ¡ vacÃ­a / hay
// un error, con el mismo contenido de reserva que ya tenÃ­a el sitio (los
// 8 integrantes reales, sin inventar a nadie).
//
// Prioridad para resolver la fotografÃ­a de cada persona:
//   1) "imagen_url" de Supabase, si tiene un valor vÃ¡lido.
//   2) Si es null/vacÃ­o, la imagen local ya existente para esa persona
//      (ver IMAGENES_EQUIPO), buscada por nombre exacto.
//   3) Si tampoco hay una imagen local conocida, un placeholder neutro
//      (el fondo violeta de .equipo__avatar-wrap, sin <img>).
// Una fila de Supabase con imagen_url = null NUNCA hace desaparecer la
// foto existente: siempre cae al fallback local antes que al placeholder.
(function () {
    'use strict';

    // Rutas web relativas (no rutas de Windows). "imagenes/" vive al mismo
    // nivel que "redesign/" (kalulu-main/imagenes y kalulu-main/redesign
    // son carpetas hermanas), y este archivo lo usa una pÃ¡gina que estÃ¡ un
    // nivel adentro de "redesign/" (redesign/index.html), asÃ­ que "imagenes/..."
    // es lo que sube un nivel desde "redesign/" y entra a "imagenes/" â€”
    // funciona tanto abriendo el proyecto en local como sirviÃ©ndolo desde
    // esa misma carpeta en producciÃ³n. Nombres de archivo EXACTOS (mayÃºsculas
    // y extensiÃ³n) tal como existen hoy en imagenes/, porque el hosting
    // final puede ser case-sensitive.
    var IMAGENES_EQUIPO = {
        'Melina Vladisauskas': 'imagenes/melina.jpg',
        'Julia Hermida': 'imagenes/julia.jpeg',
        'Cassandra Potier Watkins': 'imagenes/cassandra.jpg',
        'AndrÃ©s Rieznik': 'imagenes/andres.jpg',
        'Stanislas Dehaene': 'imagenes/Stanislas.jpg',
        'Agripina Sanchez Menta': 'imagenes/agrispina.jpg',
        'Romina Curto': 'imagenes/Romina.jpg',
        'Marie Lubineau': 'imagenes/marie.jpg'
    };

    // object-position solo para las fotos locales donde un recorte
    // cuadrado centrado cortarÃ­a la cara (por ejemplo, retratos verticales
    // con la cara en el tercio superior). Todo lo que no estÃ¡ listado acÃ¡
    // usa "center" (definido por defecto en el CSS).
    var OBJECT_POSITION_EQUIPO = {
        'Agripina Sanchez Menta': 'center 20%'
    };

    // Contenido de reserva: mismos 8 integrantes reales, mismos cargos,
    // mismo orden que ya tenÃ­a el sitio. Se usa solo si Supabase no
    // responde, la tabla "equipo" todavÃ­a no existe, o estÃ¡ vacÃ­a.
    var FALLBACK = [
        { nombre: 'Melina Vladisauskas', descripcion: 'Dra. en BiologÃ­a, Postdoc en Excello Lab - CollÃ¨ge de France', imagen_url: null },
        { nombre: 'Julia Hermida', descripcion: 'Dra. en PsicologÃ­a UBA, Profesora adjunta en UNAHUR, Investigadora Asistente en CONICET', imagen_url: null },
        { nombre: 'Cassandra Potier Watkins', descripcion: 'Investigadora en Neurociencia Cognitiva y EducaciÃ³n (CollÃ¨ge de France), Fundadora de Excello', imagen_url: null },
        { nombre: 'AndrÃ©s Rieznik', descripcion: 'Dr. en FÃ­sica, Profesor full time en UTDT, Comunicador cientÃ­fico', imagen_url: null },
        { nombre: 'Stanislas Dehaene', descripcion: 'Investigador en Neurociencia Cognitiva, Prof. en CollÃ¨ge de France, Dir. de NeuroSpin (INSERM-CEA)', imagen_url: null },
        { nombre: 'Agripina Sanchez Menta', descripcion: 'Docente de primaria y Psicopedagoga', imagen_url: null },
        { nombre: 'Romina Curto', descripcion: 'Docente y estudiante de psicopedagogÃ­a', imagen_url: null },
        { nombre: 'Marie Lubineau', descripcion: 'Doctora en Ciencias Cognitivas, Postdoctorado en Excello Lab - CollÃ¨ge de France', imagen_url: null }
    ];

    function urlValida(valor) {
        if (!valor) return false;
        try {
            var u = new URL(valor, window.location.href);
            return u.protocol === 'http:' || u.protocol === 'https:' || valor.indexOf('/') === 0;
        } catch (e) {
            return valor.indexOf('/') === 0;
        }
    }

    function crearTarjeta(persona) {
        var article = document.createElement('article');
        article.className = 'equipo__miembro';

        // Prioridad: imagen_url de Supabase -> foto local por nombre -> placeholder.
        var imagenUrl = urlValida(persona.imagen_url) ? persona.imagen_url : (IMAGENES_EQUIPO[persona.nombre] || null);
        var usandoFallbackLocal = !urlValida(persona.imagen_url) && !!IMAGENES_EQUIPO[persona.nombre];

        var avatarWrap = document.createElement('div');
        avatarWrap.className = 'equipo__avatar-wrap';
        if (imagenUrl) {
            var img = document.createElement('img');
            img.src = imagenUrl;
            img.alt = '';
            img.loading = 'lazy';
            if (usandoFallbackLocal && OBJECT_POSITION_EQUIPO[persona.nombre]) {
                img.style.objectPosition = OBJECT_POSITION_EQUIPO[persona.nombre];
            }
            img.onerror = function () { img.remove(); };
            avatarWrap.appendChild(img);
        }
        article.appendChild(avatarWrap);

        var cuerpo = document.createElement('div');
        cuerpo.className = 'equipo__miembro-cuerpo';

        var nombre = document.createElement('h3');
        nombre.textContent = persona.nombre || '';
        cuerpo.appendChild(nombre);

        if (persona.descripcion) {
            var descripcion = document.createElement('p');
            descripcion.textContent = persona.descripcion;
            cuerpo.appendChild(descripcion);
        }

        article.appendChild(cuerpo);
        return article;
    }

    function renderizar(lista) {
        var grid = document.getElementById('equipo-grid');
        if (!grid) return;
        grid.innerHTML = '';
        lista.forEach(function (persona) { grid.appendChild(crearTarjeta(persona)); });
    }

    async function cargarEquipo() {
        var client = window.obtenerClienteKalulu && window.obtenerClienteKalulu();

        if (!client) {
            renderizar(FALLBACK);
            return;
        }

        try {
            var resp = await client
                .from('equipo')
                .select('id, nombre, descripcion, imagen_url, orden')
                .eq('publicada', true)
                .order('orden', { ascending: true });

            if (resp.error) throw resp.error;

            var equipo = resp.data || [];
            renderizar(equipo.length > 0 ? equipo : FALLBACK);
        } catch (err) {
            // Tabla todavÃ­a no creada (ver sql/redesign_04_equipo.sql), sin
            // conexiÃ³n, etc.: se usa el contenido de reserva.
            console.warn('No se pudo cargar "QuiÃ©nes somos" desde Supabase, se usa el contenido por defecto:', err);
            renderizar(FALLBACK);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cargarEquipo);
    } else {
        cargarEquipo();
    }
})();

