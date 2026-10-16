-- Fotos de animales, bienes y fincas.
--
-- El cliente pidió poder tomarle foto a cualquier elemento al registrarlo. Las imágenes se guardan en
-- un bucket privado de Storage llamado "fotos" y en la tabla solo queda la RUTA del archivo
-- (`foto_url`), nunca una URL firmada: la app firma el enlace cuando lo va a mostrar (una hora).
--
-- Ruta: {organizacion_id}/{tipo}/{archivo}  ·  tipo ∈ (animales, bienes, fincas)
--
-- Así la seguridad por empresa se puede aplicar con los mismos ayudantes de RLS que el resto del
-- esquema: ver → cualquier miembro de esa empresa (`es_miembro`); subir, cambiar o borrar → solo
-- propietarios y administradores (`es_gestor`). El consultor es de solo lectura: no puede subir.

-- ─────────────────────────── Columnas ───────────────────────────
-- `animales.foto_url` existe desde el esquema inicial; `bienes` y `fincas` también lo traían, pero se
-- dejan los `if not exists` para que la migración sea segura en bases que vengan de antes.
alter table animales add column if not exists foto_url text;
alter table bienes add column if not exists foto_url text;
alter table fincas add column if not exists foto_url text;

comment on column animales.foto_url is 'Ruta dentro del bucket privado "fotos": {organizacion_id}/animales/{uuid}.jpg. No es una URL: se firma al mostrarla.';
comment on column bienes.foto_url is 'Ruta dentro del bucket privado "fotos": {organizacion_id}/bienes/{uuid}.jpg. No es una URL: se firma al mostrarla.';
comment on column fincas.foto_url is 'Ruta dentro del bucket privado "fotos": {organizacion_id}/fincas/{uuid}.jpg. No es una URL: se firma al mostrarla.';

-- ─────────────────────────── Bucket ───────────────────────────
-- Privado, máximo 5 MB por archivo y solo imágenes. El navegador además redimensiona antes de subir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ─────────────────────────── Dueño de la ruta ───────────────────────────
-- Devuelve la organización de la ruta solo si tiene la forma esperada ({uuid}/{tipo}/{archivo});
-- cualquier otra cosa devuelve null y las políticas la rechazan (es_miembro(null) = es_gestor(null) = false).
create or replace function organizacion_de_ruta_foto(nombre text) returns uuid
language sql immutable set search_path = public, storage as $$
  with partes as (select storage.foldername(nombre) as carpetas)
  select case
    when array_length(carpetas, 1) = 2
      and carpetas[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and carpetas[2] in ('animales', 'bienes', 'fincas')
    then carpetas[1]::uuid
  end
  from partes;
$$;

comment on function organizacion_de_ruta_foto(text) is 'Organización dueña de una ruta del bucket "fotos" ({organizacion_id}/{tipo}/{archivo}); null si la ruta no es válida.';

revoke execute on function organizacion_de_ruta_foto(text) from anon, public;
grant execute on function organizacion_de_ruta_foto(text) to authenticated;

-- ─────────────────────────── Políticas del bucket ───────────────────────────
create policy "fotos: ver las de mi empresa" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and es_miembro(organizacion_de_ruta_foto(name)));

create policy "fotos: subir si gestiono" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and es_gestor(organizacion_de_ruta_foto(name)));

create policy "fotos: cambiar si gestiono" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and es_gestor(organizacion_de_ruta_foto(name)))
  with check (bucket_id = 'fotos' and es_gestor(organizacion_de_ruta_foto(name)));

create policy "fotos: borrar si gestiono" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and es_gestor(organizacion_de_ruta_foto(name)));
