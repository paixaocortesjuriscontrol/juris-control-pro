

# Implementação do Monitoramento DataJud Termos

## Contextualização
O sistema atual utiliza a **API PJE Comunica** que indexa apenas publicações com efeito intimatório. A publicação do processo `0016979-04.2015.8.13.0251` (TJMG) foi marcada como "sem efeito intimatório" e portanto não é retornada por essa API. A solução é criar um novo tipo de monitoramento complementar que consulta a **API DataJud (CNJ)** - gratuita e oficial - para capturar movimentações processuais que complementam a cobertura do DJEN Termos.

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────┐
│             PÁGINA DE CONFIGURAÇÕES (Aba Nova)              │
│                    "DataJud Termos"                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MonitoramentoDataJudCard                             │  │
│  │  - Botão "Executar Monitoramento"                     │  │
│  │  - Status: Parado / Executando / Concluído            │  │
│  │  - Progresso: tribunais processados / total           │  │
│  │  - Contadores: novos encontrados, duplicados          │  │
│  │  - Histórico de últimas execuções                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
           ┌───────────────────────────────┐
           │   Hook: useDjenDataJud        │
           │  (React State + Mutation)     │
           │  - Dispara execução manual    │
           │  - Monitora progresso via DB  │
           └───────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Edge Function                       │
        │  monitorar-datajud-termos            │
        │  (Executa em background)             │
        │  - Itera monitoramentos ativos       │
        │  - Busca DataJud por tribunal        │
        │  - Deduplica e salva resultados      │
        │  - Atualiza metadata de execução     │
        └──────────────────────────────────────┘
                           ↓
   ┌─────────────────────────────────────────────┐
   │   API DataJud (CNJ)                         │
   │  Endpoints por tribunal                     │
   │  (api_publica_tjmg, api_publica_tjsp, etc) │
   │  - Query: match_phrase por nome advogado    │
   │  - Range: últimos 7 dias                    │
   │  - Retorna: metadados de movimentações      │
   └─────────────────────────────────────────────┘
                           ↓
       ┌──────────────────────────────────┐
       │   Nova Tabela: movimentacoes_datajud  │
       │   - id (uuid)                    │
       │   - monitoramento_id (FK)        │
       │   - coordenacao_id (FK)          │
       │   - numero_processo              │
       │   - tribunal                     │
       │   - orgao_julgador               │
       │   - tipo_movimentacao            │
       │   - data_movimentacao            │
       │   - complemento (description)    │
       │   - lida (bool)                  │
       │   - created_at                   │
       └──────────────────────────────────┘
```

## Etapas de Implementação (Sequencial)

### **Etapa 1: Criar Tabela `movimentacoes_datajud` no Banco de Dados**

**Objetivo:** Armazenar os resultados encontrados via DataJud, separados das publicações DJEN.

**Estrutura da Tabela:**

```sql
CREATE TABLE public.movimentacoes_datajud (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_djen(id) ON DELETE CASCADE,
  coordenacao_id UUID NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  numero_processo TEXT NOT NULL,
  tribunal TEXT NOT NULL,
  orgao_julgador TEXT,
  tipo_movimentacao TEXT,
  data_movimentacao DATE,
  complemento TEXT,
  classe_processual TEXT,
  assuntos TEXT,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Índices para performance
  UNIQUE(monitoramento_id, numero_processo, data_movimentacao, tipo_movimentacao)
);

-- RLS: Acesso por coordenação
ALTER TABLE public.movimentacoes_datajud ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their coordination's DataJud records"
  ON public.movimentacoes_datajud FOR SELECT
  USING (
    public.is_admin_or_coordenador(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.membros_coordenacao
      WHERE coordenacao_id = movimentacoes_datajud.coordenacao_id
      AND usuario_id = auth.uid()
    )
  );

-- Trigger para update_at
CREATE TRIGGER update_movimentacoes_datajud_timestamp
  BEFORE UPDATE ON public.movimentacoes_datajud
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

**Chave de Deduplicação:** 
- UNIQUE(monitoramento_id, numero_processo, data_movimentacao, tipo_movimentacao)
- Garante que a mesma movimentação não seja inserida duas vezes para o mesmo monitoramento

---

### **Etapa 2: Criar Edge Function `monitorar-datajud-termos`**

**Arquivo:** `supabase/functions/monitorar-datajud-termos/index.ts`

**Responsabilidades:**
1. Buscar todos os `monitoramentos_djen` ativos
2. Para cada monitoramento, extrair o termo de busca (advogado, parte, palavra-chave)
3. Para cada tribunal configurado:
   - Montar query Elasticsearch para DataJud
   - Buscar por `match_phrase` do nome do advogado/parte
   - Filtrar por range de data (últimos 7 dias)
   - Processar resultados e deduplica com banco
4. Salvar novos registros em `movimentacoes_datajud`
5. Atualizar `configuracoes_monitoramento` tipo='datajud_termos' com metadata de execução

**Configuração supabase/config.toml:**
```toml
[functions.monitorar-datajud-termos]
verify_jwt = false
```

**Estrutura do Código:**

```typescript
// Constantes
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const TRIBUNAIS_MAP = { /* mapa tribunal -> endpoint */ };
const DATAJUD_TIMEOUT_MS = 8000;
const BATCH_SIZE = 100;
const MAX_EXECUTION_TIME_MS = 50000;

// Funções auxiliares
async function buscarNoDataJud(
  endpoint: string,
  nomeBusca: string,
  dataInicio: string,
  dataFim: string
): Promise<any[]>

async function deduplicar(
  supabase: any,
  monitoramentoId: string,
  resultados: any[]
): Promise<any[]>

// Handler principal
Deno.serve(async (req) => {
  // 1. Validar autenticação
  // 2. Buscar todos monitoramentos_djen ativos
  // 3. Para cada monitoramento:
  //    - Extrair termo de busca
  //    - Buscar em DataJud por tribunal
  //    - Deduplica
  //    - Salva em movimentacoes_datajud
  // 4. Atualizar configuracoes_monitoramento metadata
  // 5. Retornar stats (novos encontrados, etc)
})
```

**Respostas Esperadas:**
```json
{
  "status": "sucesso",
  "monitoramentosProcessados": 5,
  "tribunaisProcessados": 12,
  "novasMovimentacoes": 23,
  "duplicadasIgnoradas": 3,
  "erros": [],
  "duracaoSegundos": 45
}
```

---

### **Etapa 3: Criar Hook React `useDjenDataJud`**

**Arquivo:** `src/hooks/useDjenDataJud.ts`

**Responsabilidades:**
- Disparar execução manual da Edge Function
- Monitorar progresso via polling de `configuracoes_monitoramento`
- Gerenciar estado de execução (rodando, parado, erro)
- Invalidar queries ao concluir

**Interface:**
```typescript
export function useDjenDataJud() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<DjenDataJudProgress>(initial);
  
  const executar = useCallback(async () => {
    // Dispara Edge Function
    // Inicia polling de progresso
  }, []);
  
  const cancelar = useCallback(async () => {
    // Marca como cancelada em configuracoes_monitoramento
  }, []);
  
  return {
    isRunning,
    progress,
    executar,
    cancelar,
    stats: { novas, duplicadas, tribunais }
  };
}
```

---

### **Etapa 4: Criar Componente `MonitoramentoDataJudCard`**

**Arquivo:** `src/components/configuracoes/MonitoramentoDataJudCard.tsx`

**Features:**
- Card similar ao `MonitoramentoTermosCard`
- Botão "Executar" (dispara Edge Function)
- Barra de progresso (tribunais processados / total)
- Contadores: novos, duplicados ignorados
- Histórico de últimas execuções
- Status: Parado / Executando / Concluído / Erro

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ 🔍 Monitoramento DataJud Termos                  │
│ Busca complementar em movimentações via CNJ     │
├─────────────────────────────────────────────────┤
│ Status: [Parado] / [●○ Executando (67%)]       │
│                                                 │
│ Tribunais: 5/8 processados (62%)                │
│ Novos encontrados: 12                           │
│ Duplicados ignorados: 2                         │
│                                                 │
│ [▶ Executar] [■ Cancelar] [↺ Retomar]          │
│                                                 │
│ ╭─ Histórico de Execuções ─────────────────╮  │
│ │ 12/02 14:30 - Sucesso - 8 novos          │  │
│ │ 11/02 09:15 - Sucesso - 5 novos          │  │
│ │ 10/02 18:00 - Erro (timeout)             │  │
│ ╰──────────────────────────────────────────╯  │
└─────────────────────────────────────────────────┘
```

---

### **Etapa 5: Adicionar Aba em `src/pages/Configuracoes.tsx`**

**Mudanças:**
1. Importar `MonitoramentoDataJudCard`
2. Adicionar novo TabsTrigger: `datajud-termos`
3. Adicionar novo TabsContent com o card

**Novo Trigger:**
```tsx
<TabsTrigger value="datajud-termos" className="flex items-center gap-2">
  <Zap className="h-4 w-4" /> {/* ou outro ícone apropriado */}
  <span className="hidden sm:inline">DataJud Termos</span>
</TabsTrigger>
```

---

### **Etapa 6: Criar Configuração em `configuracoes_monitoramento`**

**Mudança no Banco:**
- Inserir registro com `tipo='datajud_termos'`, `coordenacao_id=null` (global)
- `frequencia='manual'` (sem cron automático, apenas disparos manuais)
- `metadata` com stats de execução

**Query SQL:**
```sql
INSERT INTO public.configuracoes_monitoramento (
  tipo, frequencia, ativo, coordenacao_id, metadata
) VALUES (
  'datajud_termos',
  'manual',
  true,
  null,
  '{"status": "idle", "novas": 0, "duplicadas": 0, "tribunaisProcessados": 0}'
)
ON CONFLICT DO NOTHING;
```

---

## Fluxo de Execução End-to-End

1. **Usuário clica em "Executar"** na aba "DataJud Termos"
2. Hook `useDjenDataJud` dispara `monitorar-datajud-termos` via Edge Function
3. Edge Function:
   - Consulta todos `monitoramentos_djen` ativos
   - Para cada monitoramento, extrai termo e lista de tribunais
   - Faz request Elasticsearch à API DataJud para cada tribunal
   - Filtra movimentações dos últimos 7 dias
   - Deduplica contra `movimentacoes_datajud`
   - Insere novas movimentações no banco
   - Atualiza metadata em `configuracoes_monitoramento`
4. Hook detecta conclusão via polling e invalida queries
5. UI atualiza com contadores finais

---

## Vantagens desta Abordagem

| Aspecto | Benefício |
|---------|-----------|
| **Fonte Oficial** | API DataJud é oficial do CNJ, 100% gratuita |
| **Cobertura Ampla** | Cobre todos os tribunais brasileiros (TJMG, TJSP, TRTs, STJ, TRFs, etc) |
| **Não Invasivo** | Complementa DJEN Termos sem substituí-lo |
| **Metadados Estruturados** | Retorna tipo de movimentação, data, órgão julgador, etc |
| **Deduplicação Inteligente** | Mesma lógica de DJEN: evita duplicações sem substituir termos |
| **Escalável** | Reutiliza infraestrutura de polling e metadata de `configuracoes_monitoramento` |

---

## Limitações Conhecidas

1. **Metadados vs Texto Integral**: DataJud retorna descrição resumida da movimentação, não o texto completo da publicação DJE (similar a what DataJud returns today)
2. **Latência**: Movimentações no DataJud pode ter atraso de 1-3 dias em relação à publicação no DJE
3. **Rate Limiting**: API DataJud tem limites de requisição não documentados (será tratado com retry logic)
4. **Associação com Processo**: Se o processo `0016979` não estiver cadastrado em `processos`, a movimentação será salva mas desassociada do processo

---

## Ordem de Implementação

1. ✅ Tabela `movimentacoes_datajud` (migration)
2. ✅ Edge Function `monitorar-datajud-termos`
3. ✅ Hook `useDjenDataJud`
4. ✅ Componente `MonitoramentoDataJudCard`
5. ✅ Aba em `Configuracoes.tsx`
6. ✅ Inserção de config em `configuracoes_monitoramento`

