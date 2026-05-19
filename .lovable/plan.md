## DJEN Termos Kurier — Plano de Implementação

Migração de banco já aplicada (tabelas, RLS, seed dos 10 logins inativos, singleton em `configuracoes_monitoramento`, ajuste do CHECK de `execucoes_agendadas`). Resto da implementação abaixo.

### 1. Secret necessário
- `KURIER_BASE_URL` (vou pedir via `add_secret` no início da execução). Valor sugerido: `https://wsk.kurier.com.br`. Se a URL real for outra, você cola na hora.

### 2. Edge Functions (todas com `verify_jwt = true`, CORS, validação Zod, decrypt local AES-GCM)

| Função | Método | O que faz |
|---|---|---|
| `kurier-testar-credencial` | POST `{login, senha}` | Faz uma chamada de baixo custo (`ConsultarQuantidadePublicacoesDisponiveis`) e devolve `{ok, total, erro}`. Não grava nada. |
| `kurier-quantidade-disponivel` | POST `{credencial_id?}` | Para uma credencial (ou todas as ativas) retorna o total pendente. |
| `kurier-consultar-publicacoes` | POST `{credencial_id}` | Loop de lotes de 50 chamando `GET /api/KJuridico/ConsultarPublicacoes`. Para cada lote: grava em `kurier_publicacoes_raw` (upsert por `id_kurier`), insere em `publicacoes_djen` (dedup pela mesma chave que a Paralela), e chama `ConfirmarPublicacoes` para tirar da fila Kurier. Atualiza `kurier_execucoes` e `ultimo_uso`/`ultimo_status` da credencial. |
| `kurier-confirmar-publicacoes` | POST `{credencial_id, ids_kurier[]}` | Confirmação manual (caso a UI precise reconfirmar). |
| `kurier-consultar-personalizado` | POST `{credencial_id, data, termo?, tribunal?, estado?}` | Wrapper de `ConsultarPublicacoesPersonalizado` para reconsultar histórico. Não confirma. |

Autenticação Kurier: `?login=...&senha=...` no querystring (padrão Kurier público); se a Kurier exigir Basic Auth, ajusto em um único ponto (`buildKurierUrl`).

Padrões obrigatórios do projeto aplicados:
- `import { createClient } from "npm:@supabase/supabase-js@2"`
- AES-GCM local com `COFRE_ENCRYPTION_KEY` (mesmo cofre)
- `verify_jwt = true`, valida `has_role(admin|coordenador)` antes de qualquer operação sensível
- Logs em `kurier_execucoes` e `monitoramento_logs` (best-effort)

### 3. Frontend

**Hooks:**
- `useKurierCredenciais.ts` — CRUD inline com React Query. Inclui mutação `testar(credencialId)` que invoca `kurier-testar-credencial` (senha decriptada no backend) e mostra toast com o resultado.
- `useDjenTermosKurierEngine.ts` — singleton com a mesma superfície da Paralela: `executar`, `cancelar`, `forceKill`, `resetTotal`, `subscribe`, `getProgress`, `hydrateFromBackend`, checkpoint em `localStorage` (`djen-termos-kurier-checkpoint-v1`). Diferença: cada **track = um login ativo** (não tribunal). Concorrência 3 logins simultâneos, com `delay_between_lotes: 800ms`.
- `useDjenTermosKurier.ts` — wrapper React do singleton (espelha `useDjenTermosParalela.ts`), com `await invalidateQueries` antes de fechar status concluído.
- `useDjenTermosKurierScheduler.ts` — checa `configuracoes_monitoramento` tipo `kurier` e dispara o engine respeitando `frequencia` e `horarios_execucao` (mesmo formato da Paralela).

**Componentes:**
- `KurierCredenciaisPanel.tsx` — tabela com colunas: Login (read-only), Senha (input password inline; salva criptografando via edge `kurier-testar-credencial` com flag `salvar=true` OU via mutação dedicada `kurier-salvar-senha`), Prioridade (numérico inline), Ativo (switch inline), Último uso, Último status, Ações (Testar, Excluir). Sem botão "Editar" — tudo inline conforme padrão do projeto.
- `MonitoramentoTermosKurierCard.tsx` — estrutura visual idêntica ao `MonitoramentoTermosParalelaCard`: cabeçalho com Frequência/Ativo/Horários, botões Executar/Cancelar/Reset/Force Kill, barra de progresso geral, lista de tracks (uma por login), painel de credenciais embutido logo abaixo.

**Aba em `Configuracoes.tsx`:**
- Novo `TabsTrigger value="djen-termos-kurier"` (ícone `KeyRound` ou similar) e `TabsContent` com o card.

### 4. Isolamento garantido
- Nenhum arquivo existente da Paralela, Pro, Flash, PJE Comunica é tocado.
- As publicações Kurier entram em `publicacoes_djen` com `origem='kurier'` (campo já existente) — para que apareçam na timeline normal — mas o pipeline é 100% paralelo ao DJEN/PJE.
- Coordenação: como Kurier devolve publicações já filtradas pelos termos cadastrados no portal Kurier, o engine **não** aplica as regras de `monitoramentos` do nosso sistema. Apenas grava com `origem='kurier'` e `coordenacao_id=null` (visível a todas as coordenações). Se você quiser amarrar cada login a uma coordenação específica, adiciono coluna `coordenacao_id` em `kurier_credenciais` numa segunda migração.

### 5. Ordem de execução
1. `add_secret KURIER_BASE_URL` — aguarda você colar a URL.
2. Criar 6 arquivos em `supabase/functions/` (5 functions + 1 shared).
3. Criar 4 hooks em `src/hooks/`.
4. Criar 2 componentes em `src/components/configuracoes/`.
5. Adicionar aba em `src/pages/Configuracoes.tsx`.
6. Aguardar deploy automático e validar que a aba abre e a tabela de credenciais carrega vazia (sem senhas) com os 10 logins listados.

### Detalhes técnicos

```text
publicacoes_djen
  ├── id (uuid)
  ├── numero_processo
  ├── conteudo (HTML)
  ├── origem = 'kurier'   ← marca a fonte
  ├── coordenacao_id = null
  └── metadata = { kurier: { id_kurier, login_usado, data_disponibilizacao, ... } }

kurier_publicacoes_raw  ← audit + idempotência
  └── UNIQUE(id_kurier)   ← evita reprocessar mesma publicação entre logins

kurier_credenciais
  └── senha_encrypted: base64(IV ‖ AES-GCM ciphertext)
```

Checkpoint engine (`localStorage`):
```json
{
  "runKey": "uuid",
  "credenciaisConcluidas": ["uuid", "..."],
  "novas": 0, "duplicadas": 0, "descartadas": 0,
  "tempoInicio": 0
}
```