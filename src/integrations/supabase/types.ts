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
          observacoes: string | null
          origem: string | null
          polo_ativo: string | null
          preposto: string | null
          processo_numero: string | null
          providencias_tomadas: string | null
          publicacao_id: string | null
          resumo_objeto: string | null
          status: string
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
          observacoes?: string | null
          origem?: string | null
          polo_ativo?: string | null
          preposto?: string | null
          processo_numero?: string | null
          providencias_tomadas?: string | null
          publicacao_id?: string | null
          resumo_objeto?: string | null
          status?: string
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
          observacoes?: string | null
          origem?: string | null
          polo_ativo?: string | null
          preposto?: string | null
          processo_numero?: string | null
          providencias_tomadas?: string | null
          publicacao_id?: string | null
          resumo_objeto?: string | null
          status?: string
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
            foreignKeyName: "audiencias_detectadas_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_djen"
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
      comentarios_prazos: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          id: string
          prazo_id: string
        }
        Insert: {
          autor_id: string
          conteudo: string
          created_at?: string
          id?: string
          prazo_id: string
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          prazo_id?: string
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
            columns: ["prazo_id"]
            isOneToOne: false
            referencedRelation: "prazos"
            referencedColumns: ["id"]
          },
        ]
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
      prazos: {
        Row: {
          concluido_por_nome: string | null
          created_at: string
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
          prioridade: Database["public"]["Enums"]["prioridade_prazo"]
          processo_id: string | null
          quadro_kanban: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_prazo"]
          tipo_tarefa: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          concluido_por_nome?: string | null
          created_at?: string
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
          prioridade?: Database["public"]["Enums"]["prioridade_prazo"]
          processo_id?: string | null
          quadro_kanban?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_prazo"]
          tipo_tarefa?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          concluido_por_nome?: string | null
          created_at?: string
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
          prioridade?: Database["public"]["Enums"]["prioridade_prazo"]
          processo_id?: string | null
          quadro_kanban?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_prazo"]
          tipo_tarefa?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prazos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_basic"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          advogado_responsavel_id: string | null
          andamento_atual: string | null
          area: string
          assunto: string | null
          classe: string | null
          cliente_id: string | null
          comarca: string | null
          coordenacao_id: string | null
          cpf_cnpj_parte_contraria: string | null
          created_at: string
          data_arquivamento: string | null
          data_citacao: string | null
          data_distribuicao: string | null
          data_encerramento: string | null
          data_fato_gerador: string | null
          data_recebimento: string | null
          deposito_judicial: number | null
          descricao: string | null
          esfera: string | null
          fase: string | null
          forma_pagamento: string | null
          funcao_parte_contraria: string | null
          id: string
          identificador_projuris: string | null
          instancia: string | null
          justica: string | null
          materia: string | null
          monitorar_andamentos: boolean
          natureza: string | null
          numero: string
          observacoes_processo: string | null
          pasta_cliente: string | null
          pasta_fisica: string | null
          pasta_id: string | null
          pedidos: string | null
          periodo_laborado: string | null
          polo_ativo: string | null
          polo_passivo: string | null
          probabilidade: string | null
          provisionamento_possivel: number | null
          provisionamento_provavel: number | null
          provisionamento_remoto: number | null
          responsaveis_projuris: string | null
          resultado: string | null
          risco: string | null
          sigla_unidade: string | null
          status: Database["public"]["Enums"]["status_processo"]
          terceiro_envolvido: string | null
          tipo_controladora: string | null
          tipo_pagamento: string | null
          transitado_julgado: boolean | null
          tribunal: string | null
          uf: string | null
          unidade_cliente: string | null
          updated_at: string
          valor_causa: number | null
          valor_condenacao: number | null
          valor_pagamento: number | null
          valor_pago: number | null
          valor_provisionado: number | null
          vara: string | null
        }
        Insert: {
          advogado_responsavel_id?: string | null
          andamento_atual?: string | null
          area: string
          assunto?: string | null
          classe?: string | null
          cliente_id?: string | null
          comarca?: string | null
          coordenacao_id?: string | null
          cpf_cnpj_parte_contraria?: string | null
          created_at?: string
          data_arquivamento?: string | null
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_fato_gerador?: string | null
          data_recebimento?: string | null
          deposito_judicial?: number | null
          descricao?: string | null
          esfera?: string | null
          fase?: string | null
          forma_pagamento?: string | null
          funcao_parte_contraria?: string | null
          id?: string
          identificador_projuris?: string | null
          instancia?: string | null
          justica?: string | null
          materia?: string | null
          monitorar_andamentos?: boolean
          natureza?: string | null
          numero: string
          observacoes_processo?: string | null
          pasta_cliente?: string | null
          pasta_fisica?: string | null
          pasta_id?: string | null
          pedidos?: string | null
          periodo_laborado?: string | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          probabilidade?: string | null
          provisionamento_possivel?: number | null
          provisionamento_provavel?: number | null
          provisionamento_remoto?: number | null
          responsaveis_projuris?: string | null
          resultado?: string | null
          risco?: string | null
          sigla_unidade?: string | null
          status?: Database["public"]["Enums"]["status_processo"]
          terceiro_envolvido?: string | null
          tipo_controladora?: string | null
          tipo_pagamento?: string | null
          transitado_julgado?: boolean | null
          tribunal?: string | null
          uf?: string | null
          unidade_cliente?: string | null
          updated_at?: string
          valor_causa?: number | null
          valor_condenacao?: number | null
          valor_pagamento?: number | null
          valor_pago?: number | null
          valor_provisionado?: number | null
          vara?: string | null
        }
        Update: {
          advogado_responsavel_id?: string | null
          andamento_atual?: string | null
          area?: string
          assunto?: string | null
          classe?: string | null
          cliente_id?: string | null
          comarca?: string | null
          coordenacao_id?: string | null
          cpf_cnpj_parte_contraria?: string | null
          created_at?: string
          data_arquivamento?: string | null
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_fato_gerador?: string | null
          data_recebimento?: string | null
          deposito_judicial?: number | null
          descricao?: string | null
          esfera?: string | null
          fase?: string | null
          forma_pagamento?: string | null
          funcao_parte_contraria?: string | null
          id?: string
          identificador_projuris?: string | null
          instancia?: string | null
          justica?: string | null
          materia?: string | null
          monitorar_andamentos?: boolean
          natureza?: string | null
          numero?: string
          observacoes_processo?: string | null
          pasta_cliente?: string | null
          pasta_fisica?: string | null
          pasta_id?: string | null
          pedidos?: string | null
          periodo_laborado?: string | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          probabilidade?: string | null
          provisionamento_possivel?: number | null
          provisionamento_provavel?: number | null
          provisionamento_remoto?: number | null
          responsaveis_projuris?: string | null
          resultado?: string | null
          risco?: string | null
          sigla_unidade?: string | null
          status?: Database["public"]["Enums"]["status_processo"]
          terceiro_envolvido?: string | null
          tipo_controladora?: string | null
          tipo_pagamento?: string | null
          transitado_julgado?: boolean | null
          tribunal?: string | null
          uf?: string | null
          unidade_cliente?: string | null
          updated_at?: string
          valor_causa?: number | null
          valor_condenacao?: number | null
          valor_pagamento?: number | null
          valor_pago?: number | null
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
      can_access_processo: {
        Args: { _processo_id: string; _user_id: string }
        Returns: boolean
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
      get_relatorio_atividades: { Args: never; Returns: Json }
      get_relatorio_clientes: { Args: never; Returns: Json }
      get_relatorio_resumo: { Args: never; Returns: Json }
      get_user_coordenacao: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_coordenador: { Args: { _user_id: string }; Returns: boolean }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenador"
        | "advogado"
        | "estagiario"
        | "assistente"
        | "secretaria"
      area_atuacao: "civil" | "trabalhista" | "empresarial" | "direito_privado"
      prioridade_prazo: "baixa" | "media" | "alta" | "urgente"
      status_prazo: "pendente" | "cumprido" | "atrasado"
      status_processo:
        | "ativo"
        | "pendente"
        | "urgente"
        | "encerrado"
        | "arquivado"
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
      ],
      area_atuacao: ["civil", "trabalhista", "empresarial", "direito_privado"],
      prioridade_prazo: ["baixa", "media", "alta", "urgente"],
      status_prazo: ["pendente", "cumprido", "atrasado"],
      status_processo: [
        "ativo",
        "pendente",
        "urgente",
        "encerrado",
        "arquivado",
      ],
    },
  },
} as const
