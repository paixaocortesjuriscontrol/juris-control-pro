## Plano corrigido

### 1. Corrigir a tela Análise DJEN Servidor quando a data está vazia

O comportamento correto será:

- Se o filtro estiver em **Hoje** e o campo de data estiver vazio, a tela deve buscar por **data_publicacao do dia atual em BRT (America/Sao_Paulo)**.
- Não deve cair em `created_at`/data de captura nesse caso.
- Quando o usuário preenche explicitamente a data `26/06`, a tela já mostra porque está usando a data certa; vou alinhar o caso vazio para usar essa mesma semântica.

Mudanças previstas:

- Ajustar `src/hooks/usePublicacoesDjenServidorUnificadas.ts`:
  - Onde `filtros.apenasHoje` monta `startOfDay(new Date())`/`endOfDay(new Date())`, trocar para uma data BRT estável.
  - Aplicar o range em `data_publicacao` quando `apenasHoje=true`.
  - Manter `created_at` apenas para filtros de período de captura quando o usuário estiver em “Todos” e usar `dataInicio/dataFim`.
- Revisar os blocos de estatísticas, listagem e fallback para garantir que todos usem a mesma regra.
- Ajustar contadores/headers para não divergir da lista.

### 2. Não mudar deduplicação geral do sistema

Não vou alterar:

- `src/utils/djenDedup.ts`
- regras de deduplicação visual por `coordenação + id_djen`
- constraints/índices principais do Servidor
- validação dos motores Browser/Servidor
- regra de salvar publicação por coordenação independente

Essas regras continuam intactas.

### 3. Usar conteúdo completo + processo somente no botão vermelho

A regra especial vale somente para o botão **“Descartar duplicadas da coordenação”**.

Para esse botão, a duplicidade será:

- mesma coordenação
- mesmo processo normalizado, apenas dígitos
- mesmo conteúdo completo normalizado
- dentro do intervalo escolhido no botão; se vazio, somente hoje em BRT

Não usará `id_djen` para esse descarte em lote.
Não cortará destinatários, partes ou advogados.
Não afetará a listagem normal.

### 4. Ajustar RPC do botão

Criar/ajustar uma função própria para a tela Servidor:

- `descartar_duplicadas_coordenacao_servidor(p_coordenacao_id, p_data_disp_inicio, p_data_disp_fim)`
- Operar somente em `publicacoes_djen_servidor`
- Mover duplicadas para `publicacoes_djen_descartadas`
- Usar `motivo_descarte='duplicada_lote'`
- Registrar `tipo_origem_origem='servidor'`
- Manter a publicação mais antiga do grupo
- Preservar o desfazer por lote

A função Browser existente só será mexida se estiver usando a regra nova por `id_djen`; nesse caso volta para conteúdo completo + processo, mas **somente para o botão**.

### 5. Ajustar chamada da tela

Em `src/pages/AnaliseDjenServidor.tsx`:

- O botão do Servidor chamará a RPC do Servidor.
- O texto/tooltip permanecerá coerente: “mesmo processo + conteúdo completo”.
- O default de data do botão também será “hoje BRT”, não UTC/local do navegador.

### 6. Validação

Depois da implementação, validar:

- Com data manual `26/06`, a lista continua mostrando as publicações.
- Com data vazia e filtro “Hoje”, a lista mostra as publicações com `data_publicacao` do dia BRT.
- O botão vermelho descarta duplicadas por conteúdo completo + processo.
- A listagem normal continua sem aplicar essa regra de conteúdo+processo.