-- RLS por pertenencia a la organización + cálculos que reemplazan las fórmulas del Excel.

-- ─────────────────────────── Funciones de acceso ───────────────────────────
create function es_miembro(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where organizacion_id = org and usuario_id = (select auth.uid()));
$$;

create function es_gestor(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros
    where organizacion_id = org and usuario_id = (select auth.uid())
      and rol in ('propietario', 'administrador')
  );
$$;

create function puede_ver_finca(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fincas fi join miembros m on m.organizacion_id = fi.organizacion_id
    where fi.id = f and m.usuario_id = (select auth.uid())
  );
$$;

create function puede_gestionar_finca(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fincas fi join miembros m on m.organizacion_id = fi.organizacion_id
    where fi.id = f and m.usuario_id = (select auth.uid()) and m.rol in ('propietario', 'administrador')
  );
$$;

create function puede_ver_animal(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from animales an join fincas fi on fi.id = an.finca_id
    join miembros m on m.organizacion_id = fi.organizacion_id
    where an.id = a and m.usuario_id = (select auth.uid())
  );
$$;

-- ─────────────────────────── Políticas ───────────────────────────
alter table organizaciones enable row level security;
create policy "ver mi organización" on organizaciones for select to authenticated using (es_miembro(id));
create policy "gestionar mi organización" on organizaciones for update to authenticated using (es_gestor(id));

alter table perfiles enable row level security;
create policy "ver perfiles de mi organización" on perfiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from miembros yo join miembros otro on otro.organizacion_id = yo.organizacion_id
    where yo.usuario_id = (select auth.uid()) and otro.usuario_id = perfiles.id
  )
);
create policy "editar mi perfil" on perfiles for update to authenticated using (id = (select auth.uid()));

alter table miembros enable row level security;
create policy "ver miembros" on miembros for select to authenticated using (es_miembro(organizacion_id));
create policy "gestionar miembros" on miembros for all to authenticated
  using (es_gestor(organizacion_id)) with check (es_gestor(organizacion_id));

alter table fincas enable row level security;
create policy "ver fincas" on fincas for select to authenticated using (es_miembro(organizacion_id));
create policy "gestionar fincas" on fincas for all to authenticated
  using (es_gestor(organizacion_id)) with check (es_gestor(organizacion_id));

alter table insumos enable row level security;
create policy "ver insumos" on insumos for select to authenticated using (es_miembro(organizacion_id));
create policy "gestionar insumos" on insumos for all to authenticated
  using (es_gestor(organizacion_id)) with check (es_gestor(organizacion_id));

alter table comentarios enable row level security;
create policy "ver comentarios" on comentarios for select to authenticated using (es_miembro(organizacion_id));
create policy "crear comentarios" on comentarios for insert to authenticated with check (es_miembro(organizacion_id));
create policy "gestionar comentarios" on comentarios for update to authenticated using (es_gestor(organizacion_id));

alter table mensajes enable row level security;
create policy "ver mensajes" on mensajes for select to authenticated using (
  es_miembro(organizacion_id) and (
    destinatario_id is null or destinatario_id = (select auth.uid()) or remitente_id = (select auth.uid())
  )
);
create policy "enviar mensajes" on mensajes for insert to authenticated
  with check (es_miembro(organizacion_id) and remitente_id = (select auth.uid()));
create policy "marcar leído" on mensajes for update to authenticated using (destinatario_id = (select auth.uid()));

-- Tablas colgadas de una finca: todo miembro ve y registra; solo gestores corrigen o borran.
do $$
declare t text;
begin
  foreach t in array array[
    'potreros', 'animales', 'bienes', 'movimientos_insumos', 'consumos_diarios', 'recolecciones_leche',
    'aplicaciones_campo', 'controles_calidad', 'mantenimientos', 'visitas', 'parametros_costos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "ver" on %I for select to authenticated using (puede_ver_finca(finca_id))', t);
    execute format('create policy "registrar" on %I for insert to authenticated with check (puede_ver_finca(finca_id))', t);
    execute format('create policy "corregir" on %I for update to authenticated using (puede_gestionar_finca(finca_id))', t);
    execute format('create policy "borrar" on %I for delete to authenticated using (puede_gestionar_finca(finca_id))', t);
  end loop;

  foreach t in array array['ordenos', 'servicios', 'palpaciones', 'partos', 'secados', 'eventos_sanitarios', 'bajas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "ver" on %I for select to authenticated using (puede_ver_animal(animal_id))', t);
    execute format('create policy "registrar" on %I for insert to authenticated with check (puede_ver_animal(animal_id))', t);
    execute format(
      'create policy "corregir" on %I for update to authenticated using (
         exists (select 1 from animales a where a.id = animal_id and puede_gestionar_finca(a.finca_id)))', t);
    execute format(
      'create policy "borrar" on %I for delete to authenticated using (
         exists (select 1 from animales a where a.id = animal_id and puede_gestionar_finca(a.finca_id)))', t);
  end loop;
end $$;

alter table tareas_manual enable row level security;
create policy "leer manual" on tareas_manual for select to authenticated using (true);
alter table plan_sanitario enable row level security;
create policy "leer plan sanitario" on plan_sanitario for select to authenticated using (true);

-- ─────────────────────────── Estado reproductivo ───────────────────────────
-- Reglas de la planilla operativa de Toneles:
--   días en ordeño = corte - último parto (si no se ha secado después)
--   mora de preñez = días en ordeño - 40, cuando no hay servicio con preñez confirmada
--   palpar  = servicio + 33 días      secar = servicio + 210      parto esperado = secar + 65
create function estado_reproductivo(p_finca uuid, p_corte date default current_date)
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
    where o.fecha = (
      select max(o2.fecha) from ordenos o2 join animales a2 on a2.id = o2.animal_id
      where a2.finca_id = p_finca and o2.fecha <= p_corte
    )
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

-- Conteos del recuadro "ANIMALES EN LA FINCA"
create function resumen_finca(p_finca uuid, p_corte date default current_date)
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
  with er as (select * from estado_reproductivo(p_finca, p_corte)),
  ult as (
    select max(o.fecha) as fecha from ordenos o join animales a on a.id = o.animal_id
    where a.finca_id = p_finca and o.fecha <= p_corte
  ),
  leche as (
    select sum(o.litros) as litros, count(distinct o.animal_id) as vacas
    from ordenos o join animales a on a.id = o.animal_id, ult
    where a.finca_id = p_finca and o.fecha = ult.fecha
  )
  select
    count(*) filter (where en_ordeno)::int,
    count(*) filter (where not en_ordeno and ultimo_parto is not null)::int,
    count(*) filter (where ultimo_parto is null)::int,
    count(*) filter (where prenada)::int,
    count(*) filter (where ultimo_servicio is not null and not prenada)::int,
    count(*) filter (where en_ordeno and ultimo_servicio is null)::int,
    (select count(*) from animales a where a.finca_id = p_finca and a.estado = 'activo'
       and a.categoria in ('ternera', 'ternero', 'ternerona'))::int,
    (select count(*) from animales a where a.finca_id = p_finca and a.estado = 'activo')::int,
    (select litros from leche),
    (select round(litros / nullif(vacas, 0), 1) from leche),
    (select fecha from ult)
  from er;
$$;

-- Alertas accionables para mensajes/notificaciones
create function alertas_finca(p_finca uuid, p_corte date default current_date, p_horizonte int default 7)
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
  order by 2 desc, 6;
$$;
