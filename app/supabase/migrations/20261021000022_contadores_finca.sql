-- El cuadro de arriba de la finca no mostraba ni las crías ni el total: el ganadero registraba un
-- parto en VacDaTa, la cría se creaba bien (ternera enlazada a su madre, visible en Levante y en
-- «Otros animales»), pero ningún contador se movía y la suma de los contadores no explicaba el
-- total del hato («veo 4 animales y 1 + 2 + 0 son 3; ¿dónde está el cuarto?»).
--
-- `resumen_finca` ya devolvía `terneras` y `total_animales`, pero `terneras` cuenta también los
-- machos y los novillos, así que ese nombre no se puede enseñar tal cual. Se amplía la función con
-- dos columnas al final que **parten el hato activo sin dejar a nadie fuera**:
--
--   vacas_ordeno + vacas_horras + novillas_vientre  →  hembras bovinas vaca/novilla (vientres)
--   crias                                           →  ternera + ternero
--   otros                                           →  todo lo demás (novillo, toro, caballo, perro, otro)
--   ───────────────────────────────────────────────────────────────────────────────────────────
--   = total_animales
--
-- La partición es exacta por construcción: los tres primeros contadores reparten sin solaparse las
-- filas de `estado_reproductivo` (activas, hembras, categoría vaca o novilla) y `crias` y `otros`
-- se calculan sobre categorías que no se cruzan con esas. Por eso la pantalla ya puede escribir la
-- suma y el ganadero ve dónde está cada animal.
--
-- `terneras` se conserva con el mismo significado de siempre (ternera + ternero + novillo) para no
-- romper a nadie que ya la lea; lo nuevo es `crias`, que es lo que de verdad son crías.
--
-- Nota sobre la fecha de corte: el conjunto de animales nunca depende del corte (`estado_reproductivo`
-- filtra por `estado = 'activo'`, no por fechas); el corte solo decide los hechos reproductivos
-- (partos, secados, ordeños). Así que una cría recién nacida entra en los contadores enseguida,
-- aunque el corte de la finca sea el último ordeño registrado y ese sea anterior.

-- Añadir columnas al final cambia el tipo de retorno, y eso `create or replace` no lo permite:
-- hay que soltar la función. No hay vistas ni funciones que dependan de ella (solo la aplicación),
-- así que soltarla es seguro.
drop function if exists public.resumen_finca(uuid, date);

create function public.resumen_finca(p_finca uuid, p_corte date default current_date)
returns table (
  vacas_ordeno int,
  vacas_horras int,
  novillas_vientre int,
  prenadas int,
  servidas_sin_confirmar int,
  vacias int,
  terneras int,
  total_animales int,
  litros_dia numeric,
  promedio_vaca numeric,
  fecha_leche date,
  crias int,
  otros int
)
language sql stable security invoker set search_path = public as $$
  with er as materialized (select * from estado_reproductivo(p_finca, p_corte)),
  ult as materialized (select fecha from ultimo_ordeno(p_finca, p_corte)),
  leche as materialized (
    select sum(o.litros) as litros, count(distinct o.animal_id) as vacas
    from ordenos o join animales a on a.id = o.animal_id
    where a.finca_id = p_finca and o.fecha = (select fecha from ult)
  ),
  conteos as materialized (
    select
      -- Se conserva tal cual: cuenta hembras y machos de cría y de levante.
      count(*) filter (where a.categoria in ('ternera', 'ternero', 'novillo'))::int as terneras,
      -- Las crías propiamente dichas: lo que nace de un parto, hembra o macho.
      count(*) filter (where a.categoria in ('ternera', 'ternero'))::int as crias,
      -- El resto del hato: ni vientre ni cría (novillo, toro, caballo, perro, otro, ternerona).
      count(*) filter (
        where not (a.sexo = 'hembra' and a.categoria in ('vaca', 'novilla'))
          and a.categoria not in ('ternera', 'ternero')
      )::int as otros,
      count(*)::int as total
    from animales a where a.finca_id = p_finca and a.estado = 'activo'
  )
  select
    count(*) filter (where en_ordeno)::int,
    -- La etapa manda: una vaca que no está en ordeño está seca, aunque su parto no se haya
    -- registrado (pasa al cargar el hato con la plantilla). Novilla de vientre solo la que lo es.
    count(*) filter (where not en_ordeno and (ultimo_parto is not null or categoria = 'vaca'))::int,
    count(*) filter (where categoria = 'novilla' and not en_ordeno and ultimo_parto is null)::int,
    count(*) filter (where prenada)::int,
    count(*) filter (where ultimo_servicio is not null and not prenada)::int,
    count(*) filter (where en_ordeno and ultimo_servicio is null)::int,
    (select terneras from conteos),
    (select total from conteos),
    (select litros from leche),
    (select round(litros / nullif(vacas, 0), 1) from leche),
    (select fecha from ult),
    (select crias from conteos),
    (select otros from conteos)
  from er;
$$;

comment on function public.resumen_finca(uuid, date) is
  'Resumen del hato de la finca. Los contadores vacas_ordeno + vacas_horras + novillas_vientre + crias + otros suman exactamente total_animales; prenadas, servidas_sin_confirmar y vacias son cortes de los vientres y no se suman. terneras se mantiene por compatibilidad (ternera + ternero + novillo).';

-- Mismos privilegios que tenía: la lee cualquier sesión y RLS decide qué finca ve.
revoke execute on function public.resumen_finca(uuid, date) from anon, public;
grant execute on function public.resumen_finca(uuid, date) to authenticated;

-- ─────────────────────────── La ficha de la cría, completa ───────────────────────────
-- Revisando el recorrido del parto desde VacDaTa: la cría se crea con la etapa correcta (el
-- disparador de `animales` la deja en ternera/ternero por edad), queda enlazada a la madre y la
-- madre sube a vaca en ordeño. Lo que faltaba eran tres datos que se conocen y se dejaban en blanco:
--
--   · `especie`: se dejaba al valor por defecto de la tabla. Se escribe explícita, con la misma
--     regla que el formulario de ser vivo (`ESPECIE_DE_CATEGORIA`): una cría de vaca es bovina.
--   · `metodo_adquisicion`: la ficha lo muestra y una cría de un parto de la finca siempre nació
--     aquí; quedaba vacío como si no se supiera.
--   · `madre_chapeta`: `madre_id` es `on delete set null`, así que si algún día se borra la ficha
--     de la madre la cría se queda sin saber de quién es. Se guarda la chapeta, igual que hace el
--     importador de la plantilla.
--
-- Todo lo demás queda igual que en 20261020000020.
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
    insert into animales (
      finca_id, codigo, chapeta, nombre, especie, categoria, sexo, raza, fecha_nacimiento,
      metodo_adquisicion, madre_id, madre_nombre, madre_chapeta
    )
    values (
      madre.finca_id,
      p_cria ->> 'codigo',
      nullif(p_cria ->> 'chapeta', ''),
      p_cria ->> 'nombre',
      'bovino',
      case when p_cria ->> 'sexo' = 'macho' then 'ternero'::categoria_animal else 'ternera'::categoria_animal end,
      (p_cria ->> 'sexo')::sexo,
      nullif(p_cria ->> 'raza', ''),
      (p_parto ->> 'fecha')::date,
      'Nacido en la finca',
      madre.id,
      madre.nombre,
      madre.chapeta
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
