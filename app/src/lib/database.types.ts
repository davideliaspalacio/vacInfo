export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      animales: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_animal"]
          chapeta: string | null
          codigo: string
          color: string | null
          creado_en: string
          especie: Database["public"]["Enums"]["especie"]
          estado: Database["public"]["Enums"]["estado_animal"]
          fecha_destete: string | null
          fecha_nacimiento: string | null
          finca_id: string
          foto_url: string | null
          id: string
          madre_id: string | null
          madre_nombre: string | null
          metodo_adquisicion: string | null
          nombre: string
          notas: string | null
          padre_nombre: string | null
          peso_kg: number | null
          raza: string | null
          sexo: Database["public"]["Enums"]["sexo"]
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["categoria_animal"]
          chapeta?: string | null
          codigo: string
          color?: string | null
          creado_en?: string
          especie?: Database["public"]["Enums"]["especie"]
          estado?: Database["public"]["Enums"]["estado_animal"]
          fecha_destete?: string | null
          fecha_nacimiento?: string | null
          finca_id: string
          foto_url?: string | null
          id?: string
          madre_id?: string | null
          madre_nombre?: string | null
          metodo_adquisicion?: string | null
          nombre: string
          notas?: string | null
          padre_nombre?: string | null
          peso_kg?: number | null
          raza?: string | null
          sexo?: Database["public"]["Enums"]["sexo"]
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_animal"]
          chapeta?: string | null
          codigo?: string
          color?: string | null
          creado_en?: string
          especie?: Database["public"]["Enums"]["especie"]
          estado?: Database["public"]["Enums"]["estado_animal"]
          fecha_destete?: string | null
          fecha_nacimiento?: string | null
          finca_id?: string
          foto_url?: string | null
          id?: string
          madre_id?: string | null
          madre_nombre?: string | null
          metodo_adquisicion?: string | null
          nombre?: string
          notas?: string | null
          padre_nombre?: string | null
          peso_kg?: number | null
          raza?: string | null
          sexo?: Database["public"]["Enums"]["sexo"]
        }
        Relationships: [
          {
            foreignKeyName: "animales_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animales_madre_id_fkey"
            columns: ["madre_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      aplicaciones_campo: {
        Row: {
          animales_tratados: number | null
          area: string | null
          cantidad: number | null
          dias_retiro_pastoreo: number | null
          fecha: string
          finca_id: string
          id: string
          jornada: Database["public"]["Enums"]["jornada"] | null
          personas: string | null
          potrero_ids: string[] | null
          potreros: string | null
          producto: string
          registrado_en: string
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_aplicacion"]
          unidad: string | null
        }
        Insert: {
          animales_tratados?: number | null
          area?: string | null
          cantidad?: number | null
          dias_retiro_pastoreo?: number | null
          fecha?: string
          finca_id: string
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"] | null
          personas?: string | null
          potrero_ids?: string[] | null
          potreros?: string | null
          producto: string
          registrado_en?: string
          registrado_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_aplicacion"]
          unidad?: string | null
        }
        Update: {
          animales_tratados?: number | null
          area?: string | null
          cantidad?: number | null
          dias_retiro_pastoreo?: number | null
          fecha?: string
          finca_id?: string
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"] | null
          personas?: string | null
          potrero_ids?: string[] | null
          potreros?: string | null
          producto?: string
          registrado_en?: string
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_aplicacion"]
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aplicaciones_campo_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      bajas: {
        Row: {
          animal_id: string
          causa: string | null
          fecha: string
          id: string
          registrado_en: string
          registrado_por: string | null
          responsable_traslado: string | null
          tipo: Database["public"]["Enums"]["tipo_baja"]
          valor: number | null
        }
        Insert: {
          animal_id: string
          causa?: string | null
          fecha: string
          id?: string
          registrado_en?: string
          registrado_por?: string | null
          responsable_traslado?: string | null
          tipo: Database["public"]["Enums"]["tipo_baja"]
          valor?: number | null
        }
        Update: {
          animal_id?: string
          causa?: string | null
          fecha?: string
          id?: string
          registrado_en?: string
          registrado_por?: string | null
          responsable_traslado?: string | null
          tipo?: Database["public"]["Enums"]["tipo_baja"]
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bajas_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      bienes: {
        Row: {
          codigo: string
          creado_en: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_bien"]
          fecha_adquisicion: string | null
          finca_id: string
          foto_url: string | null
          garantia_hasta: string | null
          id: string
          marca: string | null
          metodo_adquisicion: string | null
          nombre: string
          recordatorio: string | null
          tipo: Database["public"]["Enums"]["tipo_bien"]
        }
        Insert: {
          codigo: string
          creado_en?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_bien"]
          fecha_adquisicion?: string | null
          finca_id: string
          foto_url?: string | null
          garantia_hasta?: string | null
          id?: string
          marca?: string | null
          metodo_adquisicion?: string | null
          nombre: string
          recordatorio?: string | null
          tipo?: Database["public"]["Enums"]["tipo_bien"]
        }
        Update: {
          codigo?: string
          creado_en?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_bien"]
          fecha_adquisicion?: string | null
          finca_id?: string
          foto_url?: string | null
          garantia_hasta?: string | null
          id?: string
          marca?: string | null
          metodo_adquisicion?: string | null
          nombre?: string
          recordatorio?: string | null
          tipo?: Database["public"]["Enums"]["tipo_bien"]
        }
        Relationships: [
          {
            foreignKeyName: "bienes_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios: {
        Row: {
          estado: Database["public"]["Enums"]["estado_comentario"]
          finca_id: string | null
          id: string
          mensaje: string
          organizacion_id: string
          registrado_en: string
          registrado_por: string | null
          urgencia: Database["public"]["Enums"]["urgencia"]
        }
        Insert: {
          estado?: Database["public"]["Enums"]["estado_comentario"]
          finca_id?: string | null
          id?: string
          mensaje: string
          organizacion_id: string
          registrado_en?: string
          registrado_por?: string | null
          urgencia?: Database["public"]["Enums"]["urgencia"]
        }
        Update: {
          estado?: Database["public"]["Enums"]["estado_comentario"]
          finca_id?: string | null
          id?: string
          mensaje?: string
          organizacion_id?: string
          registrado_en?: string
          registrado_por?: string | null
          urgencia?: Database["public"]["Enums"]["urgencia"]
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_organizacion_id_fkey"
            columns: ["organizacion_id"]
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      consumos_diarios: {
        Row: {
          fecha: string
          finca_id: string
          id: string
          kg_concentrado_terneras: number | null
          kg_concentrado_vacas: number | null
          kg_sal_terneras: number | null
          kg_sal_vacas: number | null
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          fecha?: string
          finca_id: string
          id?: string
          kg_concentrado_terneras?: number | null
          kg_concentrado_vacas?: number | null
          kg_sal_terneras?: number | null
          kg_sal_vacas?: number | null
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          fecha?: string
          finca_id?: string
          id?: string
          kg_concentrado_terneras?: number | null
          kg_concentrado_vacas?: number | null
          kg_sal_terneras?: number | null
          kg_sal_vacas?: number | null
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumos_diarios_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      consumos_programados: {
        Row: {
          activo: boolean
          cantidad: number
          desde: string
          en_kg: boolean
          finca_id: string
          grupo: string | null
          hasta: string | null
          id: string
          insumo_id: string
          modo: string
          notas: string | null
          periodo: string
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          activo?: boolean
          cantidad: number
          desde?: string
          en_kg?: boolean
          finca_id: string
          grupo?: string | null
          hasta?: string | null
          id?: string
          insumo_id: string
          modo: string
          notas?: string | null
          periodo: string
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          activo?: boolean
          cantidad?: number
          desde?: string
          en_kg?: boolean
          finca_id?: string
          grupo?: string | null
          hasta?: string | null
          id?: string
          insumo_id?: string
          modo?: string
          notas?: string | null
          periodo?: string
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumos_programados_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumos_programados_insumo_id_fkey"
            columns: ["insumo_id"]
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      controles_calidad: {
        Row: {
          cloro: number | null
          estado: string | null
          fecha: string
          finca_id: string
          grados: number | null
          id: string
          jornada: Database["public"]["Enums"]["jornada"] | null
          muestra: string | null
          ph: number | null
          registrado_en: string
          registrado_por: string | null
          responsable: string | null
          tipo: Database["public"]["Enums"]["tipo_control"]
          tratamiento: string | null
        }
        Insert: {
          cloro?: number | null
          estado?: string | null
          fecha?: string
          finca_id: string
          grados?: number | null
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"] | null
          muestra?: string | null
          ph?: number | null
          registrado_en?: string
          registrado_por?: string | null
          responsable?: string | null
          tipo: Database["public"]["Enums"]["tipo_control"]
          tratamiento?: string | null
        }
        Update: {
          cloro?: number | null
          estado?: string | null
          fecha?: string
          finca_id?: string
          grados?: number | null
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"] | null
          muestra?: string | null
          ph?: number | null
          registrado_en?: string
          registrado_por?: string | null
          responsable?: string | null
          tipo?: Database["public"]["Enums"]["tipo_control"]
          tratamiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_calidad_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_programados: {
        Row: {
          animal_id: string | null
          descripcion: string | null
          estado: string
          fecha: string
          finca_id: string
          hora: string | null
          id: string
          recordar_dias: number
          registrado_en: string
          registrado_por: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          animal_id?: string | null
          descripcion?: string | null
          estado?: string
          fecha: string
          finca_id: string
          hora?: string | null
          id?: string
          recordar_dias?: number
          registrado_en?: string
          registrado_por?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          animal_id?: string | null
          descripcion?: string | null
          estado?: string
          fecha?: string
          finca_id?: string
          hora?: string | null
          id?: string
          recordar_dias?: number
          registrado_en?: string
          registrado_por?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_programados_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_programados_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_sanitarios: {
        Row: {
          animal_id: string
          cuartos: string[] | null
          diagnostico: string | null
          dias_retiro: number | null
          dosis: string | null
          estado: Database["public"]["Enums"]["estado_sanitario"]
          fecha: string
          fecha_fin: string | null
          frecuencia: string | null
          id: string
          lote: string | null
          observaciones: string | null
          operario: string | null
          producto: string | null
          proxima_fecha: string | null
          registrado_en: string
          registrado_por: string | null
          registro_ica: string | null
          tarjeta_profesional: string | null
          tipo: Database["public"]["Enums"]["tipo_evento_sanitario"]
          veterinario: string | null
          via_administracion: string | null
        }
        Insert: {
          animal_id: string
          cuartos?: string[] | null
          diagnostico?: string | null
          dias_retiro?: number | null
          dosis?: string | null
          estado?: Database["public"]["Enums"]["estado_sanitario"]
          fecha: string
          fecha_fin?: string | null
          frecuencia?: string | null
          id?: string
          lote?: string | null
          observaciones?: string | null
          operario?: string | null
          producto?: string | null
          proxima_fecha?: string | null
          registrado_en?: string
          registrado_por?: string | null
          registro_ica?: string | null
          tarjeta_profesional?: string | null
          tipo: Database["public"]["Enums"]["tipo_evento_sanitario"]
          veterinario?: string | null
          via_administracion?: string | null
        }
        Update: {
          animal_id?: string
          cuartos?: string[] | null
          diagnostico?: string | null
          dias_retiro?: number | null
          dosis?: string | null
          estado?: Database["public"]["Enums"]["estado_sanitario"]
          fecha?: string
          fecha_fin?: string | null
          frecuencia?: string | null
          id?: string
          lote?: string | null
          observaciones?: string | null
          operario?: string | null
          producto?: string | null
          proxima_fecha?: string | null
          registrado_en?: string
          registrado_por?: string | null
          registro_ica?: string | null
          tarjeta_profesional?: string | null
          tipo?: Database["public"]["Enums"]["tipo_evento_sanitario"]
          veterinario?: string | null
          via_administracion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_sanitarios_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      fincas: {
        Row: {
          area_cuadras: number | null
          codigo_asociado: string | null
          contrato_energia: string | null
          creado_en: string
          departamento: string | null
          dias_descanso_objetivo: number
          dias_destete: number
          direccion: string | null
          edad_servicio_meses: number
          empresa_compradora: string | null
          foto_url: string | null
          id: string
          municipio: string | null
          nombre: string
          organizacion_id: string
          peso_servicio_kg: number
          precio_litro: number | null
          registro_ica: string | null
          ruta: string | null
          tanque_numero: string | null
          tenencia: string | null
          vereda: string | null
        }
        Insert: {
          area_cuadras?: number | null
          codigo_asociado?: string | null
          contrato_energia?: string | null
          creado_en?: string
          departamento?: string | null
          dias_descanso_objetivo?: number
          dias_destete?: number
          direccion?: string | null
          edad_servicio_meses?: number
          empresa_compradora?: string | null
          foto_url?: string | null
          id?: string
          municipio?: string | null
          nombre: string
          organizacion_id: string
          peso_servicio_kg?: number
          precio_litro?: number | null
          registro_ica?: string | null
          ruta?: string | null
          tanque_numero?: string | null
          tenencia?: string | null
          vereda?: string | null
        }
        Update: {
          area_cuadras?: number | null
          codigo_asociado?: string | null
          contrato_energia?: string | null
          creado_en?: string
          departamento?: string | null
          dias_descanso_objetivo?: number
          dias_destete?: number
          direccion?: string | null
          edad_servicio_meses?: number
          empresa_compradora?: string | null
          foto_url?: string | null
          id?: string
          municipio?: string | null
          nombre?: string
          organizacion_id?: string
          peso_servicio_kg?: number
          precio_litro?: number | null
          registro_ica?: string | null
          ruta?: string | null
          tanque_numero?: string | null
          tenencia?: string | null
          vereda?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fincas_organizacion_id_fkey"
            columns: ["organizacion_id"]
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      importaciones: {
        Row: {
          archivo: string
          finca_id: string
          hojas: number
          id: string
          registrado_en: string
          registrado_por: string | null
          resumen: Json
        }
        Insert: {
          archivo: string
          finca_id: string
          hojas?: number
          id?: string
          registrado_en?: string
          registrado_por?: string | null
          resumen?: Json
        }
        Update: {
          archivo?: string
          finca_id?: string
          hojas?: number
          id?: string
          registrado_en?: string
          registrado_por?: string | null
          resumen?: Json
        }
        Relationships: [
          {
            foreignKeyName: "importaciones_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_insumo"]
          consumo_diario_fuente: string | null
          contenido: number | null
          id: string
          nombre: string
          organizacion_id: string
          precio: number | null
          stock_minimo: number | null
          unidad: string
        }
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_insumo"]
          consumo_diario_fuente?: string | null
          contenido?: number | null
          id?: string
          nombre: string
          organizacion_id: string
          precio?: number | null
          stock_minimo?: number | null
          unidad?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_insumo"]
          consumo_diario_fuente?: string | null
          contenido?: number | null
          id?: string
          nombre?: string
          organizacion_id?: string
          precio?: number | null
          stock_minimo?: number | null
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_organizacion_id_fkey"
            columns: ["organizacion_id"]
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          activa: boolean
          codigo: string
          creado_en: string
          creado_por: string | null
          expira_en: string
          finca_id: string | null
          id: string
          organizacion_id: string
          rol: Database["public"]["Enums"]["rol_miembro"]
          usos: number
          usos_max: number
        }
        Insert: {
          activa?: boolean
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          expira_en?: string
          finca_id?: string | null
          id?: string
          organizacion_id: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          usos?: number
          usos_max?: number
        }
        Update: {
          activa?: boolean
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          expira_en?: string
          finca_id?: string | null
          id?: string
          organizacion_id?: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          usos?: number
          usos_max?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_organizacion_id_fkey"
            columns: ["organizacion_id"]
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      mantenimientos: {
        Row: {
          bien_id: string | null
          celular: string | null
          detalle: string
          fecha: string
          finca_id: string
          id: string
          materiales: string | null
          potreros: string | null
          registrado_en: string
          registrado_por: string | null
          responsable: string | null
          tipo: Database["public"]["Enums"]["tipo_mantenimiento"]
        }
        Insert: {
          bien_id?: string | null
          celular?: string | null
          detalle: string
          fecha?: string
          finca_id: string
          id?: string
          materiales?: string | null
          potreros?: string | null
          registrado_en?: string
          registrado_por?: string | null
          responsable?: string | null
          tipo: Database["public"]["Enums"]["tipo_mantenimiento"]
        }
        Update: {
          bien_id?: string | null
          celular?: string | null
          detalle?: string
          fecha?: string
          finca_id?: string
          id?: string
          materiales?: string | null
          potreros?: string | null
          registrado_en?: string
          registrado_por?: string | null
          responsable?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mantenimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "mantenimientos_bien_id_fkey"
            columns: ["bien_id"]
            referencedRelation: "bienes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimientos_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          creado_en: string
          destinatario_id: string | null
          id: string
          leido: boolean
          organizacion_id: string
          remitente_id: string | null
          texto: string
        }
        Insert: {
          creado_en?: string
          destinatario_id?: string | null
          id?: string
          leido?: boolean
          organizacion_id: string
          remitente_id?: string | null
          texto: string
        }
        Update: {
          creado_en?: string
          destinatario_id?: string | null
          id?: string
          leido?: boolean
          organizacion_id?: string
          remitente_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_organizacion_id_fkey"
            columns: ["organizacion_id"]
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros: {
        Row: {
          creado_en: string
          fincas: string[] | null
          organizacion_id: string
          rol: Database["public"]["Enums"]["rol_miembro"]
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          fincas?: string[] | null
          organizacion_id: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          usuario_id: string
        }
        Update: {
          creado_en?: string
          fincas?: string[] | null
          organizacion_id?: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_organizacion_id_fkey"
            columns: ["organizacion_id"]
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_insumos: {
        Row: {
          cantidad: number
          entrega: string | null
          fecha: string
          finca_id: string
          hora: string | null
          id: string
          insumo_id: string | null
          producto: string
          recibe: string | null
          registrado_en: string
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          cantidad: number
          entrega?: string | null
          fecha?: string
          finca_id: string
          hora?: string | null
          id?: string
          insumo_id?: string | null
          producto: string
          recibe?: string | null
          registrado_en?: string
          registrado_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          cantidad?: number
          entrega?: string | null
          fecha?: string
          finca_id?: string
          hora?: string | null
          id?: string
          insumo_id?: string | null
          producto?: string
          recibe?: string | null
          registrado_en?: string
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_insumos_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenos: {
        Row: {
          animal_id: string
          fecha: string
          id: string
          jornada: Database["public"]["Enums"]["jornada"]
          litros: number
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          animal_id: string
          fecha: string
          id?: string
          jornada: Database["public"]["Enums"]["jornada"]
          litros: number
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          animal_id?: string
          fecha?: string
          id?: string
          jornada?: Database["public"]["Enums"]["jornada"]
          litros?: number
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenos_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      organizaciones: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: string
          nit: string | null
          nombre: string
          plan: string
          prueba_hasta: string | null
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          nit?: string | null
          nombre: string
          plan?: string
          prueba_hasta?: string | null
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          nit?: string | null
          nombre?: string
          plan?: string
          prueba_hasta?: string | null
        }
        Relationships: []
      }
      palpaciones: {
        Row: {
          animal_id: string
          dias_prenez: number | null
          fecha: string
          id: string
          observaciones: string | null
          registrado_en: string
          registrado_por: string | null
          resultado: Database["public"]["Enums"]["resultado_palpacion"]
          veterinario: string | null
        }
        Insert: {
          animal_id: string
          dias_prenez?: number | null
          fecha: string
          id?: string
          observaciones?: string | null
          registrado_en?: string
          registrado_por?: string | null
          resultado: Database["public"]["Enums"]["resultado_palpacion"]
          veterinario?: string | null
        }
        Update: {
          animal_id?: string
          dias_prenez?: number | null
          fecha?: string
          id?: string
          observaciones?: string | null
          registrado_en?: string
          registrado_por?: string | null
          resultado?: Database["public"]["Enums"]["resultado_palpacion"]
          veterinario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "palpaciones_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_costos: {
        Row: {
          datos: Json
          finca_id: string
          id: string
          periodo: string
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          datos: Json
          finca_id: string
          id?: string
          periodo: string
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          datos?: Json
          finca_id?: string
          id?: string
          periodo?: string
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parametros_costos_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      partos: {
        Row: {
          aborto: boolean
          animal_id: string
          cria_id: string | null
          cria_raza: string | null
          cria_sexo: Database["public"]["Enums"]["sexo"] | null
          en_la_noche: boolean | null
          fecha: string
          id: string
          lavado: boolean | null
          nacido_vivo: boolean
          observaciones: string | null
          persona_calostro: string | null
          placenta_expulsada: boolean | null
          registrado_en: string
          registrado_por: string | null
          toma_calostro: boolean | null
        }
        Insert: {
          aborto?: boolean
          animal_id: string
          cria_id?: string | null
          cria_raza?: string | null
          cria_sexo?: Database["public"]["Enums"]["sexo"] | null
          en_la_noche?: boolean | null
          fecha: string
          id?: string
          lavado?: boolean | null
          nacido_vivo?: boolean
          observaciones?: string | null
          persona_calostro?: string | null
          placenta_expulsada?: boolean | null
          registrado_en?: string
          registrado_por?: string | null
          toma_calostro?: boolean | null
        }
        Update: {
          aborto?: boolean
          animal_id?: string
          cria_id?: string | null
          cria_raza?: string | null
          cria_sexo?: Database["public"]["Enums"]["sexo"] | null
          en_la_noche?: boolean | null
          fecha?: string
          id?: string
          lavado?: boolean | null
          nacido_vivo?: boolean
          observaciones?: string | null
          persona_calostro?: string | null
          placenta_expulsada?: boolean | null
          registrado_en?: string
          registrado_por?: string | null
          toma_calostro?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "partos_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partos_cria_id_fkey"
            columns: ["cria_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          creado_en: string
          id: string
          nombre_completo: string
          telefono: string | null
        }
        Insert: {
          creado_en?: string
          id: string
          nombre_completo?: string
          telefono?: string | null
        }
        Update: {
          creado_en?: string
          id?: string
          nombre_completo?: string
          telefono?: string | null
        }
        Relationships: []
      }
      pesajes: {
        Row: {
          altura_cm: number | null
          animal_id: string
          condicion_corporal: number | null
          fecha: string
          id: string
          observaciones: string | null
          peso_kg: number
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          altura_cm?: number | null
          animal_id: string
          condicion_corporal?: number | null
          fecha?: string
          id?: string
          observaciones?: string | null
          peso_kg: number
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          altura_cm?: number | null
          animal_id?: string
          condicion_corporal?: number | null
          fecha?: string
          id?: string
          observaciones?: string | null
          peso_kg?: number
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesajes_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sanitario: {
        Row: {
          adulto: string | null
          enfermedad: string
          id: number
          joven: string | null
          observaciones: string | null
        }
        Insert: {
          adulto?: string | null
          enfermedad: string
          id?: number
          joven?: string | null
          observaciones?: string | null
        }
        Update: {
          adulto?: string | null
          enfermedad?: string
          id?: number
          joven?: string | null
          observaciones?: string | null
        }
        Relationships: []
      }
      potreros: {
        Row: {
          area_cuadras: number | null
          finca_id: string
          id: string
          nombre: string | null
          numero: number
        }
        Insert: {
          area_cuadras?: number | null
          finca_id: string
          id?: string
          nombre?: string | null
          numero: number
        }
        Update: {
          area_cuadras?: number | null
          finca_id?: string
          id?: string
          nombre?: string | null
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "potreros_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      recolecciones_leche: {
        Row: {
          celular_conductor: string | null
          conductor: string | null
          entregado_por: string | null
          fecha: string
          finca_id: string
          id: string
          litros: number
          placa: string | null
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          celular_conductor?: string | null
          conductor?: string | null
          entregado_por?: string | null
          fecha?: string
          finca_id: string
          id?: string
          litros: number
          placa?: string | null
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          celular_conductor?: string | null
          conductor?: string | null
          entregado_por?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          litros?: number
          placa?: string | null
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recolecciones_leche_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      rotaciones_potrero: {
        Row: {
          animales: number | null
          fecha_entrada: string
          fecha_salida: string | null
          finca_id: string
          grupo: string
          id: string
          observaciones: string | null
          potrero_id: string
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          animales?: number | null
          fecha_entrada?: string
          fecha_salida?: string | null
          finca_id: string
          grupo?: string
          id?: string
          observaciones?: string | null
          potrero_id: string
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          animales?: number | null
          fecha_entrada?: string
          fecha_salida?: string | null
          finca_id?: string
          grupo?: string
          id?: string
          observaciones?: string | null
          potrero_id?: string
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rotaciones_potrero_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotaciones_potrero_potrero_id_fkey"
            columns: ["potrero_id"]
            referencedRelation: "potreros"
            referencedColumns: ["id"]
          },
        ]
      }
      secados: {
        Row: {
          animal_id: string
          fecha: string
          id: string
          motivo: string | null
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          animal_id: string
          fecha: string
          id?: string
          motivo?: string | null
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          animal_id?: string
          fecha?: string
          id?: string
          motivo?: string | null
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secados_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          animal_id: string
          fecha: string
          id: string
          inseminador: string | null
          jornada: Database["public"]["Enums"]["jornada"] | null
          observaciones: string | null
          registrado_en: string
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_servicio"]
          toro_nombre: string | null
          toro_raza: string | null
        }
        Insert: {
          animal_id: string
          fecha: string
          id?: string
          inseminador?: string | null
          jornada?: Database["public"]["Enums"]["jornada"] | null
          observaciones?: string | null
          registrado_en?: string
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_servicio"]
          toro_nombre?: string | null
          toro_raza?: string | null
        }
        Update: {
          animal_id?: string
          fecha?: string
          id?: string
          inseminador?: string | null
          jornada?: Database["public"]["Enums"]["jornada"] | null
          observaciones?: string | null
          registrado_en?: string
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_servicio"]
          toro_nombre?: string | null
          toro_raza?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_animal_id_fkey"
            columns: ["animal_id"]
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      sincronizaciones: {
        Row: {
          accion: string
          cliente_id: string
          registrado_en: string
          usuario_id: string
        }
        Insert: {
          accion: string
          cliente_id: string
          registrado_en?: string
          usuario_id?: string
        }
        Update: {
          accion?: string
          cliente_id?: string
          registrado_en?: string
          usuario_id?: string
        }
        Relationships: []
      }
      tareas_manual: {
        Row: {
          descripcion: string
          frecuencia: Database["public"]["Enums"]["frecuencia_tarea"]
          id: number
          orden: number
        }
        Insert: {
          descripcion: string
          frecuencia: Database["public"]["Enums"]["frecuencia_tarea"]
          id?: number
          orden: number
        }
        Update: {
          descripcion?: string
          frecuencia?: Database["public"]["Enums"]["frecuencia_tarea"]
          id?: number
          orden?: number
        }
        Relationships: []
      }
      visitas: {
        Row: {
          cedula: string | null
          empresa: string | null
          fecha: string
          finca_id: string
          hora_ingreso: string | null
          id: string
          motivo: string | null
          nombre: string
          placa: string | null
          registrado_en: string
          registrado_por: string | null
        }
        Insert: {
          cedula?: string | null
          empresa?: string | null
          fecha?: string
          finca_id: string
          hora_ingreso?: string | null
          id?: string
          motivo?: string | null
          nombre: string
          placa?: string | null
          registrado_en?: string
          registrado_por?: string | null
        }
        Update: {
          cedula?: string | null
          empresa?: string | null
          fecha?: string
          finca_id?: string
          hora_ingreso?: string | null
          id?: string
          motivo?: string | null
          nombre?: string
          placa?: string | null
          registrado_en?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_finca_id_fkey"
            columns: ["finca_id"]
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceptar_invitacion: { Args: { p_codigo: string }; Returns: string }
      alertas_finca: {
        Args: { p_corte?: string; p_finca: string; p_horizonte?: number }
        Returns: {
          animal_id: string
          chapeta: string
          detalle: string
          fecha: string
          nombre: string
          prioridad: Database["public"]["Enums"]["urgencia"]
          tipo: string
        }[]
      }
      animales_por_dia: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          dia: string
          levante: number
          todos: number
          vacas_horras: number
          vacas_ordeno: number
        }[]
      }
      crear_organizacion: {
        Args: { p_nit?: string; p_nombre: string }
        Returns: string
      }
      es_gestor: { Args: { org: string }; Returns: boolean }
      es_miembro: { Args: { org: string }; Returns: boolean }
      estado_potreros: {
        Args: { p_corte?: string; p_finca: string }
        Returns: {
          animales: number
          aplicacion_producto: string
          aplicacion_tipo: Database["public"]["Enums"]["tipo_aplicacion"]
          area_cuadras: number
          dias_descanso: number
          dias_ocupado: number
          estado: string
          grupo: string
          nombre: string
          numero: number
          ocupado: boolean
          potrero_id: string
          retiro_hasta: string
          ultima_aplicacion: string
          ultima_salida: string
        }[]
      }
      estado_reproductivo: {
        Args: { p_corte?: string; p_finca: string }
        Returns: {
          animal_id: string
          categoria: Database["public"]["Enums"]["categoria_animal"]
          chapeta: string
          codigo: string
          cria_sexo: Database["public"]["Enums"]["sexo"]
          dias_ordeno: number
          dias_seca: number
          en_ordeno: boolean
          inseminador: string
          litros_am: number
          litros_pm: number
          litros_total: number
          mora_prenez: number
          nombre: string
          palpador: string
          palpar_el: string
          parto_esperado: string
          prenada: boolean
          resultado_palpacion: Database["public"]["Enums"]["resultado_palpacion"]
          secar_el: string
          tipo_servicio: Database["public"]["Enums"]["tipo_servicio"]
          toro_nombre: string
          toro_raza: string
          ultima_palpacion: string
          ultimo_parto: string
          ultimo_secado: string
          ultimo_servicio: string
        }[]
      }
      eventos_calendario: {
        Args: {
          p_corte?: string
          p_desde: string
          p_finca: string
          p_hasta: string
        }
        Returns: {
          animal_id: string
          chapeta: string
          detalle: string
          fecha: string
          nombre: string
          realizado: boolean
          tipo: string
        }[]
      }
      generar_codigo: { Args: never; Returns: string }
      indicadores_mensuales: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          dias_abiertos_promedio: number
          dias_con_ordeno: number
          litros_dia: number
          litros_totales: number
          litros_vaca_dia: number
          mes: string
          palpaciones: number
          partos: number
          prenadas_confirmadas: number
          prenez_hato: number
          recogido_litros: number
          servicios: number
          tasa_concepcion: number
          vacas_ordeno_promedio: number
        }[]
      }
      levante_finca: {
        Args: { p_corte?: string; p_finca: string }
        Returns: {
          animal_id: string
          categoria: Database["public"]["Enums"]["categoria_animal"]
          chapeta: string
          codigo: string
          destetada: boolean
          destetar_el: string
          edad_dias: number
          edad_meses: number
          estado: string
          fecha_destete: string
          fecha_nacimiento: string
          fecha_ultimo_peso: string
          ganancia_diaria_g: number
          madre_nombre: string
          nombre: string
          prenada: boolean
          raza: string
          sexo: Database["public"]["Enums"]["sexo"]
          ultimo_peso: number
          ultimo_servicio: string
        }[]
      }
      puede_gestionar_finca: { Args: { f: string }; Returns: boolean }
      puede_registrar_animal: { Args: { a: string }; Returns: boolean }
      puede_registrar_finca: { Args: { f: string }; Returns: boolean }
      puede_registrar_organizacion: { Args: { org: string }; Returns: boolean }
      puede_ver_animal: { Args: { a: string }; Returns: boolean }
      puede_ver_finca: { Args: { f: string }; Returns: boolean }
      registrar_destete: {
        Args: { p_animal: string; p_fecha?: string }
        Returns: undefined
      }
      registrar_parto: {
        Args: { p_cria?: Json; p_parto: Json }
        Returns: string
      }
      resumen_finca: {
        Args: { p_corte?: string; p_finca: string }
        Returns: {
          fecha_leche: string
          litros_dia: number
          novillas_vientre: number
          prenadas: number
          promedio_vaca: number
          servidas_sin_confirmar: number
          terneras: number
          total_animales: number
          vacas_horras: number
          vacas_ordeno: number
          vacias: number
        }[]
      }
      saldo_insumos: {
        Args: { p_corte?: string; p_finca: string }
        Returns: {
          categoria: Database["public"]["Enums"]["categoria_insumo"]
          consumo_automatico: number
          consumo_diario: number
          consumo_registrado: number
          contenido: number
          dias_alcanza: number
          estado: string
          ingresos: number
          insumo_id: string
          producto: string
          saldo: number
          salidas: number
          stock_minimo: number
          ultimo_ingreso: string
          unidad: string
        }[]
      }
      ultimo_ordeno: {
        Args: { p_corte: string; p_finca: string }
        Returns: {
          fecha: string
        }[]
      }
      ver_invitacion: {
        Args: { p_codigo: string }
        Returns: {
          finca: string
          organizacion: string
          rol: Database["public"]["Enums"]["rol_miembro"]
          valida: boolean
        }[]
      }
    }
    Enums: {
      categoria_animal:
        | "vaca"
        | "novilla"
        | "ternerona"
        | "ternera"
        | "ternero"
        | "toro"
        | "caballo"
        | "perro"
        | "otro"
      categoria_insumo:
        | "concentrado"
        | "sal"
        | "mineral"
        | "abono"
        | "cal"
        | "fertilizante"
        | "veneno"
        | "medicamento"
        | "aseo"
        | "semen"
        | "otro"
      especie: "bovino" | "equino" | "canino" | "ave" | "otro"
      estado_animal: "activo" | "vendido" | "retirado" | "muerto"
      estado_bien: "bueno" | "mantenimiento" | "malo"
      estado_comentario: "nuevo" | "leido" | "resuelto"
      estado_sanitario: "activo" | "en_tratamiento" | "resuelto"
      frecuencia_tarea: "diaria" | "frecuente"
      jornada: "am" | "pm"
      resultado_palpacion: "prenada" | "vacia"
      rol_miembro:
        | "propietario"
        | "administrador"
        | "mayordomo"
        | "trabajador"
        | "veterinario"
        | "consultor"
      sexo: "hembra" | "macho"
      tipo_aplicacion:
        | "fumigacion"
        | "fertilizacion"
        | "abonada"
        | "encalada"
        | "veneno_mosca"
        | "veneno_roedores"
      tipo_baja: "venta" | "retiro" | "muerte"
      tipo_bien:
        | "equipo"
        | "vehiculo"
        | "herramienta"
        | "maquinaria"
        | "infraestructura"
        | "otro"
      tipo_control: "agua" | "temperatura_tanque"
      tipo_evento_sanitario:
        | "enfermedad"
        | "tratamiento"
        | "vacuna"
        | "mastitis"
        | "cojera"
        | "fiebre"
        | "entamborada"
        | "fiebre_leche"
        | "cirugia"
        | "desparasitacion"
      tipo_mantenimiento:
        | "equipo_ordeno"
        | "tanque"
        | "cercas"
        | "equipos"
        | "general"
      tipo_movimiento: "ingreso" | "salida"
      tipo_servicio: "inseminacion" | "monta"
      urgencia: "baja" | "media" | "alta"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      categoria_animal: [
        "vaca",
        "novilla",
        "ternerona",
        "ternera",
        "ternero",
        "toro",
        "caballo",
        "perro",
        "otro",
      ],
      categoria_insumo: [
        "concentrado",
        "sal",
        "mineral",
        "abono",
        "cal",
        "fertilizante",
        "veneno",
        "medicamento",
        "aseo",
        "semen",
        "otro",
      ],
      especie: ["bovino", "equino", "canino", "ave", "otro"],
      estado_animal: ["activo", "vendido", "retirado", "muerto"],
      estado_bien: ["bueno", "mantenimiento", "malo"],
      estado_comentario: ["nuevo", "leido", "resuelto"],
      estado_sanitario: ["activo", "en_tratamiento", "resuelto"],
      frecuencia_tarea: ["diaria", "frecuente"],
      jornada: ["am", "pm"],
      resultado_palpacion: ["prenada", "vacia"],
      rol_miembro: [
        "propietario",
        "administrador",
        "mayordomo",
        "trabajador",
        "veterinario",
        "consultor",
      ],
      sexo: ["hembra", "macho"],
      tipo_aplicacion: [
        "fumigacion",
        "fertilizacion",
        "abonada",
        "encalada",
        "veneno_mosca",
        "veneno_roedores",
      ],
      tipo_baja: ["venta", "retiro", "muerte"],
      tipo_bien: [
        "equipo",
        "vehiculo",
        "herramienta",
        "maquinaria",
        "infraestructura",
        "otro",
      ],
      tipo_control: ["agua", "temperatura_tanque"],
      tipo_evento_sanitario: [
        "enfermedad",
        "tratamiento",
        "vacuna",
        "mastitis",
        "cojera",
        "fiebre",
        "entamborada",
        "fiebre_leche",
        "cirugia",
        "desparasitacion",
      ],
      tipo_mantenimiento: [
        "equipo_ordeno",
        "tanque",
        "cercas",
        "equipos",
        "general",
      ],
      tipo_movimiento: ["ingreso", "salida"],
      tipo_servicio: ["inseminacion", "monta"],
      urgencia: ["baja", "media", "alta"],
    },
  },
} as const
