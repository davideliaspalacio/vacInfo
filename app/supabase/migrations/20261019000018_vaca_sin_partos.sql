-- Una vaca sin partos registrados se contaba como «novilla de vientre»: al cargar el hato
-- con la plantilla, ninguna vaca trae historial de partos y todas salían mal clasificadas.
-- Ahora manda la etapa del animal y los partos solo se usan como dato adicional.

create or replace function public.resumen_finca(p_finca uuid, p_corte date DEFAULT CURRENT_DATE)
 RETURNS TABLE(vacas_ordeno integer, vacas_horras integer, novillas_vientre integer, prenadas integer, servidas_sin_confirmar integer, vacias integer, terneras integer, total_animales integer, litros_dia numeric, promedio_vaca numeric, fecha_leche date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    (select fecha from ult)
  from er;
$function$


