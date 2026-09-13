-- =====================================================================
-- Kalulu — Rediseño: configuración editable del Hero de la Home
-- SQL para pegar en el SQL Editor de Supabase (Dashboard > SQL Editor).
--
-- Idempotente: se puede correr las veces que haga falta sin romper nada.
-- No modifica ni elimina ninguna tabla existente (noticias, eventos,
-- admins). Reutiliza la función public.is_admin() y la tabla
-- public.admins ya creadas en etapa2_supabase_setup.sql.
--
-- Diseño: una única fila de configuración (id = 1) en vez de un esquema
-- de filas arbitrarias — más simple de mantener y de editar desde /admin.
-- Se agrega también "hero_imagen_url" (opcional, hoy sin usar desde el
-- frontend salvo que tenga un valor) para que en el futuro la imagen de
-- fondo del Hero también se pueda administrar desde acá sin cambiar el
-- esquema ni el código.
-- =====================================================================


-- =====================================================================
-- BLOQUE 1: tabla public.home_config
-- =====================================================================
create table if not exists public.home_config (
  id integer primary key default 1,
  hero_titulo text not null default 'Los docentes podemos transformar la alfabetización',
  hero_subtitulo text not null default 'Sé parte de un proyecto de ciencia colectiva para mejorar la educación argentina empoderando a los docentes.',
  hero_cta_texto text not null default 'Quiero participar',
  hero_cta_url text not null default 'https://kalulu.excellolab.org/cienciaciudadana-argentina/',
  hero_imagen_url text,
  updated_at timestamptz not null default now(),
  constraint home_config_fila_unica check (id = 1)
);

comment on table public.home_config is 'Configuración editable de la Home (por ahora, el Hero). Fila única con id = 1.';

-- Mantiene "updated_at" al día en cada UPDATE, para que /admin pueda
-- mostrar "última edición" sin tener que calcularlo a mano.
create or replace function public.home_config_actualizar_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_home_config_updated_at on public.home_config;
create trigger trg_home_config_updated_at
before update on public.home_config
for each row
execute function public.home_config_actualizar_timestamp();

alter table public.home_config enable row level security;


-- =====================================================================
-- BLOQUE 2: policies de public.home_config
-- =====================================================================
-- Lectura pública: el Hero se muestra a cualquier visitante, sin login.
drop policy if exists "Lectura publica home_config" on public.home_config;
create policy "Lectura publica home_config"
on public.home_config
for select
to anon, authenticated
using ( true );

-- Solo admins pueden crear la fila de configuración (normalmente ya la
-- crea el BLOQUE 3 de este archivo; esta policy cubre el caso de que se
-- haya borrado a mano y un admin necesite recrearla desde /admin).
drop policy if exists "Admins pueden crear home_config" on public.home_config;
create policy "Admins pueden crear home_config"
on public.home_config
for insert
to authenticated
with check ( public.is_admin() );

-- Solo admins pueden editar la configuración del Hero.
drop policy if exists "Admins pueden editar home_config" on public.home_config;
create policy "Admins pueden editar home_config"
on public.home_config
for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

-- Solo admins podrían eliminarla (no hace falta en el uso normal, pero
-- se deja consistente con el resto de las tablas administrables).
drop policy if exists "Admins pueden eliminar home_config" on public.home_config;
create policy "Admins pueden eliminar home_config"
on public.home_config
for delete
to authenticated
using ( public.is_admin() );


-- =====================================================================
-- BLOQUE 3: fila inicial (seed conservador)
-- =====================================================================
-- Mismo texto que ya tenía el Hero del sitio actual, para que activar
-- esta tabla no cambie nada visualmente hasta que un admin lo edite.
insert into public.home_config (id, hero_titulo, hero_subtitulo, hero_cta_texto, hero_cta_url)
values (
  1,
  'Los docentes podemos transformar la alfabetización',
  'Sé parte de un proyecto de ciencia colectiva para mejorar la educación argentina empoderando a los docentes.',
  'Quiero participar',
  'https://kalulu.excellolab.org/cienciaciudadana-argentina/'
)
on conflict (id) do nothing;


-- =====================================================================
-- BLOQUE 4 (opcional): verificación rápida
-- =====================================================================
select * from public.home_config;

select tablename, policyname, cmd, roles
from pg_policies
where tablename = 'home_config'
order by cmd;
