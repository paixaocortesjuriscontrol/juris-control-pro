# Plano: corrigir os avisos de segurança mais graves

## Objetivo
Corrigir primeiro os avisos mais graves da revisão de segurança, sem quebrar o trabalho compartilhado das equipes. Os avisos de "só exige login" (grupo 1) ficam para uma etapa posterior.

## O que será corrigido

### Etapa 1 — Regras totalmente abertas (USING true), as mais graves
Tabelas hoje sem nenhuma restrição real: `dados_benner`, `judit_logs` (expõe e-mails), `audiencia_envolvidos`, `tarefa_envolvidos`, `teses_juridicas`, `pecas_geradas`, `execucoes_agendadas`, `classificacao_relatores_tst`, `djen_diario_index_tribunais`, `dje_resultados_busca`, `repositorio_documentos`, `publicacoes_djen_leituras`, `publicacoes_djen_execucoes`, `publicacoes_djen_servidor_execucoes`, `permissoes_situacao_tipo_tarefa`, `alertas_parcela`, `judit_anexos`, `processos_capturados`, `depositos_recursais` e demais listadas no scan.

Para cada uma, antes de mexer:
- Conferir quem escreve nela (tela do usuário ou função de servidor/edge function).
- Se quem escreve é o servidor (service_role), a regra aberta pode ser removida sem impacto — o servidor não passa por RLS.
- Se usuários logados usam a tabela, trocar a regra aberta por "precisa estar logado" (fecha acesso anônimo) e, quando houver dono/coordenação clara, restringir por dono ou coordenação.

### Etapa 2 — Arquivos (storage) sem dono
Espaços: `processos-autos`, `documentos_processos`, `cargas-benner-remessas`, `repositorio_documentos`, `dje-pdfs`, `dj-estaduais-pdfs`.
- Amarrar gravação/exclusão ao dono do arquivo (pasta por usuário ou owner_id) onde fizer sentido.
- Onde o arquivo é compartilhado por design (autos de processo, PDFs de diário), manter leitura para logados e documentar a decisão.

### Etapa 3 — Verificação
- Rodar nova revisão de segurança e confirmar que os avisos graves sumiram.
- Conferir as telas que usam as tabelas alteradas (sem login no preview, verificação limitada — usuário confere as telas principais).

## Fora deste plano (etapa futura)
- Os ~140 avisos de "qualquer logado acessa tudo" (grupo 1): exigem decisão de isolamento por coordenação e são trabalho maior.

## Detalhes técnicos
- Mudanças via `supabase--migration` (DROP POLICY/CREATE POLICY), em lotes pequenos para não estourar timeout.
- Nenhuma tabela será criada ou apagada; só regras de acesso (RLS) mudam.
- Tabelas escritas apenas por edge functions com service_role: remover policies abertas não afeta o funcionamento.
- Backup não necessário: policies são recriáveis e o histórico de migrações guarda o estado anterior.
