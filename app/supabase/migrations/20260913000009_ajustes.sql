-- Ajustes del cliente: consultor de solo lectura, eventos programados en el calendario,
-- consumo automático de insumos y rendimiento de las funciones de la finca.

-- ─────────────────────────── 1 · Consultor de solo lectura ───────────────────────────
create function puede_registrar_finca(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fincas fi join miembros m on m.organizacion_id = fi.organizacion_id
    where fi.id = f and m.usuario_id = (select auth.uid()) and m.rol <> 'consultor'
      and (m.fincas is null or fi.id = any (m.fincas))
  );
$$;

create function puede_registrar_animal(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from animales an join fincas fi on fi.id = an.finca_id
    join miembros m on m.organizacion_id = fi.organizacion_id
    where an.id = a and m.usuario_id = (select auth.uid()) and m.rol <> 'consultor'
      and (m.fincas is null or fi.id = any (m.fincas))
  );
$$;

create function puede_registrar_organizacion(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros where organizacion_id = org and usuario_id = (select auth.uid()) and rol <> 'consultor'
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'potreros', 'animales', 'bienes', 'movimientos_insumos', 'consumos_diarios', 'recolecciones_leche', 'aplicaciones_campo',
    'controles_calidad', 'mantenimientos', 'visitas', 'parametros_costos', 'importaciones', 'rotaciones_potrero'
  ] loop
    execute format('drop policy "registrar" on %I', t);
    execute format('create policy "registrar" on %I for insert to authenticated with check (puede_registrar_finca(finca_id))', t);
  end loop;

  -- Estas dos permitían corregir a cualquier miembro.
  foreach t in array array['importaciones', 'rotaciones_potrero'] loop
    execute format('drop policy "corregir" on %I', t);
    execute format(
      'create policy "corregir" on %I for update to authenticated
         using (puede_registrar_finca(finca_id)) with check (puede_registrar_finca(finca_id))', t);
  end loop;

  foreach t in array array['ordenos', 'servicios', 'palpaciones', 'partos', 'secados', 'eventos_sanitarios', 'bajas', 'pesajes'] loop
    execute format('drop policy "registrar" on %I', t);
    execute format('create policy "registrar" on %I for insert to authenticated with check (puede_registrar_animal(animal_id))', t);
  end loop;
end $$;

drop policy "corregir mi pesaje" on pesajes;
create policy "corregir mi pesaje" on pesajes for update to authenticated
  using (registrado_por = (select auth.uid()) and registrado_en > now() - interval '1 day' and puede_registrar_animal(animal_id));

drop policy "crear comentarios" on comentarios;
create policy "crear comentarios" on comentarios for insert to authenticated
  with check (puede_registrar_organizacion(organizacion_id));

drop policy "enviar mensajes" on mensajes;
create policy "enviar mensajes" on mensajes for insert to authenticated
  with check (puede_registrar_organizacion(organizacion_id) and remitente_id = (select auth.uid()));

drop policy "registrar sincronización" on sincronizaciones;
create policy "registrar sincronización" on sincronizaciones for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (select 1 from miembros m where m.usuario_id = (select auth.uid()) and m.rol <> 'consultor')
  );

create or replace function registrar_destete(p_animal uuid, p_fecha date default current_date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede_ver_animal(p_animal) then
    raise exception 'No tienes acceso a este animal';
  end if;
  if not puede_registrar_animal(p_animal) then
    raise exception 'Tu rol de consultor es de solo lectura: puedes ver la información, pero no modificarla.';
  end if;
  update animales set fecha_destete = p_fecha where id = p_animal;
end $$;

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
  if not puede_registrar_animal(madre.id) then
    raise exception 'Tu rol de consultor es de solo lectura: puedes ver la información, pero no modificarla.';
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

  update animales set categoria = 'vaca' where id = madre.id and categoria = 'novilla';

  return parto_id;
end $$;

-- La baja cambia el estado del animal aunque quien la registra (p. ej. un trabajador) no pueda editar la ficha.
create or replace function aplicar_baja() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update animales set estado = case new.tipo
    when 'venta' then 'vendido'::estado_animal
    when 'muerte' then 'muerto'::estado_animal
    else 'retirado'::estado_animal end
  where id = new.animal_id;
  return new;
end $$;

revoke execute on function aplicar_baja() from anon, public, authenticated;

-- ─────────────────────────── 2 · Eventos programados ───────────────────────────
create table eventos_programados (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  fecha date not null,
  hora time,
  titulo text not null check (length(trim(titulo)) between 1 and 120),
  tipo text not null default 'otro' check (tipo in (
    'vacunacion', 'palpacion', 'secado', 'parto', 'tratamiento', 'mantenimiento', 'fumigacion', 'abonada',
    'visita_veterinario', 'reunion', 'otro'
  )),
  animal_id uuid references animales on delete set null,
  descripcion text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecho', 'cancelado')),
  recordar_dias int not null default 1 check (recordar_dias between 0 and 60),
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);
create index on eventos_programados (finca_id, fecha);

alter table eventos_programados enable row level security;
create policy "ver" on eventos_programados for select to authenticated using (puede_ver_finca(finca_id));
create policy "registrar" on eventos_programados for insert to authenticated with check (
  puede_registrar_finca(finca_id) and (
    animal_id is null
    or exists (select 1 from animales a where a.id = eventos_programados.animal_id and a.finca_id = eventos_programados.finca_id)
  )
);
create policy "corregir" on eventos_programados for update to authenticated using (puede_registrar_finca(finca_id)) with check (
  puede_registrar_finca(finca_id) and (
    animal_id is null
    or exists (select 1 from animales a where a.id = eventos_programados.animal_id and a.finca_id = eventos_programados.finca_id)
  )
);
create policy "borrar" on eventos_programados for delete to authenticated using (puede_gestionar_finca(finca_id));

-- ─────────────────────────── 3 · Consumo automático de insumos ───────────────────────────
create table consumos_programados (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  insumo_id uuid not null references insumos on delete cascade,
  modo text not null check (modo in ('fijo', 'por_animal')),
  cantidad numeric not null check (cantidad > 0),
  -- true: la cantidad está en kg y se convierte con insumos.contenido; false: en la unidad del insumo
  en_kg boolean not null default false,
  periodo text not null check (periodo in ('dia', 'mes', 'anio')),
  grupo text check (grupo in ('vacas_ordeno', 'vacas_horras', 'levante', 'todos')),
  desde date not null default current_date,
  hasta date,
  activo boolean not null default true,
  notas text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now(),
  check ((modo = 'por_animal') = (grupo is not null)),
  check (hasta is null or hasta >= desde)
);
create index on consumos_programados (finca_id);

alter table consumos_programados enable row level security;
create policy "ver" on consumos_programados for select to authenticated using (puede_ver_finca(finca_id));
create policy "registrar" on consumos_programados for insert to authenticated with check (
  puede_registrar_finca(finca_id) and exists (
    select 1 from insumos i join fincas f on f.organizacion_id = i.organizacion_id
    where i.id = consumos_programados.insumo_id and f.id = consumos_programados.finca_id
  )
);
create policy "corregir" on consumos_programados for update to authenticated using (puede_registrar_finca(finca_id)) with check (
  puede_registrar_finca(finca_id) and exists (
    select 1 from insumos i join fincas f on f.organizacion_id = i.organizacion_id
    where i.id = consumos_programados.insumo_id and f.id = consumos_programados.finca_id
  )
);
create policy "borrar" on consumos_programados for delete to authenticated using (puede_gestionar_finca(finca_id));

-- Animales por grupo en cada día del rango, con las mismas reglas de estado_reproductivo/resumen_finca
-- (se toman los animales activos hoy; en ordeño = último parto posterior al último secado).
-- Se calcula con intervalos de lactancia en vez de llamar resumen_finca por día: es exacto día a día y barato.
create function animales_por_dia(p_finca uuid, p_desde date, p_hasta date)
returns table (dia date, vacas_ordeno int, vacas_horras int, levante int, todos int)
language sql stable security invoker set search_path = public as $$
  with activos as materialized (
    select a.id, a.categoria, a.sexo, a.fecha_nacimiento from animales a
    where a.finca_id = p_finca and a.estado = 'activo'
  ),
  hembras as materialized (
    select id from activos where sexo = 'hembra' and categoria in ('vaca', 'novilla')
  ),
  partos_h as materialized (
    select p.animal_id, p.fecha from partos p join hembras h on h.id = p.animal_id where p.fecha <= p_hasta
  ),
  primer as materialized (
    select animal_id, min(fecha) as fecha from partos_h group by animal_id
  ),
  -- [inicio, fin): del parto al primer secado (el mismo día cuenta) o al siguiente parto
  lactancias as materialized (
    select p.animal_id, p.fecha as inicio, least(
      (select min(s.fecha) from secados s where s.animal_id = p.animal_id and s.fecha >= p.fecha),
      (select min(q.fecha) from partos_h q where q.animal_id = p.animal_id and q.fecha > p.fecha)
    ) as fin
    from partos_h p
  ),
  total_hembras as (select count(*)::int as n from hembras)
  select d.dia, o.n, pr.n - o.n, lv.n + th.n - pr.n, t.n
  from (select g::date as dia from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') g) d
  cross join total_hembras th
  cross join lateral (
    select count(distinct l.animal_id)::int as n from lactancias l where l.inicio <= d.dia and (l.fin is null or l.fin > d.dia)
  ) o
  cross join lateral (select count(*)::int as n from primer where primer.fecha <= d.dia) pr
  cross join lateral (
    select count(*)::int as n from activos
    where categoria in ('ternera', 'ternero', 'ternerona') and coalesce(fecha_nacimiento, d.dia) <= d.dia
  ) lv
  cross join lateral (select count(*)::int as n from activos where coalesce(fecha_nacimiento, d.dia) <= d.dia) t;
$$;

-- saldo = ingresos − salidas − consumo diario registrado − consumo automático (reglas de consumos_programados)
drop function saldo_insumos(uuid, date);
create function saldo_insumos(p_finca uuid, p_corte date default current_date)
returns table (
  insumo_id uuid,
  producto text,
  categoria categoria_insumo,
  unidad text,
  contenido numeric,
  ingresos numeric,
  salidas numeric,
  consumo_registrado numeric,
  saldo numeric,
  consumo_diario numeric,
  dias_alcanza numeric,
  stock_minimo numeric,
  ultimo_ingreso date,
  estado text,
  consumo_automatico numeric
)
language sql stable security invoker set search_path = public as $$
  with org as (select organizacion_id from fincas where id = p_finca),
  mov as (
    select i.id as insumo_id, coalesce(i.nombre, trim(m.producto)) as producto, m.tipo, m.cantidad, m.fecha, 'movimiento' as origen
    from movimientos_insumos m
    left join lateral (
      select ins.id, ins.nombre from insumos ins, org
      where ins.organizacion_id = org.organizacion_id
        and (ins.id = m.insumo_id or (m.insumo_id is null and lower(ins.nombre) = lower(trim(m.producto))))
      limit 1
    ) i on true
    where m.finca_id = p_finca and m.fecha <= p_corte
  ),
  consumo as (
    select i.id, i.nombre, 'salida'::tipo_movimiento,
      (case i.consumo_diario_fuente
        when 'concentrado_vacas' then c.kg_concentrado_vacas
        when 'sal_vacas' then c.kg_sal_vacas
        when 'concentrado_terneras' then c.kg_concentrado_terneras
        when 'sal_terneras' then c.kg_sal_terneras
      end) / nullif(i.contenido, 0),
      c.fecha, 'registrado'
    from consumos_diarios c
    cross join org
    join insumos i on i.organizacion_id = org.organizacion_id and i.consumo_diario_fuente is not null
    where c.finca_id = p_finca and c.fecha <= p_corte
  ),
  reglas as materialized (
    select r.*, i.nombre, i.contenido as kg_unidad, least(p_corte, r.hasta) as fin
    from consumos_programados r join insumos i on i.id = r.insumo_id
    where r.finca_id = p_finca and r.activo and r.desde <= least(p_corte, r.hasta, p_corte)
  ),
  conteo as materialized (
    select * from animales_por_dia(p_finca, (select min(desde) from reglas where modo = 'por_animal'), p_corte)
  ),
  automatico as (
    select r.insumo_id, r.nombre, 'salida'::tipo_movimiento,
      r.cantidad
        / case r.periodo when 'dia' then 1 when 'mes' then 30 else 365 end
        / case when r.en_kg then nullif(r.kg_unidad, 0) else 1 end
        * case r.grupo
            when 'vacas_ordeno' then c.vacas_ordeno
            when 'vacas_horras' then c.vacas_horras
            when 'levante' then c.levante
            when 'todos' then c.todos
            else 1
          end,
      g::date, 'automatico'
    from reglas r
    cross join generate_series(r.desde::timestamp, r.fin::timestamp, interval '1 day') g
    left join conteo c on r.modo = 'por_animal' and c.dia = g::date
  ),
  todo as (
    select * from mov
    union all
    select * from consumo
    union all
    select * from automatico
  ),
  agg as (
    select
      (array_agg(insumo_id) filter (where insumo_id is not null))[1] as insumo_id,
      min(producto) as producto,
      coalesce(sum(cantidad) filter (where tipo = 'ingreso'), 0) as ingresos,
      coalesce(sum(cantidad) filter (where tipo = 'salida' and origen = 'movimiento'), 0) as salidas,
      coalesce(sum(cantidad) filter (where origen = 'registrado'), 0) as consumo_registrado,
      coalesce(sum(cantidad) filter (where origen = 'automatico'), 0) as consumo_automatico,
      coalesce(sum(cantidad) filter (where tipo = 'salida' and origen <> 'automatico' and fecha > p_corte - 30), 0) as usado_30,
      min(fecha) filter (where tipo = 'salida' and origen <> 'automatico' and fecha > p_corte - 30) as primera_salida_30,
      coalesce(sum(cantidad) filter (where origen = 'automatico' and fecha > p_corte - 30), 0) as auto_30,
      min(fecha) filter (where origen = 'automatico' and fecha > p_corte - 30) as primera_auto_30,
      max(fecha) filter (where tipo = 'ingreso') as ultimo_ingreso
    from todo
    where cantidad is not null
    group by coalesce(insumo_id::text, lower(producto))
  ),
  calc as (
    select a.*, i.categoria, i.unidad, i.contenido, i.stock_minimo,
      round(a.ingresos - a.salidas - a.consumo_registrado - a.consumo_automatico, 2) as saldo,
      -- promedio de lo registrado + promedio del consumo automático, cada uno sobre sus propios días
      round(
        a.usado_30 / greatest(p_corte - a.primera_salida_30 + 1, 1)
        + a.auto_30 / greatest(p_corte - a.primera_auto_30 + 1, 1), 2) as consumo_diario
    from agg a left join insumos i on i.id = a.insumo_id
  )
  select * from (
    select insumo_id, producto, categoria, coalesce(unidad, 'unidad') as unidad, contenido, ingresos, salidas,
      round(consumo_registrado, 2) as consumo_registrado, saldo, consumo_diario,
      case when consumo_diario > 0 then round(greatest(saldo, 0) / consumo_diario, 1) end as dias_alcanza,
      stock_minimo, ultimo_ingreso,
      case
        when saldo <= 0 then 'agotado'
        when (consumo_diario > 0 and saldo / consumo_diario < 7) or (stock_minimo is not null and saldo < stock_minimo) then 'bajo'
        else 'ok'
      end as estado,
      round(consumo_automatico, 2) as consumo_automatico
    from calc
  ) r
  order by r.estado = 'ok', r.producto;
$$;

-- ─────────────────────────── 4 · Rendimiento ───────────────────────────
-- La fecha del último ordeño se buscaba recorriendo todos los ordeños de la finca, evaluando RLS fila por fila
-- (~50 ms). Con un "último por animal" sobre el índice (animal_id, fecha) se revisa una fila por animal.
-- Fecha del último ordeño de la finca hasta el corte (cualquier animal, activo o no).
create function ultimo_ordeno(p_finca uuid, p_corte date) returns table (fecha date)
language sql stable security invoker set search_path = public as $$
  select max(u.fecha)
  from animales a
  cross join lateral (
    select o.fecha from ordenos o where o.animal_id = a.id and o.fecha <= p_corte order by o.fecha desc limit 1
  ) u
  where a.finca_id = p_finca;
$$;

create or replace function estado_reproductivo(p_finca uuid, p_corte date default current_date)
returns table (
  animal_id uuid,
  codigo text,
  chapeta text,
  nombre text,
  categoria categoria_animal,
  ultimo_parto date,
  ultimo_secado date,
  en_ordeno boolean,
  dias_ordeno int,
  dias_seca int,
  ultimo_servicio date,
  toro_nombre text,
  toro_raza text,
  tipo_servicio tipo_servicio,
  inseminador text,
  ultima_palpacion date,
  resultado_palpacion resultado_palpacion,
  palpador text,
  prenada boolean,
  mora_prenez int,
  palpar_el date,
  secar_el date,
  parto_esperado date,
  cria_sexo sexo,
  litros_am numeric,
  litros_pm numeric,
  litros_total numeric
)
language sql stable security invoker set search_path = public as $$
  with base as (
    select a.*,
      (select max(p.fecha) from partos p where p.animal_id = a.id and p.fecha <= p_corte) as u_parto,
      (select max(s.fecha) from secados s where s.animal_id = a.id and s.fecha <= p_corte) as u_secado
    from animales a
    where a.finca_id = p_finca and a.estado = 'activo' and a.sexo = 'hembra'
      and a.categoria in ('vaca', 'novilla')
  ),
  srv as (
    select b.id, sv.fecha, sv.toro_nombre, sv.toro_raza, sv.tipo, sv.inseminador
    from base b
    left join lateral (
      select * from servicios s
      where s.animal_id = b.id and s.fecha <= p_corte and (b.u_parto is null or s.fecha > b.u_parto)
      order by s.fecha desc limit 1
    ) sv on true
  ),
  pal as (
    select b.id, pa.fecha, pa.resultado, pa.veterinario
    from base b join srv on srv.id = b.id
    left join lateral (
      select * from palpaciones p
      where p.animal_id = b.id and p.fecha <= p_corte and srv.fecha is not null and p.fecha >= srv.fecha
      order by p.fecha desc limit 1
    ) pa on true
  ),
  leche as (
    select o.animal_id,
      sum(o.litros) filter (where o.jornada = 'am') as am,
      sum(o.litros) filter (where o.jornada = 'pm') as pm
    from ordenos o
    where o.fecha = (select fecha from ultimo_ordeno(p_finca, p_corte))
    group by o.animal_id
  )
  select
    b.id, b.codigo, b.chapeta, b.nombre, b.categoria,
    b.u_parto, b.u_secado,
    en.en_ordeno,
    case when en.en_ordeno then p_corte - b.u_parto end,
    case when not en.en_ordeno and b.u_secado is not null then p_corte - b.u_secado end,
    srv.fecha, srv.toro_nombre, srv.toro_raza, srv.tipo, srv.inseminador,
    pal.fecha, pal.resultado, pal.veterinario,
    coalesce(pal.resultado = 'prenada', false),
    case when en.en_ordeno and coalesce(pal.resultado = 'prenada', false) = false
      then greatest((p_corte - b.u_parto) - 40, 0) end,
    case when srv.fecha is not null and pal.fecha is null then srv.fecha + 33 end,
    case when pal.resultado = 'prenada' then srv.fecha + 210 end,
    case when pal.resultado = 'prenada' then srv.fecha + 275 end,
    (select p.cria_sexo from partos p where p.animal_id = b.id and p.fecha = b.u_parto limit 1),
    l.am, l.pm, coalesce(l.am, 0) + coalesce(l.pm, 0)
  from base b
  join srv on srv.id = b.id
  join pal on pal.id = b.id
  cross join lateral (
    select (b.u_parto is not null and (b.u_secado is null or b.u_secado < b.u_parto)) as en_ordeno
  ) en
  left join leche l on l.animal_id = b.id
  order by b.nombre;
$$;

create or replace function resumen_finca(p_finca uuid, p_corte date default current_date)
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
  fecha_leche date
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
      count(*) filter (where a.categoria in ('ternera', 'ternero', 'ternerona'))::int as terneras,
      count(*)::int as total
    from animales a where a.finca_id = p_finca and a.estado = 'activo'
  )
  select
    count(*) filter (where en_ordeno)::int,
    count(*) filter (where not en_ordeno and ultimo_parto is not null)::int,
    count(*) filter (where ultimo_parto is null)::int,
    count(*) filter (where prenada)::int,
    count(*) filter (where ultimo_servicio is not null and not prenada)::int,
    count(*) filter (where en_ordeno and ultimo_servicio is null)::int,
    (select terneras from conteos),
    (select total from conteos),
    (select litros from leche),
    (select round(litros / nullif(vacas, 0), 1) from leche),
    (select fecha from ult)
  from er;
$$;

create or replace function alertas_finca(p_finca uuid, p_corte date default current_date, p_horizonte int default 7)
returns table (tipo text, prioridad urgencia, animal_id uuid, nombre text, chapeta text, fecha date, detalle text)
language sql stable security invoker set search_path = public as $$
  with er as materialized (select * from estado_reproductivo(p_finca, p_corte)),
  lv as materialized (select * from levante_finca(p_finca, p_corte)),
  ani as materialized (select a.id, a.nombre, a.chapeta from animales a where a.finca_id = p_finca)
  select 'palpar', 'media'::urgencia, er.animal_id, er.nombre, er.chapeta, er.palpar_el,
         'Palpar (33 días después del servicio del ' || to_char(er.ultimo_servicio, 'DD/MM/YY') || ')'
  from er where er.palpar_el <= p_corte + p_horizonte
  union all
  select 'secar', 'alta', er.animal_id, er.nombre, er.chapeta, er.secar_el, 'Secar: 7 meses de preñez'
  from er where er.en_ordeno and er.secar_el <= p_corte + p_horizonte
  union all
  select 'parto', 'alta', er.animal_id, er.nombre, er.chapeta, er.parto_esperado, 'Parto esperado: preparar calostro y revisar placenta'
  from er where er.parto_esperado between p_corte - 15 and p_corte + p_horizonte
  union all
  select 'mora_prenez', case when er.mora_prenez > 60 then 'alta'::urgencia else 'media'::urgencia end,
         er.animal_id, er.nombre, er.chapeta, p_corte, er.mora_prenez || ' días de mora sin preñez confirmada'
  from er where er.mora_prenez > 0 and er.ultimo_servicio is null
  union all
  select 'retiro_leche', 'alta', e.animal_id, a.nombre, a.chapeta, e.fecha_fin_retiro,
         'Leche en retiro por ' || coalesce(e.producto, e.tipo::text) || ' hasta ' || to_char(e.fecha_fin_retiro, 'DD/MM/YY')
  from (
    select es.*, coalesce(es.fecha_fin, es.fecha) + es.dias_retiro as fecha_fin_retiro
    from eventos_sanitarios es where es.dias_retiro > 0
  ) e join ani a on a.id = e.animal_id
  where p_corte between e.fecha and e.fecha_fin_retiro
  union all
  select 'vacuna', 'media', e.animal_id, a.nombre, a.chapeta, e.proxima_fecha,
         'Próxima dosis: ' || coalesce(e.producto, e.diagnostico, 'vacuna')
  from eventos_sanitarios e join ani a on a.id = e.animal_id
  where e.proxima_fecha between p_corte - 7 and p_corte + p_horizonte
  union all
  select 'insumo', case when s.estado = 'agotado' or s.dias_alcanza < 3 then 'alta'::urgencia else 'media'::urgencia end,
         null::uuid, s.producto, null::text, p_corte,
         case when s.estado = 'agotado' then 'Insumo agotado'
              else 'Quedan ' || s.saldo || ' ' || s.unidad || coalesce(' · alcanza para ' || s.dias_alcanza || ' días', '') end
  from saldo_insumos(p_finca, p_corte) s where s.estado in ('agotado', 'bajo')
  union all
  select 'destete', 'media', lv.animal_id, lv.nombre, lv.chapeta, lv.destetar_el, 'Destetar: ' || lv.edad_dias || ' días de nacida'
  from lv where lv.estado = 'destetar'
  union all
  select 'novilla_lista', 'media', lv.animal_id, lv.nombre, lv.chapeta, p_corte,
         'Lista para servicio: ' || lv.edad_meses || ' meses y ' || lv.ultimo_peso || ' kg'
  from lv where lv.estado = 'lista_servicio'
  union all
  -- Eventos programados pendientes: desde una semana vencidos hasta el horizonte (o los días de recordatorio, si son más).
  select 'programado', 'media', ep.animal_id, coalesce(a.nombre, ep.titulo), a.chapeta, ep.fecha,
         case ep.tipo
           when 'vacunacion' then 'Vacunación'
           when 'palpacion' then 'Palpación'
           when 'secado' then 'Secado'
           when 'parto' then 'Parto'
           when 'tratamiento' then 'Tratamiento'
           when 'mantenimiento' then 'Mantenimiento'
           when 'fumigacion' then 'Fumigación'
           when 'abonada' then 'Abonada'
           when 'visita_veterinario' then 'Visita del veterinario'
           when 'reunion' then 'Reunión'
           else 'Evento agendado'
         end || coalesce(' · ' || to_char(ep.hora, 'HH24:MI'), '')
           || case when a.id is not null then ': ' || ep.titulo else '' end
  from eventos_programados ep left join ani a on a.id = ep.animal_id
  where ep.finca_id = p_finca and ep.estado = 'pendiente'
    and ep.fecha between p_corte - 7 and p_corte + greatest(p_horizonte, ep.recordar_dias)
  order by 2 desc, 6;
$$;

create or replace function eventos_calendario(p_finca uuid, p_desde date, p_hasta date, p_corte date default current_date)
returns table (fecha date, tipo text, realizado boolean, animal_id uuid, nombre text, chapeta text, detalle text)
language sql stable security invoker set search_path = public as $$
  with ani as materialized (select id, nombre, chapeta, fecha_destete from animales where finca_id = p_finca),
  er as materialized (select * from estado_reproductivo(p_finca, p_corte))
  select p.fecha, 'parto', true, a.id, a.nombre, a.chapeta,
    case when p.aborto then 'Aborto' else 'Parto' || coalesce(' · cría ' || p.cria_sexo::text, '') end
  from partos p join ani a on a.id = p.animal_id where p.fecha between p_desde and p_hasta
  union all
  select s.fecha, 'servicio', true, a.id, a.nombre, a.chapeta,
    'Servicio' || coalesce(' con ' || s.toro_nombre, '') || coalesce(' (' || s.toro_raza || ')', '')
  from servicios s join ani a on a.id = s.animal_id where s.fecha between p_desde and p_hasta
  union all
  select pa.fecha, 'palpacion', true, a.id, a.nombre, a.chapeta,
    case pa.resultado when 'prenada' then 'Palpación: preñada' else 'Palpación: vacía' end
  from palpaciones pa join ani a on a.id = pa.animal_id where pa.fecha between p_desde and p_hasta
  union all
  select se.fecha, 'secado', true, a.id, a.nombre, a.chapeta, 'Secado'
  from secados se join ani a on a.id = se.animal_id where se.fecha between p_desde and p_hasta
  union all
  select e.fecha, 'sanidad', true, a.id, a.nombre, a.chapeta,
    initcap(replace(e.tipo::text, '_', ' ')) || coalesce(': ' || coalesce(e.producto, e.diagnostico), '')
  from eventos_sanitarios e join ani a on a.id = e.animal_id where e.fecha between p_desde and p_hasta
  union all
  select w.fecha, 'pesaje', true, a.id, a.nombre, a.chapeta, 'Pesaje: ' || w.peso_kg || ' kg'
  from pesajes w join ani a on a.id = w.animal_id where w.fecha between p_desde and p_hasta
  union all
  select a.fecha_destete, 'destete', true, a.id, a.nombre, a.chapeta, 'Destete'
  from ani a where a.fecha_destete between p_desde and p_hasta
  union all
  select er.palpar_el, 'palpar', false, er.animal_id, er.nombre, er.chapeta, 'Palpar (servicio del ' || to_char(er.ultimo_servicio, 'DD/MM/YY') || ')'
  from er where er.palpar_el between p_desde and p_hasta
  union all
  select er.secar_el, 'secar', false, er.animal_id, er.nombre, er.chapeta, 'Secar'
  from er where er.en_ordeno and er.secar_el between p_desde and p_hasta
  union all
  select er.parto_esperado, 'parto_esperado', false, er.animal_id, er.nombre, er.chapeta, 'Parto esperado'
  from er where er.parto_esperado between p_desde and p_hasta
  union all
  select e.proxima_fecha, 'vacuna', false, a.id, a.nombre, a.chapeta, 'Próxima dosis: ' || coalesce(e.producto, e.diagnostico, 'vacuna')
  from eventos_sanitarios e join ani a on a.id = e.animal_id where e.proxima_fecha between p_desde and p_hasta
  union all
  select coalesce(e.fecha_fin, e.fecha) + e.dias_retiro, 'fin_retiro', false, a.id, a.nombre, a.chapeta,
    'Termina retiro de leche (' || coalesce(e.producto, e.tipo::text) || ')'
  from eventos_sanitarios e join ani a on a.id = e.animal_id
  where e.dias_retiro > 0 and coalesce(e.fecha_fin, e.fecha) + e.dias_retiro between p_desde and p_hasta
  union all
  select l.destetar_el, 'destetar', false, l.animal_id, l.nombre, l.chapeta, 'Destetar'
  from levante_finca(p_finca, p_corte) l where l.destetar_el between p_desde and p_hasta
  union all
  select ep.fecha, 'programado', ep.estado = 'hecho', ep.animal_id, a.nombre, a.chapeta, ep.titulo
  from eventos_programados ep left join ani a on a.id = ep.animal_id
  where ep.finca_id = p_finca and ep.estado <> 'cancelado' and ep.fecha between p_desde and p_hasta
  order by 1, 2;
$$;

create index if not exists animales_finca_categoria_estado on animales (finca_id, categoria, estado);
create index if not exists eventos_sanitarios_proxima_fecha on eventos_sanitarios (proxima_fecha) where proxima_fecha is not null;
create index if not exists aplicaciones_campo_finca_fecha on aplicaciones_campo (finca_id, fecha);
create index if not exists rotaciones_potrero_potrero_salida on rotaciones_potrero (potrero_id, fecha_salida desc);
create index if not exists partos_cria_id on partos (cria_id) where cria_id is not null;
create index if not exists movimientos_insumos_finca_fecha on movimientos_insumos (finca_id, fecha);
create index if not exists bajas_animal_id on bajas (animal_id);
-- ordenos(animal_id, fecha) ya está cubierto por el único (animal_id, fecha, jornada).

-- ─────────────────────────── Permisos ───────────────────────────
revoke execute on function
  puede_registrar_finca(uuid), puede_registrar_animal(uuid), puede_registrar_organizacion(uuid),
  animales_por_dia(uuid, date, date), saldo_insumos(uuid, date), ultimo_ordeno(uuid, date)
from anon, public;
grant execute on function
  puede_registrar_finca(uuid), puede_registrar_animal(uuid), puede_registrar_organizacion(uuid),
  animales_por_dia(uuid, date, date), saldo_insumos(uuid, date), ultimo_ordeno(uuid, date)
to authenticated;
