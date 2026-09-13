-- El trabajador registra el destete sin necesitar permiso para editar la ficha completa del animal.
create function registrar_destete(p_animal uuid, p_fecha date default current_date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede_ver_animal(p_animal) then
    raise exception 'No tienes acceso a este animal';
  end if;
  update animales set fecha_destete = p_fecha where id = p_animal;
end $$;

revoke execute on function registrar_destete(uuid, date) from anon, public;
grant execute on function registrar_destete(uuid, date) to authenticated;
