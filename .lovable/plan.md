# Botão Judit: preencher valor da causa (e demais campos) + gravar andamentos

## Diagnóstico confirmado (processo 0100715-02.2024.5.01.0343)

O botão Judit da tela Processos e Casos chama a função `buscar-judit` (a mesma da Distribuição TST). A resposta dela só traz campos do escopo TST: reclamante, reclamada, tribunal, classe_capa, relator, turma, tipo de recurso, trânsito etc. Ela **não** traz `valor_causa`, `comarca`, `vara`, `uf`, `instancia`, `assunto`, `fase` nem os andamentos.

Ao clicar em "Preencher formulário", o formulário lê apenas esses campos de topo — por isso o valor da causa e vários outros ficam vazios.

Porém os dados existem no payload já armazenado, dentro do bloco bruto `_judit_raw`. Verificado no registro mais recente desse processo:
- `amount = 60000` (é o R$ 60.000,00 exibido no card "Cache Judit")
- `courts[0].name = "3ª Vara do Trabalho de Volta Redonda"`
- `steps` com **117 andamentos**

Ou seja: nada precisa de nova consulta paga na Judit — basta ler o bloco bruto que já está gravado.

## O que será feito

### 1) Função Judit própria da tela Processos e Casos
Criar uma função dedicada `busca-judit-processos-e-casos`, totalmente separada da usada na Distribuição TST (`buscar-judit`). A tela Processos e Casos passa a usar só essa função, tanto no botão Judit quanto no "Preencher formulário".

Ela devolve o conjunto completo de campos do processo (não o recorte do TST) e também os andamentos:
- Identificação: assunto/matéria, classe, natureza, área, fase, situação
- Tribunal/órgão: tribunal, justiça, instância, esfera, sistema, órgão julgador, vara, comarca, UF
- Partes: polo ativo, polo passivo, terceiros, advogados e detalhamento das partes
- Datas: distribuição, recebimento, citação
- Financeiro: valor da causa
- Andamentos (lista completa de movimentos) e anexos quando solicitado

### 2) Preencher os campos que faltam
O extrator lê tanto os campos de topo da nova função quanto o bloco bruto (`_judit_raw`) de consultas já armazenadas, e deriva, quando o campo estiver vazio no formulário:
- Valor da causa (`amount`/`value`)
- Órgão julgador, vara e comarca/cidade (a partir de `courts`)
- UF, instância, justiça, área, sistema
- Assunto/matéria, classe, fase e situação
- Data de distribuição, data de recebimento e data de citação

Regras mantidas: só preenche campo vazio (não sobrescreve o que a advogada digitou), marca em verde os campos preenchidos pela Judit e não gera nova cobrança na Judit. Continua valendo a regra atual de tipo de recurso: apenas o que a Judit confirma, sem inferência.

### 3) Gravar os andamentos na aba Andamentos
Ao usar o botão Judit (e também no "Preencher formulário", reaproveitando o cache), os andamentos do payload passam a ser gravados nas movimentações do processo:
- Origem `judit_api`, com data, descrição e código do movimento
- Sem duplicar: ignora movimentos já existentes com a mesma data + descrição
- Aba Andamentos e contador do topo atualizados automaticamente após a gravação
- Mensagem informando quantos andamentos novos entraram

## Detalhes técnicos
- Nova Edge Function `supabase/functions/busca-judit-processos-e-casos/index.ts`, derivada da lógica de mapeamento completa hoje em `judit-processo-interno`, acrescentando `steps` (andamentos normalizados: data, descrição, código) no retorno. Cache-first (TTL padrão) e `force_refresh` só quando o usuário pede atualização forçada; anexos só com `with_attachments`. Nenhuma dependência de `buscar-judit`.
- `src/components/processos/ProcessoVisaoGeralForm.tsx`: `handleFetchJuditOnly` e `handleSyncJuditInterno` passam a invocar `busca-judit-processos-e-casos`; o fallback usa os campos derivados de `_judit_raw` (`cache_lookup` e `crawler.page_data[].response_data`, escolhendo a instância com mais `steps`), aplicados via `applyIfEmpty`.
- Novo utilitário `src/lib/juditRawCampos.ts` com `extrairCamposDoJuditRaw(payload)` e `extrairStepsDoJuditRaw(payload)`, reutilizável pelas duas rotas (botão Judit e preencher formulário).
- Andamentos: insert em `movimentacoes` (`processo_id`, `data_movimentacao`, `descricao`, `codigo`, `tipo: "judit"`, `fonte: "judit_api"`, `raw`) com deduplicação prévia por `data|descricao`, seguido de `invalidateQueries(["movimentacoes-processo", id])`.
- Logs continuam em `judit_logs`/`consultas_judit` (marcados com fonte `busca-judit-processos-e-casos`) e alimentam a tela Consumo Judit. Nenhuma mudança de schema; a Distribuição TST segue intocada em `buscar-judit`.