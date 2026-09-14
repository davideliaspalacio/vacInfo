-- Etapas de los animales y terminología del consultor (2/2).
-- Requiere 20260914000011 (agrega 'novillo' al enum en una transacción anterior).
--
-- · ternerona → novilla (datos) y bloqueo para que no vuelva a aparecer.
-- · "vacas horras" → "vacas secas" en los textos guardados.
-- · levante_finca, animales_por_dia y resumen_finca: mismas firmas y columnas, con las etapas nuevas.
--
-- Se conservan a propósito los nombres internos: la columna vacas_horras de resumen_finca y
-- animales_por_dia, y el código 'vacas_horras' de consumos_programados.grupo (lo usan saldo_insumos,
-- la app instalada sin conexión y las colas pendientes de sincronizar). Solo cambian los textos visibles.

-- ─────────────── ternerona → novilla ───────────────
update animales set categoria = 'novilla' where categoria = 'ternerona';

-- Una app de campo con una versión vieja en caché (o una cola sin conexión) aún puede enviar
-- 'ternerona': se convierte en novilla antes de validar, en vez de perder el registro.
create or replace function normalizar_categoria_animal()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.categoria = 'ternerona' then
    new.categoria := 'novilla';
  end if;
  return new;
end;
$$;

drop trigger if exists normalizar_categoria on animales;
create trigger normalizar_categoria before insert or update of categoria on animales
  for each row execute function normalizar_categoria_animal();

-- Postgres no puede quitar un valor de un enum sin recrear el tipo; la restricción garantiza que no se use.
alter table animales drop constraint if exists animales_sin_ternerona;
alter table animales add constraint animales_sin_ternerona check (categoria <> 'ternerona');

-- ─────────────── horras → secas en textos guardados ───────────────
update rotaciones_potrero
set grupo = replace(replace(replace(grupo, 'Vacas horras', 'Vacas secas'), 'horras', 'secas'), 'Horras', 'Secas')
where grupo ilike '%horra%';

update tareas_manual
set descripcion = replace(replace(descripcion, 'vacas horras', 'vacas secas'), 'Vacas horras', 'Vacas secas')
where descripcion ilike '%horra%';

-- Nombres de ítems de costos (solo textos; las claves del JSON no cambian).
update parametros_costos
set datos = replace(replace(datos::text, '"Concentrado horras"', '"Concentrado vacas secas"'),
                    '"Concentrado novillas - terneronas"', '"Concentrado novillas"')::jsonb
where datos::text like '%"Concentrado horras"%' or datos::text like '%"Concentrado novillas - terneronas"%';

-- ─────────────── Funciones ───────────────
create or replace function levante_finca(p_finca uuid, p_corte date default current_date)
returns table (
  animal_id uuid,
  codigo text,
  chapeta text,
  nombre text,
  categoria categoria_animal,
  sexo sexo,
  raza text,
  fecha_nacimiento date,
  edad_dias int,
  edad_meses numeric,
  madre_nombre text,
  fecha_destete date,
  destetada boolean,
  destetar_el date,
  ultimo_peso numeric,
  fecha_ultimo_peso date,
  ganancia_diaria_g numeric,
  ultimo_servicio date,
  prenada boolean,
  estado text
)
language sql stable security invoker set search_path = public as $$
  with f as (select dias_destete, edad_servicio_meses, peso_servicio_kg from fincas where id = p_finca),
  base as (
    select a.id, a.codigo, a.chapeta, a.nombre, a.categoria, a.sexo, a.raza, a.fecha_destete,
      coalesce(a.fecha_nacimiento, (select p.fecha from partos p where p.cria_id = a.id limit 1)) as nac,
      coalesce(a.madre_nombre, (select m.nombre from animales m where m.id = a.madre_id)) as madre
    from animales a
    where a.finca_id = p_finca and a.estado = 'activo'
      and a.categoria in ('ternera', 'ternero', 'novilla', 'novillo')
      and not exists (select 1 from partos p where p.animal_id = a.id)
  )
  select b.id, b.codigo, b.chapeta, b.nombre, b.categoria, b.sexo, b.raza, b.nac,
    p_corte - b.nac,
    round((p_corte - b.nac) / 30.4, 1),
    b.madre,
    b.fecha_destete,
    b.fecha_destete is not null and b.fecha_destete <= p_corte,
    case when b.fecha_destete is null and b.nac is not null then b.nac + f.dias_destete end,
    w1.peso_kg, w1.fecha,
    case when w2.fecha is not null then round((w1.peso_kg - w2.peso_kg) * 1000 / (w1.fecha - w2.fecha)) end,
    sv.fecha,
    coalesce(pl.resultado = 'prenada', false),
    case
      when sv.fecha is not null then case when pl.resultado = 'prenada' then 'prenada' else 'servida' end
      when b.fecha_destete is null and b.nac is not null and p_corte - b.nac >= f.dias_destete then 'destetar'
      when b.fecha_destete is null and b.categoria in ('ternera', 'ternero') then 'lactante'
      when b.sexo = 'hembra' and b.nac is not null and (p_corte - b.nac) / 30.4 >= f.edad_servicio_meses
        and coalesce(w1.peso_kg, 0) >= f.peso_servicio_kg then 'lista_servicio'
      else 'levante'
    end
  from base b
  cross join f
  left join lateral (
    select w.peso_kg, w.fecha from pesajes w where w.animal_id = b.id and w.fecha <= p_corte order by w.fecha desc limit 1
  ) w1 on true
  left join lateral (
    select w.peso_kg, w.fecha from pesajes w where w.animal_id = b.id and w.fecha <= p_corte order by w.fecha desc offset 1 limit 1
  ) w2 on true
  left join lateral (
    select s.fecha from servicios s where s.animal_id = b.id and s.fecha <= p_corte order by s.fecha desc limit 1
  ) sv on true
  left join lateral (
    select pp.resultado from palpaciones pp
    where pp.animal_id = b.id and sv.fecha is not null and pp.fecha >= sv.fecha and pp.fecha <= p_corte
    order by pp.fecha desc limit 1
  ) pl on true
  order by b.nac nulls last, b.nombre;
$$;

-- vacas_horras conserva el nombre de columna (lo leen pantallas e informes); significa "vacas secas".
create or replace function animales_por_dia(p_finca uuid, p_desde date, p_hasta date)
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
    where categoria in ('ternera', 'ternero', 'novillo') and coalesce(fecha_nacimiento, d.dia) <= d.dia
  ) lv
  cross join lateral (select count(*)::int as n from activos where coalesce(fecha_nacimiento, d.dia) <= d.dia) t;
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
      count(*) filter (where a.categoria in ('ternera', 'ternero', 'novillo'))::int as terneras,
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

comment on column consumos_programados.grupo is
  'vacas_ordeno | vacas_horras (se muestra como "Vacas secas") | levante | todos';
