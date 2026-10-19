-- Pantalla «Revisar etapas» (/fincas/:id/etapas). La regla híbrida de 20261020000020 arregla sola
-- lo que puede, pero deja tres cosas que necesitan a una persona:
--   · animales que la regla cambiaría y nadie ha mandado a cambiar todavía (`etapas_pendientes`);
--   · datos que la regla no puede resolver (vaca sin partos ni ordeños, novilla con ordeños,
--     animal sin fecha de nacimiento);
--   · vacas que quedaron mal de la regla anterior por edad y que, como la etapa nunca baja, solo
--     se corrigen a mano.
--
-- Aquí va lo que necesita esa pantalla, y nada más: una lectura (`revision_etapas`) y dos
-- escrituras con permiso de gestor (`aplicar_etapas_finca`, `bajar_etapa_animal`). Las funciones
-- de 20261020000020 están revocadas al rol `authenticated` a propósito; estas tres son la puerta.

-- ─────────────────────────── Bajar una etapa a mano ───────────────────────────
-- `aplicar_etapa_animal` sube la etapa con `etapa_mas_alta`, así que un update a 'novilla' sobre
-- una vaca no hace nada. La marca `vacinfo.etapa_baja` le avisa que esta vez la corrección la
-- pidió una persona por la pantalla de revisión y que debe respetarla; queda como 'cambio manual'.
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
  v_baja boolean;
begin
  v_baja := coalesce(current_setting('vacinfo.etapa_baja', true), '') = 'si';

  -- Al corregir se parte de la etapa que ya tenía: así un cambio a mano no puede bajarla.
  v_base := case when tg_op = 'UPDATE' then old.categoria else new.categoria end;

  select exists (select 1 from partos p where p.animal_id = new.id),
         exists (select 1 from ordenos o where o.animal_id = new.id),
         exists (select 1 from servicios s where s.animal_id = new.id)
           or exists (select 1 from palpaciones q where q.animal_id = new.id)
    into v_parto, v_ordeno, v_repro;

  -- La única excepción a «nunca baja»: la corrección a mano de `bajar_etapa_animal`, que ya
  -- comprobó que la regla no la volvería a subir.
  v_final := case
    when v_baja then new.categoria
    else etapa_mas_alta(new.categoria, etapa_de_animal(v_base, new.fecha_nacimiento, v_parto, v_ordeno, v_repro))
  end;

  -- El cambio es del sistema si lo pidió la puesta al día o si la regla corrigió lo que llegó.
  v_automatico := not v_baja
                  and (coalesce(current_setting('vacinfo.etapa_automatica', true), '') = 'si'
                       or v_final <> new.categoria);
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
  'Deja la ficha con la etapa que le corresponde y anota el cambio en cambios_etapa. Respeta la baja a mano marcada con vacinfo.etapa_baja.';

-- ─────────────────────────── Lo que hay que revisar ───────────────────────────
-- Una fila por animal y por caso: un animal puede aparecer en dos grupos (por ejemplo una novilla
-- con ordeños, que además es un cambio pendiente), y así la pantalla agrupa y cuenta sin rehacer
-- la regla en TypeScript.
--
--   pendiente              la regla la cambiaría: `etapa_nueva` y `motivo` dicen a qué y por qué.
--   vaca_sin_historial     vaca sin un solo parto ni ordeño: falta cargar el historial.
--   novilla_con_ordenos    hembra joven con ordeños y sin parto: el dato es incoherente.
--   sin_nacimiento         sin fecha de nacimiento y sin hechos que decidan: la etapa no se puede
--                          calcular. Una vaca con partos no entra: su etapa ya la decide el hecho.
--   vaca_joven_sin_datos   vaca de menos de 36 meses sin ningún registro: pudo quedar mal de la
--                          regla vieja por edad y solo se corrige bajándola a mano.
create or replace function revision_etapas(p_finca uuid)
returns table (
  animal_id uuid,
  codigo text,
  chapeta text,
  nombre text,
  categoria categoria_animal,
  fecha_nacimiento date,
  edad_meses numeric,
  partos integer,
  ordenos integer,
  tiene_repro boolean,
  etapa_nueva categoria_animal,
  motivo text,
  caso text
)
language sql stable security definer
set search_path = public
as $$
  with permiso as (select puede_ver_finca(p_finca) as si),
  base as (
    select a.id, a.codigo, a.chapeta, a.nombre, a.categoria, a.fecha_nacimiento,
           (select count(*) from partos p where p.animal_id = a.id)::integer as partos,
           (select count(*) from ordenos o where o.animal_id = a.id)::integer as ordenos,
           exists (select 1 from servicios s where s.animal_id = a.id)
             or exists (select 1 from palpaciones q where q.animal_id = a.id) as repro
      from animales a
     cross join permiso
     where permiso.si
       and a.finca_id = p_finca
       and a.estado = 'activo'
       -- Caballo, perro y «otro» no tienen escala de etapas: nunca se tocan y no se revisan.
       and escala_etapa(a.categoria) is not null
  ),
  calc as (
    select b.*,
           round((current_date - b.fecha_nacimiento) / 30.4, 1) as edad,
           etapa_de_animal(b.categoria, b.fecha_nacimiento, b.partos > 0, b.ordenos > 0, b.repro) as regla,
           -- Vaca joven sin un solo dato: el caso que solo se arregla bajándola a mano.
           b.categoria = 'vaca' and b.partos = 0 and b.ordenos = 0 and not b.repro
             and b.fecha_nacimiento is not null
             and b.fecha_nacimiento > current_date - interval '36 months' as joven_sin_datos
      from base b
  )
  select c.id, c.codigo, c.chapeta, c.nombre, c.categoria, c.fecha_nacimiento, c.edad,
         c.partos, c.ordenos, c.repro,
         case when x.caso = 'pendiente' then c.regla end,
         case when x.caso = 'pendiente' then motivo_etapa(c.regla, c.partos > 0, c.ordenos > 0) end,
         x.caso
    from calc c
   cross join lateral (
     select unnest(array_remove(array[
       case when c.regla <> c.categoria then 'pendiente' end,
       case when c.joven_sin_datos then 'vaca_joven_sin_datos' end,
       case when c.categoria = 'vaca' and c.partos = 0 and c.ordenos = 0 and not c.joven_sin_datos
            then 'vaca_sin_historial' end,
       case when c.categoria in ('ternera', 'ternerona', 'novilla') and c.ordenos > 0 and c.partos = 0
            then 'novilla_con_ordenos' end,
       -- Sin fecha de nacimiento solo estorba cuando la etapa depende de la edad: los machos
       -- siempre, y las hembras que no tienen parto ni ordeño que decida por ellas.
       case when c.fecha_nacimiento is null
              and (escala_etapa(c.categoria) = 'macho' or (c.partos = 0 and c.ordenos = 0))
            then 'sin_nacimiento' end
     ], null)) as caso
   ) x;
$$;

comment on function revision_etapas(uuid) is
  'Animales de la finca cuya etapa hay que revisar, una fila por caso: pendiente, vaca_sin_historial, novilla_con_ordenos, sin_nacimiento, vaca_joven_sin_datos.';

-- ─────────────────────────── Aplicar la regla ───────────────────────────
-- Lo mismo que `actualizar_etapas_de`, pero acotado a una finca y con permiso de gestor: el
-- consultor solo mira y el trabajador no entra a VacInfo.
create or replace function aplicar_etapas_finca(p_finca uuid, p_animales uuid[] default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_animales uuid[];
begin
  if not puede_gestionar_finca(p_finca) then
    raise exception 'Solo el propietario y el administrador pueden corregir etapas';
  end if;

  select array_agg(a.id) into v_animales
    from animales a
   where a.finca_id = p_finca
     and a.estado = 'activo'
     and (p_animales is null or a.id = any (p_animales));

  if v_animales is null then
    return 0;
  end if;
  return actualizar_etapas_de(v_animales);
end;
$$;

comment on function aplicar_etapas_finca(uuid, uuid[]) is
  'Aplica la regla de etapa a los animales activos de una finca (null = todos). Solo propietario y administrador.';

-- ─────────────────────────── Bajar una etapa a mano ───────────────────────────
-- Solo hacia abajo y solo cuando la regla no la volvería a subir: si el animal tiene un parto o
-- ordeños, bajarla sería inútil (el disparador o la tarea diaria la devolverían a vaca al rato),
-- así que se rechaza con un mensaje que lo explica en vez de dejar un cambio que se deshace solo.
create or replace function bajar_etapa_animal(p_animal uuid, p_etapa categoria_animal)
returns categoria_animal
language plpgsql security definer
set search_path = public
as $$
declare
  v animales;
  v_parto boolean;
  v_ordeno boolean;
  v_repro boolean;
begin
  select * into v from animales where id = p_animal;
  if not found then
    raise exception 'El animal no existe';
  end if;
  if not puede_gestionar_finca(v.finca_id) then
    raise exception 'Solo el propietario y el administrador pueden corregir etapas';
  end if;
  if escala_etapa(p_etapa) is null or escala_etapa(v.categoria) is distinct from escala_etapa(p_etapa) then
    raise exception 'La etapa % no es de la misma escala que %', p_etapa, v.categoria;
  end if;
  if rango_etapa(p_etapa) >= rango_etapa(v.categoria) then
    raise exception 'Esta pantalla solo baja la etapa: % no está por debajo de %', p_etapa, v.categoria;
  end if;

  select exists (select 1 from partos p where p.animal_id = v.id),
         exists (select 1 from ordenos o where o.animal_id = v.id),
         exists (select 1 from servicios s where s.animal_id = v.id)
           or exists (select 1 from palpaciones q where q.animal_id = v.id)
    into v_parto, v_ordeno, v_repro;

  if etapa_de_animal(p_etapa, v.fecha_nacimiento, v_parto, v_ordeno, v_repro) <> p_etapa then
    raise exception 'No se puede bajar a %: con los registros que tiene, la regla la volvería a subir', p_etapa;
  end if;

  perform set_config('vacinfo.etapa_baja', 'si', true);
  update animales set categoria = p_etapa where id = v.id;
  perform set_config('vacinfo.etapa_baja', '', true);
  return p_etapa;
end;
$$;

comment on function bajar_etapa_animal(uuid, categoria_animal) is
  'Baja a mano la etapa de un animal (única excepción a «nunca baja»), deja el rastro con motivo «cambio manual» y rechaza la baja que la regla desharía.';

-- Permisos: la pantalla llama a las tres; nadie más.
revoke execute on function
  revision_etapas(uuid), aplicar_etapas_finca(uuid, uuid[]), bajar_etapa_animal(uuid, categoria_animal)
from anon, public;
grant execute on function
  revision_etapas(uuid), aplicar_etapas_finca(uuid, uuid[]), bajar_etapa_animal(uuid, categoria_animal)
to authenticated;
