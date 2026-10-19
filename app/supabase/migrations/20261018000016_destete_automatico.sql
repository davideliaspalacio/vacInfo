-- ─────────────────── El destete se genera solo ───────────────────
--
-- Pedido del cliente: «El destete se debe generar de manera automática y no como un registro de
-- evento (por eso en los parámetros de la finca se pone un límite de días de destete para que el
-- sistema solo lo haga sin necesidad de registro)».
--
-- Regla única para toda la base:
--     destete del animal = coalesce(animales.fecha_destete, animales.fecha_nacimiento + fincas.dias_destete)
--
-- Es decir: si alguien ya registró la fecha a mano (datos históricos, o una cola sin señal de un
-- teléfono viejo), esa manda; el resto se calcula. No se escribe nada en `animales.fecha_destete`:
-- la fecha se calcula al vuelo, igual que las alertas, así que cambiar `fincas.dias_destete` mueve
-- solas todas las fechas automáticas y los animales con destete registrado no se mueven.
--
-- Qué cambia aquí (mismas firmas y mismas columnas; solo cambia lo que calculan):
--   * `levante_finca`: `fecha_destete`, `destetada` y `destetar_el` salen de la regla de arriba
--     (`destetar_el` ahora es la fecha de destete efectiva, pasada o futura). El estado
--     «destetar» desaparece: la cría es `lactante` hasta el día de su destete y `levante` después.
--   * `alertas_finca`: la alerta «destete» deja de ser tarea pendiente y pasa a aviso informativo
--     de prioridad baja dentro del horizonte. Razón: apartar la cría sigue siendo trabajo real de
--     la finca ese día, pero ya no hay nada que registrar, así que como tarea nunca se podría
--     cerrar y se acumularía para siempre (en la finca de pruebas ya había 5 vencidas por meses).
--     Al avisar solo en la ventana del horizonte, el aviso aparece a tiempo y nunca se acumula.
--   * `eventos_calendario`: una sola marca por animal en su fecha de destete, `destete` (hecha) si
--     ya pasó el corte y `destetar` (pendiente) si está por venir.
--
-- Compatibilidad: `registrar_destete` NO se borra. Los destetes ya registrados se conservan y un
-- teléfono con la app vieja en caché puede tener todavía una acción `destete` encolada sin señal;
-- el servidor la sigue aceptando (src/lib/offline/servidor.ts, src/lib/offline/esquemas.ts).
-- El registro manual solo desapareció de la interfaz.

comment on column fincas.dias_destete is
  'Días de nacida a los que el sistema da por destetada a la cría. Genera el destete solo: no hay que registrarlo. Una fecha_destete guardada a mano en el animal manda sobre este cálculo.';

comment on function registrar_destete(uuid, date) is
  'Se conserva por compatibilidad: ya no hay registro manual de destete en la interfaz (el destete se calcula con fincas.dias_destete), pero sigue aceptando colas sin señal de teléfonos con la app vieja y los destetes históricos ya guardados.';

-- ─────────────── Levante ───────────────
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
  crudo as (
    select a.id, a.codigo, a.chapeta, a.nombre, a.categoria, a.sexo, a.raza, a.fecha_destete,
      coalesce(a.fecha_nacimiento, (select p.fecha from partos p where p.cria_id = a.id limit 1)) as nac,
      coalesce(a.madre_nombre, (select m.nombre from animales m where m.id = a.madre_id)) as madre
    from animales a
    where a.finca_id = p_finca and a.estado = 'activo'
      and a.categoria in ('ternera', 'ternero', 'novilla', 'novillo')
      and not exists (select 1 from partos p where p.animal_id = a.id)
  ),
  -- El destete se genera solo: nacimiento + dias_destete, salvo que haya fecha registrada a mano.
  base as (
    select c.*, coalesce(c.fecha_destete, c.nac + f.dias_destete) as destete_el
    from crudo c cross join f
  )
  select b.id, b.codigo, b.chapeta, b.nombre, b.categoria, b.sexo, b.raza, b.nac,
    p_corte - b.nac,
    round((p_corte - b.nac) / 30.4, 1),
    b.madre,
    b.destete_el,
    coalesce(b.destete_el <= p_corte, false),
    b.destete_el,
    w1.peso_kg, w1.fecha,
    case when w2.fecha is not null then round((w1.peso_kg - w2.peso_kg) * 1000 / (w1.fecha - w2.fecha)) end,
    sv.fecha,
    coalesce(pl.resultado = 'prenada', false),
    case
      when sv.fecha is not null then case when pl.resultado = 'prenada' then 'prenada' else 'servida' end
      -- Lactante hasta el día del destete; después pasa a levante sin que nadie registre nada.
      when b.destete_el > p_corte then 'lactante'
      when b.destete_el is null and b.categoria in ('ternera', 'ternero') then 'lactante'
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

-- ─────────────── Alertas ───────────────
create or replace function alertas_finca(p_finca uuid, p_corte date default current_date, p_horizonte int default 7)
returns table (tipo text, prioridad urgencia, animal_id uuid, nombre text, chapeta text, fecha date, detalle text)
language sql stable security invoker set search_path = public as $$
  with er as materialized (select * from estado_reproductivo(p_finca, p_corte)),
  lv as materialized (select * from levante_finca(p_finca, p_corte)),
  ani as materialized (select a.id, a.nombre, a.chapeta, a.fecha_destete from animales a where a.finca_id = p_finca)
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
  -- Destete: aviso informativo, no tarea. El sistema lo da por hecho el día que la cría cumple los
  -- días de destete de la finca; aquí solo se avisa desde hoy hasta el horizonte (nunca vencido,
  -- así no se acumula) para que en la finca sepan qué cría hay que apartar. Solo los automáticos:
  -- si alguien dejó una fecha registrada a mano, no hay nada que anunciar.
  select 'destete', 'baja', lv.animal_id, lv.nombre, lv.chapeta, lv.fecha_destete,
         'Destete automático a los ' || (select dias_destete from fincas where id = p_finca)
           || ' días de nacida: pasa a levante sin registrar nada'
  from lv join ani a on a.id = lv.animal_id
  where a.fecha_destete is null and lv.fecha_destete between p_corte and p_corte + p_horizonte
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

-- ─────────────── Calendario ───────────────
create or replace function eventos_calendario(p_finca uuid, p_desde date, p_hasta date, p_corte date default current_date)
returns table (fecha date, tipo text, realizado boolean, animal_id uuid, nombre text, chapeta text, detalle text)
language sql stable security invoker set search_path = public as $$
  with f as (select dias_destete from fincas where id = p_finca),
  ani as materialized (
    -- destete_el: la fecha de destete efectiva (registrada a mano o calculada por la finca).
    select a.id, a.nombre, a.chapeta, a.fecha_destete,
      coalesce(a.fecha_destete, a.fecha_nacimiento + (select dias_destete from f)) as destete_el
    from animales a where a.finca_id = p_finca
  ),
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
  -- Una sola marca de destete por animal: hecha si ya pasó el corte, pendiente si está por venir.
  select a.destete_el,
    case when a.destete_el <= p_corte then 'destete' else 'destetar' end,
    a.destete_el <= p_corte, a.id, a.nombre, a.chapeta,
    case when a.destete_el <= p_corte then 'Destete' else 'Destetar' end
      || case when a.fecha_destete is null then ' (automático)' else '' end
  from ani a where a.destete_el between p_desde and p_hasta
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
  select ep.fecha, 'programado', ep.estado = 'hecho', ep.animal_id, a.nombre, a.chapeta, ep.titulo
  from eventos_programados ep left join ani a on a.id = ep.animal_id
  where ep.finca_id = p_finca and ep.estado <> 'cancelado' and ep.fecha between p_desde and p_hasta
  order by 1, 2;
$$;
