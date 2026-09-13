-- La CLI actual no concede privilegios por defecto sobre public: el acceso real lo decide RLS.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- Las funciones auxiliares de RLS no deben ser invocables sin sesión.
revoke execute on all functions in schema public from anon, public;
