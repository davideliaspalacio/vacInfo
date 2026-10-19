-- La etapa del animal no subía nunca: una novilla registrada hace años seguía siendo novilla
-- aunque tuviera 25. Ahora la etapa se corrige con la edad en tres momentos:
--   1. al guardar la ficha (disparador),
--   2. una vez ahora para los animales ya cargados,
--   3. todos los días a las 6 a. m. para los que van cumpliendo años (si pg_cron está disponible).
-- Reglas (iguales a las del importador): hembras ternera <12 meses, novilla 12-24, vaca >24;
-- machos ternero <12, novillo 12-24, toro >24. Solo sube de etapa: nunca devuelve una vaca a novilla.

create or replace function etapa_por_edad(p_categoria categoria_animal, p_nacimiento date)
returns categoria_animal
language sql immutable
set search_path = public
as $$
  select case
    when p_nacimiento is null then p_categoria
    when p_categoria in ('ternera', 'novilla') then
      case
        when p_nacimiento > current_date - interval '12 months' then 'ternera'
        when p_nacimiento > current_date - interval '24 months' then 'novilla'
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
  'Etapa que le corresponde al animal por su edad. Solo sube de etapa; sin fecha de nacimiento deja la que tenga.';

-- 1. Al guardar: la ficha queda con la etapa correcta de una vez.
create or replace function aplicar_etapa_por_edad()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.categoria := etapa_por_edad(new.categoria, new.fecha_nacimiento);
  return new;
end;
$$;

drop trigger if exists etapa_por_edad_al_guardar on animales;
create trigger etapa_por_edad_al_guardar
  before insert or update of categoria, fecha_nacimiento on animales
  for each row execute function aplicar_etapa_por_edad();

-- 2 y 3. Puesta al día de los animales ya cargados.
create or replace function actualizar_etapas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cambiados integer;
begin
  update animales a
     set categoria = etapa_por_edad(a.categoria, a.fecha_nacimiento)
   where a.estado = 'activo'
     and a.fecha_nacimiento is not null
     and a.categoria <> etapa_por_edad(a.categoria, a.fecha_nacimiento);
  get diagnostics cambiados = row_count;
  return cambiados;
end;
$$;

comment on function actualizar_etapas() is
  'Sube de etapa a los animales que cumplieron edad. Corre sola cada día; también se puede llamar a mano.';

select actualizar_etapas();

-- Tarea diaria. Si el proyecto no permite pg_cron, la migración no falla: quedan el disparador
-- y la función, y basta con llamar a actualizar_etapas() desde fuera.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('vacinfo-etapas-por-edad', '0 6 * * *', 'select public.actualizar_etapas()');
exception when others then
  raise notice 'pg_cron no disponible (%); la etapa se corrige al guardar y llamando actualizar_etapas()', sqlerrm;
end $$;
