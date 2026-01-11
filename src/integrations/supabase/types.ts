export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alertas_audiencias: {
        Row: {
          audiencia_id: string
          created_at: string
          dias_restantes: number | null
          enviado_em: string
          id: string
          lido: boolean
          lido_em: string | null
          lido_por: string | null
          tipo: string
        }
        Insert: {
          audiencia_id: string
          created_at?: string
          dias_restantes?: number | null
          enviado_em?: string
          id?: string
          lido?: boolean
          lido_em?: string | null
          lido_por?: string | null
          tipo?: string
        }
        Update: {
          audiencia_id?: string
          created_at?: string
          dias_restantes?: number | null
          enviado_em?: string
          id?: string
          lido?: boolean
          lido_em?: string | null
          lido_por?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_audiencias_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_coordenacao_djen: {
        Row: {
          ativo: boolean
          coordenacao_id: string
          created_at: string
          horario_envio: string
          id: string
          membros_ids: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          coordenacao_id: string
          created_at?: string
          horario_envio?: string
          id?: string
          membros_ids?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          coordenacao_id?: string
          created_at?: string
          horario_envio?: string
          id?: string
          membros_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_coordenacao_djen_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: true
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_evento: {
        Row: {
          created_at: string
          enviado: boolean | null
          enviado_em: string | null
          evento_id: string
          id: string
          minutos_antes: number
        }
        Insert: {
          created_at?: string
          enviado?: boolean | null
          enviado_em?: string | null
          evento_id: string
          id?: string
          minutos_antes?: number
        }
        Update: {
          created_at?: string
          enviado?: boolean | null
          enviado_em?: string | null
          evento_id?: string
          id?: string
          minutos_antes?: number
        }
        Relationships: [
          {
            foreignKeyName: "alertas_evento_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_monitoramento: {
        Row: {
          contexto: string | null
          created_at: string
          id: string
          movimentacao_id: string | null
          observacoes: string | null
          prioridade: string
          processo_id: string
          status: string
          termo_encontrado: string
          termo_id: string
          tratado_em: string | null
          tratado_por: string | null
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          id?: string
          movimentacao_id?: string | null
          observacoes?: string | null
          prioridade?: string
          processo_id: string
          status?: string
          termo_encontrado: string
          termo_id: string
          tratado_em?: string | null
          tratado_por?: string | null
        }
        Update: {
          contexto?: string | null
          created_at?: string
          id?: string
          movimentacao_id?: string | null
          observacoes?: string | null
          prioridade?: string
          processo_id?: string
          status?: string
          termo_encontrado?: string
          termo_id?: string
          tratado_em?: string | null
          tratado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_monitoramento_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_monitoramento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_monitoramento_termo_id_fkey"
            columns: ["termo_id"]
            isOneToOne: false
            referencedRelation: "termos_monitoramento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_monitoramento_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_monitoramento_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_parcela: {
        Row: {
          created_at: string
          enviado: boolean | null
          enviado_em: string | null
          id: string
          minutos_antes: number
          parcela_id: string
        }
        Insert: {
          created_at?: string
          enviado?: boolean | null
          enviado_em?: string | null
          id?: string
          minutos_antes?: number
          parcela_id: string
        }
        Update: {
          created_at?: string
          enviado?: boolean | null
          enviado_em?: string | null
          id?: string
          minutos_antes?: number
          parcela_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_parcela_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas_evento"
            referencedColumns: ["id"]
          },
        ]
      }
      areas_atuacao: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          id: string
          nome: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          slug: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      audiencias_advogados: {
        Row: {
          advogado_id: string
          audiencia_id: string
          created_at: string
          id: string
        }
        Insert: {
          advogado_id: string
          audiencia_id: string
          created_at?: string
          id?: string
        }
        Update: {
          advogado_id?: string
          audiencia_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_advogados_advogado_id_fkey"
            columns: ["advogado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_advogados_advogado_id_fkey"
            columns: ["advogado_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_advogados_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
        ]
      }
      audiencias_detectadas: {
        Row: {
          advogado: string | null
          alerta_enviado: boolean | null
          cliente: string | null
          comarca: string | null
          conteudo_publicacao: string | null
          contexto: string | null
          created_at: string
          criado_por: string | null
          data_audiencia: string | null
          funcao: string | null
          hora: string | null
          hora_brasilia: string | null
          hora_local: string | null
          id: string
          local_audiencia: string | null
          monitoramento_id: string | null
          movimentacao_id: string | null
          observacoes: string | null
          origem: string | null
          polo_ativo: string | null
          preposto: string | null
          processo_id: string | null
          processo_numero: string | null
          providencias_tomadas: string | null
          publicacao_id: string | null
          resumo_objeto: string | null
          status: string
          tarefa_id: string | null
          terceirizado: string | null
          testemunhas: string | null
          tipo_audiencia: string | null
          tratado_em: string | null
          tratado_por: string | null
          updated_at: string
          vara_camara: string | null
        }
        Insert: {
          advogado?: string | null
          alerta_enviado?: boolean | null
          cliente?: string | null
          comarca?: string | null
          conteudo_publicacao?: string | null
          contexto?: string | null
          created_at?: string
          criado_por?: string | null
          data_audiencia?: string | null
          funcao?: string | null
          hora?: string | null
          hora_brasilia?: string | null
          hora_local?: string | null
          id?: string
          local_audiencia?: string | null
          monitoramento_id?: string | null
          movimentacao_id?: string | null
          observacoes?: string | null
          origem?: string | null
          polo_ativo?: string | null
          preposto?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          providencias_tomadas?: string | null
          publicacao_id?: string | null
          resumo_objeto?: string | null
          status?: string
          tarefa_id?: string | null
          terceirizado?: string | null
          testemunhas?: string | null
          tipo_audiencia?: string | null
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string
          vara_camara?: string | null
        }
        Update: {
          advogado?: string | null
          alerta_enviado?: boolean | null
          cliente?: string | null
          comarca?: string | null
          conteudo_publicacao?: string | null
          contexto?: string | null
          created_at?: string
          criado_por?: string | null
          data_audiencia?: string | null
          funcao?: string | null
          hora?: string | null
          hora_brasilia?: string | null
          hora_local?: string | null
          id?: string
          local_audiencia?: string | null
          monitoramento_id?: string | null
          movimentacao_id?: string | null
          observacoes?: string | null
          origem?: string | null
          polo_ativo?: string | null
          preposto?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          providencias_tomadas?: string | null
          publicacao_id?: string | null
          resumo_objeto?: string | null
          status?: string
          tarefa_id?: string | null
          terceirizado?: string | null
          testemunhas?: string | null
          tipo_audiencia?: string | null
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string
          vara_camara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_detectadas_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_detectadas_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_detectadas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_detectadas_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_detectadas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_detectadas_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_detectadas_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      backfill_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          criado_por: string
          data_fim: string
          data_inicio: string
          erro: string | null
          id: string
          logs: string[] | null
          monitoramento_id: string | null
          progresso: Json | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          criado_por: string
          data_fim: string
          data_inicio: string
          erro?: string | null
          id?: string
          logs?: string[] | null
          monitoramento_id?: string | null
          progresso?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          criado_por?: string
          data_fim?: string
          data_inicio?: string
          erro?: string | null
          id?: string
          logs?: string[] | null
          monitoramento_id?: string | null
          progresso?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      capturas_intimacoes: {
        Row: {
          ativo: boolean
          cofre_senha_id: string
          created_at: string
          id: string
          instancia: string
          justica: string
          mensagem_status: string | null
          oab_numero: string
          oab_uf: string
          orgao: string
          proxima_captura: string | null
          status: string
          total_intimacoes_capturadas: number
          ultima_captura: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cofre_senha_id: string
          created_at?: string
          id?: string
          instancia: string
          justica: string
          mensagem_status?: string | null
          oab_numero: string
          oab_uf: string
          orgao: string
          proxima_captura?: string | null
          status?: string
          total_intimacoes_capturadas?: number
          ultima_captura?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cofre_senha_id?: string
          created_at?: string
          id?: string
          instancia?: string
          justica?: string
          mensagem_status?: string | null
          oab_numero?: string
          oab_uf?: string
          orgao?: string
          proxima_captura?: string | null
          status?: string
          total_intimacoes_capturadas?: number
          ultima_captura?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capturas_intimacoes_cofre_senha_id_fkey"
            columns: ["cofre_senha_id"]
            isOneToOne: false
            referencedRelation: "cofre_senhas"
            referencedColumns: ["id"]
          },
        ]
      }
      carteiras_processos: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          criado_por: string
          criterios: Json | null
          descricao: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          criado_por: string
          criterios?: Json | null
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          criado_por?: string
          criterios?: Json | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes_grupos: {
        Row: {
          cliente_id: string
          created_at: string
          grupo_id: string
          id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          grupo_id: string
          id?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          grupo_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_grupos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_grupos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_usuarios: {
        Row: {
          ativo: boolean | null
          cliente_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          cliente_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          cliente_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_usuarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cofre_senhas: {
        Row: {
          aceite_termos_em: string | null
          ativo: boolean
          certificado_a1_path: string | null
          certificado_a1_senha: string | null
          created_at: string
          id: string
          login: string
          mensagem_erro: string | null
          nome: string
          qrcode_2fa_path: string | null
          senha_hash: string
          sistema: string
          status_validacao: string | null
          tribunal: string
          ultima_validacao: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          aceite_termos_em?: string | null
          ativo?: boolean
          certificado_a1_path?: string | null
          certificado_a1_senha?: string | null
          created_at?: string
          id?: string
          login: string
          mensagem_erro?: string | null
          nome: string
          qrcode_2fa_path?: string | null
          senha_hash: string
          sistema: string
          status_validacao?: string | null
          tribunal: string
          ultima_validacao?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          aceite_termos_em?: string | null
          ativo?: boolean
          certificado_a1_path?: string | null
          certificado_a1_senha?: string | null
          created_at?: string
          id?: string
          login?: string
          mensagem_erro?: string | null
          nome?: string
          qrcode_2fa_path?: string | null
          senha_hash?: string
          sistema?: string
          status_validacao?: string | null
          tribunal?: string
          ultima_validacao?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      comentarios_tarefas: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          id: string
          tarefa_id: string
        }
        Insert: {
          autor_id: string
          conteudo: string
          created_at?: string
          id?: string
          tarefa_id: string
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_prazos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_prazos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_prazos_prazo_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_alertas_audiencias: {
        Row: {
          created_at: string
          destinatarios_email: string[] | null
          destinatarios_whatsapp: string[] | null
          enviar_email_criacao: boolean
          enviar_whatsapp_criacao: boolean
          id: string
          lembretes_minutos: number[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destinatarios_email?: string[] | null
          destinatarios_whatsapp?: string[] | null
          enviar_email_criacao?: boolean
          enviar_whatsapp_criacao?: boolean
          id?: string
          lembretes_minutos?: number[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destinatarios_email?: string[] | null
          destinatarios_whatsapp?: string[] | null
          enviar_email_criacao?: boolean
          enviar_whatsapp_criacao?: boolean
          id?: string
          lembretes_minutos?: number[] | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_monitoramento: {
        Row: {
          ativo: boolean
          coordenacao_id: string | null
          created_at: string
          frequencia: string
          horarios_execucao: string[] | null
          id: string
          metadata: Json | null
          tipo: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          coordenacao_id?: string | null
          created_at?: string
          frequencia?: string
          horarios_execucao?: string[] | null
          id?: string
          metadata?: Json | null
          tipo: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          coordenacao_id?: string | null
          created_at?: string
          frequencia?: string
          horarios_execucao?: string[] | null
          id?: string
          metadata?: Json | null
          tipo?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_monitoramento_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_cliente: {
        Row: {
          aceito_em: string | null
          cliente_id: string
          created_at: string | null
          email: string
          enviado_por: string | null
          expira_em: string | null
          id: string
          status: string | null
          token: string
        }
        Insert: {
          aceito_em?: string | null
          cliente_id: string
          created_at?: string | null
          email: string
          enviado_por?: string | null
          expira_em?: string | null
          id?: string
          status?: string | null
          token?: string
        }
        Update: {
          aceito_em?: string | null
          cliente_id?: string
          created_at?: string | null
          email?: string
          enviado_por?: string | null
          expira_em?: string | null
          id?: string
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      coordenacoes: {
        Row: {
          area: string
          coordenador_id: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          area: string
          coordenador_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          area?: string
          coordenador_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordenacoes_coordenador_id_fkey"
            columns: ["coordenador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordenacoes_coordenador_id_fkey"
            columns: ["coordenador_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      distribuicoes_encontradas: {
        Row: {
          assunto: string | null
          classe: string | null
          created_at: string
          dados_completos: Json | null
          data_distribuicao: string | null
          id: string
          monitoramento_id: string
          numero_processo: string
          polo_ativo: string | null
          polo_passivo: string | null
          processo_id: string | null
          status: string
          tribunal: string | null
          vara: string | null
        }
        Insert: {
          assunto?: string | null
          classe?: string | null
          created_at?: string
          dados_completos?: Json | null
          data_distribuicao?: string | null
          id?: string
          monitoramento_id: string
          numero_processo: string
          polo_ativo?: string | null
          polo_passivo?: string | null
          processo_id?: string | null
          status?: string
          tribunal?: string | null
          vara?: string | null
        }
        Update: {
          assunto?: string | null
          classe?: string | null
          created_at?: string
          dados_completos?: Json | null
          data_distribuicao?: string | null
          id?: string
          monitoramento_id?: string
          numero_processo?: string
          polo_ativo?: string | null
          polo_passivo?: string | null
          processo_id?: string | null
          status?: string
          tribunal?: string | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribuicoes_encontradas_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_distribuicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_encontradas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          created_at: string
          id: string
          nome: string
          pasta_id: string | null
          processo_id: string | null
          tamanho_bytes: number | null
          tarefa_id: string | null
          tipo: string | null
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          pasta_id?: string | null
          processo_id?: string | null
          tamanho_bytes?: number | null
          tarefa_id?: string | null
          tipo?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          pasta_id?: string | null
          processo_id?: string | null
          tamanho_bytes?: number | null
          tarefa_id?: string | null
          tipo?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "pastas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_prazo_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_agenda: {
        Row: {
          concluido_em: string | null
          created_at: string
          criado_por: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          dia_inteiro: boolean | null
          enviar_whatsapp: boolean
          grupo_parcelas: string | null
          id: string
          local: string | null
          numero_parcela: number | null
          processo_id: string | null
          recorrencia_dias_semana: number[] | null
          recorrencia_fim: string | null
          recorrencia_intervalo: number | null
          recorrencia_tipo: string | null
          recorrente: boolean | null
          status: string
          tipo: string
          titulo: string
          total_parcelas: number | null
          updated_at: string
          valor_parcela: number | null
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          criado_por: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          dia_inteiro?: boolean | null
          enviar_whatsapp?: boolean
          grupo_parcelas?: string | null
          id?: string
          local?: string | null
          numero_parcela?: number | null
          processo_id?: string | null
          recorrencia_dias_semana?: number[] | null
          recorrencia_fim?: string | null
          recorrencia_intervalo?: number | null
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          status?: string
          tipo?: string
          titulo: string
          total_parcelas?: number | null
          updated_at?: string
          valor_parcela?: number | null
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          criado_por?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          dia_inteiro?: boolean | null
          enviar_whatsapp?: boolean
          grupo_parcelas?: string | null
          id?: string
          local?: string | null
          numero_parcela?: number | null
          processo_id?: string | null
          recorrencia_dias_semana?: number[] | null
          recorrencia_fim?: string | null
          recorrencia_intervalo?: number | null
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          status?: string
          tipo?: string
          titulo?: string
          total_parcelas?: number | null
          updated_at?: string
          valor_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_agenda_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grupos_clientes: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      historico_capturas: {
        Row: {
          captura_id: string
          detalhes: Json | null
          erro: string | null
          executado_em: string
          id: string
          intimacoes_encontradas: number
          intimacoes_novas: number
          sucesso: boolean
          tempo_execucao_ms: number | null
        }
        Insert: {
          captura_id: string
          detalhes?: Json | null
          erro?: string | null
          executado_em?: string
          id?: string
          intimacoes_encontradas?: number
          intimacoes_novas?: number
          sucesso: boolean
          tempo_execucao_ms?: number | null
        }
        Update: {
          captura_id?: string
          detalhes?: Json | null
          erro?: string | null
          executado_em?: string
          id?: string
          intimacoes_encontradas?: number
          intimacoes_novas?: number
          sucesso?: boolean
          tempo_execucao_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_capturas_captura_id_fkey"
            columns: ["captura_id"]
            isOneToOne: false
            referencedRelation: "capturas_intimacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_login: {
        Row: {
          email: string | null
          id: string
          ip_address: string | null
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          email?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          email?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      historico_monitoramento: {
        Row: {
          created_at: string
          detalhes: Json | null
          erros: number
          executado_em: string
          id: string
          novos_andamentos: number
          processos_com_novos: number
          processos_verificados: number
          tipo: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          erros?: number
          executado_em?: string
          id?: string
          novos_andamentos?: number
          processos_com_novos?: number
          processos_verificados?: number
          tipo: string
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          erros?: number
          executado_em?: string
          id?: string
          novos_andamentos?: number
          processos_com_novos?: number
          processos_verificados?: number
          tipo?: string
        }
        Relationships: []
      }
      intimacoes_detectadas: {
        Row: {
          conteudo_publicacao: string | null
          contexto: string | null
          created_at: string
          criado_por: string | null
          data_disponibilizacao: string | null
          data_intimacao: string | null
          data_limite: string | null
          descricao: string | null
          hash_dedup: string | null
          id: string
          movimentacao_id: string | null
          observacoes: string | null
          orgao_intimante: string | null
          origem: string | null
          prazo_dias: number | null
          prioridade: string | null
          processo_id: string | null
          processo_numero: string | null
          providencias_tomadas: string | null
          status: string
          tarefa_id: string | null
          tipo_intimacao: string | null
          tratado_em: string | null
          tratado_por: string | null
          updated_at: string
        }
        Insert: {
          conteudo_publicacao?: string | null
          contexto?: string | null
          created_at?: string
          criado_por?: string | null
          data_disponibilizacao?: string | null
          data_intimacao?: string | null
          data_limite?: string | null
          descricao?: string | null
          hash_dedup?: string | null
          id?: string
          movimentacao_id?: string | null
          observacoes?: string | null
          orgao_intimante?: string | null
          origem?: string | null
          prazo_dias?: number | null
          prioridade?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          providencias_tomadas?: string | null
          status?: string
          tarefa_id?: string | null
          tipo_intimacao?: string | null
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string
        }
        Update: {
          conteudo_publicacao?: string | null
          contexto?: string | null
          created_at?: string
          criado_por?: string | null
          data_disponibilizacao?: string | null
          data_intimacao?: string | null
          data_limite?: string | null
          descricao?: string | null
          hash_dedup?: string | null
          id?: string
          movimentacao_id?: string | null
          observacoes?: string | null
          orgao_intimante?: string | null
          origem?: string | null
          prazo_dias?: number | null
          prioridade?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          providencias_tomadas?: string | null
          status?: string
          tarefa_id?: string | null
          tipo_intimacao?: string | null
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intimacoes_detectadas_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intimacoes_detectadas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intimacoes_detectadas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes_audiencia: {
        Row: {
          audiencia_id: string
          created_at: string
          enviado: boolean | null
          enviado_em: string | null
          id: string
          minutos_antes: number
        }
        Insert: {
          audiencia_id: string
          created_at?: string
          enviado?: boolean | null
          enviado_em?: string | null
          id?: string
          minutos_antes?: number
        }
        Update: {
          audiencia_id?: string
          created_at?: string
          enviado?: boolean | null
          enviado_em?: string | null
          id?: string
          minutos_antes?: number
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_audiencia_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_captura_tribunal: {
        Row: {
          captura_id: string | null
          cofre_senha_id: string | null
          created_at: string
          detalhes: Json | null
          id: string
          mensagem: string
          tipo: string
        }
        Insert: {
          captura_id?: string | null
          cofre_senha_id?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          mensagem: string
          tipo: string
        }
        Update: {
          captura_id?: string | null
          cofre_senha_id?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          mensagem?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_captura_tribunal_captura_id_fkey"
            columns: ["captura_id"]
            isOneToOne: false
            referencedRelation: "capturas_intimacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_captura_tribunal_cofre_senha_id_fkey"
            columns: ["cofre_senha_id"]
            isOneToOne: false
            referencedRelation: "cofre_senhas"
            referencedColumns: ["id"]
          },
        ]
      }
      membros_coordenacao: {
        Row: {
          cargo: string | null
          coordenacao_id: string
          created_at: string
          id: string
          usuario_id: string
        }
        Insert: {
          cargo?: string | null
          coordenacao_id: string
          created_at?: string
          id?: string
          usuario_id: string
        }
        Update: {
          cargo?: string | null
          coordenacao_id?: string
          created_at?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_coordenacao_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_coordenacao_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_coordenacao_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramentos_distribuicao: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string
          id: string
          termo_busca: string
          tipo: string
          tribunal: string | null
          uf: string | null
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por: string
          id?: string
          termo_busca: string
          tipo: string
          tribunal?: string | null
          uf?: string | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string
          id?: string
          termo_busca?: string
          tipo?: string
          tribunal?: string | null
          uf?: string | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoramentos_distribuicao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoramentos_distribuicao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramentos_djen: {
        Row: {
          ativo: boolean
          condicao_concomitante: string | null
          coordenacao_id: string | null
          created_at: string
          criado_por: string
          descricao: string | null
          exclusoes: string[] | null
          id: string
          oab: string | null
          termo_busca: string
          tipo: string
          tribunais: string[] | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          condicao_concomitante?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por: string
          descricao?: string | null
          exclusoes?: string[] | null
          id?: string
          oab?: string | null
          termo_busca: string
          tipo: string
          tribunais?: string[] | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          condicao_concomitante?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string | null
          exclusoes?: string[] | null
          id?: string
          oab?: string | null
          termo_busca?: string
          tipo?: string
          tribunais?: string[] | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoramentos_djen_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoramentos_djen_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoramentos_djen_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramentos_eprocesso: {
        Row: {
          ativo: boolean | null
          created_at: string
          criado_por: string
          erro_ultima_verificacao: string | null
          id: string
          numero_processo: string
          processo_id: string | null
          total_andamentos: number | null
          ultima_verificacao: string | null
          ultimo_andamento_data: string | null
          ultimo_andamento_texto: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          criado_por: string
          erro_ultima_verificacao?: string | null
          id?: string
          numero_processo: string
          processo_id?: string | null
          total_andamentos?: number | null
          ultima_verificacao?: string | null
          ultimo_andamento_data?: string | null
          ultimo_andamento_texto?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          criado_por?: string
          erro_ultima_verificacao?: string | null
          id?: string
          numero_processo?: string
          processo_id?: string | null
          total_andamentos?: number | null
          ultima_verificacao?: string | null
          ultimo_andamento_data?: string | null
          ultimo_andamento_texto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoramentos_eprocesso_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramentos_pje: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string
          id: string
          oab: string | null
          termo_busca: string
          tipo: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por: string
          id?: string
          oab?: string | null
          termo_busca: string
          tipo: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string
          id?: string
          oab?: string | null
          termo_busca?: string
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          created_at: string
          data_movimentacao: string
          descricao: string
          fonte: string | null
          id: string
          processo_id: string
          tipo: string | null
        }
        Insert: {
          created_at?: string
          data_movimentacao?: string
          descricao: string
          fonte?: string | null
          id?: string
          processo_id: string
          tipo?: string | null
        }
        Update: {
          created_at?: string
          data_movimentacao?: string
          descricao?: string
          fonte?: string | null
          id?: string
          processo_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_evento: {
        Row: {
          created_at: string
          data_vencimento: string
          evento_id: string
          id: string
          numero: number
          observacoes: string | null
          pago_em: string | null
          status: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          data_vencimento: string
          evento_id: string
          id?: string
          numero: number
          observacoes?: string | null
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          data_vencimento?: string
          evento_id?: string
          id?: string
          numero?: number
          observacoes?: string | null
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_evento_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      participantes_evento: {
        Row: {
          created_at: string
          evento_id: string
          id: string
          notificar: boolean | null
          usuario_id: string
        }
        Insert: {
          created_at?: string
          evento_id: string
          id?: string
          notificar?: boolean | null
          usuario_id: string
        }
        Update: {
          created_at?: string
          evento_id?: string
          id?: string
          notificar?: boolean | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participantes_evento_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      pastas: {
        Row: {
          cliente_id: string | null
          coordenacao_id: string | null
          created_at: string
          criado_por: string
          descricao: string | null
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por: string
          descricao?: string | null
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string | null
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastas_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          adicao_baixa: string | null
          advogado_externo: string | null
          advogado_responsavel_id: string | null
          andamento_atual: string | null
          area: string
          assunto: string | null
          ativo_passivo: string | null
          auto_infracao: string | null
          autor: string | null
          cargo_reconhecimento_vinculo: string | null
          categoria_importacao: string | null
          classe: string | null
          cliente_id: string | null
          cnpj_fiscalizado: string | null
          comarca: string | null
          coordenacao_id: string | null
          cpf_cnpj_parte_contraria: string | null
          created_at: string
          custo_encerramento: number | null
          data_arquivamento: string | null
          data_citacao: string | null
          data_consulta: string | null
          data_desligamento: string | null
          data_distribuicao: string | null
          data_encerramento: string | null
          data_fato_gerador: string | null
          data_lavratura: string | null
          data_recebimento: string | null
          data_situacao: string | null
          deposito_judicial: number | null
          depositos_vinculados: string | null
          descricao: string | null
          epoca_razao: string | null
          esfera: string | null
          fase: string | null
          fiscal_responsavel: string | null
          forma_pagamento: string | null
          funcao: string | null
          funcao_parte_contraria: string | null
          id: string
          identificador_projuris: string | null
          instancia: string | null
          justica: string | null
          justificativa_risco: string | null
          lei_13467_2017: string | null
          localidade: string | null
          materia: string | null
          materia_mpt: string | null
          monitorar_andamentos: boolean
          monitorar_djen: boolean | null
          motivo_encerramento: string | null
          mudanca_risco: boolean | null
          natureza: string | null
          nit_fiscalizado: string | null
          nome_cliente_envolvido: string | null
          numero: string
          observacao_advogado: string | null
          observacao_resp_subsidiaria: string | null
          observacoes_processo: string | null
          orgao_origem: string | null
          pasta_cliente: string | null
          pasta_fisica: string | null
          pasta_id: string | null
          pedido_acidente_doenca: string | null
          pedido_adicional_noturno: string | null
          pedido_danos_materiais: string | null
          pedido_danos_morais_acidente: string | null
          pedido_danos_morais_assedio: string | null
          pedido_danos_morais_outros: string | null
          pedido_descaract_jornada_12_36: string | null
          pedido_diferencas_salariais: string | null
          pedido_dobras: string | null
          pedido_domingos_feriados: string | null
          pedido_estabilidade: string | null
          pedido_excesso_jornada: string | null
          pedido_indenizacao_substitutiva: string | null
          pedido_insalubridade_periculosidade: string | null
          pedido_intervalo_interjornada: string | null
          pedido_intervalo_intrajornada: string | null
          pedido_limbo_previdenciario: string | null
          pedido_multas_ccts: string | null
          pedido_multas_clt: string | null
          pedido_pensao_vitalicia: string | null
          pedido_plantoes_extras: string | null
          pedido_reconhecimento_vinculo: string | null
          pedido_rescisao_indireta: string | null
          pedido_reversao_justa_causa: string | null
          pedido_reversao_pedido_demissao: string | null
          pedido_sobrecarga_trabalho: string | null
          pedido_valor: string | null
          pedidos: string | null
          periodo_condenacao: string | null
          periodo_contratacao: string | null
          periodo_laborado: string | null
          polo_ativo: string | null
          polo_passivo: string | null
          probabilidade: string | null
          provisionamento_possivel: number | null
          provisionamento_provavel: number | null
          provisionamento_remoto: number | null
          reclamados: string | null
          reclamante: string | null
          requerido: string | null
          responsabilidade_antes_data: number | null
          responsabilidade_apos_data: number | null
          responsabilidade_subsidiaria: string | null
          responsabilidade_tipo: string | null
          responsaveis_projuris: string | null
          resultado: string | null
          risco: string | null
          risco_anterior: string | null
          risco_atual: string | null
          setor: string | null
          sigla_unidade: string | null
          situacao_original: string | null
          status: Database["public"]["Enums"]["status_processo"]
          status_pedido: string | null
          terceiro_envolvido: string | null
          tipo_controladora: string | null
          tipo_estabilidade: string | null
          tipo_pagamento: string | null
          tipo_processo: string | null
          transitado_julgado: boolean | null
          tribunal: string | null
          uf: string | null
          ultimo_andamento_mpt: string | null
          unidade_cliente: string | null
          updated_at: string
          valor_causa: number | null
          valor_condenacao: number | null
          valor_multa: number | null
          valor_pagamento: number | null
          valor_pago: number | null
          valor_perda_anterior: number | null
          valor_perda_atual: number | null
          valor_provisionado: number | null
          vara: string | null
        }
        Insert: {
          adicao_baixa?: string | null
          advogado_externo?: string | null
          advogado_responsavel_id?: string | null
          andamento_atual?: string | null
          area: string
          assunto?: string | null
          ativo_passivo?: string | null
          auto_infracao?: string | null
          autor?: string | null
          cargo_reconhecimento_vinculo?: string | null
          categoria_importacao?: string | null
          classe?: string | null
          cliente_id?: string | null
          cnpj_fiscalizado?: string | null
          comarca?: string | null
          coordenacao_id?: string | null
          cpf_cnpj_parte_contraria?: string | null
          created_at?: string
          custo_encerramento?: number | null
          data_arquivamento?: string | null
          data_citacao?: string | null
          data_consulta?: string | null
          data_desligamento?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_fato_gerador?: string | null
          data_lavratura?: string | null
          data_recebimento?: string | null
          data_situacao?: string | null
          deposito_judicial?: number | null
          depositos_vinculados?: string | null
          descricao?: string | null
          epoca_razao?: string | null
          esfera?: string | null
          fase?: string | null
          fiscal_responsavel?: string | null
          forma_pagamento?: string | null
          funcao?: string | null
          funcao_parte_contraria?: string | null
          id?: string
          identificador_projuris?: string | null
          instancia?: string | null
          justica?: string | null
          justificativa_risco?: string | null
          lei_13467_2017?: string | null
          localidade?: string | null
          materia?: string | null
          materia_mpt?: string | null
          monitorar_andamentos?: boolean
          monitorar_djen?: boolean | null
          motivo_encerramento?: string | null
          mudanca_risco?: boolean | null
          natureza?: string | null
          nit_fiscalizado?: string | null
          nome_cliente_envolvido?: string | null
          numero: string
          observacao_advogado?: string | null
          observacao_resp_subsidiaria?: string | null
          observacoes_processo?: string | null
          orgao_origem?: string | null
          pasta_cliente?: string | null
          pasta_fisica?: string | null
          pasta_id?: string | null
          pedido_acidente_doenca?: string | null
          pedido_adicional_noturno?: string | null
          pedido_danos_materiais?: string | null
          pedido_danos_morais_acidente?: string | null
          pedido_danos_morais_assedio?: string | null
          pedido_danos_morais_outros?: string | null
          pedido_descaract_jornada_12_36?: string | null
          pedido_diferencas_salariais?: string | null
          pedido_dobras?: string | null
          pedido_domingos_feriados?: string | null
          pedido_estabilidade?: string | null
          pedido_excesso_jornada?: string | null
          pedido_indenizacao_substitutiva?: string | null
          pedido_insalubridade_periculosidade?: string | null
          pedido_intervalo_interjornada?: string | null
          pedido_intervalo_intrajornada?: string | null
          pedido_limbo_previdenciario?: string | null
          pedido_multas_ccts?: string | null
          pedido_multas_clt?: string | null
          pedido_pensao_vitalicia?: string | null
          pedido_plantoes_extras?: string | null
          pedido_reconhecimento_vinculo?: string | null
          pedido_rescisao_indireta?: string | null
          pedido_reversao_justa_causa?: string | null
          pedido_reversao_pedido_demissao?: string | null
          pedido_sobrecarga_trabalho?: string | null
          pedido_valor?: string | null
          pedidos?: string | null
          periodo_condenacao?: string | null
          periodo_contratacao?: string | null
          periodo_laborado?: string | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          probabilidade?: string | null
          provisionamento_possivel?: number | null
          provisionamento_provavel?: number | null
          provisionamento_remoto?: number | null
          reclamados?: string | null
          reclamante?: string | null
          requerido?: string | null
          responsabilidade_antes_data?: number | null
          responsabilidade_apos_data?: number | null
          responsabilidade_subsidiaria?: string | null
          responsabilidade_tipo?: string | null
          responsaveis_projuris?: string | null
          resultado?: string | null
          risco?: string | null
          risco_anterior?: string | null
          risco_atual?: string | null
          setor?: string | null
          sigla_unidade?: string | null
          situacao_original?: string | null
          status?: Database["public"]["Enums"]["status_processo"]
          status_pedido?: string | null
          terceiro_envolvido?: string | null
          tipo_controladora?: string | null
          tipo_estabilidade?: string | null
          tipo_pagamento?: string | null
          tipo_processo?: string | null
          transitado_julgado?: boolean | null
          tribunal?: string | null
          uf?: string | null
          ultimo_andamento_mpt?: string | null
          unidade_cliente?: string | null
          updated_at?: string
          valor_causa?: number | null
          valor_condenacao?: number | null
          valor_multa?: number | null
          valor_pagamento?: number | null
          valor_pago?: number | null
          valor_perda_anterior?: number | null
          valor_perda_atual?: number | null
          valor_provisionado?: number | null
          vara?: string | null
        }
        Update: {
          adicao_baixa?: string | null
          advogado_externo?: string | null
          advogado_responsavel_id?: string | null
          andamento_atual?: string | null
          area?: string
          assunto?: string | null
          ativo_passivo?: string | null
          auto_infracao?: string | null
          autor?: string | null
          cargo_reconhecimento_vinculo?: string | null
          categoria_importacao?: string | null
          classe?: string | null
          cliente_id?: string | null
          cnpj_fiscalizado?: string | null
          comarca?: string | null
          coordenacao_id?: string | null
          cpf_cnpj_parte_contraria?: string | null
          created_at?: string
          custo_encerramento?: number | null
          data_arquivamento?: string | null
          data_citacao?: string | null
          data_consulta?: string | null
          data_desligamento?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_fato_gerador?: string | null
          data_lavratura?: string | null
          data_recebimento?: string | null
          data_situacao?: string | null
          deposito_judicial?: number | null
          depositos_vinculados?: string | null
          descricao?: string | null
          epoca_razao?: string | null
          esfera?: string | null
          fase?: string | null
          fiscal_responsavel?: string | null
          forma_pagamento?: string | null
          funcao?: string | null
          funcao_parte_contraria?: string | null
          id?: string
          identificador_projuris?: string | null
          instancia?: string | null
          justica?: string | null
          justificativa_risco?: string | null
          lei_13467_2017?: string | null
          localidade?: string | null
          materia?: string | null
          materia_mpt?: string | null
          monitorar_andamentos?: boolean
          monitorar_djen?: boolean | null
          motivo_encerramento?: string | null
          mudanca_risco?: boolean | null
          natureza?: string | null
          nit_fiscalizado?: string | null
          nome_cliente_envolvido?: string | null
          numero?: string
          observacao_advogado?: string | null
          observacao_resp_subsidiaria?: string | null
          observacoes_processo?: string | null
          orgao_origem?: string | null
          pasta_cliente?: string | null
          pasta_fisica?: string | null
          pasta_id?: string | null
          pedido_acidente_doenca?: string | null
          pedido_adicional_noturno?: string | null
          pedido_danos_materiais?: string | null
          pedido_danos_morais_acidente?: string | null
          pedido_danos_morais_assedio?: string | null
          pedido_danos_morais_outros?: string | null
          pedido_descaract_jornada_12_36?: string | null
          pedido_diferencas_salariais?: string | null
          pedido_dobras?: string | null
          pedido_domingos_feriados?: string | null
          pedido_estabilidade?: string | null
          pedido_excesso_jornada?: string | null
          pedido_indenizacao_substitutiva?: string | null
          pedido_insalubridade_periculosidade?: string | null
          pedido_intervalo_interjornada?: string | null
          pedido_intervalo_intrajornada?: string | null
          pedido_limbo_previdenciario?: string | null
          pedido_multas_ccts?: string | null
          pedido_multas_clt?: string | null
          pedido_pensao_vitalicia?: string | null
          pedido_plantoes_extras?: string | null
          pedido_reconhecimento_vinculo?: string | null
          pedido_rescisao_indireta?: string | null
          pedido_reversao_justa_causa?: string | null
          pedido_reversao_pedido_demissao?: string | null
          pedido_sobrecarga_trabalho?: string | null
          pedido_valor?: string | null
          pedidos?: string | null
          periodo_condenacao?: string | null
          periodo_contratacao?: string | null
          periodo_laborado?: string | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          probabilidade?: string | null
          provisionamento_possivel?: number | null
          provisionamento_provavel?: number | null
          provisionamento_remoto?: number | null
          reclamados?: string | null
          reclamante?: string | null
          requerido?: string | null
          responsabilidade_antes_data?: number | null
          responsabilidade_apos_data?: number | null
          responsabilidade_subsidiaria?: string | null
          responsabilidade_tipo?: string | null
          responsaveis_projuris?: string | null
          resultado?: string | null
          risco?: string | null
          risco_anterior?: string | null
          risco_atual?: string | null
          setor?: string | null
          sigla_unidade?: string | null
          situacao_original?: string | null
          status?: Database["public"]["Enums"]["status_processo"]
          status_pedido?: string | null
          terceiro_envolvido?: string | null
          tipo_controladora?: string | null
          tipo_estabilidade?: string | null
          tipo_pagamento?: string | null
          tipo_processo?: string | null
          transitado_julgado?: boolean | null
          tribunal?: string | null
          uf?: string | null
          ultimo_andamento_mpt?: string | null
          unidade_cliente?: string | null
          updated_at?: string
          valor_causa?: number | null
          valor_condenacao?: number | null
          valor_multa?: number | null
          valor_pagamento?: number | null
          valor_pago?: number | null
          valor_perda_anterior?: number | null
          valor_perda_atual?: number | null
          valor_provisionado?: number | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_advogado_responsavel_id_fkey"
            columns: ["advogado_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_advogado_responsavel_id_fkey"
            columns: ["advogado_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_capturados: {
        Row: {
          assunto: string | null
          captura_id: string | null
          classe: string | null
          cofre_senha_id: string | null
          created_at: string
          dados_completos: Json | null
          data_distribuicao: string | null
          documentos: Json | null
          id: string
          movimentacoes: Json | null
          partes: Json | null
          processo_numero: string
          sistema: string
          situacao: string | null
          tribunal: string | null
          ultima_atualizacao: string | null
          updated_at: string
          valor_causa: number | null
          vara: string | null
        }
        Insert: {
          assunto?: string | null
          captura_id?: string | null
          classe?: string | null
          cofre_senha_id?: string | null
          created_at?: string
          dados_completos?: Json | null
          data_distribuicao?: string | null
          documentos?: Json | null
          id?: string
          movimentacoes?: Json | null
          partes?: Json | null
          processo_numero: string
          sistema: string
          situacao?: string | null
          tribunal?: string | null
          ultima_atualizacao?: string | null
          updated_at?: string
          valor_causa?: number | null
          vara?: string | null
        }
        Update: {
          assunto?: string | null
          captura_id?: string | null
          classe?: string | null
          cofre_senha_id?: string | null
          created_at?: string
          dados_completos?: Json | null
          data_distribuicao?: string | null
          documentos?: Json | null
          id?: string
          movimentacoes?: Json | null
          partes?: Json | null
          processo_numero?: string
          sistema?: string
          situacao?: string | null
          tribunal?: string | null
          ultima_atualizacao?: string | null
          updated_at?: string
          valor_causa?: number | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_capturados_captura_id_fkey"
            columns: ["captura_id"]
            isOneToOne: false
            referencedRelation: "capturas_intimacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_capturados_cofre_senha_id_fkey"
            columns: ["cofre_senha_id"]
            isOneToOne: false
            referencedRelation: "cofre_senhas"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_responsaveis: {
        Row: {
          ativo: boolean | null
          coordenacao_id: string | null
          created_at: string
          id: string
          papel: string | null
          processo_id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean | null
          coordenacao_id?: string | null
          created_at?: string
          id?: string
          papel?: string | null
          processo_id: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean | null
          coordenacao_id?: string | null
          created_at?: string
          id?: string
          papel?: string | null
          processo_id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_responsaveis_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_responsaveis_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_responsaveis_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_responsaveis_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          area_principal: string | null
          ativo: boolean
          avatar_url: string | null
          created_at: string
          email: string
          filial: string | null
          id: string
          nome: string
          notificacoes_email: boolean
          oab: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          area_principal?: string | null
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          filial?: string | null
          id: string
          nome: string
          notificacoes_email?: boolean
          oab?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          area_principal?: string | null
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          filial?: string | null
          id?: string
          nome?: string
          notificacoes_email?: boolean
          oab?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      publicacoes_djen: {
        Row: {
          conteudo: string | null
          created_at: string
          data_publicacao: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          importada_de_descartada: boolean | null
          lida: boolean
          monitoramento_id: string
          processo_numero: string | null
          resumo_gerado_em: string | null
          resumo_ia: string | null
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          data_publicacao?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          importada_de_descartada?: boolean | null
          lida?: boolean
          monitoramento_id: string
          processo_numero?: string | null
          resumo_gerado_em?: string | null
          resumo_ia?: string | null
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          data_publicacao?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          importada_de_descartada?: boolean | null
          lida?: boolean
          monitoramento_id?: string
          processo_numero?: string | null
          resumo_gerado_em?: string | null
          resumo_ia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_djen_descartadas: {
        Row: {
          conteudo: string | null
          created_at: string
          data_publicacao: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          monitoramento_id: string
          motivo_descarte: string
          processo_numero: string | null
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          data_publicacao?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          monitoramento_id: string
          motivo_descarte: string
          processo_numero?: string | null
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          data_publicacao?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          monitoramento_id?: string
          motivo_descarte?: string
          processo_numero?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_descartadas_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_djen_global_hash: {
        Row: {
          created_at: string
          hash_global: string
          id: string
          primeiro_monitoramento_id: string
          publicacao_id: string | null
        }
        Insert: {
          created_at?: string
          hash_global: string
          id?: string
          primeiro_monitoramento_id: string
          publicacao_id?: string | null
        }
        Update: {
          created_at?: string
          hash_global?: string
          id?: string
          primeiro_monitoramento_id?: string
          publicacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_global_hash_primeiro_monitoramento_id_fkey"
            columns: ["primeiro_monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_djen_global_hash_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_djen_processos: {
        Row: {
          conteudo: string | null
          created_at: string
          data_encontrado: string
          data_publicacao: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          lida: boolean
          processo_id: string
          processo_numero: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          data_encontrado?: string
          data_publicacao?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          lida?: boolean
          processo_id: string
          processo_numero: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          data_encontrado?: string
          data_publicacao?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          lida?: boolean
          processo_id?: string
          processo_numero?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_processos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_pje: {
        Row: {
          conteudo: string | null
          created_at: string
          data_publicacao: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          lida: boolean
          monitoramento_id: string
          processo_numero: string | null
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          data_publicacao?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          lida?: boolean
          monitoramento_id: string
          processo_numero?: string | null
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          data_publicacao?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          lida?: boolean
          monitoramento_id?: string
          processo_numero?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_pje_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_pje"
            referencedColumns: ["id"]
          },
        ]
      }
      repositorio_conversas: {
        Row: {
          created_at: string
          id: string
          titulo: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      repositorio_documentos: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          erro_processamento: string | null
          id: string
          mime_type: string | null
          nome: string
          nome_original: string
          processado: boolean | null
          storage_path: string
          tags: string[] | null
          tamanho_bytes: number | null
          tipo_documento: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          erro_processamento?: string | null
          id?: string
          mime_type?: string | null
          nome: string
          nome_original: string
          processado?: boolean | null
          storage_path: string
          tags?: string[] | null
          tamanho_bytes?: number | null
          tipo_documento?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          erro_processamento?: string | null
          id?: string
          mime_type?: string | null
          nome?: string
          nome_original?: string
          processado?: boolean | null
          storage_path?: string
          tags?: string[] | null
          tamanho_bytes?: number | null
          tipo_documento?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      repositorio_mensagens: {
        Row: {
          content: string
          conversa_id: string
          created_at: string
          documentos_referenciados: string[] | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversa_id: string
          created_at?: string
          documentos_referenciados?: string[] | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversa_id?: string
          created_at?: string
          documentos_referenciados?: string[] | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "repositorio_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "repositorio_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      resumos_monitoramento_djen: {
        Row: {
          created_at: string
          data_busca: string
          id: string
          monitoramento_id: string
          publicacoes_incluidas: string[] | null
          resumo: string
        }
        Insert: {
          created_at?: string
          data_busca?: string
          id?: string
          monitoramento_id: string
          publicacoes_incluidas?: string[] | null
          resumo: string
        }
        Update: {
          created_at?: string
          data_busca?: string
          id?: string
          monitoramento_id?: string
          publicacoes_incluidas?: string[] | null
          resumo?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumos_monitoramento_djen_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          concluido_por_nome: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_base: string | null
          data_cumprimento: string | null
          data_fatal: string | null
          data_vencimento: string | null
          descricao: string | null
          grupos_trabalho: string | null
          id: string
          identificador_projuris: string | null
          marcadores: string | null
          observacoes: string | null
          prioridade: Database["public"]["Enums"]["prioridade_tarefa"]
          processo_id: string | null
          quadro_kanban: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_tarefa"]
          tipo_tarefa: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          concluido_por_nome?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_base?: string | null
          data_cumprimento?: string | null
          data_fatal?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          grupos_trabalho?: string | null
          id?: string
          identificador_projuris?: string | null
          marcadores?: string | null
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_tarefa"]
          processo_id?: string | null
          quadro_kanban?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_tarefa"]
          tipo_tarefa?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          concluido_por_nome?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_base?: string | null
          data_cumprimento?: string | null
          data_fatal?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          grupos_trabalho?: string | null
          id?: string
          identificador_projuris?: string | null
          marcadores?: string | null
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_tarefa"]
          processo_id?: string | null
          quadro_kanban?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_tarefa"]
          tipo_tarefa?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_relacionadas: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          tarefa_origem_id: string
          tarefa_relacionada_id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          tarefa_origem_id: string
          tarefa_relacionada_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          tarefa_origem_id?: string
          tarefa_relacionada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_relacionadas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_relacionadas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_relacionadas_tarefa_origem_id_fkey"
            columns: ["tarefa_origem_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_relacionadas_tarefa_relacionada_id_fkey"
            columns: ["tarefa_relacionada_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_monitoramento: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          criado_por: string
          descricao: string | null
          id: string
          prioridade: string
          termo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          criado_por: string
          descricao?: string | null
          id?: string
          prioridade?: string
          termo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          criado_por?: string
          descricao?: string | null
          id?: string
          prioridade?: string
          termo?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_basic: {
        Row: {
          id: string | null
          nome: string | null
        }
        Insert: {
          id?: string | null
          nome?: string | null
        }
        Update: {
          id?: string | null
          nome?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calcular_primeiro_dia_util: {
        Args: { data_base: string; dias_uteis_adicionar?: number }
        Returns: string
      }
      can_access_evento: {
        Args: { _evento_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_processo: {
        Args: { _processo_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_evento: {
        Args: { _evento_id: string; _user_id: string }
        Returns: boolean
      }
      count_tarefas_urgentes_coordenacao: {
        Args: { p_coordenacao_id: string }
        Returns: number
      }
      get_cliente_ids_for_user: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_cliente_portal_stats: { Args: { _user_id: string }; Returns: Json }
      get_cliente_processos_paginados: {
        Args: {
          _area?: string
          _page?: number
          _page_size?: number
          _search?: string
          _status?: string
          _user_id: string
        }
        Returns: {
          advogado_responsavel: Json
          area: string
          assunto: string
          comarca: string
          created_at: string
          data_distribuicao: string
          id: string
          numero: string
          polo_ativo: string
          polo_passivo: string
          status: string
          total_count: number
          tribunal: string
          vara: string
        }[]
      }
      get_coordenacao_stats: {
        Args: never
        Returns: {
          coordenacao_id: string
          coordenacao_nome: string
          processos_distribuidos: number
          processos_nao_distribuidos: number
          total_processos: number
        }[]
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_processos_paginados:
        | {
            Args: {
              _area?: string
              _cliente_ids?: string[]
              _com_movimento?: boolean
              _com_publicacao_djen?: boolean
              _coordenacao_id?: string
              _instancia?: string
              _page?: number
              _page_size?: number
              _periodo_fim?: string
              _periodo_inicio?: string
              _responsavel_id?: string
              _search?: string
              _status?: string
            }
            Returns: {
              advogado_responsavel: Json
              area: string
              assunto: string
              cliente: Json
              comarca: string
              coordenacao_id: string
              created_at: string
              data_distribuicao: string
              id: string
              numero: string
              pasta_id: string
              polo_ativo: string
              polo_passivo: string
              status: Database["public"]["Enums"]["status_processo"]
              total_count: number
              tribunal: string
              valor_causa: number
              vara: string
            }[]
          }
        | {
            Args: {
              _area?: string
              _cliente_ids?: string[]
              _com_audiencia?: boolean
              _com_intimacao?: boolean
              _com_movimento?: boolean
              _com_publicacao_djen?: boolean
              _coordenacao_id?: string
              _instancia?: string
              _page?: number
              _page_size?: number
              _periodo_fim?: string
              _periodo_inicio?: string
              _responsavel_id?: string
              _search?: string
              _status?: string
            }
            Returns: {
              advogado_responsavel: Json
              area: string
              assunto: string
              cliente: Json
              comarca: string
              coordenacao_id: string
              created_at: string
              data_distribuicao: string
              id: string
              numero: string
              pasta_id: string
              polo_ativo: string
              polo_passivo: string
              status: Database["public"]["Enums"]["status_processo"]
              total_count: number
              tribunal: string
              valor_causa: number
              vara: string
            }[]
          }
        | {
            Args: {
              _area?: string
              _cliente_ids?: string[]
              _com_audiencia?: boolean
              _com_intimacao?: boolean
              _com_movimento?: boolean
              _com_publicacao_djen?: boolean
              _coordenacao_id?: string
              _instancia?: string
              _page?: number
              _page_size?: number
              _periodo_fim?: string
              _periodo_inicio?: string
              _responsavel_id?: string
              _search?: string
              _status?: string
              _tipo_processo?: string
            }
            Returns: {
              advogado_responsavel: Json
              area: string
              assunto: string
              cliente: Json
              comarca: string
              coordenacao_id: string
              created_at: string
              data_distribuicao: string
              id: string
              numero: string
              pasta_id: string
              polo_ativo: string
              polo_passivo: string
              status: Database["public"]["Enums"]["status_processo"]
              tipo_processo: string
              total_count: number
              tribunal: string
              valor_causa: number
              vara: string
            }[]
          }
      get_relatorio_andamentos: { Args: never; Returns: Json }
      get_relatorio_atividades: { Args: never; Returns: Json }
      get_relatorio_clientes: { Args: never; Returns: Json }
      get_relatorio_prazos: { Args: never; Returns: Json }
      get_relatorio_resumo: { Args: never; Returns: Json }
      get_relatorio_tarefas: { Args: never; Returns: Json }
      get_user_coordenacao: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_coordenador: { Args: { _user_id: string }; Returns: boolean }
      is_cliente: { Args: { _user_id: string }; Returns: boolean }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      search_users_basic: {
        Args: { _limit?: number; _query?: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      subtrair_dias_uteis: {
        Args: { data_base: string; dias_uteis_subtrair: number }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenador"
        | "advogado"
        | "estagiario"
        | "assistente"
        | "secretaria"
        | "cliente"
      area_atuacao: "civil" | "trabalhista" | "empresarial" | "direito_privado"
      prioridade_tarefa: "baixa" | "media" | "alta" | "urgente"
      status_processo:
        | "ativo"
        | "pendente"
        | "urgente"
        | "encerrado"
        | "arquivado"
      status_tarefa: "pendente" | "cumprido" | "atrasado"
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
      app_role: [
        "admin",
        "coordenador",
        "advogado",
        "estagiario",
        "assistente",
        "secretaria",
        "cliente",
      ],
      area_atuacao: ["civil", "trabalhista", "empresarial", "direito_privado"],
      prioridade_tarefa: ["baixa", "media", "alta", "urgente"],
      status_processo: [
        "ativo",
        "pendente",
        "urgente",
        "encerrado",
        "arquivado",
      ],
      status_tarefa: ["pendente", "cumprido", "atrasado"],
    },
  },
} as const
