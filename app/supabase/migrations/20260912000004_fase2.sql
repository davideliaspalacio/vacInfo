-- Fase 2: importador, inventario, offline, invitaciones, registro de empresas,
-- indicadores, calendario, levante y potreros.

-- ─────────────────────────── Columnas nuevas ───────────────────────────
alter table organizaciones
  add column plan text not null default 'prueba',
  add column prueba_hasta date default current_date + 30,
  add column creado_por uuid references auth.users default auth.uid();

-- null = acceso a todas las fincas de la organización
alter table miembros add column fincas uuid[];

alter table fincas
  add column dias_descanso_objetivo int not null default 35,
  add column dias_destete int not null default 90,
  add column edad_servicio_meses int not null default 15,
  add column peso_servicio_kg numeric not null default 340;

alter table insumos
  add column stock_minimo numeric,
  add column consumo_diario_fuente text
    check (consumo_diario_fuente in ('concentrado_vacas', 'sal_vacas', 'concentrado_terneras', 'sal_terneras'));

alter table animales add column fecha_destete date;
alter table aplicaciones_campo add column potrero_ids uuid[];

-- Un evento por animal y día: permite importar varias veces sin duplicar.
create unique index partos_animal_fecha on partos (animal_id, fecha);
create unique index servicios_animal_fecha on servicios (animal_id, fecha);
create unique index palpaciones_animal_fecha on palpaciones (animal_id, fecha);
create unique index secados_animal_fecha on secados (animal_id, fecha);

-- ─────────────────────────── Tablas nuevas ───────────────────────────
create table importaciones (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  archivo text not null,
  hojas int not null default 0,
  resumen jsonb not null default '{}',
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

create table sincronizaciones (
  cliente_id uuid primary key,
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  accion text not null,
  registrado_en timestamptz not null default now()
);

create table invitaciones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones on delete cascade,
  finca_id uuid references fincas on delete cascade,
  rol rol_miembro not null default 'trabajador' check (rol <> 'propietario'),
  codigo text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  usos_max int not null default 10 check (usos_max > 0),
  usos int not null default 0,
  activa boolean not null default true,
  expira_en timestamptz not null default now() + interval '14 days',
  creado_por uuid references auth.users default auth.uid(),
  creado_en timestamptz not null default now()
);

create table pesajes (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  fecha date not null default current_date,
  peso_kg numeric not null check (peso_kg > 0),
  altura_cm numeric,
  condicion_corporal numeric check (condicion_corporal between 1 and 5),
  observaciones text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now(),
  unique (animal_id, fecha)
);

create table rotaciones_potrero (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  potrero_id uuid not null references potreros on delete cascade,
  grupo text not null default 'Vacas en ordeño',
  animales int,
  fecha_entrada date not null default current_date,
  fecha_salida date,
  observaciones text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now(),
  check (fecha_salida is null or fecha_salida >= fecha_entrada)
);
create index on rotaciones_potrero (potrero_id, fecha_entrada desc);

-- ─────────────────────────── Acceso por finca ───────────────────────────
create or replace function puede_ver_finca(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fincas fi join miembros m on m.organizacion_id = fi.organizacion_id
    where fi.id = f and m.usuario_id = (select auth.uid()) and (m.fincas is null or fi.id = any (m.fincas))
  );
$$;

create or replace function puede_gestionar_finca(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fincas fi join miembros m on m.organizacion_id = fi.organizacion_id
    where fi.id = f and m.usuario_id = (select auth.uid()) and m.rol in ('propietario', 'administrador')
      and (m.fincas is null or fi.id = any (m.fincas))
  );
$$;

create or replace function puede_ver_animal(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from animales an join fincas fi on fi.id = an.finca_id
    join miembros m on m.organizacion_id = fi.organizacion_id
    where an.id = a and m.usuario_id = (select auth.uid()) and (m.fincas is null or fi.id = any (m.fincas))
  );
$$;

drop policy "ver fincas" on fincas;
create policy "ver fincas" on fincas for select to authenticated using (puede_ver_finca(id));

-- ─────────────────────────── RLS de tablas nuevas ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['importaciones', 'rotaciones_potrero'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "ver" on %I for select to authenticated using (puede_ver_finca(finca_id))', t);
    execute format('create policy "registrar" on %I for insert to authenticated with check (puede_ver_finca(finca_id))', t);
    execute format('create policy "corregir" on %I for update to authenticated using (puede_ver_finca(finca_id))', t);
    execute format('create policy "borrar" on %I for delete to authenticated using (puede_gestionar_finca(finca_id))', t);
  end loop;
end $$;

alter table pesajes enable row level security;
create policy "ver" on pesajes for select to authenticated using (puede_ver_animal(animal_id));
create policy "registrar" on pesajes for insert to authenticated with check (puede_ver_animal(animal_id));
create policy "corregir" on pesajes for update to authenticated using (
  exists (select 1 from animales a where a.id = animal_id and puede_gestionar_finca(a.finca_id)));
create policy "borrar" on pesajes for delete to authenticated using (
  exists (select 1 from animales a where a.id = animal_id and puede_gestionar_finca(a.finca_id)));

alter table sincronizaciones enable row level security;
create policy "mis sincronizaciones" on sincronizaciones for select to authenticated using (usuario_id = (select auth.uid()));
create policy "registrar sincronización" on sincronizaciones for insert to authenticated
  with check (usuario_id = (select auth.uid()));

alter table invitaciones enable row level security;
create policy "gestionar invitaciones" on invitaciones for all to authenticated
  using (es_gestor(organizacion_id)) with check (es_gestor(organizacion_id));

-- ─────────────────────────── 13 · Invitaciones ───────────────────────────
create function ver_invitacion(p_codigo text)
returns table (organizacion text, finca text, rol rol_miembro, valida boolean)
language sql stable security definer set search_path = public as $$
  select o.nombre, f.nombre, i.rol, i.activa and i.expira_en > now() and i.usos < i.usos_max
  from invitaciones i
  join organizaciones o on o.id = i.organizacion_id
  left join fincas f on f.id = i.finca_id
  where i.codigo = upper(trim(p_codigo));
$$;

create function aceptar_invitacion(p_codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invitaciones;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para usar el código';
  end if;

  select * into inv from invitaciones where codigo = upper(trim(p_codigo)) for update;
  if not found or not inv.activa or inv.expira_en <= now() or inv.usos >= inv.usos_max then
    raise exception 'El código no es válido o ya venció';
  end if;

  insert into miembros (organizacion_id, usuario_id, rol, fincas)
  values (inv.organizacion_id, uid, inv.rol, case when inv.finca_id is null then null else array[inv.finca_id] end)
  on conflict (organizacion_id, usuario_id) do nothing;

  update invitaciones set usos = usos + 1 where id = inv.id;
  return inv.organizacion_id;
end $$;

-- ─────────────────────────── 14 · Registro de empresas ───────────────────────────
create function crear_organizacion(p_nombre text, p_nit text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  org uuid;
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para crear la empresa';
  end if;
  if exists (select 1 from miembros where usuario_id = uid) then
    raise exception 'Tu usuario ya pertenece a una empresa';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Escribe el nombre de la empresa';
  end if;

  insert into organizaciones (nombre, nit, creado_por) values (trim(p_nombre), nullif(trim(p_nit), ''), uid)
  returning id into org;
  insert into miembros (organizacion_id, usuario_id, rol) values (org, uid, 'propietario');
  return org;
end $$;

-- ─────────────────────────── 11 · Inventario ───────────────────────────
-- saldo = ingresos − salidas − consumo diario registrado (kg convertidos a la unidad del insumo)
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
  estado text
)
language sql stable security invoker set search_path = public as $$
  with org as (select organizacion_id from fincas where id = p_finca),
  mov as (
    select i.id as insumo_id, coalesce(i.nombre, trim(m.producto)) as producto, m.tipo, m.cantidad, m.fecha, false as es_consumo
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
      c.fecha, true
    from consumos_diarios c
    cross join org
    join insumos i on i.organizacion_id = org.organizacion_id and i.consumo_diario_fuente is not null
    where c.finca_id = p_finca and c.fecha <= p_corte
  ),
  todo as (
    select * from mov
    union all
    select * from consumo
  ),
  agg as (
    select
      (array_agg(insumo_id) filter (where insumo_id is not null))[1] as insumo_id,
      min(producto) as producto,
      coalesce(sum(cantidad) filter (where tipo = 'ingreso'), 0) as ingresos,
      coalesce(sum(cantidad) filter (where tipo = 'salida' and not es_consumo), 0) as salidas,
      coalesce(sum(cantidad) filter (where es_consumo), 0) as consumo_registrado,
      coalesce(sum(cantidad) filter (where tipo = 'salida' and fecha > p_corte - 30), 0) as usado_30,
      min(fecha) filter (where tipo = 'salida' and fecha > p_corte - 30) as primera_salida_30,
      max(fecha) filter (where tipo = 'ingreso') as ultimo_ingreso
    from todo
    where cantidad is not null
    group by coalesce(insumo_id::text, lower(producto))
  ),
  calc as (
    select a.*, i.categoria, i.unidad, i.contenido, i.stock_minimo,
      round(a.ingresos - a.salidas - a.consumo_registrado, 2) as saldo,
      round(a.usado_30 / greatest(p_corte - a.primera_salida_30 + 1, 1), 2) as consumo_diario
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
      end as estado
    from calc
  ) r
  order by r.estado = 'ok', r.producto;
$$;

-- ─────────────────────────── 17 · Levante ───────────────────────────
create function levante_finca(p_finca uuid, p_corte date default current_date)
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
      and a.categoria in ('ternera', 'ternero', 'ternerona', 'novilla')
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

-- ─────────────────────────── 18 · Potreros ───────────────────────────
create function estado_potreros(p_finca uuid, p_corte date default current_date)
returns table (
  potrero_id uuid,
  numero int,
  nombre text,
  area_cuadras numeric,
  ocupado boolean,
  grupo text,
  animales int,
  dias_ocupado int,
  ultima_salida date,
  dias_descanso int,
  ultima_aplicacion date,
  aplicacion_tipo tipo_aplicacion,
  aplicacion_producto text,
  retiro_hasta date,
  estado text
)
language sql stable security invoker set search_path = public as $$
  with apl as (
    select a.*, string_to_array(regexp_replace(coalesce(a.potreros, ''), '[^0-9,]', '', 'g'), ',') as numeros
    from aplicaciones_campo a where a.finca_id = p_finca and a.fecha <= p_corte
  )
  select p.id, p.numero, p.nombre, p.area_cuadras,
    ab.id is not null, ab.grupo, ab.animales,
    p_corte - ab.fecha_entrada,
    us.fecha_salida,
    p_corte - us.fecha_salida,
    ap.fecha, ap.tipo, ap.producto,
    ret.hasta,
    case
      when ab.id is not null then 'ocupado'
      when ret.hasta > p_corte then 'bloqueado'
      when us.fecha_salida is null then 'sin_datos'
      when p_corte - us.fecha_salida >= f.dias_descanso_objetivo then 'listo'
      else 'descansando'
    end
  from potreros p
  join fincas f on f.id = p.finca_id
  left join lateral (
    select r.id, r.grupo, r.animales, r.fecha_entrada from rotaciones_potrero r
    where r.potrero_id = p.id and r.fecha_entrada <= p_corte and (r.fecha_salida is null or r.fecha_salida > p_corte)
    order by r.fecha_entrada desc limit 1
  ) ab on true
  left join lateral (
    select r.fecha_salida from rotaciones_potrero r
    where r.potrero_id = p.id and r.fecha_salida <= p_corte
    order by r.fecha_salida desc limit 1
  ) us on true
  left join lateral (
    select a.fecha, a.tipo, a.producto from apl a
    where p.id = any (a.potrero_ids) or p.numero::text = any (a.numeros)
    order by a.fecha desc limit 1
  ) ap on true
  left join lateral (
    select max(a.fecha + a.dias_retiro_pastoreo) as hasta from apl a
    where coalesce(a.dias_retiro_pastoreo, 0) > 0 and (p.id = any (a.potrero_ids) or p.numero::text = any (a.numeros))
  ) ret on true
  where p.finca_id = p_finca
  order by p.numero;
$$;

-- ─────────────────────────── 15 · Indicadores ───────────────────────────
create function indicadores_mensuales(p_finca uuid, p_desde date, p_hasta date)
returns table (
  mes date,
  litros_totales numeric,
  dias_con_ordeno int,
  litros_dia numeric,
  vacas_ordeno_promedio numeric,
  litros_vaca_dia numeric,
  recogido_litros numeric,
  partos int,
  servicios int,
  palpaciones int,
  prenadas_confirmadas int,
  tasa_concepcion numeric,
  prenez_hato numeric,
  dias_abiertos_promedio numeric
)
language sql stable security invoker set search_path = public as $$
  with meses as (
    select m::date as mes, least((m + interval '1 month - 1 day')::date, p_hasta) as fin
    from generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month') m
  ),
  ani as (select id from animales where finca_id = p_finca),
  ord as (
    select date_trunc('month', o.fecha)::date as mes, sum(o.litros) as litros, count(distinct o.fecha) as dias,
      count(distinct o.animal_id::text || o.fecha::text) as vaca_dias
    from ordenos o join ani on ani.id = o.animal_id
    where o.fecha between p_desde and p_hasta group by 1
  ),
  rec as (
    select date_trunc('month', r.fecha)::date as mes, sum(r.litros) as litros
    from recolecciones_leche r where r.finca_id = p_finca and r.fecha between p_desde and p_hasta group by 1
  ),
  par as (
    select date_trunc('month', p.fecha)::date as mes, count(*) as n
    from partos p join ani on ani.id = p.animal_id
    where p.fecha between p_desde and p_hasta and not p.aborto group by 1
  ),
  ser as (
    select date_trunc('month', s.fecha)::date as mes, count(*) as n
    from servicios s join ani on ani.id = s.animal_id
    where s.fecha between p_desde and p_hasta group by 1
  ),
  pal as (
    select date_trunc('month', p.fecha)::date as mes, count(*) as total,
      count(*) filter (where p.resultado = 'prenada') as prenadas,
      avg(sv.fecha - pa.fecha) filter (where p.resultado = 'prenada' and pa.fecha is not null) as dias_abiertos
    from palpaciones p
    join ani on ani.id = p.animal_id
    left join lateral (
      select s.fecha from servicios s where s.animal_id = p.animal_id and s.fecha <= p.fecha order by s.fecha desc limit 1
    ) sv on true
    left join lateral (
      select x.fecha from partos x where x.animal_id = p.animal_id and x.fecha < sv.fecha order by x.fecha desc limit 1
    ) pa on true
    where p.fecha between p_desde and p_hasta group by 1
  )
  select m.mes,
    coalesce(o.litros, 0),
    coalesce(o.dias, 0)::int,
    round(o.litros / nullif(o.dias, 0), 1),
    round(o.vaca_dias::numeric / nullif(o.dias, 0), 1),
    round(o.litros / nullif(o.vaca_dias, 0), 1),
    coalesce(r.litros, 0),
    coalesce(pr.n, 0)::int,
    coalesce(s.n, 0)::int,
    coalesce(pl.total, 0)::int,
    coalesce(pl.prenadas, 0)::int,
    round(pl.prenadas::numeric / nullif(pl.total, 0), 3),
    h.prenez,
    round(pl.dias_abiertos, 0)
  from meses m
  left join ord o on o.mes = m.mes
  left join rec r on r.mes = m.mes
  left join par pr on pr.mes = m.mes
  left join ser s on s.mes = m.mes
  left join pal pl on pl.mes = m.mes
  left join lateral (
    select round(
      count(*) filter (where e.prenada and e.ultimo_parto is not null)::numeric
      / nullif(count(*) filter (where e.ultimo_parto is not null), 0), 3) as prenez
    from estado_reproductivo(p_finca, m.fin) e
  ) h on true
  order by m.mes;
$$;

-- ─────────────────────────── 16 · Calendario ───────────────────────────
create function eventos_calendario(p_finca uuid, p_desde date, p_hasta date, p_corte date default current_date)
returns table (fecha date, tipo text, realizado boolean, animal_id uuid, nombre text, chapeta text, detalle text)
language sql stable security invoker set search_path = public as $$
  with ani as (select id, nombre, chapeta, fecha_destete from animales where finca_id = p_finca)
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
  from estado_reproductivo(p_finca, p_corte) er where er.palpar_el between p_desde and p_hasta
  union all
  select er.secar_el, 'secar', false, er.animal_id, er.nombre, er.chapeta, 'Secar'
  from estado_reproductivo(p_finca, p_corte) er where er.en_ordeno and er.secar_el between p_desde and p_hasta
  union all
  select er.parto_esperado, 'parto_esperado', false, er.animal_id, er.nombre, er.chapeta, 'Parto esperado'
  from estado_reproductivo(p_finca, p_corte) er where er.parto_esperado between p_desde and p_hasta
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
  order by 1, 2;
$$;

-- ─────────────────────────── Alertas ampliadas ───────────────────────────
create or replace function alertas_finca(p_finca uuid, p_corte date default current_date, p_horizonte int default 7)
returns table (tipo text, prioridad urgencia, animal_id uuid, nombre text, chapeta text, fecha date, detalle text)
language sql stable security invoker set search_path = public as $$
  select 'palpar', 'media'::urgencia, animal_id, nombre, chapeta, palpar_el,
         'Palpar (33 días después del servicio del ' || to_char(ultimo_servicio, 'DD/MM/YY') || ')'
  from estado_reproductivo(p_finca, p_corte) where palpar_el <= p_corte + p_horizonte
  union all
  select 'secar', 'alta', animal_id, nombre, chapeta, secar_el, 'Secar: 7 meses de preñez'
  from estado_reproductivo(p_finca, p_corte) where en_ordeno and secar_el <= p_corte + p_horizonte
  union all
  select 'parto', 'alta', animal_id, nombre, chapeta, parto_esperado, 'Parto esperado: preparar calostro y revisar placenta'
  from estado_reproductivo(p_finca, p_corte)
  where parto_esperado between p_corte - 15 and p_corte + p_horizonte
  union all
  select 'mora_prenez', case when mora_prenez > 60 then 'alta'::urgencia else 'media'::urgencia end,
         animal_id, nombre, chapeta, p_corte, mora_prenez || ' días de mora sin preñez confirmada'
  from estado_reproductivo(p_finca, p_corte) where mora_prenez > 0 and ultimo_servicio is null
  union all
  select 'retiro_leche', 'alta', e.animal_id, a.nombre, a.chapeta, e.fecha_fin_retiro,
         'Leche en retiro por ' || coalesce(e.producto, e.tipo::text) || ' hasta ' || to_char(e.fecha_fin_retiro, 'DD/MM/YY')
  from (
    select es.*, coalesce(es.fecha_fin, es.fecha) + es.dias_retiro as fecha_fin_retiro
    from eventos_sanitarios es where es.dias_retiro > 0
  ) e join animales a on a.id = e.animal_id
  where a.finca_id = p_finca and p_corte between e.fecha and e.fecha_fin_retiro
  union all
  select 'vacuna', 'media', e.animal_id, a.nombre, a.chapeta, e.proxima_fecha,
         'Próxima dosis: ' || coalesce(e.producto, e.diagnostico, 'vacuna')
  from eventos_sanitarios e join animales a on a.id = e.animal_id
  where a.finca_id = p_finca and e.proxima_fecha between p_corte - 7 and p_corte + p_horizonte
  union all
  select 'insumo', case when s.estado = 'agotado' or s.dias_alcanza < 3 then 'alta'::urgencia else 'media'::urgencia end,
         null::uuid, s.producto, null::text, p_corte,
         case when s.estado = 'agotado' then 'Insumo agotado'
              else 'Quedan ' || s.saldo || ' ' || s.unidad || coalesce(' · alcanza para ' || s.dias_alcanza || ' días', '') end
  from saldo_insumos(p_finca, p_corte) s where s.estado in ('agotado', 'bajo')
  union all
  select 'destete', 'media', l.animal_id, l.nombre, l.chapeta, l.destetar_el, 'Destetar: ' || l.edad_dias || ' días de nacida'
  from levante_finca(p_finca, p_corte) l where l.estado = 'destetar'
  union all
  select 'novilla_lista', 'media', l.animal_id, l.nombre, l.chapeta, p_corte,
         'Lista para servicio: ' || l.edad_meses || ' meses y ' || l.ultimo_peso || ' kg'
  from levante_finca(p_finca, p_corte) l where l.estado = 'lista_servicio'
  order by 2 desc, 6;
$$;

-- ─────────────────────────── Permisos ───────────────────────────
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
grant execute on function ver_invitacion(text) to anon;
