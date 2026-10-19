-- Un código de invitación para trabajador o mayordomo debe traer finca: así nadie entra
-- viendo toda la empresa por descuido. Los roles de oficina (administrador, veterinario,
-- consultor) sí pueden crearse con acceso a todas las fincas.
-- NOT VALID: los códigos ya emitidos se conservan tal como están; la regla aplica a los nuevos.
alter table invitaciones
  add constraint invitaciones_campo_con_finca
  check (finca_id is not null or rol::text not in ('trabajador', 'mayordomo')) not valid;

comment on constraint invitaciones_campo_con_finca on invitaciones is
  'Trabajador y mayordomo se invitan siempre a una finca concreta; el acceso a todas se amplía después desde Empleados.';
