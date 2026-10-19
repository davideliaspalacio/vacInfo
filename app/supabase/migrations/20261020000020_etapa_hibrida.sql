-- La etapa subía solo por edad (20261019000019) y eso es falso en ganadería: una novilla de 25
-- meses que nunca ha parido se convertía en vaca sola. La etapa ahora la deciden los hechos y la
-- edad queda como respaldo para los hatos que se cargan sin historial.
--
-- Regla de la hembra bovina (ternera · novilla · vaca):
--   1. con parto registrado, o con ordeños registrados → vaca (el hecho manda, así sea joven);
--   2. con servicio o palpación y ningún parto → se queda como está (va en camino de preñez:
--      no se asciende por edad);
--   3. sin ningún registro reproductivo ni de ordeño → por edad: < 12 meses ternera,
--      12–36 novilla, > 36 vaca (a esa edad, sin un solo dato, es un hato cargado sin historial).
-- Machos (ternero · novillo · toro): solo por edad, < 12, 12–24, > 24.
-- Nunca baja de etapa, sin fecha de nacimiento ni historial no se toca nada, y caballo, perro
-- y «otro» jamás se tocan.
--
-- Se mantiene al día en cuatro momentos: al guardar la ficha (disparador en `animales`), al
-- registrar un parto o un ordeño (disparadores por sentencia en `partos` y `ordenos`, más la
-- llamada explícita de `registrar_parto`), llamando a `actualizar_etapas()` y en la tarea diaria
-- de pg_cron de las 6 a. m. Cada cambio, automático o manual, queda en `cambios_etapa`.

-- ─────────────────────────── Escala de etapas ───────────────────────────
-- Dos escalas paralelas que no se mezclan: la de la hembra y la del macho. Lo que no está en
-- ninguna (caballo, perro, otro) no tiene escala y por eso nunca se mueve.

create or replace function escala_etapa(p_categoria categoria_animal)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_categoria in ('ternera', 'ternerona', 'novilla', 'vaca') then 'hembra'
    when p_categoria in ('ternero', 'novillo', 'toro') then 'macho'
  end;
$$;

comment on function escala_etapa(categoria_animal) is
  'Escala de etapas a la que pertenece la categoría: hembra, macho o ninguna (caballo, perro, otro).';

create or replace function rango_etapa(p_categoria categoria_animal)
returns integer
language sql immutable
set search_path = public
as $$
  select case p_categoria
    when 'ternera' then 1
    when 'ternero' then 1
    when 'ternerona' then 2        -- etapa retirada: cuenta como novilla
    when 'novilla' then 2
    when 'novillo' then 2
    when 'vaca' then 3
    when 'toro' then 3
    else 0
  end;
$$;

comment on function rango_etapa(categoria_animal) is
  'Altura de la etapa dentro de su escala (1 cría, 2 levante, 3 adulto). 0 si no tiene escala.';

-- La etapa más alta de las dos, dentro de la misma escala. Es lo que impide que un animal baje
-- de etapa: una vaca no vuelve a novilla ni por un cambio a mano. Si alguna no tiene escala o
-- son de escalas distintas (corregir un caballo mal registrado, corregir el sexo), manda la
-- primera, que es la que pide quien guarda.
create or replace function etapa_mas_alta(p_pedida categoria_animal, p_regla categoria_animal)
returns categoria_animal
language sql immutable
set search_path = public
as $$
  select case
    when p_pedida = p_regla then p_pedida
    when escala_etapa(p_pedida) is null or escala_etapa(p_regla) is null then p_pedida
    when escala_etapa(p_pedida) <> escala_etapa(p_regla) then p_pedida
    when rango_etapa(p_regla) > rango_etapa(p_pedida) then p_regla
    else p_pedida
  end;
$$;

comment on function etapa_mas_alta(categoria_animal, categoria_animal) is
  'La más alta de dos etapas de la misma escala. Garantiza que un animal nunca baje de etapa.';

-- ─────────────────────────── La regla ───────────────────────────
-- Respaldo por edad. Cambia respecto a 20261019000019: la hembra sin historial pasa a vaca a los
-- 36 meses, no a los 24, porque hasta esa edad lo más probable es que siga siendo novilla.
create or replace function etapa_por_edad(p_categoria categoria_animal, p_nacimiento date)
returns categoria_animal
language sql stable
set search_path = public
as $$
  select case
    when p_nacimiento is null then p_categoria
    when p_categoria in ('ternera', 'ternerona', 'novilla') then
      case
        when p_nacimiento > current_date - interval '12 months' then 'ternera'
        when p_nacimiento > current_date - interval '36 months' then 'novilla'
        else 'vaca'
      end::categoria_animal
    when p_categoria in ('ternero', 'novillo') then
      case
        when p_nacimiento > current_date - interval '12 months' then 'ternero'
        when p_nacimiento > current_date - interval '24 months' then 'novillo'
        else 'toro'
      end::categoria_animal
    else p_categoria            -- vaca, toro, caballo, perro, otro: no se tocan
  end;
$$;

comment on function etapa_por_edad(categoria_animal, date) is
  'Respaldo por edad cuando el animal no tiene historial: hembra < 12 ternera, 12-36 novilla, > 36 vaca; macho < 12, 12-24, > 24.';

-- Etapa que le corresponde al animal con sus hechos y su edad. Es la regla completa.
create or replace function etapa_de_animal(
  p_categoria categoria_animal,
  p_nacimiento date,
  p_parto boolean,
  p_ordeno boolean,
  p_repro boolean                -- servicio o palpación registrados
)
returns categoria_animal
language sql stable
set search_path = public
as $$
  select case
    when p_categoria in ('ternera', 'ternerona', 'novilla') then
      case
        when p_parto or p_ordeno then 'vaca'::categoria_animal   -- parió o da leche: es vaca
        when p_repro then p_categoria                            -- en camino de preñez: no sube por edad
        else etapa_por_edad(p_categoria, p_nacimiento)           -- sin un solo dato: por edad
      end
    when p_categoria in ('ternero', 'novillo') then etapa_por_edad(p_categoria, p_nacimiento)
    else p_categoria              -- vaca, toro, caballo, perro, otro: ya están donde deben
  end;
$$;

comment on function etapa_de_animal(categoria_animal, date, boolean, boolean, boolean) is
  'Etapa que le corresponde al bovino: manda el parto o el ordeño, el servicio la deja quieta y la edad es el respaldo.';

create or replace function motivo_etapa(p_nueva categoria_animal, p_parto boolean, p_ordeno boolean)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_nueva = 'vaca' and p_parto then 'parto registrado'
    when p_nueva = 'vaca' and p_ordeno then 'tiene ordeños'
    else 'edad sin historial'
  end;
$$;

comment on function motivo_etapa(categoria_animal, boolean, boolean) is
  'Motivo legible de un cambio de etapa hecho por el sistema.';

-- ─────────────────────────── Rastro de los cambios ───────────────────────────

create table if not exists cambios_etapa (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  etapa_anterior categoria_animal not null,
  etapa_nueva categoria_animal not null,
  motivo text not null,
  cambiado_en timestamptz not null default now(),
  cambiado_por uuid references auth.users default auth.uid()
);
create index if not exists cambios_etapa_animal_idx on cambios_etapa (animal_id, cambiado_en desc);

comment on table cambios_etapa is
  'Cada cambio de etapa de un animal, automático o a mano, con su motivo. Lo escribe el sistema.';

alter table cambios_etapa enable row level security;

-- Lo ve quien puede ver el animal; nadie lo escribe desde la aplicación: lo llenan las funciones
-- security definer de aquí abajo.
drop policy if exists "ver cambios de etapa" on cambios_etapa;
create policy "ver cambios de etapa" on cambios_etapa
  for select to authenticated using (puede_ver_animal(animal_id));

grant select on cambios_etapa to authenticated;
revoke insert, update, delete on cambios_etapa from authenticated;

-- ─────────────────────────── Puesta al día ───────────────────────────
-- Qué animales están en la etapa equivocada. Sin argumento, todo el hato activo.
create or replace function etapas_pendientes(p_animales uuid[] default null)
returns table (animal_id uuid, etapa_anterior categoria_animal, etapa_nueva categoria_animal)
language sql stable security definer
set search_path = public
as $$
  select h.id, h.categoria, etapa_de_animal(h.categoria, h.fecha_nacimiento, h.parto, h.ordeno, h.repro)
  from (
    select a.id, a.categoria, a.fecha_nacimiento,
           exists (select 1 from partos p where p.animal_id = a.id) as parto,
           exists (select 1 from ordenos o where o.animal_id = a.id) as ordeno,
           exists (select 1 from servicios s where s.animal_id = a.id)
             or exists (select 1 from palpaciones q where q.animal_id = a.id) as repro
      from animales a
     where a.estado = 'activo'
       and (p_animales is null or a.id = any (p_animales))
  ) h
  where etapa_de_animal(h.categoria, h.fecha_nacimiento, h.parto, h.ordeno, h.repro) <> h.categoria;
$$;

comment on function etapas_pendientes(uuid[]) is
  'Animales activos cuya etapa no es la que les corresponde, con la etapa que tienen y la que les toca.';

-- Corrige la etapa de los animales que se le pasen (null = todos). El disparador de `animales`
-- es el que deja el rastro; la marca `vacinfo.etapa_automatica` le avisa que el cambio no lo
-- pidió una persona, para que el motivo no salga como «cambio manual».
create or replace function actualizar_etapas_de(p_animales uuid[])
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  cambiados integer;
begin
  perform set_config('vacinfo.etapa_automatica', 'si', true);
  update animales a
     set categoria = e.etapa_nueva
    from etapas_pendientes(p_animales) e
   where a.id = e.animal_id;
  get diagnostics cambiados = row_count;
  perform set_config('vacinfo.etapa_automatica', '', true);
  return cambiados;
end;
$$;

create or replace function actualizar_etapas()
returns integer
language sql security definer
set search_path = public
as $$
  select actualizar_etapas_de(null);
$$;

comment on function actualizar_etapas() is
  'Pone al día la etapa de todo el hato activo con la regla híbrida. Corre sola cada día; también se puede llamar a mano.';

create or replace function actualizar_etapa_animal(p_animal uuid)
returns integer
language sql security definer
set search_path = public
as $$
  select actualizar_etapas_de(array[p_animal]);
$$;

comment on function actualizar_etapa_animal(uuid) is
  'Pone al día la etapa de un solo animal. La llaman los disparadores de partos y ordeños.';

-- ─────────────────────────── 1. Al guardar la ficha ───────────────────────────
create or replace function aplicar_etapa_animal()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_base categoria_animal;
  v_parto boolean;
  v_ordeno boolean;
  v_repro boolean;
  v_final categoria_animal;
  v_automatico boolean;
begin
  -- Al corregir se parte de la etapa que ya tenía: así un cambio a mano no puede bajarla.
  v_base := case when tg_op = 'UPDATE' then old.categoria else new.categoria end;

  select exists (select 1 from partos p where p.animal_id = new.id),
         exists (select 1 from ordenos o where o.animal_id = new.id),
         exists (select 1 from servicios s where s.animal_id = new.id)
           or exists (select 1 from palpaciones q where q.animal_id = new.id)
    into v_parto, v_ordeno, v_repro;

  v_final := etapa_mas_alta(new.categoria, etapa_de_animal(v_base, new.fecha_nacimiento, v_parto, v_ordeno, v_repro));

  -- El cambio es del sistema si lo pidió la puesta al día o si la regla corrigió lo que llegó.
  v_automatico := coalesce(current_setting('vacinfo.etapa_automatica', true), '') = 'si'
                  or v_final <> new.categoria;
  new.categoria := v_final;

  if tg_op = 'UPDATE' and v_final <> old.categoria then
    insert into cambios_etapa (animal_id, etapa_anterior, etapa_nueva, motivo)
    values (new.id, old.categoria, v_final,
            case when v_automatico then motivo_etapa(v_final, v_parto, v_ordeno) else 'cambio manual' end);
  end if;

  return new;
end;
$$;

comment on function aplicar_etapa_animal() is
  'Deja la ficha con la etapa que le corresponde y anota el cambio en cambios_etapa.';

-- El disparador por edad de 20261019000019 se reemplaza por este.
drop trigger if exists etapa_por_edad_al_guardar on animales;
drop function if exists aplicar_etapa_por_edad();

drop trigger if exists etapa_al_guardar on animales;
create trigger etapa_al_guardar
  before insert or update of categoria, fecha_nacimiento on animales
  for each row execute function aplicar_etapa_animal();

-- ─────────────────────────── 2. Al registrar un parto o un ordeño ───────────────────────────
-- La etapa ya no depende solo de la ficha, así que hay que reaccionar a los hechos. Se usan
-- disparadores por sentencia con tabla de transición (no por fila): una carga de ordeños de
-- toda una jornada, o del importador, se resuelve con una sola consulta en vez de una por fila.
-- Se dispara al insertar, no al borrar: un animal nunca baja de etapa.
create or replace function etapa_tras_evento()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_animales uuid[];
begin
  select array_agg(distinct animal_id) into v_animales from nuevas;
  if v_animales is not null then
    perform actualizar_etapas_de(v_animales);
  end if;
  return null;
end;
$$;

comment on function etapa_tras_evento() is
  'Pone al día la etapa de los animales de un parto o un ordeño recién registrados.';

drop trigger if exists etapa_tras_parto on partos;
create trigger etapa_tras_parto
  after insert on partos
  referencing new table as nuevas
  for each statement execute function etapa_tras_evento();

drop trigger if exists etapa_tras_ordeno on ordenos;
create trigger etapa_tras_ordeno
  after insert on ordenos
  referencing new table as nuevas
  for each statement execute function etapa_tras_evento();

-- `registrar_parto` ya subía la novilla a vaca con un update a pelo, que no servía para una
-- ternera que pare ni dejaba rastro. Ahora llama a la puesta al día del animal (el disparador
-- de arriba ya la hizo; la llamada queda como red de seguridad y es idempotente).
create or replace function registrar_parto(p_parto jsonb, p_cria jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  madre animales;
  cria_id uuid;
  parto_id uuid;
begin
  select * into madre from animales where id = (p_parto ->> 'animal_id')::uuid;
  if not found or not puede_ver_animal(madre.id) then
    raise exception 'No tienes acceso a este animal';
  end if;

  if exists (select 1 from partos where animal_id = madre.id and fecha = (p_parto ->> 'fecha')::date) then
    raise exception 'Ya hay un parto registrado para esta vaca en esa fecha';
  end if;

  if p_cria is not null then
    insert into animales (finca_id, codigo, chapeta, nombre, categoria, sexo, raza, fecha_nacimiento, madre_id, madre_nombre)
    values (
      madre.finca_id,
      p_cria ->> 'codigo',
      nullif(p_cria ->> 'chapeta', ''),
      p_cria ->> 'nombre',
      case when p_cria ->> 'sexo' = 'macho' then 'ternero'::categoria_animal else 'ternera'::categoria_animal end,
      (p_cria ->> 'sexo')::sexo,
      nullif(p_cria ->> 'raza', ''),
      (p_parto ->> 'fecha')::date,
      madre.id,
      madre.nombre
    )
    returning id into cria_id;
  end if;

  insert into partos (
    animal_id, fecha, cria_sexo, cria_raza, cria_id, en_la_noche, nacido_vivo, aborto,
    toma_calostro, persona_calostro, placenta_expulsada, lavado, observaciones
  ) values (
    madre.id,
    (p_parto ->> 'fecha')::date,
    nullif(p_parto ->> 'cria_sexo', '')::sexo,
    nullif(p_parto ->> 'cria_raza', ''),
    cria_id,
    (p_parto ->> 'en_la_noche')::boolean,
    coalesce((p_parto ->> 'nacido_vivo')::boolean, true),
    coalesce((p_parto ->> 'aborto')::boolean, false),
    (p_parto ->> 'toma_calostro')::boolean,
    nullif(p_parto ->> 'persona_calostro', ''),
    (p_parto ->> 'placenta_expulsada')::boolean,
    (p_parto ->> 'lavado')::boolean,
    nullif(p_parto ->> 'observaciones', '')
  )
  returning id into parto_id;

  -- La que pare es vaca, sin importar la etapa que tuviera.
  perform actualizar_etapa_animal(madre.id);

  return parto_id;
end $$;

-- Las funciones del sistema no se llaman desde fuera de la aplicación.
revoke execute on function
  escala_etapa(categoria_animal), rango_etapa(categoria_animal),
  etapa_mas_alta(categoria_animal, categoria_animal), etapa_por_edad(categoria_animal, date),
  etapa_de_animal(categoria_animal, date, boolean, boolean, boolean),
  motivo_etapa(categoria_animal, boolean, boolean), etapas_pendientes(uuid[]),
  actualizar_etapas_de(uuid[]), actualizar_etapas(), actualizar_etapa_animal(uuid),
  aplicar_etapa_animal(), etapa_tras_evento(), registrar_parto(jsonb, jsonb)
from anon, public;
grant execute on function registrar_parto(jsonb, jsonb) to authenticated;
revoke execute on function
  etapas_pendientes(uuid[]), actualizar_etapas_de(uuid[]), actualizar_etapas(),
  actualizar_etapa_animal(uuid), aplicar_etapa_animal(), etapa_tras_evento()
from authenticated;

-- ─────────────────────────── 3. Puesta al día de una vez ───────────────────────────
select actualizar_etapas();

-- ─────────────────────────── 4. Tarea diaria ───────────────────────────
-- Mismo nombre de tarea que en 20261019000019: se reemplaza. Si el proyecto no permite pg_cron,
-- la migración no falla: quedan los disparadores y basta con llamar a actualizar_etapas().
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('vacinfo-etapas-por-edad', '0 6 * * *', 'select public.actualizar_etapas()');
exception when others then
  raise notice 'pg_cron no disponible (%); la etapa se corrige al guardar y llamando actualizar_etapas()', sqlerrm;
end $$;
