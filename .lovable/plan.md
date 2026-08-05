# Considerações da Coordenação Dra. Beatriz Costa

Plano dividido em: (A) correções de bugs relatados, (B) ajustes de fluxo na leitura do DJEN, (C) novidades (legendas, comentário obrigatório, etiquetas automáticas, relatórios, permissões).

## A. Correções

**1. Publicação marcada como lida continua em "Não lidas"**
Hoje o "Salvar e ler" grava `lida = true` apenas na linha clicada e registra a leitura em `publicacoes_djen_leituras`, sem tratar o erro do update e sem alcançar as demais linhas do mesmo grupo deduplicado que a lista unificada mostra. Primeiro passo: confirmar em qual dos dois pontos falha (retorno de erro do update x irmãs do grupo dedup). Depois:
- passar a tratar e exibir erro do update/upsert;
- marcar como lidas todas as publicações do mesmo grupo (mesmo processo + dia + conteúdo normalizado) da coordenação, não só a clicada;
- aguardar `invalidateQueries` antes de redirecionar para a lista.

**2. Descarte em lote não funciona**
Revisar `handleDescartarSelecionadas` / "Descartar duplicadas": hoje ele só descarta itens que considera duplicados entre os selecionados e aborta em silêncio nos outros casos. Passa a existir um comportamento previsível: descarta exatamente o que está selecionado, com confirmação única, contador de sucesso/falha e mensagem clara quando algo é bloqueado por permissão.

**3. Etiquetas não aplicam**
O catálogo da coordenação existe (9 etiquetas cadastradas). A investigação começa pelo gravar: reproduzir o clique no checkbox e capturar o erro real do insert em `etiquetas_itens` (permissão x coordenação da etiqueta diferente da coordenação do item x entidade não habilitada para o módulo). O ajuste será feito onde o teste apontar, mais exibição de erro em toast em vez de falha silenciosa, nas telas Análise DJEN, Processos e Casos, Clientes e formulários da agenda.

**4. Relatórios sem reclamante/cliente**
Incluir nas RPCs de relatório e nas telas/exports as colunas Reclamante, Reclamada, Cliente e Etiquetas.

**5. Coordenadora não fica fixa nos envolvidos**
Ao criar tarefa/prazo/evento/audiência, incluir automaticamente as coordenadoras da coordenação como envolvidas (acompanhamento), sem substituir os responsáveis, e sem duplicar quando já estiverem na lista.

## B. Fluxo da leitura do DJEN

**6. Data base automática**
Ao abrir o formulário a partir de uma publicação, preencher "Data base" com a data da publicação (mesma normalização de dia útil já usada no projeto), mantendo o campo editável.

**7. Desfazer último**
Botão "Desfazer último" na Análise DJEN que reverte a última ação da sessão (marcação de leitura, descarte ou criação de item), com confirmação e aviso do que será revertido.

**8. Títulos com prazo pré-programado**
Os modelos de título já têm preenchimentos padrão para prazo. Estender para que qualquer modelo (prazo, tarefa, audiência, evento) tenha "Prazo (dias)" + unidade (úteis/corridos), e ao selecionar o título durante a leitura do DJEN as datas prevista/fatal sejam calculadas a partir da data base, respeitando dias úteis e a suspensão do art. 775-A da CLT já implementada.

## C. Novidades

**9. Legendas de cumprimento de prazos**
Acrescentar às situações de tarefa/prazo: PROTOCOLADO, BAIXADO, MINUTADO - REVISÃO. PENDENTE, REAGENDADO e TRATADO já existem — REAGENDADO e TRATADO passam a valer também para tarefa e prazo (hoje são só de audiência). Cores/ícones no mesmo padrão atual e legenda visível nos quadros.

**10. Comentário obrigatório na mudança de situação**
Ao alterar a situação de tarefa, prazo, evento ou audiência, o comentário passa a ser obrigatório: o salvamento é bloqueado sem texto, e o comentário entra no histórico/auditoria e no e-mail de notificação de mudança de situação.

**11. Alteração de datas: liberar para advogados**
Datas de prazos/tarefas passam a ser editáveis por advogado, além de admin/coordenador/assistente coordenador. Estagiário, assistente e secretaria continuam sem essa permissão. Toda alteração continua registrada na auditoria.

**12. Etiqueta de cliente aplicada na base e automaticamente**
- Aplicação retroativa: para cada etiqueta de cliente da coordenação, aplicar aos processos da base cuja parte/cliente corresponda ao cliente da etiqueta (execução em lote, com prévia de contagem antes de gravar).
- Automático: ao chegar publicação nova e o processo ganhar/ter vínculo com o cliente, a etiqueta correspondente é aplicada sozinha ao processo e à publicação.
- A regra de vínculo etiqueta ↔ cliente precisa ser definida com você (ver pergunta abaixo).

## Detalhes técnicos

- Migrações: novos valores no enum `status_tarefa` (`protocolado`, `baixado`, `minutado_revisao`) e reuso de `reagendado`/`tratado`; coluna opcional de mapeamento etiqueta → cliente (`etiquetas.cliente_id`) para a automação; ajuste das RPCs `get_relatorio_*` para devolver reclamante/reclamada/cliente/etiquetas. Todo `CREATE TABLE` novo sai com GRANTs + RLS por coordenação.
- Situações: `src/constants/situacoesItem.ts` como fonte única; comentário obrigatório validado nos diálogos (`TarefaDetalhesDialog`, `PrazoDialog`, `EventoDialog`, `EditarAudienciaDialog`) e propagado às Edge Functions de notificação.
- Leitura DJEN: correção em `markPubComoLida` (`src/pages/AnaliseDjen.tsx`) usando a chave de dedup já existente no banco; `await invalidateQueries` antes de fechar/redirecionar.
- Etiquetas: diagnóstico via reprodução no preview com captura do erro do insert em `etiquetas_itens`; erros passam a aparecer em toast em `EtiquetaPicker`.
- Modelos de título: novos campos em `CAMPOS_MODELO` e cálculo em `src/lib/aplicarPadroesModelo.ts` reaproveitando a regra CLT de dias úteis.
- Desfazer último: pilha de ações em memória na Análise DJEN, com reversão por tipo de ação.

## Sequência de entrega

1. Bugs (leitura DJEN, descarte em lote, etiquetas) — maior impacto imediato.
2. Legendas + comentário obrigatório + permissão de datas.
3. Data base automática, prazo por título, desfazer último.
4. Relatórios e etiquetas automáticas de cliente.
