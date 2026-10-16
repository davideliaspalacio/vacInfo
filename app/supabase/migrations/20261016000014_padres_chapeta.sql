-- Chapetas de los padres en la ficha del ser vivo.
--
-- La "PLANILLA IMPLEMENTACIÓN SERES VIVOS" que llena el cliente en papel trae el nombre y la chapeta
-- de la madre y del padre. Cuando la chapeta de la madre coincide con un animal de la finca el
-- importador enlaza `madre_id`; cuando no coincide (padres vendidos, muertos o de otra finca) se
-- guarda el dato tal como vino para no perderlo y poder enlazarlo después a mano.
--
-- El padre nunca se enlaza: la app lo maneja como nombre libre (`padre_nombre`), igual que en el
-- formulario de ser vivo y en los servicios.

alter table animales add column padre_chapeta text;
alter table animales add column madre_chapeta text;

comment on column animales.padre_chapeta is 'Chapeta del padre tal como vino en la planilla. Informativa: el padre no se enlaza a una ficha.';
comment on column animales.madre_chapeta is 'Chapeta de la madre tal como vino en la planilla. Se conserva aunque madre_id quede en null porque la madre no está registrada en la finca.';
