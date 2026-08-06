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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acompanhamento_especial_eventos: {
        Row: {
          anexos_count: number
          conteudo: string | null
          criado_em: string
          criou_tarefa_id: string | null
          id: string
          instancia: string | null
          lido_em: string | null
          notificou_em: string | null
          processo_id: string
          step_date: string | null
          step_id: string | null
          tribunal: string | null
        }
        Insert: {
          anexos_count?: number
          conteudo?: string | null
          criado_em?: string
          criou_tarefa_id?: string | null
          id?: string
          instancia?: string | null
          lido_em?: string | null
          notificou_em?: string | null
          processo_id: string
          step_date?: string | null
          step_id?: string | null
          tribunal?: string | null
        }
        Update: {
          anexos_count?: number
          conteudo?: string | null
          criado_em?: string
          criou_tarefa_id?: string | null
          id?: string
          instancia?: string | null
          lido_em?: string | null
          notificou_em?: string | null
          processo_id?: string
          step_date?: string | null
          step_id?: string | null
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acompanhamento_especial_eventos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          completion_tokens: number | null
          created_at: string
          custo_usd: number | null
          duracao_ms: number | null
          edge_function: string
          erro: string | null
          id: string
          metadata: Json | null
          model: string
          origem: string | null
          prompt_tokens: number | null
          status: string
          total_tokens: number | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          custo_usd?: number | null
          duracao_ms?: number | null
          edge_function: string
          erro?: string | null
          id?: string
          metadata?: Json | null
          model: string
          origem?: string | null
          prompt_tokens?: number | null
          status?: string
          total_tokens?: number | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          custo_usd?: number | null
          duracao_ms?: number | null
          edge_function?: string
          erro?: string | null
          id?: string
          metadata?: Json | null
          model?: string
          origem?: string | null
          prompt_tokens?: number | null
          status?: string
          total_tokens?: number | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      alertas_diferenca_execucoes_djen: {
        Row: {
          coordenacao_id: string | null
          created_at: string
          destinatarios: number
          dia_ymd: string | null
          diferenca: number
          enviado_em: string
          execucao_id: string
          fonte: string
          id: string
          total_anterior: number
          total_atual: number
        }
        Insert: {
          coordenacao_id?: string | null
          created_at?: string
          destinatarios?: number
          dia_ymd?: string | null
          diferenca?: number
          enviado_em?: string
          execucao_id: string
          fonte?: string
          id?: string
          total_anterior?: number
          total_atual?: number
        }
        Update: {
          coordenacao_id?: string | null
          created_at?: string
          destinatarios?: number
          dia_ymd?: string | null
          diferenca?: number
          enviado_em?: string
          execucao_id?: string
          fonte?: string
          id?: string
          total_anterior?: number
          total_atual?: number
        }
        Relationships: []
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
      alertas_processos_nao_cadastrados: {
        Row: {
          conteudo_publicacao: string | null
          contexto: string | null
          coordenacao_id: string | null
          created_at: string
          id: string
          observacoes: string | null
          prioridade: string
          processo_numero: string
          publicacao_id: string | null
          status: string
          termo_encontrado: string
          termo_id: string
          tratado_em: string | null
          tratado_por: string | null
          tribunal: string | null
          updated_at: string
        }
        Insert: {
          conteudo_publicacao?: string | null
          contexto?: string | null
          coordenacao_id?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          prioridade?: string
          processo_numero: string
          publicacao_id?: string | null
          status?: string
          termo_encontrado: string
          termo_id: string
          tratado_em?: string | null
          tratado_por?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Update: {
          conteudo_publicacao?: string | null
          contexto?: string | null
          coordenacao_id?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          prioridade?: string
          processo_numero?: string
          publicacao_id?: string | null
          status?: string
          termo_encontrado?: string
          termo_id?: string
          tratado_em?: string | null
          tratado_por?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_processos_nao_cadastrados_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_processos_nao_cadastrados_termo_id_fkey"
            columns: ["termo_id"]
            isOneToOne: false
            referencedRelation: "termos_monitoramento"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_recebidos_leituras: {
        Row: {
          alerta_id: string
          created_at: string
          id: string
          lido_em: string
          user_id: string
        }
        Insert: {
          alerta_id: string
          created_at?: string
          id?: string
          lido_em?: string
          user_id: string
        }
        Update: {
          alerta_id?: string
          created_at?: string
          id?: string
          lido_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_recebidos_leituras_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "historico_alertas_enviados"
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
      audiencia_envolvidos: {
        Row: {
          audiencia_id: string
          created_at: string
          id: string
          usuario_id: string
        }
        Insert: {
          audiencia_id: string
          created_at?: string
          id?: string
          usuario_id: string
        }
        Update: {
          audiencia_id?: string
          created_at?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiencia_envolvidos_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
        ]
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
          alerta_unidade: string | null
          alerta_valor: number | null
          cliente: string | null
          comarca: string | null
          conteudo_publicacao: string | null
          contexto: string | null
          coordenacao_id: string | null
          created_at: string
          criado_por: string | null
          data_audiencia: string | null
          dossie: string | null
          equipe: string | null
          forum: string | null
          funcao: string | null
          hora: string | null
          hora_brasilia: string | null
          hora_fim: string | null
          hora_local: string | null
          id: string
          local_audiencia: string | null
          modalidade: string | null
          monitoramento_id: string | null
          movimentacao_id: string | null
          nucleo_origem: string | null
          observacoes: string | null
          origem: string | null
          originada_de: string | null
          polo_ativo: string | null
          preposto: string | null
          processo_id: string | null
          processo_numero: string | null
          providencias_tomadas: string | null
          publicacao_id: string | null
          resumo_objeto: string | null
          sala_forum: string | null
          status: string
          tarefa_id: string | null
          terceirizado: string | null
          testemunhas: string | null
          tipo_audiencia: string | null
          titulo: string | null
          tratado_em: string | null
          tratado_por: string | null
          updated_at: string
          vara_camara: string | null
        }
        Insert: {
          advogado?: string | null
          alerta_enviado?: boolean | null
          alerta_unidade?: string | null
          alerta_valor?: number | null
          cliente?: string | null
          comarca?: string | null
          conteudo_publicacao?: string | null
          contexto?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_audiencia?: string | null
          dossie?: string | null
          equipe?: string | null
          forum?: string | null
          funcao?: string | null
          hora?: string | null
          hora_brasilia?: string | null
          hora_fim?: string | null
          hora_local?: string | null
          id?: string
          local_audiencia?: string | null
          modalidade?: string | null
          monitoramento_id?: string | null
          movimentacao_id?: string | null
          nucleo_origem?: string | null
          observacoes?: string | null
          origem?: string | null
          originada_de?: string | null
          polo_ativo?: string | null
          preposto?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          providencias_tomadas?: string | null
          publicacao_id?: string | null
          resumo_objeto?: string | null
          sala_forum?: string | null
          status?: string
          tarefa_id?: string | null
          terceirizado?: string | null
          testemunhas?: string | null
          tipo_audiencia?: string | null
          titulo?: string | null
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string
          vara_camara?: string | null
        }
        Update: {
          advogado?: string | null
          alerta_enviado?: boolean | null
          alerta_unidade?: string | null
          alerta_valor?: number | null
          cliente?: string | null
          comarca?: string | null
          conteudo_publicacao?: string | null
          contexto?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_audiencia?: string | null
          dossie?: string | null
          equipe?: string | null
          forum?: string | null
          funcao?: string | null
          hora?: string | null
          hora_brasilia?: string | null
          hora_fim?: string | null
          hora_local?: string | null
          id?: string
          local_audiencia?: string | null
          modalidade?: string | null
          monitoramento_id?: string | null
          movimentacao_id?: string | null
          nucleo_origem?: string | null
          observacoes?: string | null
          origem?: string | null
          originada_de?: string | null
          polo_ativo?: string | null
          preposto?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          providencias_tomadas?: string | null
          publicacao_id?: string | null
          resumo_objeto?: string | null
          sala_forum?: string | null
          status?: string
          tarefa_id?: string | null
          terceirizado?: string | null
          testemunhas?: string | null
          tipo_audiencia?: string | null
          titulo?: string | null
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string
          vara_camara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_detectadas_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "audiencias_detectadas_originada_de_fkey"
            columns: ["originada_de"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
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
      audiencias_publicacoes: {
        Row: {
          audiencia_id: string
          created_at: string
          id: string
          publicacao_id: string
        }
        Insert: {
          audiencia_id: string
          created_at?: string
          id?: string
          publicacao_id: string
        }
        Update: {
          audiencia_id?: string
          created_at?: string
          id?: string
          publicacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_publicacoes_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_publicacoes_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen"
            referencedColumns: ["id"]
          },
        ]
      }
      audiencias_publicacoes_descartadas: {
        Row: {
          audiencia_id: string
          created_at: string
          id: string
          publicacao_descartada_id: string
        }
        Insert: {
          audiencia_id: string
          created_at?: string
          id?: string
          publicacao_descartada_id: string
        }
        Update: {
          audiencia_id?: string
          created_at?: string
          id?: string
          publicacao_descartada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_publicacoes_descartada_publicacao_descartada_id_fkey"
            columns: ["publicacao_descartada_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen_descartadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_publicacoes_descartadas_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
        ]
      }
      audiencias_publicacoes_processos: {
        Row: {
          audiencia_id: string
          created_at: string
          id: string
          publicacao_processo_id: string
        }
        Insert: {
          audiencia_id: string
          created_at?: string
          id?: string
          publicacao_processo_id: string
        }
        Update: {
          audiencia_id?: string
          created_at?: string
          id?: string
          publicacao_processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_publicacoes_processos_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_publicacoes_processos_publicacao_processo_id_fkey"
            columns: ["publicacao_processo_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_distribuicao_tst: {
        Row: {
          acao: string
          campos_alterados: Json | null
          coordenacao_id: string | null
          created_at: string
          dados_antes: Json | null
          dados_benner_id: string | null
          dados_depois: Json | null
          dossie: string | null
          equipe: string | null
          id: string
          origem: string | null
          processo: string | null
          processo_digits: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          campos_alterados?: Json | null
          coordenacao_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_benner_id?: string | null
          dados_depois?: Json | null
          dossie?: string | null
          equipe?: string | null
          id?: string
          origem?: string | null
          processo?: string | null
          processo_digits?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          campos_alterados?: Json | null
          coordenacao_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_benner_id?: string | null
          dados_depois?: Json | null
          dossie?: string | null
          equipe?: string | null
          id?: string
          origem?: string | null
          processo?: string | null
          processo_digits?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      auditoria_lotes_admin_tst: {
        Row: {
          arquivo_nome: string | null
          coordenacao_id: string | null
          created_at: string
          detalhes: Json
          duracao_ms: number | null
          erro_mensagem: string | null
          ferramenta: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          itens: Json
          resumo: string | null
          rota: string | null
          status: string
          tipo_operacao: string
          total_atualizados: number
          total_criados: number
          total_erros: number
          total_ignorados: number
          total_linhas: number
          updated_at: string
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          coordenacao_id?: string | null
          created_at?: string
          detalhes?: Json
          duracao_ms?: number | null
          erro_mensagem?: string | null
          ferramenta?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          itens?: Json
          resumo?: string | null
          rota?: string | null
          status?: string
          tipo_operacao: string
          total_atualizados?: number
          total_criados?: number
          total_erros?: number
          total_ignorados?: number
          total_linhas?: number
          updated_at?: string
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          coordenacao_id?: string | null
          created_at?: string
          detalhes?: Json
          duracao_ms?: number | null
          erro_mensagem?: string | null
          ferramenta?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          itens?: Json
          resumo?: string | null
          rota?: string | null
          status?: string
          tipo_operacao?: string
          total_atualizados?: number
          total_criados?: number
          total_erros?: number
          total_ignorados?: number
          total_linhas?: number
          updated_at?: string
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      auditoria_tarefas: {
        Row: {
          acao: string
          campos_alterados: Json | null
          coordenacao_id: string | null
          created_at: string
          dados_entrada: Json | null
          dados_saida: Json | null
          erro_detalhes: Json | null
          erro_mensagem: string | null
          id: string
          ip_address: string | null
          origem: string | null
          processo_id: string | null
          sucesso: boolean
          tarefa_id: string | null
          tipo_item: string | null
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          campos_alterados?: Json | null
          coordenacao_id?: string | null
          created_at?: string
          dados_entrada?: Json | null
          dados_saida?: Json | null
          erro_detalhes?: Json | null
          erro_mensagem?: string | null
          id?: string
          ip_address?: string | null
          origem?: string | null
          processo_id?: string | null
          sucesso?: boolean
          tarefa_id?: string | null
          tipo_item?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          campos_alterados?: Json | null
          coordenacao_id?: string | null
          created_at?: string
          dados_entrada?: Json | null
          dados_saida?: Json | null
          erro_detalhes?: Json | null
          erro_mensagem?: string | null
          id?: string
          ip_address?: string | null
          origem?: string | null
          processo_id?: string | null
          sucesso?: boolean
          tarefa_id?: string | null
          tipo_item?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: []
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
      baixar_autos_jobs: {
        Row: {
          created_at: string
          documentos_baixados: number | null
          documentos_erro: number | null
          documentos_existentes: number | null
          documentos_total: number | null
          erro: string | null
          etapa: string
          id: string
          mensagem: string | null
          processo_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          documentos_baixados?: number | null
          documentos_erro?: number | null
          documentos_existentes?: number | null
          documentos_total?: number | null
          erro?: string | null
          etapa?: string
          id?: string
          mensagem?: string | null
          processo_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          documentos_baixados?: number | null
          documentos_erro?: number | null
          documentos_existentes?: number | null
          documentos_total?: number | null
          erro?: string | null
          etapa?: string
          id?: string
          mensagem?: string | null
          processo_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "baixar_autos_jobs_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      buscas_publicacao_resultados: {
        Row: {
          conteudo: string | null
          created_at: string
          data_disponibilizacao: string | null
          data_publicacao: string | null
          dedupe_key: string
          execucao_id: string
          id: string
          id_djen: string | null
          orgao: string | null
          processo_digitos: string
          processo_original: string
          raw_json: Json | null
          tipo_comunicacao: string | null
          tribunal: string | null
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          dedupe_key: string
          execucao_id: string
          id?: string
          id_djen?: string | null
          orgao?: string | null
          processo_digitos: string
          processo_original: string
          raw_json?: Json | null
          tipo_comunicacao?: string | null
          tribunal?: string | null
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          dedupe_key?: string
          execucao_id?: string
          id?: string
          id_djen?: string | null
          orgao?: string | null
          processo_digitos?: string
          processo_original?: string
          raw_json?: Json | null
          tipo_comunicacao?: string | null
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buscas_publicacao_resultados_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucoes_servidor"
            referencedColumns: ["id"]
          },
        ]
      }
      capturas_intimacoes: {
        Row: {
          ativo: boolean
          cofre_senha_id: string
          created_at: string
          dias_semana: number[] | null
          horarios_execucao: string[] | null
          id: string
          instancia: string
          intervalo_minutos: number | null
          justica: string
          mensagem_status: string | null
          modo_captura: string | null
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
          dias_semana?: number[] | null
          horarios_execucao?: string[] | null
          id?: string
          instancia: string
          intervalo_minutos?: number | null
          justica: string
          mensagem_status?: string | null
          modo_captura?: string | null
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
          dias_semana?: number[] | null
          horarios_execucao?: string[] | null
          id?: string
          instancia?: string
          intervalo_minutos?: number | null
          justica?: string
          mensagem_status?: string | null
          modo_captura?: string | null
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
      classificacao_relatores_tst: {
        Row: {
          cargo: string | null
          classificacao: Database["public"]["Enums"]["classificacao_tst_enum"]
          created_at: string
          id: string
          nome: string
          observacao: string | null
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          classificacao: Database["public"]["Enums"]["classificacao_tst_enum"]
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          classificacao?: Database["public"]["Enums"]["classificacao_tst_enum"]
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classificacao_relatores_tst_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "classificacao_turmas_tst"
            referencedColumns: ["id"]
          },
        ]
      }
      classificacao_turmas_tst: {
        Row: {
          classificacao: Database["public"]["Enums"]["classificacao_tst_enum"]
          created_at: string
          id: string
          nome: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          classificacao: Database["public"]["Enums"]["classificacao_tst_enum"]
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          classificacao?: Database["public"]["Enums"]["classificacao_tst_enum"]
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
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
          bloqueado_ate: string | null
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
          tentativas_falhas: number
          tribunal: string
          ultima_validacao: string | null
          ultimo_erro_login: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          aceite_termos_em?: string | null
          ativo?: boolean
          bloqueado_ate?: string | null
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
          tentativas_falhas?: number
          tribunal: string
          ultima_validacao?: string | null
          ultimo_erro_login?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          aceite_termos_em?: string | null
          ativo?: boolean
          bloqueado_ate?: string | null
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
          tentativas_falhas?: number
          tribunal?: string
          ultima_validacao?: string | null
          ultimo_erro_login?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      comentarios_audiencias: {
        Row: {
          audiencia_id: string
          autor_id: string
          conteudo: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          audiencia_id: string
          autor_id: string
          conteudo: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          audiencia_id?: string
          autor_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_audiencias_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios_eventos: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          evento_id: string
          id: string
          updated_at: string
        }
        Insert: {
          autor_id: string
          conteudo: string
          created_at?: string
          evento_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          evento_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios_publicacoes_djen: {
        Row: {
          comentario: string
          created_at: string
          id: string
          publicacao_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comentario: string
          created_at?: string
          id?: string
          publicacao_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comentario?: string
          created_at?: string
          id?: string
          publicacao_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_publicacoes_djen_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen"
            referencedColumns: ["id"]
          },
        ]
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
      config_alertas_coordenacao: {
        Row: {
          apenas_urgentes: boolean
          coordenacao_id: string
          created_at: string
          created_by: string | null
          dias_semana: number[] | null
          email_habilitado: boolean
          emails_destinatarios: string[] | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          telefones_whatsapp: string[] | null
          tipos_alerta: string[] | null
          updated_at: string
          whatsapp_habilitado: boolean
        }
        Insert: {
          apenas_urgentes?: boolean
          coordenacao_id: string
          created_at?: string
          created_by?: string | null
          dias_semana?: number[] | null
          email_habilitado?: boolean
          emails_destinatarios?: string[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          telefones_whatsapp?: string[] | null
          tipos_alerta?: string[] | null
          updated_at?: string
          whatsapp_habilitado?: boolean
        }
        Update: {
          apenas_urgentes?: boolean
          coordenacao_id?: string
          created_at?: string
          created_by?: string | null
          dias_semana?: number[] | null
          email_habilitado?: boolean
          emails_destinatarios?: string[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          telefones_whatsapp?: string[] | null
          tipos_alerta?: string[] | null
          updated_at?: string
          whatsapp_habilitado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "config_alertas_coordenacao_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: true
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_alertas_coordenacao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_alertas_coordenacao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      config_deteccao_coordenacao: {
        Row: {
          coordenacao_id: string
          created_at: string
          created_by: string | null
          destinatarios_audiencias_ids: string[]
          destinatarios_intimacoes_ids: string[]
          detectar_audiencias: boolean
          detectar_intimacoes: boolean
          horarios_andamentos: string[]
          horarios_distribuicoes: string[]
          horarios_djen_kurier: string[]
          horarios_djen_pautas_servidor: string[]
          horarios_djen_processos: string[]
          horarios_djen_stf_servidor: string[]
          horarios_djen_termos: string[]
          horarios_djen_termos_servidor: string[]
          horarios_djet_pautas: string[]
          horarios_redistribuicoes: string[]
          id: string
          monitorar_andamentos: boolean
          monitorar_distribuicoes: boolean
          monitorar_djen_kurier: boolean
          monitorar_djen_pautas_servidor: boolean
          monitorar_djen_processos: boolean
          monitorar_djen_stf_servidor: boolean
          monitorar_djen_termos: boolean
          monitorar_djen_termos_servidor: boolean
          monitorar_djet_pautas: boolean
          monitorar_redistribuicoes: boolean
          updated_at: string
        }
        Insert: {
          coordenacao_id: string
          created_at?: string
          created_by?: string | null
          destinatarios_audiencias_ids?: string[]
          destinatarios_intimacoes_ids?: string[]
          detectar_audiencias?: boolean
          detectar_intimacoes?: boolean
          horarios_andamentos?: string[]
          horarios_distribuicoes?: string[]
          horarios_djen_kurier?: string[]
          horarios_djen_pautas_servidor?: string[]
          horarios_djen_processos?: string[]
          horarios_djen_stf_servidor?: string[]
          horarios_djen_termos?: string[]
          horarios_djen_termos_servidor?: string[]
          horarios_djet_pautas?: string[]
          horarios_redistribuicoes?: string[]
          id?: string
          monitorar_andamentos?: boolean
          monitorar_distribuicoes?: boolean
          monitorar_djen_kurier?: boolean
          monitorar_djen_pautas_servidor?: boolean
          monitorar_djen_processos?: boolean
          monitorar_djen_stf_servidor?: boolean
          monitorar_djen_termos?: boolean
          monitorar_djen_termos_servidor?: boolean
          monitorar_djet_pautas?: boolean
          monitorar_redistribuicoes?: boolean
          updated_at?: string
        }
        Update: {
          coordenacao_id?: string
          created_at?: string
          created_by?: string | null
          destinatarios_audiencias_ids?: string[]
          destinatarios_intimacoes_ids?: string[]
          detectar_audiencias?: boolean
          detectar_intimacoes?: boolean
          horarios_andamentos?: string[]
          horarios_distribuicoes?: string[]
          horarios_djen_kurier?: string[]
          horarios_djen_pautas_servidor?: string[]
          horarios_djen_processos?: string[]
          horarios_djen_stf_servidor?: string[]
          horarios_djen_termos?: string[]
          horarios_djen_termos_servidor?: string[]
          horarios_djet_pautas?: string[]
          horarios_redistribuicoes?: string[]
          id?: string
          monitorar_andamentos?: boolean
          monitorar_distribuicoes?: boolean
          monitorar_djen_kurier?: boolean
          monitorar_djen_pautas_servidor?: boolean
          monitorar_djen_processos?: boolean
          monitorar_djen_stf_servidor?: boolean
          monitorar_djen_termos?: boolean
          monitorar_djen_termos_servidor?: boolean
          monitorar_djet_pautas?: boolean
          monitorar_redistribuicoes?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_deteccao_coordenacao_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: true
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      config_envio_alertas_tarefas: {
        Row: {
          ativo: boolean
          canal_email: boolean
          canal_whatsapp: boolean
          coordenacao_id: string
          created_at: string
          created_by: string | null
          destinatarios_ids: string[]
          dias_antes: number[]
          dias_semana: number[]
          id: string
          pos_vencimento_habilitado: boolean
          pos_vencimento_horario: string
          tipo_tarefa: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal_email?: boolean
          canal_whatsapp?: boolean
          coordenacao_id: string
          created_at?: string
          created_by?: string | null
          destinatarios_ids?: string[]
          dias_antes?: number[]
          dias_semana?: number[]
          id?: string
          pos_vencimento_habilitado?: boolean
          pos_vencimento_horario?: string
          tipo_tarefa: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal_email?: boolean
          canal_whatsapp?: boolean
          coordenacao_id?: string
          created_at?: string
          created_by?: string | null
          destinatarios_ids?: string[]
          dias_antes?: number[]
          dias_semana?: number[]
          id?: string
          pos_vencimento_habilitado?: boolean
          pos_vencimento_horario?: string
          tipo_tarefa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_envio_alertas_tarefas_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      config_notificacoes_usuario: {
        Row: {
          canal_email: boolean
          canal_in_app: boolean
          canal_whatsapp: boolean
          created_at: string
          evento_comentario: boolean
          evento_mudanca_situacao: boolean
          evento_prazo_perdido: boolean
          evento_reagendamento: boolean
          evento_tarefa_nova: boolean
          id: string
          janela_hora_fim: number
          janela_hora_inicio: number
          updated_at: string
          usuario_id: string
        }
        Insert: {
          canal_email?: boolean
          canal_in_app?: boolean
          canal_whatsapp?: boolean
          created_at?: string
          evento_comentario?: boolean
          evento_mudanca_situacao?: boolean
          evento_prazo_perdido?: boolean
          evento_reagendamento?: boolean
          evento_tarefa_nova?: boolean
          id?: string
          janela_hora_fim?: number
          janela_hora_inicio?: number
          updated_at?: string
          usuario_id: string
        }
        Update: {
          canal_email?: boolean
          canal_in_app?: boolean
          canal_whatsapp?: boolean
          created_at?: string
          evento_comentario?: boolean
          evento_mudanca_situacao?: boolean
          evento_prazo_perdido?: boolean
          evento_reagendamento?: boolean
          evento_tarefa_nova?: boolean
          id?: string
          janela_hora_fim?: number
          janela_hora_inicio?: number
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      configuracoes_carga_benner: {
        Row: {
          coordenacao_id: string | null
          email_assunto_padrao: string | null
          email_corpo_padrao: string | null
          email_padrao_cc: string[] | null
          email_padrao_para: string[] | null
          id: string
          updated_at: string
        }
        Insert: {
          coordenacao_id?: string | null
          email_assunto_padrao?: string | null
          email_corpo_padrao?: string | null
          email_padrao_cc?: string[] | null
          email_padrao_para?: string[] | null
          id?: string
          updated_at?: string
        }
        Update: {
          coordenacao_id?: string | null
          email_assunto_padrao?: string | null
          email_corpo_padrao?: string | null
          email_padrao_cc?: string[] | null
          email_padrao_para?: string[] | null
          id?: string
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
      configuracoes_monitoramento_servidor: {
        Row: {
          ativo: boolean
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
          created_at?: string
          frequencia?: string
          horarios_execucao?: string[] | null
          id?: string
          metadata?: Json | null
          tipo?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consultas_judit: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          payload_resposta: Json | null
          processo_id: string
          requisitada_em: string
          status_http: number | null
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          payload_resposta?: Json | null
          processo_id: string
          requisitada_em?: string
          status_http?: number | null
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          payload_resposta?: Json | null
          processo_id?: string
          requisitada_em?: string
          status_http?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultas_judit_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
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
          kurier_captura_total: boolean
          monitorar_distribuicoes: boolean
          monitorar_redistribuicoes: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          area: string
          coordenador_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          kurier_captura_total?: boolean
          monitorar_distribuicoes?: boolean
          monitorar_redistribuicoes?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          area?: string
          coordenador_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          kurier_captura_total?: boolean
          monitorar_distribuicoes?: boolean
          monitorar_redistribuicoes?: boolean
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
      custas_processuais: {
        Row: {
          created_at: string
          criado_por: string | null
          data_pagamento: string
          descricao: string
          id: string
          observacoes: string | null
          processo_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data_pagamento: string
          descricao: string
          id?: string
          observacoes?: string | null
          processo_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          processo_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "custas_processuais_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      dados_benner: {
        Row: {
          aba_origem: string | null
          acordo: boolean | null
          analisado: boolean
          analisado_em: string | null
          analisado_por: string | null
          analise_quarteirizado: string | null
          aparelhamento_banco: string | null
          aparelhamento_reclamante: string | null
          aparelhamento_terceiro: string | null
          assunto: string | null
          benner_atualizado: boolean | null
          categoria: string | null
          cejusc: boolean | null
          centralizador: string | null
          chance_exito: string | null
          chance_exito_banco: string | null
          chance_exito_reclamante: string | null
          chance_exito_terceiro: string | null
          comarca: string | null
          confianca_transito: number | null
          coordenacao_id: string | null
          created_at: string
          data_distribuicao: string | null
          data_distribuicao_planilha: string | null
          data_distribuicao_real: string | null
          data_julgamento: string | null
          data_transito_julgado: string | null
          decisao_quarteirizado: string | null
          distribuido_em: string | null
          distribuido_por: string | null
          dossie: string | null
          em_analise: boolean
          em_analise_em: string | null
          em_analise_por: string | null
          entrega_memoriais: string | null
          entregue_em: string | null
          entregue_por: string | null
          equipe: string | null
          erro_judit: boolean
          execucao: string | null
          fontes_importacao: string[]
          ganhamos: boolean | null
          honra: string | null
          horario_julgamento: string | null
          ia_campos_benner: string[] | null
          ia_campos_distribuicao: string[] | null
          ic_duplicado: boolean
          id: string
          judit_preenchido: boolean | null
          judit_preenchido_em: string | null
          judit_preenchido_por: string | null
          juizo: string | null
          materia_honra: string | null
          materias_analise_banco: Json | null
          materias_analise_reclamante: Json | null
          materias_recurso_banco: string | null
          materias_recurso_reclamante: string | null
          materias_recurso_terceiro: string | null
          midia_negativa: string | null
          notas: string | null
          objeto_padrao: string | null
          observacao_advogado: string | null
          observacao_distribuicao: string | null
          observacoes: string | null
          parte_recorrente_origem: string | null
          perdemos: boolean | null
          posicao_relator_desfavoravel: boolean | null
          posicao_relator_favoravel: boolean | null
          posicao_turma_desfavoravel: boolean | null
          posicao_turma_favoravel: boolean | null
          prazo_entrega: string | null
          problema_judit: boolean
          problema_judit_em: string | null
          problema_judit_por: string | null
          processo: string | null
          processo_baixado: string | null
          processo_outro_escritorio: boolean
          provas_digitais: string | null
          reclamada: string | null
          reclamante: string | null
          recorrente: string | null
          recurso_bem_aparelhado: boolean | null
          recurso_mal_aparelhado: boolean | null
          recurso_terceiro: boolean | null
          recurso_terceiros: string | null
          relator: string | null
          resultado_conhecido_nao_provido: boolean | null
          resultado_conhecido_provido: boolean | null
          resultado_nao_conhecido: boolean | null
          resultado_outra: string | null
          resultado_sem_transcendencia: boolean | null
          risco_descricao: string | null
          risco_midia: string | null
          risco_nivel: string | null
          segredo_justica: boolean | null
          situacao_envio_carga_id: string | null
          situacao_processo: string | null
          status: string
          status_distribuicao: string | null
          subcategoria: string | null
          subida_em_massa: boolean
          sustentacao_oral: string | null
          tem_chance_exito_banco: string | null
          tem_chance_exito_reclamante: string | null
          tem_chance_exito_terceiro: string | null
          tem_data_julgamento: string | null
          tem_responsavel: boolean
          tema: string | null
          tipo_julgamento: string | null
          tipo_recurso: string | null
          tipo_recurso_auto: boolean | null
          tipo_recurso_banco: string | null
          tipo_recurso_reclamante: string | null
          tipo_recurso_terceiro: string | null
          transito_julgado: boolean | null
          tribunal: string | null
          turma: string | null
          uf: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aba_origem?: string | null
          acordo?: boolean | null
          analisado?: boolean
          analisado_em?: string | null
          analisado_por?: string | null
          analise_quarteirizado?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          aparelhamento_terceiro?: string | null
          assunto?: string | null
          benner_atualizado?: boolean | null
          categoria?: string | null
          cejusc?: boolean | null
          centralizador?: string | null
          chance_exito?: string | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          chance_exito_terceiro?: string | null
          comarca?: string | null
          confianca_transito?: number | null
          coordenacao_id?: string | null
          created_at?: string
          data_distribuicao?: string | null
          data_distribuicao_planilha?: string | null
          data_distribuicao_real?: string | null
          data_julgamento?: string | null
          data_transito_julgado?: string | null
          decisao_quarteirizado?: string | null
          distribuido_em?: string | null
          distribuido_por?: string | null
          dossie?: string | null
          em_analise?: boolean
          em_analise_em?: string | null
          em_analise_por?: string | null
          entrega_memoriais?: string | null
          entregue_em?: string | null
          entregue_por?: string | null
          equipe?: string | null
          erro_judit?: boolean
          execucao?: string | null
          fontes_importacao?: string[]
          ganhamos?: boolean | null
          honra?: string | null
          horario_julgamento?: string | null
          ia_campos_benner?: string[] | null
          ia_campos_distribuicao?: string[] | null
          ic_duplicado?: boolean
          id?: string
          judit_preenchido?: boolean | null
          judit_preenchido_em?: string | null
          judit_preenchido_por?: string | null
          juizo?: string | null
          materia_honra?: string | null
          materias_analise_banco?: Json | null
          materias_analise_reclamante?: Json | null
          materias_recurso_banco?: string | null
          materias_recurso_reclamante?: string | null
          materias_recurso_terceiro?: string | null
          midia_negativa?: string | null
          notas?: string | null
          objeto_padrao?: string | null
          observacao_advogado?: string | null
          observacao_distribuicao?: string | null
          observacoes?: string | null
          parte_recorrente_origem?: string | null
          perdemos?: boolean | null
          posicao_relator_desfavoravel?: boolean | null
          posicao_relator_favoravel?: boolean | null
          posicao_turma_desfavoravel?: boolean | null
          posicao_turma_favoravel?: boolean | null
          prazo_entrega?: string | null
          problema_judit?: boolean
          problema_judit_em?: string | null
          problema_judit_por?: string | null
          processo?: string | null
          processo_baixado?: string | null
          processo_outro_escritorio?: boolean
          provas_digitais?: string | null
          reclamada?: string | null
          reclamante?: string | null
          recorrente?: string | null
          recurso_bem_aparelhado?: boolean | null
          recurso_mal_aparelhado?: boolean | null
          recurso_terceiro?: boolean | null
          recurso_terceiros?: string | null
          relator?: string | null
          resultado_conhecido_nao_provido?: boolean | null
          resultado_conhecido_provido?: boolean | null
          resultado_nao_conhecido?: boolean | null
          resultado_outra?: string | null
          resultado_sem_transcendencia?: boolean | null
          risco_descricao?: string | null
          risco_midia?: string | null
          risco_nivel?: string | null
          segredo_justica?: boolean | null
          situacao_envio_carga_id?: string | null
          situacao_processo?: string | null
          status?: string
          status_distribuicao?: string | null
          subcategoria?: string | null
          subida_em_massa?: boolean
          sustentacao_oral?: string | null
          tem_chance_exito_banco?: string | null
          tem_chance_exito_reclamante?: string | null
          tem_chance_exito_terceiro?: string | null
          tem_data_julgamento?: string | null
          tem_responsavel?: boolean
          tema?: string | null
          tipo_julgamento?: string | null
          tipo_recurso?: string | null
          tipo_recurso_auto?: boolean | null
          tipo_recurso_banco?: string | null
          tipo_recurso_reclamante?: string | null
          tipo_recurso_terceiro?: string | null
          transito_julgado?: boolean | null
          tribunal?: string | null
          turma?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aba_origem?: string | null
          acordo?: boolean | null
          analisado?: boolean
          analisado_em?: string | null
          analisado_por?: string | null
          analise_quarteirizado?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          aparelhamento_terceiro?: string | null
          assunto?: string | null
          benner_atualizado?: boolean | null
          categoria?: string | null
          cejusc?: boolean | null
          centralizador?: string | null
          chance_exito?: string | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          chance_exito_terceiro?: string | null
          comarca?: string | null
          confianca_transito?: number | null
          coordenacao_id?: string | null
          created_at?: string
          data_distribuicao?: string | null
          data_distribuicao_planilha?: string | null
          data_distribuicao_real?: string | null
          data_julgamento?: string | null
          data_transito_julgado?: string | null
          decisao_quarteirizado?: string | null
          distribuido_em?: string | null
          distribuido_por?: string | null
          dossie?: string | null
          em_analise?: boolean
          em_analise_em?: string | null
          em_analise_por?: string | null
          entrega_memoriais?: string | null
          entregue_em?: string | null
          entregue_por?: string | null
          equipe?: string | null
          erro_judit?: boolean
          execucao?: string | null
          fontes_importacao?: string[]
          ganhamos?: boolean | null
          honra?: string | null
          horario_julgamento?: string | null
          ia_campos_benner?: string[] | null
          ia_campos_distribuicao?: string[] | null
          ic_duplicado?: boolean
          id?: string
          judit_preenchido?: boolean | null
          judit_preenchido_em?: string | null
          judit_preenchido_por?: string | null
          juizo?: string | null
          materia_honra?: string | null
          materias_analise_banco?: Json | null
          materias_analise_reclamante?: Json | null
          materias_recurso_banco?: string | null
          materias_recurso_reclamante?: string | null
          materias_recurso_terceiro?: string | null
          midia_negativa?: string | null
          notas?: string | null
          objeto_padrao?: string | null
          observacao_advogado?: string | null
          observacao_distribuicao?: string | null
          observacoes?: string | null
          parte_recorrente_origem?: string | null
          perdemos?: boolean | null
          posicao_relator_desfavoravel?: boolean | null
          posicao_relator_favoravel?: boolean | null
          posicao_turma_desfavoravel?: boolean | null
          posicao_turma_favoravel?: boolean | null
          prazo_entrega?: string | null
          problema_judit?: boolean
          problema_judit_em?: string | null
          problema_judit_por?: string | null
          processo?: string | null
          processo_baixado?: string | null
          processo_outro_escritorio?: boolean
          provas_digitais?: string | null
          reclamada?: string | null
          reclamante?: string | null
          recorrente?: string | null
          recurso_bem_aparelhado?: boolean | null
          recurso_mal_aparelhado?: boolean | null
          recurso_terceiro?: boolean | null
          recurso_terceiros?: string | null
          relator?: string | null
          resultado_conhecido_nao_provido?: boolean | null
          resultado_conhecido_provido?: boolean | null
          resultado_nao_conhecido?: boolean | null
          resultado_outra?: string | null
          resultado_sem_transcendencia?: boolean | null
          risco_descricao?: string | null
          risco_midia?: string | null
          risco_nivel?: string | null
          segredo_justica?: boolean | null
          situacao_envio_carga_id?: string | null
          situacao_processo?: string | null
          status?: string
          status_distribuicao?: string | null
          subcategoria?: string | null
          subida_em_massa?: boolean
          sustentacao_oral?: string | null
          tem_chance_exito_banco?: string | null
          tem_chance_exito_reclamante?: string | null
          tem_chance_exito_terceiro?: string | null
          tem_data_julgamento?: string | null
          tem_responsavel?: boolean
          tema?: string | null
          tipo_julgamento?: string | null
          tipo_recurso?: string | null
          tipo_recurso_auto?: boolean | null
          tipo_recurso_banco?: string | null
          tipo_recurso_reclamante?: string | null
          tipo_recurso_terceiro?: string | null
          transito_julgado?: boolean | null
          tribunal?: string | null
          turma?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dados_benner_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dados_benner_situacao_envio_carga_id_fkey"
            columns: ["situacao_envio_carga_id"]
            isOneToOne: false
            referencedRelation: "situacoes_envio_carga"
            referencedColumns: ["id"]
          },
        ]
      }
      dados_benner_arquivados: {
        Row: {
          aba_origem: string | null
          arquivado_em: string
          arquivado_por: string | null
          coordenacao_id: string | null
          dados_benner_id: string
          dossie: string | null
          id: string
          motivo: string | null
          processo: string | null
          snapshot: Json
        }
        Insert: {
          aba_origem?: string | null
          arquivado_em?: string
          arquivado_por?: string | null
          coordenacao_id?: string | null
          dados_benner_id: string
          dossie?: string | null
          id?: string
          motivo?: string | null
          processo?: string | null
          snapshot: Json
        }
        Update: {
          aba_origem?: string | null
          arquivado_em?: string
          arquivado_por?: string | null
          coordenacao_id?: string | null
          dados_benner_id?: string
          dossie?: string | null
          id?: string
          motivo?: string | null
          processo?: string | null
          snapshot?: Json
        }
        Relationships: []
      }
      dados_benner_judit_temp: {
        Row: {
          aba_origem: string | null
          analise_quarteirizado: string | null
          aparelhamento_banco: string | null
          aparelhamento_reclamante: string | null
          benner_atualizado: boolean | null
          chance_exito: string | null
          chance_exito_banco: string | null
          chance_exito_reclamante: string | null
          confianca_transito: number | null
          coordenacao_id: string | null
          created_at: string | null
          data_distribuicao: string | null
          data_distribuicao_planilha: string | null
          data_distribuicao_real: string | null
          data_julgamento: string | null
          data_transito_julgado: string | null
          decisao_quarteirizado: string | null
          dossie: string | null
          entrega_memoriais: string | null
          equipe: string | null
          erro_judit: boolean | null
          execucao: string | null
          ganhamos: boolean | null
          honra: string | null
          horario_julgamento: string | null
          id: string | null
          judit_preenchido: boolean | null
          judit_preenchido_em: string | null
          judit_preenchido_por: string | null
          materia_honra: string | null
          materias_recurso_banco: string | null
          materias_recurso_reclamante: string | null
          midia_negativa: string | null
          notas: string | null
          observacao_advogado: string | null
          observacoes: string | null
          parte_recorrente_origem: string | null
          perdemos: boolean | null
          posicao_relator_desfavoravel: boolean | null
          posicao_relator_favoravel: boolean | null
          posicao_turma_desfavoravel: boolean | null
          posicao_turma_favoravel: boolean | null
          processo: string | null
          processo_baixado: string | null
          provas_digitais: string | null
          reclamada: string | null
          reclamante: string | null
          recorrente: string | null
          recurso_bem_aparelhado: boolean | null
          recurso_mal_aparelhado: boolean | null
          recurso_terceiros: string | null
          relator: string | null
          resultado_conhecido_nao_provido: boolean | null
          resultado_conhecido_provido: boolean | null
          resultado_nao_conhecido: boolean | null
          resultado_outra: string | null
          resultado_sem_transcendencia: boolean | null
          risco_descricao: string | null
          risco_midia: string | null
          situacao_processo: string | null
          status: string | null
          sustentacao_oral: string | null
          tem_data_julgamento: string | null
          tema: string | null
          tipo_julgamento: string | null
          tipo_recurso: string | null
          tipo_recurso_auto: boolean | null
          tipo_recurso_banco: string | null
          tipo_recurso_reclamante: string | null
          transito_julgado: boolean | null
          tribunal: string | null
          turma: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aba_origem?: string | null
          analise_quarteirizado?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          benner_atualizado?: boolean | null
          chance_exito?: string | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          confianca_transito?: number | null
          coordenacao_id?: string | null
          created_at?: string | null
          data_distribuicao?: string | null
          data_distribuicao_planilha?: string | null
          data_distribuicao_real?: string | null
          data_julgamento?: string | null
          data_transito_julgado?: string | null
          decisao_quarteirizado?: string | null
          dossie?: string | null
          entrega_memoriais?: string | null
          equipe?: string | null
          erro_judit?: boolean | null
          execucao?: string | null
          ganhamos?: boolean | null
          honra?: string | null
          horario_julgamento?: string | null
          id?: string | null
          judit_preenchido?: boolean | null
          judit_preenchido_em?: string | null
          judit_preenchido_por?: string | null
          materia_honra?: string | null
          materias_recurso_banco?: string | null
          materias_recurso_reclamante?: string | null
          midia_negativa?: string | null
          notas?: string | null
          observacao_advogado?: string | null
          observacoes?: string | null
          parte_recorrente_origem?: string | null
          perdemos?: boolean | null
          posicao_relator_desfavoravel?: boolean | null
          posicao_relator_favoravel?: boolean | null
          posicao_turma_desfavoravel?: boolean | null
          posicao_turma_favoravel?: boolean | null
          processo?: string | null
          processo_baixado?: string | null
          provas_digitais?: string | null
          reclamada?: string | null
          reclamante?: string | null
          recorrente?: string | null
          recurso_bem_aparelhado?: boolean | null
          recurso_mal_aparelhado?: boolean | null
          recurso_terceiros?: string | null
          relator?: string | null
          resultado_conhecido_nao_provido?: boolean | null
          resultado_conhecido_provido?: boolean | null
          resultado_nao_conhecido?: boolean | null
          resultado_outra?: string | null
          resultado_sem_transcendencia?: boolean | null
          risco_descricao?: string | null
          risco_midia?: string | null
          situacao_processo?: string | null
          status?: string | null
          sustentacao_oral?: string | null
          tem_data_julgamento?: string | null
          tema?: string | null
          tipo_julgamento?: string | null
          tipo_recurso?: string | null
          tipo_recurso_auto?: boolean | null
          tipo_recurso_banco?: string | null
          tipo_recurso_reclamante?: string | null
          transito_julgado?: boolean | null
          tribunal?: string | null
          turma?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aba_origem?: string | null
          analise_quarteirizado?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          benner_atualizado?: boolean | null
          chance_exito?: string | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          confianca_transito?: number | null
          coordenacao_id?: string | null
          created_at?: string | null
          data_distribuicao?: string | null
          data_distribuicao_planilha?: string | null
          data_distribuicao_real?: string | null
          data_julgamento?: string | null
          data_transito_julgado?: string | null
          decisao_quarteirizado?: string | null
          dossie?: string | null
          entrega_memoriais?: string | null
          equipe?: string | null
          erro_judit?: boolean | null
          execucao?: string | null
          ganhamos?: boolean | null
          honra?: string | null
          horario_julgamento?: string | null
          id?: string | null
          judit_preenchido?: boolean | null
          judit_preenchido_em?: string | null
          judit_preenchido_por?: string | null
          materia_honra?: string | null
          materias_recurso_banco?: string | null
          materias_recurso_reclamante?: string | null
          midia_negativa?: string | null
          notas?: string | null
          observacao_advogado?: string | null
          observacoes?: string | null
          parte_recorrente_origem?: string | null
          perdemos?: boolean | null
          posicao_relator_desfavoravel?: boolean | null
          posicao_relator_favoravel?: boolean | null
          posicao_turma_desfavoravel?: boolean | null
          posicao_turma_favoravel?: boolean | null
          processo?: string | null
          processo_baixado?: string | null
          provas_digitais?: string | null
          reclamada?: string | null
          reclamante?: string | null
          recorrente?: string | null
          recurso_bem_aparelhado?: boolean | null
          recurso_mal_aparelhado?: boolean | null
          recurso_terceiros?: string | null
          relator?: string | null
          resultado_conhecido_nao_provido?: boolean | null
          resultado_conhecido_provido?: boolean | null
          resultado_nao_conhecido?: boolean | null
          resultado_outra?: string | null
          resultado_sem_transcendencia?: boolean | null
          risco_descricao?: string | null
          risco_midia?: string | null
          situacao_processo?: string | null
          status?: string | null
          sustentacao_oral?: string | null
          tem_data_julgamento?: string | null
          tema?: string | null
          tipo_julgamento?: string | null
          tipo_recurso?: string | null
          tipo_recurso_auto?: boolean | null
          tipo_recurso_banco?: string | null
          tipo_recurso_reclamante?: string | null
          transito_julgado?: boolean | null
          tribunal?: string | null
          turma?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      dados_benner_judit_temp_responsaveis: {
        Row: {
          created_at: string | null
          dados_benner_id: string | null
          id: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          dados_benner_id?: string | null
          id?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          dados_benner_id?: string | null
          id?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      dados_benner_processo_tags: {
        Row: {
          created_at: string
          created_by: string | null
          dado_benner_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dado_benner_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dado_benner_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dados_benner_processo_tags_dado_benner_id_fkey"
            columns: ["dado_benner_id"]
            isOneToOne: false
            referencedRelation: "dados_benner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dados_benner_processo_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "processo_tags_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      dados_benner_responsaveis: {
        Row: {
          created_at: string
          dados_benner_id: string
          id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          dados_benner_id: string
          id?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          dados_benner_id?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dados_benner_responsaveis_dados_benner_id_fkey"
            columns: ["dados_benner_id"]
            isOneToOne: false
            referencedRelation: "dados_benner"
            referencedColumns: ["id"]
          },
        ]
      }
      depositos_recursais: {
        Row: {
          created_at: string
          criado_por: string | null
          data_pagamento: string
          id: string
          observacoes: string | null
          processo_id: string
          titulo: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data_pagamento: string
          id?: string
          observacoes?: string | null
          processo_id: string
          titulo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string
          id?: string
          observacoes?: string | null
          processo_id?: string
          titulo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "depositos_recursais_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
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
      distribuicoes_tst_arquivada_2026_06: {
        Row: {
          aba_origem: string | null
          aparelhamento_banco: string | null
          aparelhamento_reclamante: string | null
          aparelhamento_terceiro: string | null
          benner_atualizado: boolean | null
          chance_exito_banco: string | null
          chance_exito_reclamante: string | null
          chance_exito_terceiro: string | null
          created_at: string
          data_distribuicao: string | null
          decisao_quarteirizado: string | null
          dossie: string | null
          equipe: string | null
          execucao: string | null
          honra: string | null
          id: string
          judit_preenchido: boolean
          judit_preenchido_em: string | null
          judit_preenchido_por: string | null
          materias_recurso_banco: string | null
          materias_recurso_reclamante: string | null
          materias_recurso_terceiro: string | null
          midia_negativa: string | null
          parte_recorrente: string | null
          processo_id: string
          processo_numero: string
          reclamada: string | null
          reclamante: string | null
          recurso_terceiros: string | null
          relator: string | null
          relator_favorabilidade: string | null
          tema: string | null
          tipo_recurso_banco: string | null
          tipo_recurso_reclamante: string | null
          tipo_recurso_terceiro: string | null
          transito_julgado: boolean | null
          turma: string | null
          turma_favorabilidade: string | null
          updated_at: string
        }
        Insert: {
          aba_origem?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          aparelhamento_terceiro?: string | null
          benner_atualizado?: boolean | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          chance_exito_terceiro?: string | null
          created_at?: string
          data_distribuicao?: string | null
          decisao_quarteirizado?: string | null
          dossie?: string | null
          equipe?: string | null
          execucao?: string | null
          honra?: string | null
          id?: string
          judit_preenchido?: boolean
          judit_preenchido_em?: string | null
          judit_preenchido_por?: string | null
          materias_recurso_banco?: string | null
          materias_recurso_reclamante?: string | null
          materias_recurso_terceiro?: string | null
          midia_negativa?: string | null
          parte_recorrente?: string | null
          processo_id: string
          processo_numero: string
          reclamada?: string | null
          reclamante?: string | null
          recurso_terceiros?: string | null
          relator?: string | null
          relator_favorabilidade?: string | null
          tema?: string | null
          tipo_recurso_banco?: string | null
          tipo_recurso_reclamante?: string | null
          tipo_recurso_terceiro?: string | null
          transito_julgado?: boolean | null
          turma?: string | null
          turma_favorabilidade?: string | null
          updated_at?: string
        }
        Update: {
          aba_origem?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          aparelhamento_terceiro?: string | null
          benner_atualizado?: boolean | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          chance_exito_terceiro?: string | null
          created_at?: string
          data_distribuicao?: string | null
          decisao_quarteirizado?: string | null
          dossie?: string | null
          equipe?: string | null
          execucao?: string | null
          honra?: string | null
          id?: string
          judit_preenchido?: boolean
          judit_preenchido_em?: string | null
          judit_preenchido_por?: string | null
          materias_recurso_banco?: string | null
          materias_recurso_reclamante?: string | null
          materias_recurso_terceiro?: string | null
          midia_negativa?: string | null
          parte_recorrente?: string | null
          processo_id?: string
          processo_numero?: string
          reclamada?: string | null
          reclamante?: string | null
          recurso_terceiros?: string | null
          relator?: string | null
          relator_favorabilidade?: string | null
          tema?: string | null
          tipo_recurso_banco?: string | null
          tipo_recurso_reclamante?: string | null
          tipo_recurso_terceiro?: string | null
          transito_julgado?: boolean | null
          turma?: string | null
          turma_favorabilidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribuicoes_tst_judit_preenchido_por_fkey"
            columns: ["judit_preenchido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_tst_judit_preenchido_por_fkey"
            columns: ["judit_preenchido_por"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_tst_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_estaduais_conteudo: {
        Row: {
          conteudo_texto: string
          created_at: string
          id: string
          pagina: number
          pdf_id: string
          processos_detectados: string[]
        }
        Insert: {
          conteudo_texto: string
          created_at?: string
          id?: string
          pagina: number
          pdf_id: string
          processos_detectados?: string[]
        }
        Update: {
          conteudo_texto?: string
          created_at?: string
          id?: string
          pagina?: number
          pdf_id?: string
          processos_detectados?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "dj_estaduais_conteudo_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "dj_estaduais_pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_estaduais_pdfs: {
        Row: {
          baixado_em: string | null
          caderno: string
          created_at: string
          data_publicacao: string
          erro_mensagem: string | null
          id: string
          processado_em: string | null
          status: string
          storage_path: string | null
          total_paginas: number | null
          tribunal: string
          updated_at: string
        }
        Insert: {
          baixado_em?: string | null
          caderno?: string
          created_at?: string
          data_publicacao: string
          erro_mensagem?: string | null
          id?: string
          processado_em?: string | null
          status?: string
          storage_path?: string | null
          total_paginas?: number | null
          tribunal: string
          updated_at?: string
        }
        Update: {
          baixado_em?: string | null
          caderno?: string
          created_at?: string
          data_publicacao?: string
          erro_mensagem?: string | null
          id?: string
          processado_em?: string | null
          status?: string
          storage_path?: string | null
          total_paginas?: number | null
          tribunal?: string
          updated_at?: string
        }
        Relationships: []
      }
      dje_conteudo_indexado: {
        Row: {
          conteudo_texto: string
          created_at: string
          id: string
          pagina: number
          pdf_id: string
          processos_detectados: string[] | null
        }
        Insert: {
          conteudo_texto: string
          created_at?: string
          id?: string
          pagina: number
          pdf_id: string
          processos_detectados?: string[] | null
        }
        Update: {
          conteudo_texto?: string
          created_at?: string
          id?: string
          pagina?: number
          pdf_id?: string
          processos_detectados?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "dje_conteudo_indexado_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "dje_pdfs_diarios"
            referencedColumns: ["id"]
          },
        ]
      }
      dje_pdfs_diarios: {
        Row: {
          caderno: string | null
          created_at: string
          data_publicacao: string
          erro_mensagem: string | null
          id: string
          processado_em: string | null
          status: string
          storage_path: string | null
          tamanho_bytes: number | null
          total_paginas: number | null
          tribunal: string
          url_origem: string | null
        }
        Insert: {
          caderno?: string | null
          created_at?: string
          data_publicacao: string
          erro_mensagem?: string | null
          id?: string
          processado_em?: string | null
          status?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          total_paginas?: number | null
          tribunal: string
          url_origem?: string | null
        }
        Update: {
          caderno?: string | null
          created_at?: string
          data_publicacao?: string
          erro_mensagem?: string | null
          id?: string
          processado_em?: string | null
          status?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          total_paginas?: number | null
          tribunal?: string
          url_origem?: string | null
        }
        Relationships: []
      }
      dje_resultados_busca: {
        Row: {
          conteudo_id: string
          contexto: string | null
          created_at: string
          id: string
          monitoramento_id: string | null
          origem: string
          pagina: number | null
          processo_numero: string | null
          termo_encontrado: string
        }
        Insert: {
          conteudo_id: string
          contexto?: string | null
          created_at?: string
          id?: string
          monitoramento_id?: string | null
          origem?: string
          pagina?: number | null
          processo_numero?: string | null
          termo_encontrado: string
        }
        Update: {
          conteudo_id?: string
          contexto?: string | null
          created_at?: string
          id?: string
          monitoramento_id?: string | null
          origem?: string
          pagina?: number | null
          processo_numero?: string | null
          termo_encontrado?: string
        }
        Relationships: [
          {
            foreignKeyName: "dje_resultados_busca_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "dje_conteudo_indexado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dje_resultados_busca_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
        ]
      }
      djen_diario_index: {
        Row: {
          atualizado_em: string | null
          cancelado: boolean | null
          diario_ymd: string
          erro_mensagem: string | null
          id: string
          started_at: string | null
          status: string
          total_publicacoes: number | null
          total_tribunais: number | null
          tribunais_processados: number | null
        }
        Insert: {
          atualizado_em?: string | null
          cancelado?: boolean | null
          diario_ymd: string
          erro_mensagem?: string | null
          id?: string
          started_at?: string | null
          status?: string
          total_publicacoes?: number | null
          total_tribunais?: number | null
          tribunais_processados?: number | null
        }
        Update: {
          atualizado_em?: string | null
          cancelado?: boolean | null
          diario_ymd?: string
          erro_mensagem?: string | null
          id?: string
          started_at?: string | null
          status?: string
          total_publicacoes?: number | null
          total_tribunais?: number | null
          tribunais_processados?: number | null
        }
        Relationships: []
      }
      djen_diario_index_requests: {
        Row: {
          data_ymd: string
          erro_mensagem: string | null
          finished_at: string | null
          id: string
          requested_at: string
          requested_by: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          data_ymd: string
          erro_mensagem?: string | null
          finished_at?: string | null
          id?: string
          requested_at?: string
          requested_by?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          data_ymd?: string
          erro_mensagem?: string | null
          finished_at?: string | null
          id?: string
          requested_at?: string
          requested_by?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      djen_diario_index_tribunais: {
        Row: {
          atualizado_em: string | null
          diario_ymd: string
          erro_mensagem: string | null
          max_pages: number | null
          paginas_processadas: number | null
          status: string
          tribunal: string
        }
        Insert: {
          atualizado_em?: string | null
          diario_ymd: string
          erro_mensagem?: string | null
          max_pages?: number | null
          paginas_processadas?: number | null
          status?: string
          tribunal: string
        }
        Update: {
          atualizado_em?: string | null
          diario_ymd?: string
          erro_mensagem?: string | null
          max_pages?: number | null
          paginas_processadas?: number | null
          status?: string
          tribunal?: string
        }
        Relationships: []
      }
      djen_diario_publicacoes: {
        Row: {
          conteudo: string
          conteudo_tsv: unknown
          created_at: string | null
          data_disponibilizacao: string | null
          data_publicacao: string | null
          diario_ymd: string
          hash_global: string
          id: string
          processo_numero: string | null
          raw_json: Json | null
          tribunal: string | null
        }
        Insert: {
          conteudo: string
          conteudo_tsv?: unknown
          created_at?: string | null
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          diario_ymd: string
          hash_global: string
          id?: string
          processo_numero?: string | null
          raw_json?: Json | null
          tribunal?: string | null
        }
        Update: {
          conteudo?: string
          conteudo_tsv?: unknown
          created_at?: string | null
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          diario_ymd?: string
          hash_global?: string
          id?: string
          processo_numero?: string | null
          raw_json?: Json | null
          tribunal?: string | null
        }
        Relationships: []
      }
      djen_lotes: {
        Row: {
          created_at: string
          descartadas: number | null
          duplicatas: number | null
          duracao_segundos: number | null
          erro_mensagem: string | null
          erros: number | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          lote_numero: number
          novas: number | null
          offset_final: number
          offset_inicial: number
          processados: number | null
          run_id: string
          status: string
          total_paginas: number | null
          total_resultados: number | null
        }
        Insert: {
          created_at?: string
          descartadas?: number | null
          duplicatas?: number | null
          duracao_segundos?: number | null
          erro_mensagem?: string | null
          erros?: number | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          lote_numero: number
          novas?: number | null
          offset_final: number
          offset_inicial: number
          processados?: number | null
          run_id: string
          status?: string
          total_paginas?: number | null
          total_resultados?: number | null
        }
        Update: {
          created_at?: string
          descartadas?: number | null
          duplicatas?: number | null
          duracao_segundos?: number | null
          erro_mensagem?: string | null
          erros?: number | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          lote_numero?: number
          novas?: number | null
          offset_final?: number
          offset_inicial?: number
          processados?: number | null
          run_id?: string
          status?: string
          total_paginas?: number | null
          total_resultados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "djen_lotes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "djen_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      djen_proxy_pool: {
        Row: {
          base_url: string
          created_at: string
          criado_por: string | null
          enabled: boolean
          id: string
          label: string
          pool_enabled_global: boolean
          token: string
          updated_at: string
        }
        Insert: {
          base_url: string
          created_at?: string
          criado_por?: string | null
          enabled?: boolean
          id?: string
          label: string
          pool_enabled_global?: boolean
          token: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          criado_por?: string | null
          enabled?: boolean
          id?: string
          label?: string
          pool_enabled_global?: boolean
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      djen_runs: {
        Row: {
          created_at: string
          descartadas: number | null
          duplicatas: number | null
          duracao_segundos: number | null
          erros: number | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          motivo_erro: string | null
          novas: number | null
          processados: number | null
          retry_count: number | null
          run_id: string
          status: string
          total_monitoramentos: number | null
          total_paginas: number | null
          total_resultados: number | null
        }
        Insert: {
          created_at?: string
          descartadas?: number | null
          duplicatas?: number | null
          duracao_segundos?: number | null
          erros?: number | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          motivo_erro?: string | null
          novas?: number | null
          processados?: number | null
          retry_count?: number | null
          run_id: string
          status?: string
          total_monitoramentos?: number | null
          total_paginas?: number | null
          total_resultados?: number | null
        }
        Update: {
          created_at?: string
          descartadas?: number | null
          duplicatas?: number | null
          duracao_segundos?: number | null
          erros?: number | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          motivo_erro?: string | null
          novas?: number | null
          processados?: number | null
          retry_count?: number | null
          run_id?: string
          status?: string
          total_monitoramentos?: number | null
          total_paginas?: number | null
          total_resultados?: number | null
        }
        Relationships: []
      }
      djen_tribunais_lote: {
        Row: {
          created_at: string
          descartadas: number | null
          duplicatas: number | null
          id: string
          lote_id: string
          novas: number | null
          paginas: number | null
          resultados: number | null
          run_id: string
          termos_buscados: number | null
          tribunal: string
        }
        Insert: {
          created_at?: string
          descartadas?: number | null
          duplicatas?: number | null
          id?: string
          lote_id: string
          novas?: number | null
          paginas?: number | null
          resultados?: number | null
          run_id: string
          termos_buscados?: number | null
          tribunal: string
        }
        Update: {
          created_at?: string
          descartadas?: number | null
          duplicatas?: number | null
          id?: string
          lote_id?: string
          novas?: number | null
          paginas?: number | null
          resultados?: number | null
          run_id?: string
          termos_buscados?: number | null
          tribunal?: string
        }
        Relationships: [
          {
            foreignKeyName: "djen_tribunais_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "djen_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "djen_tribunais_lote_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "djen_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      documentos: {
        Row: {
          analisado_ia: boolean | null
          audiencia_id: string | null
          categoria: string | null
          confianca_ia: string | null
          conteudo_extraido: string | null
          created_at: string
          descricao: string | null
          evento_id: string | null
          id: string
          nome: string
          paginas_extraidas: number | null
          pasta_id: string | null
          processo_id: string | null
          tags: string[] | null
          tamanho_bytes: number | null
          tarefa_id: string | null
          texto_completo_indexado: boolean | null
          tipo: string | null
          tipo_documento: string | null
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          analisado_ia?: boolean | null
          audiencia_id?: string | null
          categoria?: string | null
          confianca_ia?: string | null
          conteudo_extraido?: string | null
          created_at?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          nome: string
          paginas_extraidas?: number | null
          pasta_id?: string | null
          processo_id?: string | null
          tags?: string[] | null
          tamanho_bytes?: number | null
          tarefa_id?: string | null
          texto_completo_indexado?: boolean | null
          tipo?: string | null
          tipo_documento?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          analisado_ia?: boolean | null
          audiencia_id?: string | null
          categoria?: string | null
          confianca_ia?: string | null
          conteudo_extraido?: string | null
          created_at?: string
          descricao?: string | null
          evento_id?: string | null
          id?: string
          nome?: string
          paginas_extraidas?: number | null
          pasta_id?: string | null
          processo_id?: string | null
          tags?: string[] | null
          tamanho_bytes?: number | null
          tarefa_id?: string | null
          texto_completo_indexado?: boolean | null
          tipo?: string | null
          tipo_documento?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
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
      documentos_texto_indexado: {
        Row: {
          conteudo_texto: string
          created_at: string
          documento_id: string
          id: string
          pagina: number
          processo_id: string
        }
        Insert: {
          conteudo_texto: string
          created_at?: string
          documento_id: string
          id?: string
          pagina: number
          processo_id: string
        }
        Update: {
          conteudo_texto?: string
          created_at?: string
          documento_id?: string
          id?: string
          pagina?: number
          processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_texto_indexado_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_texto_indexado_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          coordenacao_id: string
          cor: string
          created_at: string
          created_by: string | null
          id: string
          modulos: string[]
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          coordenacao_id: string
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          modulos?: string[]
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          coordenacao_id?: string
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          modulos?: string[]
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etiquetas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etiquetas_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas_itens: {
        Row: {
          created_at: string
          created_by: string | null
          entidade: string
          entidade_id: string
          etiqueta_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entidade: string
          entidade_id: string
          etiqueta_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entidade?: string
          entidade_id?: string
          etiqueta_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etiquetas_itens_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "etiquetas"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_envolvidos: {
        Row: {
          created_at: string
          evento_id: string
          id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          evento_id: string
          id?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          evento_id?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_envolvidos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_processos: {
        Row: {
          created_at: string
          evento_id: string
          processo_id: string
        }
        Insert: {
          created_at?: string
          evento_id: string
          processo_id: string
        }
        Update: {
          created_at?: string
          evento_id?: string
          processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_processos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_processos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_responsaveis: {
        Row: {
          created_at: string
          evento_id: string
          id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          evento_id: string
          id?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          evento_id?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_responsaveis_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_agenda: {
        Row: {
          concluido_em: string | null
          coordenacao_id: string | null
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
          modalidade: string | null
          numero_parcela: number | null
          processo_id: string | null
          recorrencia_ate: string | null
          recorrencia_dias_semana: number[] | null
          recorrencia_fim: string | null
          recorrencia_intervalo: number | null
          recorrencia_rrule: string | null
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
          coordenacao_id?: string | null
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
          modalidade?: string | null
          numero_parcela?: number | null
          processo_id?: string | null
          recorrencia_ate?: string | null
          recorrencia_dias_semana?: number[] | null
          recorrencia_fim?: string | null
          recorrencia_intervalo?: number | null
          recorrencia_rrule?: string | null
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
          coordenacao_id?: string | null
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
          modalidade?: string | null
          numero_parcela?: number | null
          processo_id?: string | null
          recorrencia_ate?: string | null
          recorrencia_dias_semana?: number[] | null
          recorrencia_fim?: string | null
          recorrencia_intervalo?: number | null
          recorrencia_rrule?: string | null
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
            foreignKeyName: "eventos_agenda_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_agenda_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      execucoes_acompanhamento_especial: {
        Row: {
          created_at: string
          detalhes: Json | null
          disparo: string
          duracao_ms: number | null
          erro: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          invocado_por: string | null
          slot: number | null
          status: string
          total_erros: number
          total_novos_eventos: number
          total_processos: number
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          disparo?: string
          duracao_ms?: number | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          invocado_por?: string | null
          slot?: number | null
          status?: string
          total_erros?: number
          total_novos_eventos?: number
          total_processos?: number
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          disparo?: string
          duracao_ms?: number | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          invocado_por?: string | null
          slot?: number | null
          status?: string
          total_erros?: number
          total_novos_eventos?: number
          total_processos?: number
        }
        Relationships: []
      }
      execucoes_agendadas: {
        Row: {
          agendado_para: string | null
          created_at: string | null
          detalhes: Json | null
          erros: number | null
          finalizado_em: string | null
          id: string
          iniciado_em: string | null
          job_name: string | null
          lotes_processados: number | null
          registros_encontrados: number | null
          registros_processados: number | null
          retry_count: number | null
          status: string
          tipo: string
          total_lotes: number | null
          ultimo_erro: string | null
        }
        Insert: {
          agendado_para?: string | null
          created_at?: string | null
          detalhes?: Json | null
          erros?: number | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          job_name?: string | null
          lotes_processados?: number | null
          registros_encontrados?: number | null
          registros_processados?: number | null
          retry_count?: number | null
          status?: string
          tipo: string
          total_lotes?: number | null
          ultimo_erro?: string | null
        }
        Update: {
          agendado_para?: string | null
          created_at?: string | null
          detalhes?: Json | null
          erros?: number | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          job_name?: string | null
          lotes_processados?: number | null
          registros_encontrados?: number | null
          registros_processados?: number | null
          retry_count?: number | null
          status?: string
          tipo?: string
          total_lotes?: number | null
          ultimo_erro?: string | null
        }
        Relationships: []
      }
      execucoes_servidor: {
        Row: {
          agendado_para: string
          created_at: string
          dedupe_key: string | null
          erro: string | null
          finalizado_em: string | null
          heartbeat_at: string | null
          id: string
          iniciado_em: string | null
          payload: Json | null
          progresso: Json | null
          progresso_atualizado_em: string | null
          resultado: Json | null
          rodada_do_dia: number | null
          slot_horario: string | null
          status: string
          tentativas: number
          tipo: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          agendado_para?: string
          created_at?: string
          dedupe_key?: string | null
          erro?: string | null
          finalizado_em?: string | null
          heartbeat_at?: string | null
          id?: string
          iniciado_em?: string | null
          payload?: Json | null
          progresso?: Json | null
          progresso_atualizado_em?: string | null
          resultado?: Json | null
          rodada_do_dia?: number | null
          slot_horario?: string | null
          status?: string
          tentativas?: number
          tipo: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          agendado_para?: string
          created_at?: string
          dedupe_key?: string | null
          erro?: string | null
          finalizado_em?: string | null
          heartbeat_at?: string | null
          id?: string
          iniciado_em?: string | null
          payload?: Json | null
          progresso?: Json | null
          progresso_atualizado_em?: string | null
          resultado?: Json | null
          rodada_do_dia?: number | null
          slot_horario?: string | null
          status?: string
          tentativas?: number
          tipo?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      execucoes_servidor_falhas: {
        Row: {
          created_at: string
          dia_brt: string
          execucao_id: string | null
          id: string
          item_key: string
          payload: Json
          status: string
          tentativas: number
          tipo: string
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_brt?: string
          execucao_id?: string | null
          id?: string
          item_key: string
          payload?: Json
          status?: string
          tentativas?: number
          tipo: string
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_brt?: string
          execucao_id?: string | null
          id?: string
          item_key?: string
          payload?: Json
          status?: string
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execucoes_servidor_falhas_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucoes_servidor"
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
      historico_alertas_enviados: {
        Row: {
          canal: string
          conteudo: string
          coordenacao_id: string | null
          destinatario: string
          enviado_em: string
          erro: string | null
          id: string
          itens_referencias: Json | null
          referencia_id: string | null
          status: string
          tipo_alerta: string
        }
        Insert: {
          canal: string
          conteudo: string
          coordenacao_id?: string | null
          destinatario: string
          enviado_em?: string
          erro?: string | null
          id?: string
          itens_referencias?: Json | null
          referencia_id?: string | null
          status?: string
          tipo_alerta: string
        }
        Update: {
          canal?: string
          conteudo?: string
          coordenacao_id?: string | null
          destinatario?: string
          enviado_em?: string
          erro?: string | null
          id?: string
          itens_referencias?: Json | null
          referencia_id?: string | null
          status?: string
          tipo_alerta?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_alertas_enviados_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
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
      historico_reagendamentos_audiencia: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          audiencia_id: string
          data_anterior: string | null
          data_nova: string | null
          hora_anterior: string | null
          hora_nova: string | null
          id: string
          modalidade_anterior: string | null
          modalidade_nova: string | null
          motivo: string | null
          tipo_anterior: string | null
          tipo_novo: string | null
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          audiencia_id: string
          data_anterior?: string | null
          data_nova?: string | null
          hora_anterior?: string | null
          hora_nova?: string | null
          id?: string
          modalidade_anterior?: string | null
          modalidade_nova?: string | null
          motivo?: string | null
          tipo_anterior?: string | null
          tipo_novo?: string | null
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          audiencia_id?: string
          data_anterior?: string | null
          data_nova?: string | null
          hora_anterior?: string | null
          hora_nova?: string | null
          id?: string
          modalidade_anterior?: string | null
          modalidade_nova?: string | null
          motivo?: string | null
          tipo_anterior?: string | null
          tipo_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_reagendamentos_audiencia_audiencia_id_fkey"
            columns: ["audiencia_id"]
            isOneToOne: false
            referencedRelation: "audiencias_detectadas"
            referencedColumns: ["id"]
          },
        ]
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
      judit_anexos: {
        Row: {
          attachment_date: string | null
          attachment_id: string
          attachment_name: string | null
          cnj: string | null
          corrupted: boolean | null
          created_at: string
          created_by: string | null
          documento_id: string | null
          extension: string | null
          id: string
          instance: string | null
          paginas_extraidas: number | null
          processo_id: string | null
          processo_numero: string
          raw_attachment: Json | null
          status: string | null
          step_id: string | null
          storage_path: string | null
          texto_indexado: boolean
          texto_indexado_em: string | null
          updated_at: string
        }
        Insert: {
          attachment_date?: string | null
          attachment_id: string
          attachment_name?: string | null
          cnj?: string | null
          corrupted?: boolean | null
          created_at?: string
          created_by?: string | null
          documento_id?: string | null
          extension?: string | null
          id?: string
          instance?: string | null
          paginas_extraidas?: number | null
          processo_id?: string | null
          processo_numero: string
          raw_attachment?: Json | null
          status?: string | null
          step_id?: string | null
          storage_path?: string | null
          texto_indexado?: boolean
          texto_indexado_em?: string | null
          updated_at?: string
        }
        Update: {
          attachment_date?: string | null
          attachment_id?: string
          attachment_name?: string | null
          cnj?: string | null
          corrupted?: boolean | null
          created_at?: string
          created_by?: string | null
          documento_id?: string | null
          extension?: string | null
          id?: string
          instance?: string | null
          paginas_extraidas?: number | null
          processo_id?: string | null
          processo_numero?: string
          raw_attachment?: Json | null
          status?: string | null
          step_id?: string | null
          storage_path?: string | null
          texto_indexado?: boolean
          texto_indexado_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      judit_logs: {
        Row: {
          created_at: string
          created_by: string | null
          duracao_ms: number | null
          error_message: string | null
          id: string
          origem: string | null
          processo_numero: string
          raw_response: Json | null
          request_payload: Json | null
          status: string
          tipo_cobranca: string | null
          tribunal: string | null
          user_email: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duracao_ms?: number | null
          error_message?: string | null
          id?: string
          origem?: string | null
          processo_numero: string
          raw_response?: Json | null
          request_payload?: Json | null
          status?: string
          tipo_cobranca?: string | null
          tribunal?: string | null
          user_email?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duracao_ms?: number | null
          error_message?: string | null
          id?: string
          origem?: string | null
          processo_numero?: string
          raw_response?: Json | null
          request_payload?: Json | null
          status?: string
          tipo_cobranca?: string | null
          tribunal?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      kurier_credenciais: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          login: string
          observacao: string | null
          prioridade: number
          senha_encrypted: string | null
          ultimo_status: string | null
          ultimo_uso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          login: string
          observacao?: string | null
          prioridade?: number
          senha_encrypted?: string | null
          ultimo_status?: string | null
          ultimo_uso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          login?: string
          observacao?: string | null
          prioridade?: number
          senha_encrypted?: string | null
          ultimo_status?: string | null
          ultimo_uso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kurier_credencial_coordenacoes: {
        Row: {
          captura_total: boolean
          coordenacao_id: string
          created_at: string
          credencial_id: string
          somente_djen_only: boolean
          somente_kurier_only: boolean
        }
        Insert: {
          captura_total?: boolean
          coordenacao_id: string
          created_at?: string
          credencial_id: string
          somente_djen_only?: boolean
          somente_kurier_only?: boolean
        }
        Update: {
          captura_total?: boolean
          coordenacao_id?: string
          created_at?: string
          credencial_id?: string
          somente_djen_only?: boolean
          somente_kurier_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kurier_credencial_coordenacoes_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kurier_credencial_coordenacoes_credencial_id_fkey"
            columns: ["credencial_id"]
            isOneToOne: false
            referencedRelation: "kurier_credenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      kurier_execucoes: {
        Row: {
          credencial_id: string | null
          erro: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          login_usado: string | null
          lote: string
          metadata: Json | null
          total_confirmadas: number
          total_descartadas: number
          total_duplicadas: number
          total_novas: number
          total_recebidas: number
        }
        Insert: {
          credencial_id?: string | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          login_usado?: string | null
          lote: string
          metadata?: Json | null
          total_confirmadas?: number
          total_descartadas?: number
          total_duplicadas?: number
          total_novas?: number
          total_recebidas?: number
        }
        Update: {
          credencial_id?: string | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          login_usado?: string | null
          lote?: string
          metadata?: Json | null
          total_confirmadas?: number
          total_descartadas?: number
          total_duplicadas?: number
          total_novas?: number
          total_recebidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "kurier_execucoes_credencial_id_fkey"
            columns: ["credencial_id"]
            isOneToOne: false
            referencedRelation: "kurier_credenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      kurier_publicacoes_raw: {
        Row: {
          confirmada: boolean
          confirmada_em: string | null
          created_at: string
          credencial_id: string | null
          id: string
          id_kurier: string
          login_usado: string | null
          motivo_descarte: string | null
          payload: Json
          publicacao_djen_id: string | null
          recebida_em: string
        }
        Insert: {
          confirmada?: boolean
          confirmada_em?: string | null
          created_at?: string
          credencial_id?: string | null
          id?: string
          id_kurier: string
          login_usado?: string | null
          motivo_descarte?: string | null
          payload: Json
          publicacao_djen_id?: string | null
          recebida_em?: string
        }
        Update: {
          confirmada?: boolean
          confirmada_em?: string | null
          created_at?: string
          credencial_id?: string | null
          id?: string
          id_kurier?: string
          login_usado?: string | null
          motivo_descarte?: string | null
          payload?: Json
          publicacao_djen_id?: string | null
          recebida_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "kurier_publicacoes_raw_credencial_id_fkey"
            columns: ["credencial_id"]
            isOneToOne: false
            referencedRelation: "kurier_credenciais"
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
      materias_benner: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
      modelos_titulo_coordenacao: {
        Row: {
          ativo: boolean
          coordenacao_id: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          padroes: Json
          prioridade: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          coordenacao_id: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          padroes?: Json
          prioridade?: string | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          coordenacao_id?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          padroes?: Json
          prioridade?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
          arquivado: boolean
          arquivado_em: string | null
          arquivado_por: string | null
          ativo: boolean
          busca_stf_ativa: boolean
          buscar_parte: boolean | null
          condicao_concomitante: string | null
          coordenacao_id: string | null
          created_at: string
          criado_por: string
          descricao: string | null
          exclusoes: string[] | null
          id: string
          oab: string | null
          paginacao_paralela: boolean
          somente_kurier: boolean
          termo_busca: string
          termos_or: string[] | null
          tipo: string
          tribunais: string[] | null
          tribunais_ufs: string[] | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          arquivado?: boolean
          arquivado_em?: string | null
          arquivado_por?: string | null
          ativo?: boolean
          busca_stf_ativa?: boolean
          buscar_parte?: boolean | null
          condicao_concomitante?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por: string
          descricao?: string | null
          exclusoes?: string[] | null
          id?: string
          oab?: string | null
          paginacao_paralela?: boolean
          somente_kurier?: boolean
          termo_busca: string
          termos_or?: string[] | null
          tipo: string
          tribunais?: string[] | null
          tribunais_ufs?: string[] | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          arquivado?: boolean
          arquivado_em?: string | null
          arquivado_por?: string | null
          ativo?: boolean
          busca_stf_ativa?: boolean
          buscar_parte?: boolean | null
          condicao_concomitante?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string | null
          exclusoes?: string[] | null
          id?: string
          oab?: string | null
          paginacao_paralela?: boolean
          somente_kurier?: boolean
          termo_busca?: string
          termos_or?: string[] | null
          tipo?: string
          tribunais?: string[] | null
          tribunais_ufs?: string[] | null
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
      monitoramentos_djen_auditoria: {
        Row: {
          acao: string
          alterado_em: string
          alterado_por: string | null
          campos_alterados: string[] | null
          dados_antes: Json | null
          dados_depois: Json | null
          id: string
          monitoramento_id: string
        }
        Insert: {
          acao: string
          alterado_em?: string
          alterado_por?: string | null
          campos_alterados?: string[] | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          monitoramento_id: string
        }
        Update: {
          acao?: string
          alterado_em?: string
          alterado_por?: string | null
          campos_alterados?: string[] | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          monitoramento_id?: string
        }
        Relationships: []
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
          codigo: string | null
          created_at: string
          data_movimentacao: string
          descricao: string
          eh_certidao_transito: boolean | null
          eh_decisao_recorrivel: boolean | null
          eh_recurso_interposto: boolean | null
          fonte: string | null
          id: string
          processo_id: string
          raw: Json | null
          tipo: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          data_movimentacao?: string
          descricao: string
          eh_certidao_transito?: boolean | null
          eh_decisao_recorrivel?: boolean | null
          eh_recurso_interposto?: boolean | null
          fonte?: string | null
          id?: string
          processo_id: string
          raw?: Json | null
          tipo?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string
          data_movimentacao?: string
          descricao?: string
          eh_certidao_transito?: boolean | null
          eh_decisao_recorrivel?: boolean | null
          eh_recurso_interposto?: boolean | null
          fonte?: string | null
          id?: string
          processo_id?: string
          raw?: Json | null
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
      movimentacoes_datajud: {
        Row: {
          assuntos: string | null
          classe_processual: string | null
          complemento: string | null
          coordenacao_id: string
          created_at: string
          data_movimentacao: string | null
          id: string
          lida: boolean
          monitoramento_id: string
          numero_processo: string
          orgao_julgador: string | null
          tipo_movimentacao: string | null
          tribunal: string
          updated_at: string
        }
        Insert: {
          assuntos?: string | null
          classe_processual?: string | null
          complemento?: string | null
          coordenacao_id: string
          created_at?: string
          data_movimentacao?: string | null
          id?: string
          lida?: boolean
          monitoramento_id: string
          numero_processo: string
          orgao_julgador?: string | null
          tipo_movimentacao?: string | null
          tribunal: string
          updated_at?: string
        }
        Update: {
          assuntos?: string | null
          classe_processual?: string | null
          complemento?: string | null
          coordenacao_id?: string
          created_at?: string
          data_movimentacao?: string | null
          id?: string
          lida?: boolean
          monitoramento_id?: string
          numero_processo?: string
          orgao_julgador?: string | null
          tipo_movimentacao?: string | null
          tribunal?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_datajud_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_datajud_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
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
      notificacoes_fila: {
        Row: {
          contexto: Json | null
          coordenacao_id: string | null
          created_at: string
          entidade: string
          entidade_id: string
          id: string
          processado: boolean
          processado_em: string | null
          responsaveis: string[]
          status_anterior: string | null
          status_novo: string | null
          tentativas: number
          tipo_evento: string
          titulo: string | null
          ultimo_erro: string | null
        }
        Insert: {
          contexto?: Json | null
          coordenacao_id?: string | null
          created_at?: string
          entidade: string
          entidade_id: string
          id?: string
          processado?: boolean
          processado_em?: string | null
          responsaveis?: string[]
          status_anterior?: string | null
          status_novo?: string | null
          tentativas?: number
          tipo_evento: string
          titulo?: string | null
          ultimo_erro?: string | null
        }
        Update: {
          contexto?: Json | null
          coordenacao_id?: string | null
          created_at?: string
          entidade?: string
          entidade_id?: string
          id?: string
          processado?: boolean
          processado_em?: string | null
          responsaveis?: string[]
          status_anterior?: string | null
          status_novo?: string | null
          tentativas?: number
          tipo_evento?: string
          titulo?: string | null
          ultimo_erro?: string | null
        }
        Relationships: []
      }
      parametros_monitoramento_djen: {
        Row: {
          ativo: boolean
          batch_size: number
          created_at: string
          delay_entre_lotes: number
          delay_entre_monitoramentos: number
          delay_entre_paginas: number
          delay_entre_tribunais: number
          delay_jina_api: number
          descricao: string | null
          finalization_buffer_ms: number
          group_search_size: number
          id: string
          max_paralelo: number
          max_por_invocacao: number
          max_retries: number
          modo_processamento: string
          retry_base_delay_ms: number
          soft_timeout_ms: number
          tipo_monitoramento_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          batch_size?: number
          created_at?: string
          delay_entre_lotes?: number
          delay_entre_monitoramentos?: number
          delay_entre_paginas?: number
          delay_entre_tribunais?: number
          delay_jina_api?: number
          descricao?: string | null
          finalization_buffer_ms?: number
          group_search_size?: number
          id?: string
          max_paralelo?: number
          max_por_invocacao?: number
          max_retries?: number
          modo_processamento?: string
          retry_base_delay_ms?: number
          soft_timeout_ms?: number
          tipo_monitoramento_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          batch_size?: number
          created_at?: string
          delay_entre_lotes?: number
          delay_entre_monitoramentos?: number
          delay_entre_paginas?: number
          delay_entre_tribunais?: number
          delay_jina_api?: number
          descricao?: string | null
          finalization_buffer_ms?: number
          group_search_size?: number
          id?: string
          max_paralelo?: number
          max_por_invocacao?: number
          max_retries?: number
          modo_processamento?: string
          retry_base_delay_ms?: number
          soft_timeout_ms?: number
          tipo_monitoramento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametros_monitoramento_djen_tipo_fk"
            columns: ["tipo_monitoramento_id"]
            isOneToOne: true
            referencedRelation: "tipo_monitoramento"
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
      partes_processo_benner: {
        Row: {
          created_at: string | null
          dados_benner_id: string
          documento: string | null
          id: string
          is_advogado: boolean | null
          nome: string
          origem: string | null
          polo: string | null
          tipo_pessoa: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dados_benner_id: string
          documento?: string | null
          id?: string
          is_advogado?: boolean | null
          nome: string
          origem?: string | null
          polo?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dados_benner_id?: string
          documento?: string | null
          id?: string
          is_advogado?: boolean | null
          nome?: string
          origem?: string | null
          polo?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partes_processo_benner_dados_benner_id_fkey"
            columns: ["dados_benner_id"]
            isOneToOne: false
            referencedRelation: "dados_benner"
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
      pautas_tst: {
        Row: {
          aba_origem: string | null
          advogado_interno: string | null
          aparelhamento_banco: string | null
          aparelhamento_reclamante: string | null
          chance_exito_banco: string | null
          chance_exito_reclamante: string | null
          comentarios_advogado: string | null
          created_at: string
          data_julgamento: string | null
          decisao: string | null
          desistencia_recurso: string | null
          dossie: string | null
          entrega_memoriais: string | null
          equipe: string | null
          honra: string | null
          horario: string | null
          id: string
          link_acesso: string | null
          materia_recurso_banco: string | null
          materia_recurso_reclamante: string | null
          midia_negativa: string | null
          modalidade: string | null
          orgao: string | null
          parte_recorrente: string | null
          processo_id: string | null
          processo_numero: string | null
          reclamada: string | null
          reclamante: string | null
          relator: string | null
          resultado_proxima_sessao: string | null
          retorno_esclarecimentos: string | null
          solicitacao_providencias_banco: string | null
          solicitacao_rosa_oliveira: string | null
          sustentacao_oral: string | null
          tipo_recurso: string | null
          updated_at: string
        }
        Insert: {
          aba_origem?: string | null
          advogado_interno?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          comentarios_advogado?: string | null
          created_at?: string
          data_julgamento?: string | null
          decisao?: string | null
          desistencia_recurso?: string | null
          dossie?: string | null
          entrega_memoriais?: string | null
          equipe?: string | null
          honra?: string | null
          horario?: string | null
          id?: string
          link_acesso?: string | null
          materia_recurso_banco?: string | null
          materia_recurso_reclamante?: string | null
          midia_negativa?: string | null
          modalidade?: string | null
          orgao?: string | null
          parte_recorrente?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          reclamada?: string | null
          reclamante?: string | null
          relator?: string | null
          resultado_proxima_sessao?: string | null
          retorno_esclarecimentos?: string | null
          solicitacao_providencias_banco?: string | null
          solicitacao_rosa_oliveira?: string | null
          sustentacao_oral?: string | null
          tipo_recurso?: string | null
          updated_at?: string
        }
        Update: {
          aba_origem?: string | null
          advogado_interno?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          comentarios_advogado?: string | null
          created_at?: string
          data_julgamento?: string | null
          decisao?: string | null
          desistencia_recurso?: string | null
          dossie?: string | null
          entrega_memoriais?: string | null
          equipe?: string | null
          honra?: string | null
          horario?: string | null
          id?: string
          link_acesso?: string | null
          materia_recurso_banco?: string | null
          materia_recurso_reclamante?: string | null
          midia_negativa?: string | null
          modalidade?: string | null
          orgao?: string | null
          parte_recorrente?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          reclamada?: string | null
          reclamante?: string | null
          relator?: string | null
          resultado_proxima_sessao?: string | null
          retorno_esclarecimentos?: string | null
          solicitacao_providencias_banco?: string | null
          solicitacao_rosa_oliveira?: string | null
          sustentacao_oral?: string | null
          tipo_recurso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pautas_tst_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_processo: {
        Row: {
          acordao: boolean | null
          created_at: string
          criado_por: string | null
          data: string | null
          desembargador_turma: string | null
          id: string
          juiz_sentenca: string | null
          lei: string | null
          ministro_turma_sessao: string | null
          observacao: string | null
          pedido: string
          processo_id: string
          relator: string | null
          resultado_recurso: string | null
          resultado_sentenca: string | null
          sentenca: boolean | null
          tst: boolean | null
          turma: string | null
          updated_at: string
          valor_pedido: number | null
        }
        Insert: {
          acordao?: boolean | null
          created_at?: string
          criado_por?: string | null
          data?: string | null
          desembargador_turma?: string | null
          id?: string
          juiz_sentenca?: string | null
          lei?: string | null
          ministro_turma_sessao?: string | null
          observacao?: string | null
          pedido: string
          processo_id: string
          relator?: string | null
          resultado_recurso?: string | null
          resultado_sentenca?: string | null
          sentenca?: boolean | null
          tst?: boolean | null
          turma?: string | null
          updated_at?: string
          valor_pedido?: number | null
        }
        Update: {
          acordao?: boolean | null
          created_at?: string
          criado_por?: string | null
          data?: string | null
          desembargador_turma?: string | null
          id?: string
          juiz_sentenca?: string | null
          lei?: string | null
          ministro_turma_sessao?: string | null
          observacao?: string | null
          pedido?: string
          processo_id?: string
          relator?: string | null
          resultado_recurso?: string | null
          resultado_sentenca?: string | null
          sentenca?: boolean | null
          tst?: boolean | null
          turma?: string | null
          updated_at?: string
          valor_pedido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_processo_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_menu_usuario: {
        Row: {
          created_at: string
          id: string
          menu_path: string
          permitido: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_path: string
          permitido?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_path?: string
          permitido?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      processo_tags_catalogo: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
          ordem: number
          publica: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          ordem?: number
          publica?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          ordem?: number
          publica?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      processos: {
        Row: {
          acompanhamento_ativado_em: string | null
          acompanhamento_com_anexos: boolean
          acompanhamento_especial: boolean
          acompanhamento_freq_diaria: number
          acompanhamento_ultima_checagem_em: string | null
          acompanhamento_ultimo_step_date: string | null
          adicao_baixa: string | null
          advogado_externo: string | null
          advogado_responsavel_id: string | null
          advogados_identificados: Json | null
          andamento_atual: string | null
          aparelhamento_banco: string | null
          aparelhamento_reclamante: string | null
          area: string
          assunto: string | null
          ativo_passivo: string | null
          auto_infracao: string | null
          autor: string | null
          benner_atualizado: boolean | null
          calculo_validado: string | null
          cargo_reconhecimento_vinculo: string | null
          categoria_importacao: string | null
          chance_exito_banco: string | null
          chance_exito_reclamante: string | null
          classe: string | null
          cliente_id: string | null
          cnpj_fiscalizado: string | null
          comarca: string | null
          coordenacao_id: string | null
          cpf_cnpj_parte_contraria: string | null
          created_at: string
          criado_por_tst: string | null
          custo_encerramento: number | null
          data_arquivamento: string | null
          data_citacao: string | null
          data_consulta: string | null
          data_desligamento: string | null
          data_distribuicao: string | null
          data_encerramento: string | null
          data_encerramento_cobranca: string | null
          data_fatal: string | null
          data_fato_gerador: string | null
          data_hora_encerramento: string | null
          data_lavratura: string | null
          data_recebimento: string | null
          data_situacao: string | null
          data_transito_estimada: string | null
          decisao_quarteirizado: string | null
          decisao_tst: string | null
          deposito_judicial: number | null
          deposito_judicial_tst: string | null
          depositos_vinculados: string | null
          descricao: string | null
          dossie_tst: string | null
          empresa_terceirizada: string | null
          entidade: string | null
          epoca_razao: string | null
          equipe_tst: string | null
          esfera: string | null
          execucao_tst: string | null
          fase: string | null
          fiscal_responsavel: string | null
          forma_pagamento: string | null
          formulario_tst: string | null
          funcao: string | null
          funcao_parte_contraria: string | null
          honra_tst: string | null
          id: string
          identificador_projuris: string | null
          impactante: boolean
          instancia: string | null
          judit_campos: Json
          judit_ia_observacoes: string | null
          justica: string | null
          justificativa_risco: string | null
          lei_13467_2017: string | null
          localidade: string | null
          materia: string | null
          materia_mpt: string | null
          materias_recurso_banco: string | null
          materias_recurso_reclamante: string | null
          midia_negativa_tst: string | null
          monitorar_andamentos: boolean
          monitorar_djen: boolean | null
          motivo_encerramento: string | null
          mudanca_risco: boolean | null
          multa_custas_tst: string | null
          natureza: string | null
          natureza_financeira: string | null
          nit_fiscalizado: string | null
          nome_cliente_envolvido: string | null
          numero: string
          objeto: string | null
          observacao_advogado: string | null
          observacao_cobranca: string | null
          observacao_resp_subsidiaria: string | null
          observacoes_processo: string | null
          orgao_julgador: string | null
          orgao_origem: string | null
          parte_recorrente_tst: string | null
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
          prazo_fatal_conferido: boolean
          prazo_fatal_conferido_em: string | null
          prazo_fatal_conferido_por: string | null
          preparo_tst: string | null
          prioridade_djen: boolean
          probabilidade: string | null
          processos_relacionados: string | null
          providencias_tst: string | null
          provisionamento_possivel: number | null
          provisionamento_provavel: number | null
          provisionamento_remoto: number | null
          rateio: string | null
          reclamados: string | null
          reclamante: string | null
          recurso_terceiros_tst: string | null
          relator: string | null
          relator_favorabilidade: string | null
          relator_tst: string | null
          requerido: string | null
          responsabilidade_antes_data: number | null
          responsabilidade_apos_data: number | null
          responsabilidade_subsidiaria: string | null
          responsabilidade_tipo: string | null
          responsaveis_projuris: string | null
          responsavel_tst: string | null
          responsavel_tst_id: string | null
          resultado: string | null
          resumo_ia_tst: string | null
          risco: string | null
          risco_anterior: string | null
          risco_atual: string | null
          segredo_justica: boolean | null
          setor: string | null
          sigla_unidade: string | null
          sistema: string | null
          situacao_original: string | null
          status: Database["public"]["Enums"]["status_processo"]
          status_pedido: string | null
          status_transito: string | null
          status_tst: string | null
          sugestao_providencia_tst: string | null
          tema_tst: string | null
          terceiro_envolvido: string | null
          tipo_controladora: string | null
          tipo_estabilidade: string | null
          tipo_pagamento: string | null
          tipo_processo: string | null
          tipo_recurso_banco: string | null
          tipo_recurso_reclamante: string | null
          transitado_julgado: boolean | null
          transito_julgado_tst: string | null
          tribunal: string | null
          turma_favorabilidade: string | null
          turma_tst: string | null
          uf: string | null
          ultima_consulta_judit: string | null
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
          acompanhamento_ativado_em?: string | null
          acompanhamento_com_anexos?: boolean
          acompanhamento_especial?: boolean
          acompanhamento_freq_diaria?: number
          acompanhamento_ultima_checagem_em?: string | null
          acompanhamento_ultimo_step_date?: string | null
          adicao_baixa?: string | null
          advogado_externo?: string | null
          advogado_responsavel_id?: string | null
          advogados_identificados?: Json | null
          andamento_atual?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          area: string
          assunto?: string | null
          ativo_passivo?: string | null
          auto_infracao?: string | null
          autor?: string | null
          benner_atualizado?: boolean | null
          calculo_validado?: string | null
          cargo_reconhecimento_vinculo?: string | null
          categoria_importacao?: string | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          classe?: string | null
          cliente_id?: string | null
          cnpj_fiscalizado?: string | null
          comarca?: string | null
          coordenacao_id?: string | null
          cpf_cnpj_parte_contraria?: string | null
          created_at?: string
          criado_por_tst?: string | null
          custo_encerramento?: number | null
          data_arquivamento?: string | null
          data_citacao?: string | null
          data_consulta?: string | null
          data_desligamento?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_encerramento_cobranca?: string | null
          data_fatal?: string | null
          data_fato_gerador?: string | null
          data_hora_encerramento?: string | null
          data_lavratura?: string | null
          data_recebimento?: string | null
          data_situacao?: string | null
          data_transito_estimada?: string | null
          decisao_quarteirizado?: string | null
          decisao_tst?: string | null
          deposito_judicial?: number | null
          deposito_judicial_tst?: string | null
          depositos_vinculados?: string | null
          descricao?: string | null
          dossie_tst?: string | null
          empresa_terceirizada?: string | null
          entidade?: string | null
          epoca_razao?: string | null
          equipe_tst?: string | null
          esfera?: string | null
          execucao_tst?: string | null
          fase?: string | null
          fiscal_responsavel?: string | null
          forma_pagamento?: string | null
          formulario_tst?: string | null
          funcao?: string | null
          funcao_parte_contraria?: string | null
          honra_tst?: string | null
          id?: string
          identificador_projuris?: string | null
          impactante?: boolean
          instancia?: string | null
          judit_campos?: Json
          judit_ia_observacoes?: string | null
          justica?: string | null
          justificativa_risco?: string | null
          lei_13467_2017?: string | null
          localidade?: string | null
          materia?: string | null
          materia_mpt?: string | null
          materias_recurso_banco?: string | null
          materias_recurso_reclamante?: string | null
          midia_negativa_tst?: string | null
          monitorar_andamentos?: boolean
          monitorar_djen?: boolean | null
          motivo_encerramento?: string | null
          mudanca_risco?: boolean | null
          multa_custas_tst?: string | null
          natureza?: string | null
          natureza_financeira?: string | null
          nit_fiscalizado?: string | null
          nome_cliente_envolvido?: string | null
          numero: string
          objeto?: string | null
          observacao_advogado?: string | null
          observacao_cobranca?: string | null
          observacao_resp_subsidiaria?: string | null
          observacoes_processo?: string | null
          orgao_julgador?: string | null
          orgao_origem?: string | null
          parte_recorrente_tst?: string | null
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
          prazo_fatal_conferido?: boolean
          prazo_fatal_conferido_em?: string | null
          prazo_fatal_conferido_por?: string | null
          preparo_tst?: string | null
          prioridade_djen?: boolean
          probabilidade?: string | null
          processos_relacionados?: string | null
          providencias_tst?: string | null
          provisionamento_possivel?: number | null
          provisionamento_provavel?: number | null
          provisionamento_remoto?: number | null
          rateio?: string | null
          reclamados?: string | null
          reclamante?: string | null
          recurso_terceiros_tst?: string | null
          relator?: string | null
          relator_favorabilidade?: string | null
          relator_tst?: string | null
          requerido?: string | null
          responsabilidade_antes_data?: number | null
          responsabilidade_apos_data?: number | null
          responsabilidade_subsidiaria?: string | null
          responsabilidade_tipo?: string | null
          responsaveis_projuris?: string | null
          responsavel_tst?: string | null
          responsavel_tst_id?: string | null
          resultado?: string | null
          resumo_ia_tst?: string | null
          risco?: string | null
          risco_anterior?: string | null
          risco_atual?: string | null
          segredo_justica?: boolean | null
          setor?: string | null
          sigla_unidade?: string | null
          sistema?: string | null
          situacao_original?: string | null
          status?: Database["public"]["Enums"]["status_processo"]
          status_pedido?: string | null
          status_transito?: string | null
          status_tst?: string | null
          sugestao_providencia_tst?: string | null
          tema_tst?: string | null
          terceiro_envolvido?: string | null
          tipo_controladora?: string | null
          tipo_estabilidade?: string | null
          tipo_pagamento?: string | null
          tipo_processo?: string | null
          tipo_recurso_banco?: string | null
          tipo_recurso_reclamante?: string | null
          transitado_julgado?: boolean | null
          transito_julgado_tst?: string | null
          tribunal?: string | null
          turma_favorabilidade?: string | null
          turma_tst?: string | null
          uf?: string | null
          ultima_consulta_judit?: string | null
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
          acompanhamento_ativado_em?: string | null
          acompanhamento_com_anexos?: boolean
          acompanhamento_especial?: boolean
          acompanhamento_freq_diaria?: number
          acompanhamento_ultima_checagem_em?: string | null
          acompanhamento_ultimo_step_date?: string | null
          adicao_baixa?: string | null
          advogado_externo?: string | null
          advogado_responsavel_id?: string | null
          advogados_identificados?: Json | null
          andamento_atual?: string | null
          aparelhamento_banco?: string | null
          aparelhamento_reclamante?: string | null
          area?: string
          assunto?: string | null
          ativo_passivo?: string | null
          auto_infracao?: string | null
          autor?: string | null
          benner_atualizado?: boolean | null
          calculo_validado?: string | null
          cargo_reconhecimento_vinculo?: string | null
          categoria_importacao?: string | null
          chance_exito_banco?: string | null
          chance_exito_reclamante?: string | null
          classe?: string | null
          cliente_id?: string | null
          cnpj_fiscalizado?: string | null
          comarca?: string | null
          coordenacao_id?: string | null
          cpf_cnpj_parte_contraria?: string | null
          created_at?: string
          criado_por_tst?: string | null
          custo_encerramento?: number | null
          data_arquivamento?: string | null
          data_citacao?: string | null
          data_consulta?: string | null
          data_desligamento?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_encerramento_cobranca?: string | null
          data_fatal?: string | null
          data_fato_gerador?: string | null
          data_hora_encerramento?: string | null
          data_lavratura?: string | null
          data_recebimento?: string | null
          data_situacao?: string | null
          data_transito_estimada?: string | null
          decisao_quarteirizado?: string | null
          decisao_tst?: string | null
          deposito_judicial?: number | null
          deposito_judicial_tst?: string | null
          depositos_vinculados?: string | null
          descricao?: string | null
          dossie_tst?: string | null
          empresa_terceirizada?: string | null
          entidade?: string | null
          epoca_razao?: string | null
          equipe_tst?: string | null
          esfera?: string | null
          execucao_tst?: string | null
          fase?: string | null
          fiscal_responsavel?: string | null
          forma_pagamento?: string | null
          formulario_tst?: string | null
          funcao?: string | null
          funcao_parte_contraria?: string | null
          honra_tst?: string | null
          id?: string
          identificador_projuris?: string | null
          impactante?: boolean
          instancia?: string | null
          judit_campos?: Json
          judit_ia_observacoes?: string | null
          justica?: string | null
          justificativa_risco?: string | null
          lei_13467_2017?: string | null
          localidade?: string | null
          materia?: string | null
          materia_mpt?: string | null
          materias_recurso_banco?: string | null
          materias_recurso_reclamante?: string | null
          midia_negativa_tst?: string | null
          monitorar_andamentos?: boolean
          monitorar_djen?: boolean | null
          motivo_encerramento?: string | null
          mudanca_risco?: boolean | null
          multa_custas_tst?: string | null
          natureza?: string | null
          natureza_financeira?: string | null
          nit_fiscalizado?: string | null
          nome_cliente_envolvido?: string | null
          numero?: string
          objeto?: string | null
          observacao_advogado?: string | null
          observacao_cobranca?: string | null
          observacao_resp_subsidiaria?: string | null
          observacoes_processo?: string | null
          orgao_julgador?: string | null
          orgao_origem?: string | null
          parte_recorrente_tst?: string | null
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
          prazo_fatal_conferido?: boolean
          prazo_fatal_conferido_em?: string | null
          prazo_fatal_conferido_por?: string | null
          preparo_tst?: string | null
          prioridade_djen?: boolean
          probabilidade?: string | null
          processos_relacionados?: string | null
          providencias_tst?: string | null
          provisionamento_possivel?: number | null
          provisionamento_provavel?: number | null
          provisionamento_remoto?: number | null
          rateio?: string | null
          reclamados?: string | null
          reclamante?: string | null
          recurso_terceiros_tst?: string | null
          relator?: string | null
          relator_favorabilidade?: string | null
          relator_tst?: string | null
          requerido?: string | null
          responsabilidade_antes_data?: number | null
          responsabilidade_apos_data?: number | null
          responsabilidade_subsidiaria?: string | null
          responsabilidade_tipo?: string | null
          responsaveis_projuris?: string | null
          responsavel_tst?: string | null
          responsavel_tst_id?: string | null
          resultado?: string | null
          resumo_ia_tst?: string | null
          risco?: string | null
          risco_anterior?: string | null
          risco_atual?: string | null
          segredo_justica?: boolean | null
          setor?: string | null
          sigla_unidade?: string | null
          sistema?: string | null
          situacao_original?: string | null
          status?: Database["public"]["Enums"]["status_processo"]
          status_pedido?: string | null
          status_transito?: string | null
          status_tst?: string | null
          sugestao_providencia_tst?: string | null
          tema_tst?: string | null
          terceiro_envolvido?: string | null
          tipo_controladora?: string | null
          tipo_estabilidade?: string | null
          tipo_pagamento?: string | null
          tipo_processo?: string | null
          tipo_recurso_banco?: string | null
          tipo_recurso_reclamante?: string | null
          transitado_julgado?: boolean | null
          transito_julgado_tst?: string | null
          tribunal?: string | null
          turma_favorabilidade?: string | null
          turma_tst?: string | null
          uf?: string | null
          ultima_consulta_judit?: string | null
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
      processos_documentos_download: {
        Row: {
          cofre_senha_id: string | null
          created_at: string
          data_documento: string | null
          downloaded_at: string | null
          downloaded_by: string | null
          id: string
          mensagem_erro: string | null
          nome_arquivo: string
          processo_id: string
          status_download: string
          storage_path: string
          tamanho_bytes: number | null
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          cofre_senha_id?: string | null
          created_at?: string
          data_documento?: string | null
          downloaded_at?: string | null
          downloaded_by?: string | null
          id?: string
          mensagem_erro?: string | null
          nome_arquivo: string
          processo_id: string
          status_download?: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          updated_at?: string
        }
        Update: {
          cofre_senha_id?: string | null
          created_at?: string
          data_documento?: string | null
          downloaded_at?: string | null
          downloaded_by?: string | null
          id?: string
          mensagem_erro?: string | null
          nome_arquivo?: string
          processo_id?: string
          status_download?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_documentos_download_cofre_senha_id_fkey"
            columns: ["cofre_senha_id"]
            isOneToOne: false
            referencedRelation: "cofre_senhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_documentos_download_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_partes: {
        Row: {
          created_at: string
          created_by: string | null
          documento: string | null
          fonte: string
          id: string
          is_advogado: boolean
          lado_efetivo: string | null
          nome: string
          polo: string | null
          processo_id: string
          raw: Json | null
          tipo_pessoa: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          documento?: string | null
          fonte?: string
          id?: string
          is_advogado?: boolean
          lado_efetivo?: string | null
          nome: string
          polo?: string | null
          processo_id: string
          raw?: Json | null
          tipo_pessoa?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          documento?: string | null
          fonte?: string
          id?: string
          is_advogado?: boolean
          lado_efetivo?: string | null
          nome?: string
          polo?: string | null
          processo_id?: string
          raw?: Json | null
          tipo_pessoa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_partes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
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
      processos_testemunhas: {
        Row: {
          arrolada_por: string | null
          cpf_rg: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          processo_id: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          arrolada_por?: string | null
          cpf_rg?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          processo_id: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          arrolada_por?: string | null
          cpf_rg?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          processo_id?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_testemunhas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          area_principal: string | null
          ativo: boolean
          avatar_url: string | null
          coordenacao_padrao_id: string | null
          created_at: string
          email: string
          filial: string | null
          id: string
          nome: string
          notificacoes_email: boolean
          notificacoes_email_360: boolean
          oab: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          area_principal?: string | null
          ativo?: boolean
          avatar_url?: string | null
          coordenacao_padrao_id?: string | null
          created_at?: string
          email: string
          filial?: string | null
          id: string
          nome: string
          notificacoes_email?: boolean
          notificacoes_email_360?: boolean
          oab?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          area_principal?: string | null
          ativo?: boolean
          avatar_url?: string | null
          coordenacao_padrao_id?: string | null
          created_at?: string
          email?: string
          filial?: string | null
          id?: string
          nome?: string
          notificacoes_email?: boolean
          notificacoes_email_360?: boolean
          oab?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_coordenacao_padrao_id_fkey"
            columns: ["coordenacao_padrao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts_ia_publicacoes: {
        Row: {
          ativo: boolean
          coordenacao_id: string
          created_at: string
          created_by: string | null
          id: string
          prompt: string
          tipo_item: Database["public"]["Enums"]["tipo_item_prompt_ia"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          coordenacao_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt: string
          tipo_item: Database["public"]["Enums"]["tipo_item_prompt_ia"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          coordenacao_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt?: string
          tipo_item?: Database["public"]["Enums"]["tipo_item_prompt_ia"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_ia_publicacoes_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts_ia_tst: {
        Row: {
          ativo: boolean
          coordenacao_id: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          modelo: string
          prompt: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          coordenacao_id: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          modelo?: string
          prompt: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          coordenacao_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          modelo?: string
          prompt?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_ia_tst_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_djen: {
        Row: {
          advogados_json: Json | null
          conteudo: string | null
          coordenacao_id: string | null
          created_at: string
          data_disponibilizacao: string | null
          data_publicacao: string | null
          dedup_conteudo_key: string | null
          dedup_data_ref: string | null
          dedup_head_norm: string | null
          dedup_key: string | null
          dedup_processo_digits: string | null
          execucao_id: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          id_djen: string | null
          id_kurier: string | null
          importada_de_descartada: boolean | null
          kurier_login: string | null
          lida: boolean
          meio: string | null
          monitoramento_id: string
          orgao: string | null
          partes_json: Json | null
          polo_ativo: string | null
          polo_passivo: string | null
          processo_id: string | null
          processo_numero: string | null
          publicacao_unica: boolean
          resumo_gerado_em: string | null
          resumo_ia: string | null
          status: Database["public"]["Enums"]["djen_status"]
          tipo_comunicacao: string | null
          tipo_publicacao: string
          tribunal: string | null
        }
        Insert: {
          advogados_json?: Json | null
          conteudo?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          dedup_conteudo_key?: string | null
          dedup_data_ref?: string | null
          dedup_head_norm?: string | null
          dedup_key?: string | null
          dedup_processo_digits?: string | null
          execucao_id?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          id_djen?: string | null
          id_kurier?: string | null
          importada_de_descartada?: boolean | null
          kurier_login?: string | null
          lida?: boolean
          meio?: string | null
          monitoramento_id: string
          orgao?: string | null
          partes_json?: Json | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          publicacao_unica?: boolean
          resumo_gerado_em?: string | null
          resumo_ia?: string | null
          status?: Database["public"]["Enums"]["djen_status"]
          tipo_comunicacao?: string | null
          tipo_publicacao?: string
          tribunal?: string | null
        }
        Update: {
          advogados_json?: Json | null
          conteudo?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          dedup_conteudo_key?: string | null
          dedup_data_ref?: string | null
          dedup_head_norm?: string | null
          dedup_key?: string | null
          dedup_processo_digits?: string | null
          execucao_id?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          id_djen?: string | null
          id_kurier?: string | null
          importada_de_descartada?: boolean | null
          kurier_login?: string | null
          lida?: boolean
          meio?: string | null
          monitoramento_id?: string
          orgao?: string | null
          partes_json?: Json | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          processo_id?: string | null
          processo_numero?: string | null
          publicacao_unica?: boolean
          resumo_gerado_em?: string | null
          resumo_ia?: string | null
          status?: Database["public"]["Enums"]["djen_status"]
          tipo_comunicacao?: string | null
          tipo_publicacao?: string
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_djen_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_djen_descartadas: {
        Row: {
          advogados_json: Json | null
          chave_descarte: string | null
          conteudo: string | null
          coordenacao_id: string | null
          created_at: string
          data_disponibilizacao: string | null
          data_publicacao: string | null
          dedup_data_ref: string | null
          dedup_head_norm: string | null
          dedup_processo_digits: string | null
          descartado_por: string | null
          descartado_por_nome: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          id_djen: string | null
          id_origem: string | null
          lida: boolean
          lote_descarte_id: string | null
          meio: string | null
          monitoramento_id: string | null
          motivo_descarte: string
          orgao: string | null
          partes_json: Json | null
          payload_origem: Json | null
          processo_id: string | null
          processo_numero: string | null
          tipo_comunicacao: string | null
          tipo_origem_origem: string | null
          tribunal: string | null
        }
        Insert: {
          advogados_json?: Json | null
          chave_descarte?: string | null
          conteudo?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          dedup_data_ref?: string | null
          dedup_head_norm?: string | null
          dedup_processo_digits?: string | null
          descartado_por?: string | null
          descartado_por_nome?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          id_djen?: string | null
          id_origem?: string | null
          lida?: boolean
          lote_descarte_id?: string | null
          meio?: string | null
          monitoramento_id?: string | null
          motivo_descarte: string
          orgao?: string | null
          partes_json?: Json | null
          payload_origem?: Json | null
          processo_id?: string | null
          processo_numero?: string | null
          tipo_comunicacao?: string | null
          tipo_origem_origem?: string | null
          tribunal?: string | null
        }
        Update: {
          advogados_json?: Json | null
          chave_descarte?: string | null
          conteudo?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          dedup_data_ref?: string | null
          dedup_head_norm?: string | null
          dedup_processo_digits?: string | null
          descartado_por?: string | null
          descartado_por_nome?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          id_djen?: string | null
          id_origem?: string | null
          lida?: boolean
          lote_descarte_id?: string | null
          meio?: string | null
          monitoramento_id?: string | null
          motivo_descarte?: string
          orgao?: string | null
          partes_json?: Json | null
          payload_origem?: Json | null
          processo_id?: string | null
          processo_numero?: string | null
          tipo_comunicacao?: string | null
          tipo_origem_origem?: string | null
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_descartadas_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_djen_descartadas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_djen_execucoes: {
        Row: {
          created_at: string
          execucao_id: string
          publicacao_id: string
          tipo_engine: string
        }
        Insert: {
          created_at?: string
          execucao_id: string
          publicacao_id: string
          tipo_engine: string
        }
        Update: {
          created_at?: string
          execucao_id?: string
          publicacao_id?: string
          tipo_engine?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_execucoes_execucao_fk"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucoes_agendadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_djen_execucoes_publicacao_fk"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_djen_global_hash: {
        Row: {
          created_at: string
          escopo_dedup: string
          hash_global: string
          id: string
          primeiro_monitoramento_id: string
          publicacao_id: string | null
        }
        Insert: {
          created_at?: string
          escopo_dedup: string
          hash_global: string
          id?: string
          primeiro_monitoramento_id: string
          publicacao_id?: string | null
        }
        Update: {
          created_at?: string
          escopo_dedup?: string
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
      publicacoes_djen_leituras: {
        Row: {
          id: string
          lida_em: string
          publicacao_id: string
          tabela_origem: string
          usuario_id: string
          usuario_nome: string | null
        }
        Insert: {
          id?: string
          lida_em?: string
          publicacao_id: string
          tabela_origem: string
          usuario_id: string
          usuario_nome?: string | null
        }
        Update: {
          id?: string
          lida_em?: string
          publicacao_id?: string
          tabela_origem?: string
          usuario_id?: string
          usuario_nome?: string | null
        }
        Relationships: []
      }
      publicacoes_djen_processos: {
        Row: {
          advogados_json: Json | null
          conteudo: string | null
          coordenacao_id: string | null
          created_at: string
          data_disponibilizacao: string | null
          data_encontrado: string
          data_publicacao: string | null
          dedup_data_ref: string | null
          dedup_head_norm: string | null
          dedup_key: string | null
          dedup_processo_digits: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          id_djen: string | null
          lida: boolean
          meio: string | null
          orgao: string | null
          partes_json: Json | null
          processo_id: string
          processo_numero: string
          status: Database["public"]["Enums"]["djen_status"]
          tipo_comunicacao: string | null
          tribunal: string | null
        }
        Insert: {
          advogados_json?: Json | null
          conteudo?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_encontrado?: string
          data_publicacao?: string | null
          dedup_data_ref?: string | null
          dedup_head_norm?: string | null
          dedup_key?: string | null
          dedup_processo_digits?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          id_djen?: string | null
          lida?: boolean
          meio?: string | null
          orgao?: string | null
          partes_json?: Json | null
          processo_id: string
          processo_numero: string
          status?: Database["public"]["Enums"]["djen_status"]
          tipo_comunicacao?: string | null
          tribunal?: string | null
        }
        Update: {
          advogados_json?: Json | null
          conteudo?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_encontrado?: string
          data_publicacao?: string | null
          dedup_data_ref?: string | null
          dedup_head_norm?: string | null
          dedup_key?: string | null
          dedup_processo_digits?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          id_djen?: string | null
          lida?: boolean
          meio?: string | null
          orgao?: string | null
          partes_json?: Json | null
          processo_id?: string
          processo_numero?: string
          status?: Database["public"]["Enums"]["djen_status"]
          tipo_comunicacao?: string | null
          tribunal?: string | null
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
      publicacoes_djen_servidor: {
        Row: {
          advogados_json: Json | null
          conteudo: string | null
          coordenacao_id: string | null
          created_at: string
          data_disponibilizacao: string | null
          data_publicacao: string | null
          dedup_conteudo_key: string | null
          dedup_data_ref: string | null
          dedup_head_norm: string | null
          dedup_key: string | null
          dedup_processo_digits: string | null
          execucao_id: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          id_djen: string | null
          kurier_login: string | null
          meio: string | null
          monitoramento_id: string
          orgao: string | null
          origem: string
          partes_json: Json | null
          polo_ativo: string | null
          polo_passivo: string | null
          processo_numero: string | null
          tipo_comunicacao: string | null
          tipo_publicacao: string
          tribunal: string | null
        }
        Insert: {
          advogados_json?: Json | null
          conteudo?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          dedup_conteudo_key?: string | null
          dedup_data_ref?: string | null
          dedup_head_norm?: string | null
          dedup_key?: string | null
          dedup_processo_digits?: string | null
          execucao_id?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          id_djen?: string | null
          kurier_login?: string | null
          meio?: string | null
          monitoramento_id: string
          orgao?: string | null
          origem?: string
          partes_json?: Json | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          processo_numero?: string | null
          tipo_comunicacao?: string | null
          tipo_publicacao?: string
          tribunal?: string | null
        }
        Update: {
          advogados_json?: Json | null
          conteudo?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          dedup_conteudo_key?: string | null
          dedup_data_ref?: string | null
          dedup_head_norm?: string | null
          dedup_key?: string | null
          dedup_processo_digits?: string | null
          execucao_id?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          id_djen?: string | null
          kurier_login?: string | null
          meio?: string | null
          monitoramento_id?: string
          orgao?: string | null
          origem?: string
          partes_json?: Json | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          processo_numero?: string | null
          tipo_comunicacao?: string | null
          tipo_publicacao?: string
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_servidor_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucoes_servidor"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_djen_servidor_execucoes: {
        Row: {
          created_at: string
          execucao_id: string
          publicacao_id: string
          tipo_engine: string
        }
        Insert: {
          created_at?: string
          execucao_id: string
          publicacao_id: string
          tipo_engine: string
        }
        Update: {
          created_at?: string
          execucao_id?: string
          publicacao_id?: string
          tipo_engine?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_djen_servidor_execucoes_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "execucoes_servidor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_djen_servidor_execucoes_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen_servidor"
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
      publicacoes_stf: {
        Row: {
          coordenacao_id: string | null
          created_at: string
          data_divulgacao: string | null
          data_publicacao: string | null
          fonte: string
          hash_conteudo: string
          id: string
          lida: boolean
          monitoramento_id: string
          processo_numero: string | null
          relator: string | null
          resumo_gerado_em: string | null
          resumo_ia: string | null
          stf_id: string | null
          texto_html: string | null
          texto_limpo: string | null
          tipo: string | null
        }
        Insert: {
          coordenacao_id?: string | null
          created_at?: string
          data_divulgacao?: string | null
          data_publicacao?: string | null
          fonte?: string
          hash_conteudo: string
          id?: string
          lida?: boolean
          monitoramento_id: string
          processo_numero?: string | null
          relator?: string | null
          resumo_gerado_em?: string | null
          resumo_ia?: string | null
          stf_id?: string | null
          texto_html?: string | null
          texto_limpo?: string | null
          tipo?: string | null
        }
        Update: {
          coordenacao_id?: string | null
          created_at?: string
          data_divulgacao?: string | null
          data_publicacao?: string | null
          fonte?: string
          hash_conteudo?: string
          id?: string
          lida?: boolean
          monitoramento_id?: string
          processo_numero?: string | null
          relator?: string | null
          resumo_gerado_em?: string | null
          resumo_ia?: string | null
          stf_id?: string | null
          texto_html?: string | null
          texto_limpo?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_stf_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_stf_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
        ]
      }
      remessas_benner: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          coordenacao_id: string | null
          created_at: string
          created_by: string | null
          data_conciliacao: string | null
          data_envio: string | null
          data_geracao: string
          email_assunto: string | null
          email_cc: string[] | null
          email_corpo: string | null
          email_destinatarios: string[] | null
          enviado_por: string | null
          filtros_aplicados: Json | null
          id: string
          numero_sequencial: string
          observacoes: string | null
          quantidade_aceitos: number
          quantidade_itens: number
          quantidade_pendentes: number
          quantidade_rejeitados: number
          status: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          coordenacao_id?: string | null
          created_at?: string
          created_by?: string | null
          data_conciliacao?: string | null
          data_envio?: string | null
          data_geracao?: string
          email_assunto?: string | null
          email_cc?: string[] | null
          email_corpo?: string | null
          email_destinatarios?: string[] | null
          enviado_por?: string | null
          filtros_aplicados?: Json | null
          id?: string
          numero_sequencial: string
          observacoes?: string | null
          quantidade_aceitos?: number
          quantidade_itens?: number
          quantidade_pendentes?: number
          quantidade_rejeitados?: number
          status?: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          coordenacao_id?: string | null
          created_at?: string
          created_by?: string | null
          data_conciliacao?: string | null
          data_envio?: string | null
          data_geracao?: string
          email_assunto?: string | null
          email_cc?: string[] | null
          email_corpo?: string | null
          email_destinatarios?: string[] | null
          enviado_por?: string | null
          filtros_aplicados?: Json | null
          id?: string
          numero_sequencial?: string
          observacoes?: string | null
          quantidade_aceitos?: number
          quantidade_itens?: number
          quantidade_pendentes?: number
          quantidade_rejeitados?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      remessas_benner_itens: {
        Row: {
          created_at: string
          dado_benner_id: string | null
          dossie: string | null
          id: string
          motivo_retorno: string | null
          processo: string | null
          relator: string | null
          remessa_id: string
          status_retorno: string
          tribunal: string | null
          turma: string | null
        }
        Insert: {
          created_at?: string
          dado_benner_id?: string | null
          dossie?: string | null
          id?: string
          motivo_retorno?: string | null
          processo?: string | null
          relator?: string | null
          remessa_id: string
          status_retorno?: string
          tribunal?: string | null
          turma?: string | null
        }
        Update: {
          created_at?: string
          dado_benner_id?: string | null
          dossie?: string | null
          id?: string
          motivo_retorno?: string | null
          processo?: string | null
          relator?: string | null
          remessa_id?: string
          status_retorno?: string
          tribunal?: string | null
          turma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remessas_benner_itens_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "remessas_benner"
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
          numero_processo_extraido: string | null
          processado: boolean | null
          processo_id: string | null
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
          numero_processo_extraido?: string | null
          processado?: boolean | null
          processo_id?: string | null
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
          numero_processo_extraido?: string | null
          processado?: boolean | null
          processo_id?: string | null
          storage_path?: string
          tags?: string[] | null
          tamanho_bytes?: number | null
          tipo_documento?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repositorio_documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
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
      situacoes_envio_carga: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      tarefa_envolvidos: {
        Row: {
          created_at: string
          id: string
          tarefa_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tarefa_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tarefa_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_envolvidos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_responsaveis: {
        Row: {
          created_at: string
          id: string
          tarefa_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tarefa_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tarefa_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_responsaveis_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          alerta_dias: number | null
          alerta_unidade: string | null
          concluido_por_nome: string | null
          coordenacao_id: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_base: string | null
          data_criacao_projuris: string | null
          data_cumprimento: string | null
          data_fatal: string | null
          data_prevista: string | null
          data_vencimento: string | null
          descricao: string | null
          descricao_ultimo_andamento: string | null
          envolvimento_clientes: string | null
          envolvimento_contrarios: string | null
          grupos_trabalho: string | null
          hora_conclusao: string | null
          hora_criacao: string | null
          hora_fatal: string | null
          hora_prevista: string | null
          id: string
          identificador_modulo: string | null
          identificador_projuris: string | null
          identificador_timesheet: string | null
          instancia: string | null
          link_local: string | null
          marcadores: string | null
          marcadores_vinculo: string | null
          modulo: string | null
          observacoes: string | null
          orgao: string | null
          orgao_julgador: string | null
          origem: string | null
          outras_partes: string | null
          partes_ativas: string | null
          partes_passivas: string | null
          prazo_dias: number | null
          prazo_unidade: string | null
          prioridade: Database["public"]["Enums"]["prioridade_tarefa"]
          processo_id: string | null
          quadro_kanban: string | null
          recorrencia_fim: string | null
          recorrencia_intervalo: number | null
          recorrencia_rrule: string | null
          recorrencia_tipo: string | null
          recorrente: boolean | null
          responsavel_id: string | null
          situacao_processo: string | null
          status: Database["public"]["Enums"]["status_tarefa"]
          tipo_registro: string
          tipo_tarefa: string | null
          titulo: string
          total_horas_timesheet: string | null
          updated_at: string
        }
        Insert: {
          alerta_dias?: number | null
          alerta_unidade?: string | null
          concluido_por_nome?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_base?: string | null
          data_criacao_projuris?: string | null
          data_cumprimento?: string | null
          data_fatal?: string | null
          data_prevista?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          descricao_ultimo_andamento?: string | null
          envolvimento_clientes?: string | null
          envolvimento_contrarios?: string | null
          grupos_trabalho?: string | null
          hora_conclusao?: string | null
          hora_criacao?: string | null
          hora_fatal?: string | null
          hora_prevista?: string | null
          id?: string
          identificador_modulo?: string | null
          identificador_projuris?: string | null
          identificador_timesheet?: string | null
          instancia?: string | null
          link_local?: string | null
          marcadores?: string | null
          marcadores_vinculo?: string | null
          modulo?: string | null
          observacoes?: string | null
          orgao?: string | null
          orgao_julgador?: string | null
          origem?: string | null
          outras_partes?: string | null
          partes_ativas?: string | null
          partes_passivas?: string | null
          prazo_dias?: number | null
          prazo_unidade?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_tarefa"]
          processo_id?: string | null
          quadro_kanban?: string | null
          recorrencia_fim?: string | null
          recorrencia_intervalo?: number | null
          recorrencia_rrule?: string | null
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          responsavel_id?: string | null
          situacao_processo?: string | null
          status?: Database["public"]["Enums"]["status_tarefa"]
          tipo_registro?: string
          tipo_tarefa?: string | null
          titulo: string
          total_horas_timesheet?: string | null
          updated_at?: string
        }
        Update: {
          alerta_dias?: number | null
          alerta_unidade?: string | null
          concluido_por_nome?: string | null
          coordenacao_id?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_base?: string | null
          data_criacao_projuris?: string | null
          data_cumprimento?: string | null
          data_fatal?: string | null
          data_prevista?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          descricao_ultimo_andamento?: string | null
          envolvimento_clientes?: string | null
          envolvimento_contrarios?: string | null
          grupos_trabalho?: string | null
          hora_conclusao?: string | null
          hora_criacao?: string | null
          hora_fatal?: string | null
          hora_prevista?: string | null
          id?: string
          identificador_modulo?: string | null
          identificador_projuris?: string | null
          identificador_timesheet?: string | null
          instancia?: string | null
          link_local?: string | null
          marcadores?: string | null
          marcadores_vinculo?: string | null
          modulo?: string | null
          observacoes?: string | null
          orgao?: string | null
          orgao_julgador?: string | null
          origem?: string | null
          outras_partes?: string | null
          partes_ativas?: string | null
          partes_passivas?: string | null
          prazo_dias?: number | null
          prazo_unidade?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_tarefa"]
          processo_id?: string | null
          quadro_kanban?: string | null
          recorrencia_fim?: string | null
          recorrencia_intervalo?: number | null
          recorrencia_rrule?: string | null
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          responsavel_id?: string | null
          situacao_processo?: string | null
          status?: Database["public"]["Enums"]["status_tarefa"]
          tipo_registro?: string
          tipo_tarefa?: string | null
          titulo?: string
          total_horas_timesheet?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
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
      tarefas_duplicadas_backup: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_fatal: string | null
          data_vencimento: string | null
          deleted_at: string | null
          id: string
          kept_id: string | null
          origem: string | null
          processo_id: string | null
          responsavel_id: string | null
          tipo_tarefa: string | null
          titulo: string | null
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_fatal?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          id: string
          kept_id?: string | null
          origem?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          tipo_tarefa?: string | null
          titulo?: string | null
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_fatal?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          id?: string
          kept_id?: string | null
          origem?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          tipo_tarefa?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
      tarefas_publicacoes: {
        Row: {
          created_at: string
          id: string
          publicacao_id: string
          tarefa_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          publicacao_id: string
          tarefa_id: string
        }
        Update: {
          created_at?: string
          id?: string
          publicacao_id?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_publicacoes_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_publicacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_publicacoes_processos: {
        Row: {
          created_at: string
          id: string
          publicacao_processo_id: string
          tarefa_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          publicacao_processo_id: string
          tarefa_id: string
        }
        Update: {
          created_at?: string
          id?: string
          publicacao_processo_id?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_publicacoes_processos_publicacao_processo_id_fkey"
            columns: ["publicacao_processo_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_publicacoes_processos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
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
      tipo_monitoramento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          slug?: string
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
      workers_djen_vps: {
        Row: {
          coordenacao_id: string
          created_at: string
          id: string
          ip_address: string | null
          nome_worker: string
          progresso: Json | null
          publicacoes_encontradas: number | null
          publicacoes_novas: number | null
          sessao_id: string | null
          status: string
          ultimo_erro: string | null
          ultimo_heartbeat: string | null
          updated_at: string
        }
        Insert: {
          coordenacao_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          nome_worker?: string
          progresso?: Json | null
          publicacoes_encontradas?: number | null
          publicacoes_novas?: number | null
          sessao_id?: string | null
          status?: string
          ultimo_erro?: string | null
          ultimo_heartbeat?: string | null
          updated_at?: string
        }
        Update: {
          coordenacao_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          nome_worker?: string
          progresso?: Json | null
          publicacoes_encontradas?: number | null
          publicacoes_novas?: number | null
          sessao_id?: string | null
          status?: string
          ultimo_erro?: string | null
          ultimo_heartbeat?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_djen_vps_coordenacao_id_fkey"
            columns: ["coordenacao_id"]
            isOneToOne: false
            referencedRelation: "coordenacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      workers_servidor: {
        Row: {
          created_at: string
          current_execucao_id: string | null
          current_tipo: string | null
          heartbeat_at: string
          host: string | null
          id: string
          metadata: Json | null
          started_at: string
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          current_execucao_id?: string | null
          current_tipo?: string | null
          heartbeat_at?: string
          host?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          current_execucao_id?: string | null
          current_tipo?: string | null
          heartbeat_at?: string
          host?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_servidor_current_execucao_id_fkey"
            columns: ["current_execucao_id"]
            isOneToOne: false
            referencedRelation: "execucoes_servidor"
            referencedColumns: ["id"]
          },
        ]
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
      add_fonte_importacao: {
        Args: { p_fonte: string; p_id: string }
        Returns: undefined
      }
      analyze_publicacoes_djen: { Args: never; Returns: undefined }
      aplicar_etiqueta_cliente_base: {
        Args: { _dry_run?: boolean; _etiqueta_id: string }
        Returns: Json
      }
      aplicar_etiquetas_cliente_processo: {
        Args: { _processo_id: string; _publicacao_id?: string }
        Returns: number
      }
      apply_data_planilha_fix: { Args: { items: Json }; Returns: number }
      arquivar_dados_benner: {
        Args: { _id: string; _motivo?: string }
        Returns: string
      }
      arquivar_duplicados_dados_benner_ids: {
        Args: { _ids: string[]; _motivo?: string }
        Returns: {
          arquivados: number
          grupos: number
        }[]
      }
      atualizar_cor_processo_tag: {
        Args: { _cor: string; _tag_id: string }
        Returns: {
          cor: string
          id: string
        }[]
      }
      atualizar_visibilidade_processo_tag: {
        Args: { _publica: boolean; _tag_id: string }
        Returns: {
          id: string
          publica: boolean
        }[]
      }
      backfill_djen_status_batch: {
        Args: { p_limit?: number }
        Returns: {
          processados: number
          restantes: number
        }[]
      }
      backfill_djenp_status_batch: {
        Args: { p_limit?: number }
        Returns: {
          processados: number
          restantes: number
        }[]
      }
      backfill_publicacoes_djen_unica: {
        Args: { p_batch_size?: number }
        Returns: number
      }
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
      can_comment_audiencia: {
        Args: { _audiencia_id: string; _user_id: string }
        Returns: boolean
      }
      can_comment_tarefa: {
        Args: { _tarefa_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_evento: {
        Args: { _evento_id: string; _user_id: string }
        Returns: boolean
      }
      cancelar_execucao_servidor: { Args: { p_id: string }; Returns: undefined }
      compute_djen_conteudo_dedup_key: {
        Args: {
          p_conteudo: string
          p_coordenacao: string
          p_created_at: string
          p_data_disp: string
          p_data_pub: string
          p_processo_numero: string
        }
        Returns: string
      }
      compute_djen_dedup_key: {
        Args: {
          p_coordenacao: string
          p_created_at: string
          p_data_disp: string
          p_data_pub: string
          p_processo_numero: string
        }
        Returns: string
      }
      coordenadores_da_coordenacao: {
        Args: { _coordenacao_id: string }
        Returns: {
          usuario_id: string
        }[]
      }
      count_djen_publicacoes_deduplicadas_hoje: {
        Args: never
        Returns: {
          total_bruto: number
          total_unicas: number
        }[]
      }
      count_djen_publicacoes_deduplicadas_hoje_nao_lidas: {
        Args: never
        Returns: {
          total_bruto: number
          total_unicas: number
        }[]
      }
      count_djen_publicacoes_deduplicadas_hoje_por_coordenacao: {
        Args: { p_coordenacao_id: string }
        Returns: {
          total_bruto: number
          total_unicas: number
        }[]
      }
      count_djen_publicacoes_deduplicadas_hoje_por_coordenacao_nao_li: {
        Args: { p_coordenacao_id: string }
        Returns: {
          total_bruto: number
          total_unicas: number
        }[]
      }
      count_djen_publicacoes_unificadas: {
        Args: {
          p_apenas_nao_lidas?: boolean
          p_coordenacao_id: string
          p_fim?: string
          p_inicio?: string
          p_monitoramento_id?: string
          p_search_query?: string
        }
        Returns: number
      }
      count_tarefas_urgentes_coordenacao: {
        Args: { p_coordenacao_id: string }
        Returns: number
      }
      criar_audiencia_detectada: {
        Args: {
          p_conteudo_publicacao?: string
          p_contexto?: string
          p_data_audiencia?: string
          p_hora?: string
          p_local_audiencia?: string
          p_movimentacao_id?: string
          p_origem?: string
          p_processo_id: string
          p_processo_numero: string
          p_publicacao_id?: string
          p_tipo_audiencia?: string
          p_titulo?: string
        }
        Returns: string
      }
      descartar_duplicadas_coordenacao:
        | { Args: { p_coordenacao_id: string }; Returns: Json }
        | {
            Args: {
              p_coordenacao_id: string
              p_data_disp_fim?: string
              p_data_disp_inicio?: string
            }
            Returns: Json
          }
      descartar_duplicadas_coordenacao_servidor: {
        Args: {
          p_coordenacao_id: string
          p_data_disp_fim?: string
          p_data_disp_inicio?: string
        }
        Returns: Json
      }
      descartar_publicacao_manualmente: {
        Args: { p_id: string; p_motivo?: string; p_tipo_origem: string }
        Returns: Json
      }
      desfazer_descarte_individual: { Args: { p_id: string }; Returns: Json }
      desfazer_descarte_lote: { Args: { p_lote_id: string }; Returns: Json }
      destravar_execucao_servidor: {
        Args: { p_id: string }
        Returns: undefined
      }
      deve_rodar_monitoramento: { Args: { p_tipo: string }; Returns: boolean }
      djen_first_comunicacao_id_from_json: {
        Args: { p_advogados: Json; p_partes: Json }
        Returns: string
      }
      djen_normalize_conteudo_descarte_sem_intimados: {
        Args: { p_text: string }
        Returns: string
      }
      djen_normalize_conteudo_sem_destinatarios: {
        Args: { p_text: string }
        Returns: string
      }
      djen_pick_kurier_raw_processo: {
        Args: { p_comunicacao_id: string; p_data_disponibilizacao?: string }
        Returns: {
          login_usado: string
          processo: string
        }[]
      }
      djen_strip_destinatarios: { Args: { p_text: string }; Returns: string }
      enfileirar_execucao_servidor: {
        Args: {
          p_agendado_para?: string
          p_payload?: Json
          p_rodada?: number
          p_slot?: string
          p_tipo: string
        }
        Returns: string
      }
      extract_cnj_from_text: { Args: { p_text: string }; Returns: string }
      find_processo_id_by_numero: { Args: { _numero: string }; Returns: string }
      gerar_numero_remessa_benner: { Args: never; Returns: string }
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
      get_convite_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expira_em: string
          id: string
          status: string
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
      get_dados_benner_arquivados_duplicados: {
        Args: never
        Returns: {
          aba_origem: string
          arquivado_em: string
          coordenacao_id: string
          dossie: string
          id: string
          processo: string
          snapshot: Json
        }[]
      }
      get_dados_benner_sem_responsavel: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_distribuicao_tst_multi_resp_ids: {
        Args: { filters?: Json }
        Returns: {
          id: string
        }[]
      }
      get_distribuicao_tst_responsaveis_counts: {
        Args: { filters?: Json }
        Returns: {
          count: number
          id: string
          nome: string
          pronto: number
        }[]
      }
      get_distribuicao_tst_situacao_totais: {
        Args: { filters?: Json }
        Returns: {
          a_fazer: number
          acordo: number
          cejusc: number
          midia_negativa: number
          outro_escritorio: number
          periodo_fim: string
          periodo_inicio: string
          prontos_envio: number
          recurso_terceiro: number
          segredo_justica: number
          total: number
          transito_julgado: number
        }[]
      }
      get_distribuicao_tst_stats: {
        Args: { filters?: Json }
        Returns: {
          a_fazer: number
          ate_2025: number
          benner_nao: number
          benner_sim: number
          com_equipe: number
          de_2026: number
          dossies_invalidos: number
          dossies_nao_preenchidos: number
          dossies_validos: number
          judit_nao_preenchido: number
          judit_preenchido: number
          nao_precisa_fazer: number
          outros_situacao: number
          problema_judit: number
          processos_ativos: number
          processos_invalidos: number
          processos_unicos: number
          processos_validos: number
          pronto_envio: number
          sem_equipe: number
          sem_responsavel: number
          sem_turma: number
          total: number
          transito_julgado: number
        }[]
      }
      get_djen_descartadas_dedup: {
        Args: {
          p_apenas_hoje?: boolean
          p_conteudo_query?: string
          p_coordenacao_id?: string
          p_data_disponibilizacao_fim?: string
          p_data_disponibilizacao_inicio?: string
          p_fim?: string
          p_inicio?: string
          p_limit?: number
          p_monitoramento_id?: string
          p_offset?: number
          p_read_status?: string
          p_search_query?: string
        }
        Returns: {
          advogados_json: Json
          conteudo: string
          coordenacao_id: string
          coordenacao_nome: string
          created_at: string
          data_disponibilizacao: string
          data_publicacao: string
          descartado_por: string
          descartado_por_nome: string
          fonte: string
          id: string
          lida: boolean
          lido_por: Json
          meio: string
          monitoramento_descricao: string
          monitoramento_id: string
          monitoramento_oab: string
          monitoramento_termo: string
          monitoramento_tipo: string
          monitoramento_uf: string
          motivo_descarte: string
          orgao: string
          partes_json: Json
          processo_numero: string
          tipo_comunicacao: string
          total_count: number
          tribunal: string
        }[]
      }
      get_djen_publicacoes_servidor_unificadas: {
        Args: {
          p_apenas_hoje?: boolean
          p_coordenacao_id?: string
          p_data_disponibilizacao_fim?: string
          p_data_disponibilizacao_inicio?: string
          p_dedup?: boolean
          p_fim?: string
          p_inicio?: string
          p_limit?: number
          p_monitoramento_id?: string
          p_offset?: number
          p_read_status?: string
          p_search_query?: string
          p_tipo_origem?: string
          p_tribunal?: string
        }
        Returns: {
          advogados_json: Json
          conteudo: string
          coordenacao_id: string
          coordenacao_nome: string
          created_at: string
          data_disponibilizacao: string
          data_publicacao: string
          fonte: string
          id: string
          id_djen: string
          lida: boolean
          lido_por: Json
          meio: string
          monitoramento_descricao: string
          monitoramento_id: string
          monitoramento_oab: string
          monitoramento_termo: string
          monitoramento_tipo: string
          monitoramento_uf: string
          orgao: string
          partes_json: Json
          polo_ativo: string
          polo_passivo: string
          processo_id: string
          processo_numero: string
          tipo_comunicacao: string
          tipo_origem: string
          tribunal: string
        }[]
      }
      get_djen_publicacoes_unificadas: {
        Args: {
          p_apenas_nao_lidas?: boolean
          p_conteudo_query?: string
          p_coordenacao_id?: string
          p_data_disponibilizacao_fim?: string
          p_data_disponibilizacao_inicio?: string
          p_dedup?: boolean
          p_fim?: string
          p_inicio?: string
          p_limit?: number
          p_monitoramento_id?: string
          p_offset?: number
          p_read_status?: string
          p_search_query?: string
          p_tipo_origem?: string
          p_tribunal?: string
        }
        Returns: {
          advogados_json: Json
          conteudo: string
          coordenacao_id: string
          coordenacao_nome: string
          created_at: string
          data_disponibilizacao: string
          data_publicacao: string
          fonte: string
          id: string
          lida: boolean
          lido_por: Json
          meio: string
          monitoramento_descricao: string
          monitoramento_id: string
          monitoramento_oab: string
          monitoramento_termo: string
          monitoramento_tipo: string
          monitoramento_uf: string
          orgao: string
          partes_json: Json
          polo_ativo: string
          polo_passivo: string
          processo_id: string
          processo_numero: string
          tipo_comunicacao: string
          tipo_origem: string
          tribunal: string
        }[]
      }
      get_djen_stats_per_user:
        | {
            Args: {
              p_coordenacao_id?: string
              p_fim?: string
              p_inicio?: string
            }
            Returns: {
              lidas: number
              nao_lidas: number
              total: number
            }[]
          }
        | {
            Args: {
              p_coordenacao_id?: string
              p_fim?: string
              p_inicio?: string
              p_monitoramento_id?: string
              p_search_query?: string
              p_tipo_origem?: string
            }
            Returns: {
              nao_lidas_processos: number
              nao_lidas_termos: number
              total_processos: number
              total_termos: number
            }[]
          }
        | {
            Args: {
              p_coordenacao_id?: string
              p_data_disponibilizacao_fim?: string
              p_data_disponibilizacao_inicio?: string
              p_fim?: string
              p_inicio?: string
              p_monitoramento_id?: string
              p_search_query?: string
              p_tipo_origem?: string
              p_tribunal?: string
            }
            Returns: {
              nao_lidas_processos: number
              nao_lidas_termos: number
              nao_lidas_unicas: number
              total_bruto: number
              total_processos: number
              total_termos: number
              total_unicas: number
            }[]
          }
      get_djen_stats_servidor_per_user: {
        Args: {
          p_apenas_hoje?: boolean
          p_coordenacao_id?: string
          p_data_disponibilizacao_fim?: string
          p_data_disponibilizacao_inicio?: string
          p_dedup?: boolean
          p_fim?: string
          p_inicio?: string
          p_monitoramento_id?: string
          p_search_query?: string
          p_tipo_origem?: string
          p_tribunal?: string
        }
        Returns: {
          nao_lidas_processos: number
          nao_lidas_termos: number
          nao_lidas_unicas: number
          total_bruto: number
          total_processos: number
          total_termos: number
          total_unicas: number
        }[]
      }
      get_equipe_tarefas_stats: {
        Args: { p_coordenacao_ids: string[] }
        Returns: {
          atrasadas: number
          cargo: string
          cumpridas: number
          email: string
          nome: string
          pendentes: number
          total_tarefas: number
          urgentes: number
          usuario_id: string
        }[]
      }
      get_ia_schema: { Args: never; Returns: Json }
      get_indicadores_atividades: {
        Args: {
          p_agrupamento?: string
          p_coordenacao_id?: string
          p_fim?: string
          p_inicio: string
          p_usuario_id?: string
        }
        Returns: {
          audiencias: number
          eventos: number
          periodo: string
          prazos: number
          tarefas: number
        }[]
      }
      get_leituras_publicacoes: {
        Args: { p_ids: string[] }
        Returns: {
          lida_em: string
          publicacao_id: string
          tabela_origem: string
          usuario_id: string
          usuario_nome: string
        }[]
      }
      get_meses_data_distribuicao_real: {
        Args: never
        Returns: {
          mes_ano: string
          total: number
        }[]
      }
      get_notificacoes_counts_by_coordenacao: {
        Args: {
          p_coordenacao_ids: string[]
          p_periodo_fim?: string
          p_periodo_inicio?: string
          p_prioridade_filter?: string
          p_search_query?: string
          p_status_filter?: string
        }
        Returns: {
          alertas360: number
          andamentos: number
          audiencias: number
          coordenacao_id: string
          distribuicoes: number
          djen: number
          intimacoes: number
          prazos: number
          proc_nao_cadastrados: number
          redistribuicoes: number
          tarefas: number
          total: number
        }[]
      }
      get_processos_paginados:
        | {
            Args: {
              _acompanhamento_especial?: boolean
              _area?: string
              _cliente_ids?: string[]
              _com_audiencia?: boolean
              _com_intimacao?: boolean
              _com_movimento?: boolean
              _com_publicacao_djen?: boolean
              _com_tarefa?: boolean
              _com_testemunha?: boolean
              _coordenacao_id?: string
              _instancia?: string
              _page?: number
              _page_size?: number
              _periodo_fim?: string
              _periodo_inicio?: string
              _responsavel_id?: string
              _search?: string
              _segredo_justica?: boolean
              _status?: string
              _testemunha_nome?: string
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
              status: string
              tipo_processo: string
              total_count: number
              tribunal: string
              valor_causa: number
              vara: string
            }[]
          }
        | {
            Args: {
              _acompanhamento_especial?: boolean
              _area?: string
              _cliente_ids?: string[]
              _com_audiencia?: boolean
              _com_intimacao?: boolean
              _com_movimento?: boolean
              _com_publicacao_djen?: boolean
              _com_tarefa?: boolean
              _com_testemunha?: boolean
              _coordenacao_id?: string
              _etiqueta_ids?: string[]
              _instancia?: string
              _page?: number
              _page_size?: number
              _periodo_fim?: string
              _periodo_inicio?: string
              _responsavel_id?: string
              _search?: string
              _segredo_justica?: boolean
              _status?: string
              _testemunha_nome?: string
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
              status: string
              tipo_processo: string
              total_count: number
              tribunal: string
              valor_causa: number
              vara: string
            }[]
          }
      get_publicacoes_contagens_por_monitoramento: {
        Args: never
        Returns: {
          monitoramento_id: string
          nao_lidas: number
          total: number
        }[]
      }
      get_publicacoes_contagens_por_monitoramento_periodo: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          monitoramento_id: string
          nao_lidas: number
          total: number
        }[]
      }
      get_publicacoes_relacionadas_por_dedup: {
        Args: {
          p_ids_descartadas?: string[]
          p_ids_processos?: string[]
          p_ids_termos?: string[]
        }
        Returns: {
          publicacao_id: string
          tabela_origem: string
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
      is_member_of_coordenacao: {
        Args: { _coordenacao_id: string; _user_id: string }
        Returns: boolean
      }
      is_membro_coordenacao: {
        Args: { _coordenacao_id: string }
        Returns: boolean
      }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      kurier_normalize_conteudo_sem_parte_intimacao: {
        Args: { p_text: string }
        Returns: string
      }
      lease_proxima_execucao_servidor: {
        Args: { p_tipos?: string[]; p_worker_id: string }
        Returns: {
          agendado_para: string
          created_at: string
          dedupe_key: string | null
          erro: string | null
          finalizado_em: string | null
          heartbeat_at: string | null
          id: string
          iniciado_em: string | null
          payload: Json | null
          progresso: Json | null
          progresso_atualizado_em: string | null
          resultado: Json | null
          rodada_do_dia: number | null
          slot_horario: string | null
          status: string
          tentativas: number
          tipo: string
          updated_at: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "execucoes_servidor"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      limpar_auditoria_distribuicao_tst_antiga: { Args: never; Returns: number }
      limpar_execucoes_antigas: { Args: never; Returns: undefined }
      marcar_publicacoes_lidas_por_dedup: {
        Args: {
          p_ids_descartadas?: string[]
          p_ids_processos?: string[]
          p_ids_termos?: string[]
        }
        Returns: Json
      }
      mark_djen_duplicadas_global: { Args: never; Returns: number }
      mark_djenp_duplicadas_global: { Args: never; Returns: number }
      pode_gerenciar_etiquetas: {
        Args: { _coordenacao_id: string }
        Returns: boolean
      }
      proximo_dia_util: { Args: { data_base: string }; Returns: string }
      reaper_execucoes_servidor_travadas: { Args: never; Returns: number }
      rebuild_publicacoes_djen_unica_flags: { Args: never; Returns: undefined }
      reset_jobs_orfaos_servidor: {
        Args: { p_timeout_minutes?: number }
        Returns: number
      }
      resolver_coord_processo: {
        Args: { p_processo_id: string; p_processo_numero: string }
        Returns: string
      }
      resolver_destinatarios_comentario: {
        Args: { _entidade: string; _entidade_id: string }
        Returns: string[]
      }
      resolver_responsaveis_entidade: {
        Args: { _entidade: string; _entidade_id: string }
        Returns: string[]
      }
      restaurar_dados_benner_arquivado: {
        Args: { _id: string }
        Returns: string
      }
      search_users_basic: {
        Args: { _limit?: number; _query?: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      strip_destinatarios: { Args: { content: string }; Returns: string }
      subtrair_dias_uteis: {
        Args: { data_base: string; dias_uteis_subtrair: number }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      user_can_access_publicacao_djen: {
        Args: { _publicacao_id: string; _user_id: string }
        Returns: boolean
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
        | "advogado_temporario"
        | "assistente_coordenador"
      area_atuacao: "civil" | "trabalhista" | "empresarial" | "direito_privado"
      classificacao_tst_enum: "POSITIVO" | "NEGATIVO" | "IMPEDIDA"
      djen_status: "encontrada" | "descartada" | "duplicada"
      prioridade_tarefa: "baixa" | "media" | "alta" | "urgente"
      status_processo:
        | "ativo"
        | "pendente"
        | "urgente"
        | "encerrado"
        | "arquivado"
        | "arquivado_parcialmente"
        | "arquivado_definitivamente"
        | "suspenso"
      status_tarefa:
        | "pendente"
        | "cumprido"
        | "atrasado"
        | "cancelado"
        | "a_confirmar"
        | "em_execucao"
        | "revisao"
        | "verificado"
        | "concluido_sem_sucesso"
        | "protocolado"
        | "baixado"
        | "minutado_revisao"
        | "reagendado"
        | "tratado"
      tipo_item_prompt_ia: "prazo" | "tarefa" | "evento" | "audiencia"
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
        "advogado_temporario",
        "assistente_coordenador",
      ],
      area_atuacao: ["civil", "trabalhista", "empresarial", "direito_privado"],
      classificacao_tst_enum: ["POSITIVO", "NEGATIVO", "IMPEDIDA"],
      djen_status: ["encontrada", "descartada", "duplicada"],
      prioridade_tarefa: ["baixa", "media", "alta", "urgente"],
      status_processo: [
        "ativo",
        "pendente",
        "urgente",
        "encerrado",
        "arquivado",
        "arquivado_parcialmente",
        "arquivado_definitivamente",
        "suspenso",
      ],
      status_tarefa: [
        "pendente",
        "cumprido",
        "atrasado",
        "cancelado",
        "a_confirmar",
        "em_execucao",
        "revisao",
        "verificado",
        "concluido_sem_sucesso",
        "protocolado",
        "baixado",
        "minutado_revisao",
        "reagendado",
        "tratado",
      ],
      tipo_item_prompt_ia: ["prazo", "tarefa", "evento", "audiencia"],
    },
  },
} as const
