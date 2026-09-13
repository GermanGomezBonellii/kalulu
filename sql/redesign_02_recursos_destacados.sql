-- =====================================================================
-- Kalulu — Rediseño: sección "Qué ofrecemos" (recursos_destacados)
-- SQL para pegar en el SQL Editor de Supabase (Dashboard > SQL Editor).
--
-- Idempotente: se puede correr las veces que haga falta sin romper nada.
-- No modifica ni elimina ninguna tabla existente. Reutiliza
-- public.is_admin() / public.admins ya creadas en etapa2_supabase_setup.sql
-- y sigue exactamente el mismo patrón de RLS que ya usan "noticias" y
-- "eventos" en este proyecto.
-- =====================================================================

-- pgcrypto ya viene habilitado por defecto en todo proyecto de Supabase
-- (es lo que provee gen_random_uuid()); este "create extension" es solo
-- una red de seguridad idempotente por si no lo estuviera.
create extension if not exists pgcrypto;


-- =====================================================================
-- BLOQUE 1: tabla public.recursos_destacados
-- =====================================================================
create table if not exists public.recursos_destacados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  imagen_url text,
  link text,
  cta_texto text,
  publicado boolean not null default false,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.recursos_destacados is 'Tarjetas del carrusel "Qué ofrecemos" de la Home. Visitantes solo ven las publicadas.';

create index if not exists recursos_destacados_orden_idx
  on public.recursos_destacados (publicado, orden);

alter table public.recursos_destacados enable row level security;


-- =====================================================================
-- BLOQUE 2: policies de public.recursos_destacados
-- =====================================================================
-- Cualquier visitante (incluso sin login) puede ver los recursos publicados.
drop policy if exists "Lectura publica recursos publicados" on public.recursos_destacados;
create policy "Lectura publica recursos publicados"
on public.recursos_destacados
for select
to anon, authenticated
using ( publicado = true );

-- Los admins ven TODOS los recursos (publicados y borradores) desde /admin.
drop policy if exists "Admins ven todos los recursos" on public.recursos_destacados;
create policy "Admins ven todos los recursos"
on public.recursos_destacados
for select
to authenticated
using ( public.is_admin() );

drop policy if exists "Admins crean recursos" on public.recursos_destacados;
create policy "Admins crean recursos"
on public.recursos_destacados
for insert
to authenticated
with check ( public.is_admin() );

drop policy if exists "Admins editan recursos" on public.recursos_destacados;
create policy "Admins editan recursos"
on public.recursos_destacados
for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

drop policy if exists "Admins eliminan recursos" on public.recursos_destacados;
create policy "Admins eliminan recursos"
on public.recursos_destacados
for delete
to authenticated
using ( public.is_admin() );


-- =====================================================================
-- BLOQUE 3: bucket de Storage "recursos-imagenes"
-- =====================================================================
-- Antes de correr este bloque, creá el bucket desde el Dashboard
-- (Storage > New bucket) con el nombre exacto "recursos-imagenes",
-- marcado como público — mismo procedimiento que ya se usó para
-- "noticias-imagenes" y "eventos-imagenes".

drop policy if exists "Lectura publica imagenes recursos" on storage.objects;
create policy "Lectura publica imagenes recursos"
on storage.objects
for select
to public
using ( bucket_id = 'recursos-imagenes' );

drop policy if exists "Admins suben imagenes recursos" on storage.objects;
create policy "Admins suben imagenes recursos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'recursos-imagenes'
  and public.is_admin()
);

drop policy if exists "Admins actualizan imagenes recursos" on storage.objects;
create policy "Admins actualizan imagenes recursos"
on storage.objects
for update
to authenticated
using ( bucket_id = 'recursos-imagenes' and public.is_admin() )
with check ( bucket_id = 'recursos-imagenes' and public.is_admin() );

drop policy if exists "Admins eliminan imagenes recursos" on storage.objects;
create policy "Admins eliminan imagenes recursos"
on storage.objects
for delete
to authenticated
using ( bucket_id = 'recursos-imagenes' and public.is_admin() );


-- =====================================================================
-- BLOQUE 4: seed conservador con contenido real ya existente en el sitio
-- =====================================================================
-- Mismos 6 beneficios y las mismas imágenes que ya mostraba la sección
-- "¿Sos docente alfabetizador?" del sitio actual (no se inventa nada
-- nuevo). Las imágenes apuntan al dominio público del sitio
-- (www.kaluluargentina.org/imagenes/...) en lugar de al bucket de
-- Storage, porque son las mismas imágenes que ya están versionadas en
-- el repo. Un admin puede reemplazarlas por imágenes subidas a Storage
-- en cualquier momento desde /admin.
insert into public.recursos_destacados (titulo, descripcion, imagen_url, publicado, orden)
select * from (values
  ('Cuadernillos y materiales', 'Cuadernillos y materiales para todos tus alumnos.', 'https://www.kaluluargentina.org/imagenes/imagen%20(12).jpg', true, 1),
  ('Juegos de lectura', 'Juegos de cartas para reforzar habilidades de lectura de forma divertida.', 'https://www.kaluluargentina.org/imagenes/imagen%20(4).jpg', true, 2),
  ('Guía pedagógica', 'Guía pedagógica detallada para acompañar cada paso del proceso.', 'https://www.kaluluargentina.org/imagenes/imagen%20(5).jpg', true, 3),
  ('Cursos online', 'Acceso completo a cursos online asincrónicos y capacitaciones.', 'https://www.kaluluargentina.org/imagenes/imagen%20(6).jpg', true, 4),
  ('Foro exclusivo', 'Participación con voto en un foro exclusivo de docentes e investigadores.', 'https://www.kaluluargentina.org/imagenes/imagen%20(7).jpg', true, 5),
  ('Eventos presenciales', 'Eventos presenciales con especialistas nacionales e internacionales.', 'https://www.kaluluargentina.org/imagenes/imagen%20(8).jpg', true, 6)
) as datos (titulo, descripcion, imagen_url, publicado, orden)
where not exists (select 1 from public.recursos_destacados);


-- =====================================================================
-- BLOQUE 5 (opcional): verificación rápida
-- =====================================================================
select id, titulo, publicado, orden from public.recursos_destacados order by orden;

select tablename, policyname, cmd, roles
from pg_policies
where tablename = 'recursos_destacados'
order by cmd;

select policyname, cmd, roles
from pg_policies
where tablename = 'objects' and schemaname = 'storage' and policyname ilike '%recursos%'
order by cmd;
