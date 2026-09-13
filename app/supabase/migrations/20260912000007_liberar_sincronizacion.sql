-- Si un registro offline falla al guardarse, se libera su marca para poder reintentarlo.
create policy "liberar sincronización" on sincronizaciones for delete to authenticated
  using (usuario_id = (select auth.uid()));
