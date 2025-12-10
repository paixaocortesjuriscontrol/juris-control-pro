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
          created_at: string
          frequencia: string
          id: string
          tipo: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          frequencia?: string
          id?: string
          tipo: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          frequencia?: string
          id?: string
          tipo?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coordenacoes: {
        Row: {
          area: Database["public"]["Enums"]["area_atuacao"]
          coordenador_id: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          area: Database["public"]["Enums"]["area_atuacao"]
          coordenador_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          area?: Database["public"]["Enums"]["area_atuacao"]
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
      documentos: {
        Row: {
          created_at: string
          id: string
          nome: string
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
          processo_id?: string | null
          tamanho_bytes?: number | null
          tipo?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
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
      monitoramentos_djen: {
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
        Relationships: [
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
      prazos: {
        Row: {
          created_at: string
          data_cumprimento: string | null
          data_vencimento: string
          descricao: string | null
          id: string
          observacoes: string | null
          prioridade: Database["public"]["Enums"]["prioridade_prazo"]
          processo_id: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_prazo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_cumprimento?: string | null
          data_vencimento: string
          descricao?: string | null
          id?: string
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_prazo"]
          processo_id: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_prazo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_cumprimento?: string | null
          data_vencimento?: string
          descricao?: string | null
          id?: string
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_prazo"]
          processo_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_prazo"]
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
          area: Database["public"]["Enums"]["area_atuacao"]
          assunto: string | null
          classe: string | null
          cliente_id: string | null
          comarca: string | null
          coordenacao_id: string | null
          created_at: string
          data_arquivamento: string | null
          data_citacao: string | null
          data_distribuicao: string | null
          data_encerramento: string | null
          data_recebimento: string | null
          descricao: string | null
          fase: string | null
          id: string
          identificador_projuris: string | null
          instancia: string | null
          justica: string | null
          numero: string
          pasta_cliente: string | null
          pasta_fisica: string | null
          polo_ativo: string | null
          polo_passivo: string | null
          probabilidade: string | null
          responsaveis_projuris: string | null
          resultado: string | null
          risco: string | null
          status: Database["public"]["Enums"]["status_processo"]
          transitado_julgado: boolean | null
          tribunal: string | null
          uf: string | null
          updated_at: string
          valor_causa: number | null
          valor_condenacao: number | null
          valor_provisionado: number | null
          vara: string | null
        }
        Insert: {
          advogado_responsavel_id?: string | null
          area: Database["public"]["Enums"]["area_atuacao"]
          assunto?: string | null
          classe?: string | null
          cliente_id?: string | null
          comarca?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_arquivamento?: string | null
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_recebimento?: string | null
          descricao?: string | null
          fase?: string | null
          id?: string
          identificador_projuris?: string | null
          instancia?: string | null
          justica?: string | null
          numero: string
          pasta_cliente?: string | null
          pasta_fisica?: string | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          probabilidade?: string | null
          responsaveis_projuris?: string | null
          resultado?: string | null
          risco?: string | null
          status?: Database["public"]["Enums"]["status_processo"]
          transitado_julgado?: boolean | null
          tribunal?: string | null
          uf?: string | null
          updated_at?: string
          valor_causa?: number | null
          valor_condenacao?: number | null
          valor_provisionado?: number | null
          vara?: string | null
        }
        Update: {
          advogado_responsavel_id?: string | null
          area?: Database["public"]["Enums"]["area_atuacao"]
          assunto?: string | null
          classe?: string | null
          cliente_id?: string | null
          comarca?: string | null
          coordenacao_id?: string | null
          created_at?: string
          data_arquivamento?: string | null
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_recebimento?: string | null
          descricao?: string | null
          fase?: string | null
          id?: string
          identificador_projuris?: string | null
          instancia?: string | null
          justica?: string | null
          numero?: string
          pasta_cliente?: string | null
          pasta_fisica?: string | null
          polo_ativo?: string | null
          polo_passivo?: string | null
          probabilidade?: string | null
          responsaveis_projuris?: string | null
          resultado?: string | null
          risco?: string | null
          status?: Database["public"]["Enums"]["status_processo"]
          transitado_julgado?: boolean | null
          tribunal?: string | null
          uf?: string | null
          updated_at?: string
          valor_causa?: number | null
          valor_condenacao?: number | null
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
        ]
      }
      profiles: {
        Row: {
          area_principal: Database["public"]["Enums"]["area_atuacao"] | null
          ativo: boolean
          avatar_url: string | null
          created_at: string
          email: string
          filial: string | null
          id: string
          nome: string
          oab: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          area_principal?: Database["public"]["Enums"]["area_atuacao"] | null
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          filial?: string | null
          id: string
          nome: string
          oab?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          area_principal?: Database["public"]["Enums"]["area_atuacao"] | null
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          filial?: string | null
          id?: string
          nome?: string
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
            foreignKeyName: "publicacoes_djen_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramentos_djen"
            referencedColumns: ["id"]
          },
        ]
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
      get_user_coordenacao: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_coordenador: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenador"
        | "advogado"
        | "estagiario"
        | "assistente"
        | "secretaria"
      area_atuacao: "civil" | "trabalhista" | "empresarial"
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
      area_atuacao: ["civil", "trabalhista", "empresarial"],
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
