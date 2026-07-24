## Feedback Dra. Janaina — Ajustes

### 1. Cores fixas no card Pendências (Processos e Casos → Visão Geral)
Aplicar cor por tipo, independente de status:
- **Audiências**: amarelo
- **Tarefas**: azul
- **Prazos**: vermelho
- **Parcelamentos**: verde

Escopo restrito ao card de Pendências da aba Visão Geral do processo/caso. Painel de Controle não é alterado.

### 2. Persistência ao concluir tarefa
- Garantir `await queryClient.invalidateQueries` antes de fechar modal/atualizar UI nas mutations de conclusão de tarefa.

### 3. Ação "marcar como lida" em massa involuntária
- Revisar ação individual por linha em Análise DJEN / Pub. DJEN para que o clique numa linha nunca afete outras.
- Confirmação quando ação for aplicada em seleção múltipla (>1).

### 4. Localização de publicações salvas
- Contador visível na aba **Pub. DJEN** do processo indicando publicações vinculadas.

### 5. Fluxo "Salvar" na Análise DJEN
- Ao Salvar:
  - Localizar ou criar processo pelo CNJ automaticamente.
  - Vincular publicação **completa** (conteúdo integral, sem truncar) à aba **Pub. DJEN** do processo.
  - **Remover** inserção duplicada em `movimentacoes` — publicação não aparece mais como andamento.

### Detalhes técnicos
- Preservar `conteudo` integral do DJEN no salvamento (sem substring no front/back).
- Arquivos: card Pendências (Visão Geral de Processos/Casos), `AnaliseDjen.tsx` (fluxo Salvar), aba Pub. DJEN.
- Versão para `4.2.8`.