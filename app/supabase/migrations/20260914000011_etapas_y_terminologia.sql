-- Etapas de los animales y terminología del consultor (1/2).
--
-- Etapas válidas: hembras ternera → novilla → vaca; machos ternero → novillo → toro.
-- "ternerona" deja de existir y "vaca horra" pasa a llamarse "vaca seca".
--
-- Un valor nuevo de enum no puede usarse en la misma transacción en que se agrega, y tanto
-- `supabase migration up` como `supabase db push` corren cada archivo en su propia transacción.
-- Por eso este archivo SOLO agrega 'novillo'; los datos, restricciones y funciones que lo usan
-- están en 20260914000012_etapas_y_terminologia_datos.sql.
--
-- Postgres no permite quitar un valor de un enum sin recrear el tipo (y todas las columnas,
-- funciones y políticas que dependen de él), así que 'ternerona' sigue en categoria_animal pero
-- queda bloqueado por la restricción animales_sin_ternerona (archivo 2/2).

alter type categoria_animal add value if not exists 'novillo' after 'novilla';
