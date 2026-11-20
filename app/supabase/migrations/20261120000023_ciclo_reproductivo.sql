-- ─────────────── El ciclo reproductivo, como lo corrigió el cliente ───────────────
--
-- Textual del cliente: «El primer paso o momento 0 es cuando la vaca cría una ternera, porque activa
-- su ciclo de lactancia y entonces se puede ordeñar. Los primeros 45 días post parto se les va a
-- llamar "mora preñez" y es el periodo donde la vaca va a descansar; este dato aparece como un
-- contador negativo descendente (o sea empieza en −45 y llega a 0) y se para cuando la vaca vuelve a
-- ser inseminada confirmada (o sea que cuando en la palpación se confirma que está preñada, el día
-- que realmente acabó la mora preñez fue el día de la inseminación, no el día de la palpación). La
-- idea es que la vaca utilice estos 45 días para recuperar y no se considera tiempo perdido sino
-- tiempo de descanso, pero después del día 0 sí se empiezan a contar días positivos que indican
-- retrasos en la inseminación. A los 33 días de la inseminación se hace la palpación. A partir del
-- día de inseminación se cuentan 210 días para la fecha tentativa de seca y 280 días para parir la
-- cría.»
--
-- Qué cambia (mismas firmas y mismas columnas; solo cambia lo que calculan):
--
--   1 · `estado_reproductivo.mora_prenez` pasa de «días en ordeño − 40, nunca menor que 0» a un
--       contador CON SIGNO sobre 45 días:
--
--           mora_prenez = (días desde el último parto) − 45
--
--       Negativa durante los primeros 45 días (la vaca descansa y el número sube hacia 0), 0 el día
--       45 y positiva después: ahí sí son días de retraso para inseminar. Se CONGELA el día que una
--       palpación confirma la preñez, y se congela en el día del SERVICIO que la preñó, no en el de
--       la palpación (es el día en que de verdad se acabó la mora):
--
--           mora_prenez congelada = (fecha del servicio que la preñó − último parto) − 45
--
--       Así una vaca que se inseminó dentro del descanso queda con mora negativa para siempre
--       (Zulma, chapeta 176: servicio 44 días después del parto → −1) y una que se demoró queda con
--       los días reales que se perdieron (Yamile, chapeta 1401: servicio al día 57 → +12). Sigue
--       siendo nula cuando la vaca no está en ordeño: sin lactancia no hay mora que contar.
--
--   2 · `parto_esperado` pasa de `servicio + 275` a `servicio + 280`. Palpación (+33) y secado
--       (+210) ya estaban como el cliente los pidió y no se tocan.
--
--   3 · `alertas_finca`: la alerta de mora ya no puede dispararse con una vaca descansando. Umbrales
--       sobre el valor nuevo:
--
--           mora_prenez <= 0  → sin alerta (descanso: es tiempo de recuperación, no tiempo perdido)
--           mora_prenez >  0  → media      (pasó el día 0 y todavía no se inseminó: retraso real)
--           mora_prenez > 60  → alta       (más de dos meses de retraso; un intervalo entre partos
--                                           ya perdido, hay que revisar la vaca)
--
--       El 60 se conserva del umbral anterior a propósito: la finca ya está acostumbrada a ese
--       corte y lo único que cambia es desde dónde se cuenta (ahora desde el día 45, no desde el
--       40 ni desde el parto). El detalle dice en español qué pasa: «Lleva 20 días de retraso para
--       inseminar». La condición `ultimo_servicio is null` se mantiene: una vaca ya servida está
--       esperando palpación y tiene su propia alerta, no está en mora.
--
-- No se toca ninguna otra función: `resumen_finca`, `eventos_calendario` y `contadores_finca` leen
-- `estado_reproductivo`, así que heredan las dos fórmulas nuevas sin cambios.

-- ─────────────── Estado reproductivo ───────────────
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
    -- Mora de preñez con signo: −45 el día del parto, 0 el día 45, positiva después. Se congela el
    -- día del servicio que la preñó (no el de la palpación que lo confirmó) y es nula sin lactancia.
    case when en.en_ordeno then
      case when coalesce(pal.resultado = 'prenada', false)
        then (srv.fecha - b.u_parto) - 45
        else (p_corte - b.u_parto) - 45
      end
    end,
    case when srv.fecha is not null and pal.fecha is null then srv.fecha + 33 end,
    case when pal.resultado = 'prenada' then srv.fecha + 210 end,
    -- 280 días de gestación desde la inseminación (antes 275).
    case when pal.resultado = 'prenada' then srv.fecha + 280 end,
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

comment on function estado_reproductivo(uuid, date) is
  'Estado reproductivo de los vientres de una finca a una fecha de corte. mora_prenez va con signo: (días desde el último parto) − 45, negativa mientras la vaca descansa sus 45 días post parto, 0 el día 45 y positiva después (retraso real para inseminar); se congela en el día del servicio que la preñó cuando una palpación confirma la preñez y es nula si la vaca no está en ordeño. Palpación a servicio + 33, secado a servicio + 210, parto esperado a servicio + 280.';

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
  -- Mora de preñez: solo los días positivos son tarea. Con mora negativa o en 0 la vaca está en sus
  -- 45 días de descanso post parto y no hay nada que hacer, así que no se avisa; pasado el día 0 son
  -- días de retraso para inseminar (media) y por encima de 60 ya es un intervalo perdido (alta).
  select 'mora_prenez', case when er.mora_prenez > 60 then 'alta'::urgencia else 'media'::urgencia end,
         er.animal_id, er.nombre, er.chapeta, p_corte,
         'Lleva ' || er.mora_prenez || ' días de retraso para inseminar (la mora de preñez de 45 días terminó el '
           || to_char(er.ultimo_parto + 45, 'DD/MM/YY') || ')'
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

comment on function alertas_finca(uuid, date, int) is
  'Alertas vivas de una finca a una fecha de corte. La mora de preñez solo alerta con días positivos (media pasado el día 0, alta por encima de 60): con mora negativa la vaca está en sus 45 días de descanso post parto y no se avisa nada.';
