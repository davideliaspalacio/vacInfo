-- Catálogos globales: plan sanitario preventivo y manual del trabajador.
-- Solo se cargan si las tablas están vacías (idempotente).

insert into plan_sanitario (enfermedad, joven, adulto, observaciones)
select * from (values
  ('Fiebre aftosa', 'A partir de los 6 meses, 2 veces al año', '2 veces al año', 'Sujeto a calendario oficial'),
  ('Estomatitis vesicular', '2 veces al año', '2 veces al año', 'Zonas endémicas o en riesgo. Asesoría ICA'),
  ('IBR - DVB - PI3 - BRSV', 'Vacunar al 4.º mes, revacunar al 5.º', 'Una vez al año', null),
  ('Rabia', 'Entre 3 y 6 meses', 'Una vez al año', 'Zonas endémicas o en riesgo. Asesoría ICA'),
  ('Carbón sintomático, edema maligno y clostridiosis', 'Vacunar al 4.º mes, revacunar al 5.º', 'Una vez al año', null),
  ('Botulismo', 'Vacunar al 6.º mes, revacunar al 7.º', 'Una vez al año', 'Zonas endémicas o en riesgo. Asesoría ICA'),
  ('Carbón bacteridiano (ántrax)', 'Vacunar a los 12 meses', 'Una vez al año', 'En zonas endémicas primovacunación desde los 6 meses'),
  ('Brucelosis', 'Hembras de 3 a 8 meses', 'Según ciclos de vacunación', 'Cepa RB-51 para no interferir con el diagnóstico'),
  ('Leptospirosis', 'Vacunar al 4.º mes, revacunar al 5.º', 'Cada 4 a 12 meses según prevalencia', null),
  ('Neumonía pasterelósica', 'Vacunar al 3.er mes, revacunar al 4.º', 'Una vez al año', 'Antes de destete, parto o transporte'),
  ('Desparasitación', 'Cada 4 meses', 'Cada 6 meses', 'Productos sin retiro para vacas de leche')
) v
where not exists (select 1 from plan_sanitario);

insert into tareas_manual (frecuencia, orden, descripcion)
select * from (values
  ('diaria'::frecuencia_tarea, 1, 'Hacer caso, escuchar, respetar e informar.'),
  ('diaria'::frecuencia_tarea, 2, 'Si no conoce una actividad, no la invente: pregunte al administrador o a un compañero.'),
  ('diaria'::frecuencia_tarea, 3, 'Para ingresar a laborar debe hacerse examen de ingreso general y de sicoactivos (lo paga la empresa).'),
  ('diaria'::frecuencia_tarea, 4, 'Procurar que las vacas entren a comer pasto en las tardes, abriendo pastura una sola vez al día.'),
  ('diaria'::frecuencia_tarea, 5, 'Ir al potrero por rieles o caminos, contar las vacas, abrir pastura, mover las aguas y encaminar las vacas despacio a la sala.'),
  ('diaria'::frecuencia_tarea, 6, 'En la sala: cerrar puertas, desinfectar equipos, colocar filtro y cerrar llave del tanque, calentar agua para el lavado.'),
  ('diaria'::frecuencia_tarea, 7, 'Ordeño: 1 kg de concentrado por cada 3 litros, limpiar y despuntar con tres chorros, secar tetas, colocar pezoneras, revisar que no quede leche y sellar.'),
  ('diaria'::frecuencia_tarea, 8, 'Juagar y lavar el equipo de ordeño, la fosa y la sala en la mañana y en la tarde; lavar la sala de espera en la mañana.'),
  ('diaria'::frecuencia_tarea, 9, 'Llevar leche a las terneras mañana y tarde, medio kilo de concentrado por animal, correr pasto y lavar el bebedero.'),
  ('diaria'::frecuencia_tarea, 10, 'Medir la leche del tanque mañana y tarde, anotarla, entregar al carrotanque y anotar lo recogido.'),
  ('diaria'::frecuencia_tarea, 11, 'Ir a los potreros mañana y tarde, contar las vacas, verificar el agua y que el potrero quede con cerca.'),
  ('diaria'::frecuencia_tarea, 12, 'Regar el abono de lunes a sábado (mañana en invierno, tarde en verano), revolviendo bulto por bulto.'),
  ('diaria'::frecuencia_tarea, 13, 'Cuidar las terneras de paso: un kilo de concentrado por animal, pastura, agua limpia todos los días.'),
  ('diaria'::frecuencia_tarea, 14, 'Revisar que el tanque de leche enfríe; apagarlo y bajar los breakers en la noche o si va a tronar o llover.'),
  ('diaria'::frecuencia_tarea, 15, 'Regar el tanque estercolero cada 2–3 días en verano (a diario en invierno); no dejar taquear la bomba y guardarla.'),
  ('diaria'::frecuencia_tarea, 16, 'Fumigar lento una o dos veces por semana según indicación del agrónomo; la máquina a 20 libras de presión, no más.'),
  ('diaria'::frecuencia_tarea, 17, 'Cuidar las novillas próximas a criar con 1–2 kg de concentrado preparto en las tardes.'),
  ('diaria'::frecuencia_tarea, 18, 'Lavar el tanque de enfriamiento y utensilios después de que el carrotanque recoja la leche.'),
  ('diaria'::frecuencia_tarea, 19, 'Verificar que las vacas que criaron expulsaron la placenta; si no, avisar al administrador para antibiótico.'),
  ('diaria'::frecuencia_tarea, 20, 'Revisar las vacas horras dos veces por semana: sin mastitis y sanas hasta que críen.'),
  ('diaria'::frecuencia_tarea, 21, 'Informar al administrador todo evento de vacas, terneras, compañeros, equipos, casa y vecinos.'),
  ('diaria'::frecuencia_tarea, 22, 'Regar veneno cada 8 días en lomo y patas de vacas y terneras para evitar el mosco.'),
  ('frecuente'::frecuencia_tarea, 1, 'Mantener limpios y sin huecos los caminos de ingreso de las vacas a la sala.'),
  ('frecuente'::frecuencia_tarea, 2, 'Los días 15 y 30 medir la leche de cada vaca en la tarde y anotar partos, abortos, cojeras, fiebres, servicios, concentrado y abonos.'),
  ('frecuente'::frecuencia_tarea, 3, 'Secar las vacas preñadas confirmadas a los 7 meses (palpar antes) o si dan menos de 5 litros; tratar mastitis antes de secar.'),
  ('frecuente'::frecuencia_tarea, 4, 'Revisar cada 5 días ubres y estado corporal de las vacas horras que estén en otra finca.'),
  ('frecuente'::frecuencia_tarea, 5, 'Revisar día por medio las vacas próximas a parir que estén en el paridero de otra finca.'),
  ('frecuente'::frecuencia_tarea, 6, 'Al parto: dar obligatoriamente 3 litros de calostro al ternero, calcio oral y en vena a la vaca, yodo en el ombligo; mover a las 24 horas.'),
  ('frecuente'::frecuencia_tarea, 7, 'Cambiar estacones quebrados y cuerdas reventadas; desechar la madera mala y el alambre de forma segura.'),
  ('frecuente'::frecuencia_tarea, 8, 'Marcar las vacas con retiro de leche (collar o tinta) y anotar fecha de retiro y de reingreso al tanque.'),
  ('frecuente'::frecuencia_tarea, 9, 'Recibir concentrado y fertilizante, diligenciar la planilla de ingreso y registrar las salidas al consumir.'),
  ('frecuente'::frecuencia_tarea, 10, 'Hacer los pedidos los viernes por escrito en el grupo de WhatsApp; se entregan a más tardar el domingo.'),
  ('frecuente'::frecuencia_tarea, 11, 'Arreglar la vía principal de la finca para evitar huecos o derrumbes.'),
  ('frecuente'::frecuencia_tarea, 12, 'Mantener limpias la casa, la sala de ordeño, el patio de espera y los caminos.'),
  ('frecuente'::frecuencia_tarea, 13, 'Llevar las basuras al punto de acopio los miércoles y los viernes.'),
  ('frecuente'::frecuencia_tarea, 14, 'Quemar los cachos a las terneras de 10 días de nacidas y verificar que quede bien hecho.'),
  ('frecuente'::frecuencia_tarea, 15, 'Cada 3 días revisar conexiones de agua y que los tanques de almacenamiento estén llenos y sin fugas.'),
  ('frecuente'::frecuencia_tarea, 16, 'Revisar que ninguna vaca que entra a la sala esté coja; si pasa, llamar al administrador de inmediato.'),
  ('frecuente'::frecuencia_tarea, 17, 'Cumplir las demás asignaciones del administrador o del dueño de la finca.'),
  ('frecuente'::frecuencia_tarea, 18, 'El gas lo compra cada viviente para su consumo.'),
  ('frecuente'::frecuencia_tarea, 19, 'Cada 15 días verificar que todas las vacas tengan chapeta; si falta, informar número y nombre.'),
  ('frecuente'::frecuencia_tarea, 20, 'Al retirarse debe hacerse los exámenes de retiro para poder ser liquidado.')
) v
where not exists (select 1 from tareas_manual);
