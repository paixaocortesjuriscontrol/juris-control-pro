# Roadmap — Considerações 02/09

## Workflows Projuris — Santander Cível
- [ ] Separar modelos reutilizáveis das cópias e validar etapas, prazos e condições dos arquivos enviados.
- [ ] Importar modelos com auditoria e proteção contra duplicação, sem iniciar execuções ou criar tarefas.
- [ ] Conferir os modelos e etapas gravados; verificação autenticada depende de sessão no Supabase externo.

## Versão e manuais v9.7.1
- [x] Atualizar a versão exibida no menu e o identificador de atualização; versão servida v9.7.1 e build OK.
- [x] Consolidar no manual as funcionalidades e melhorias realizadas até esta versão, preservando os capítulos anteriores; assuntos recentes conferidos no texto extraído.
- [x] Atualizar os cinco PDFs oficiais e os atalhos correspondentes; todas as páginas revisadas visualmente, capa corrigida e downloads confirmados. Tela autenticada não verificada por ausência de sessão no Supabase externo.

## Publicações Kurier incompletas — Janaina
- [x] Confirmar corte na captura comparando texto bruto e publicação do processo 0000340-48.2026.5.18.0052.
- [x] Corrigir fronteira do teor na captura e apresentação (helper compartilhado, 4 testes Deno aprovados e apresentação conferida); função publicada e duas cópias da publicação da imagem restauradas para 1.558 caracteres, incluindo a determinação de audiência.
- [ ] Recuperar a outra intimação 3069626495 sem colidir com a publicação restaurada — bloqueada pelo índice único que considera apenas os primeiros 400 caracteres; requer estratégia que preserve registros e vínculos, sem desligar a proteção contra duplicidades.
- [ ] Conferir publicação pela tela autenticada — Supabase externo sem sessão disponível; texto recuperado conferido no banco.

## Recuperação dos complementos Projuris
- [x] Ampliar a tela do backup com referências de justiça, órgão, comarca, UF, vara, classe, fase, área, partes, responsáveis textuais, pedidos e campos personalizados; novos processos recebem complementos e existentes preenchem apenas vazios.
- [x] Testar mapeamentos e preservação (13 testes); cruzamento do backup real encontrou 15.195 fontes únicas e rejeitou 20 CNJs ambíguos; tela lista arquivos ausentes.
- [x] Conferir correspondência única entre backup e processos já migrados; fontes ambíguas rejeitadas.
- [x] Recuperar 81 descrições já preservadas em Observações; conferidas 81/81, sem apagar conteúdo.
- [x] Disponibilizar Recuperar complementos no backup, com RPC admin invoker, campos vazios e auditoria de conflitos; 8 testes aprovados.
- [ ] Executar recuperação do restante do backup na tela e conferir os dados — sessão admin indisponível no Supabase externo; requer administrador conectado usando Recuperar complementos com processo.csv e processonumero.csv.

## Contagem de Atas no escritório
- [x] Corrigir continuidade da paginação da agenda ao mesclar fontes, evitando omitir Atas das páginas seguintes; testes de regressão.
- [ ] Conferir total na tela como admin — sessão autenticada indisponível no Supabase externo.

## E-mail de acompanhamento especial — partes
- [x] Incluir nomes das partes no assunto e corpo; 3 testes aprovados e função publicada sem disparar consultas pagas ou e-mails de teste. Recebimento com os nomes será confirmado no próximo aviso real.

## Avisos multicanal de alterações e cobranças
- [x] Centralizar avisos de participantes e alterações para todos os tipos, incluindo quem alterou.
- [x] Notificar cobranças com e sem comentário, sem repetir comentário + bolinha C.
- [x] Respeitar preferências individuais de canais; 3 testes Deno e teste SQL transacional aprovados para tarefas/prazos/atas/eventos/audiências/parcelas.
- [ ] Confirmar recebimento real no sistema, e-mail e WhatsApp — sessão autenticada indisponível no Supabase externo; função publicada e processamento da fila confirmado.

## Aviso de inclusão como responsável
- [x] Notificar inclusão/troca de responsável e corresponsável no sino, mantendo avisos de criação e evitando repetições rápidas.
- [x] Testar inclusão e troca em transação revertida, link e ausência de duplicação; nenhum dado de teste persistiu.
- [ ] Conferir aviso pela tela autenticada — sessão indisponível no Supabase externo; testes transacionais aprovados.

## Classificação de audiências Projuris
- [x] Exigir audiência no título na classificação de importação e testar a regra (3 testes aprovados).
- [x] Corrigir itens Projuris da Santander Cível sem essa palavra: 346 tarefas e 3 prazos; nenhum restante nesse escopo, vínculos e situações verificados no banco. Itens de origem Ástrea não alterados.

## Abas no detalhe das pautas
- [x] Incluir Processo com o formulário existente e Judit com as consultas já armazenadas, sem pesquisa automática ao abrir.
- [x] Completar Judit da pauta com análise, movimentações, capa/partes, anexos e log usando os painéis existentes.

## Manuais do sistema — 28/09/2026
- [x] Atualizar o Manual Completo para a versão 7.4.0 com os módulos atuais
- [x] Criar manual separado do Painel de Controle
- [x] Criar manual separado da Distribuição TST
- [x] Atualizar a central Manual Sistema e validar os PDFs
- [x] Ampliar o Manual do Painel de Controle com 20 capítulos, exemplos e capturas ilustrativas

Pulados por decisão do usuário: tarefas do Ástrea (item 15 do doc) e criação/desduplicação de usuários.

## Leva 1 — Bugs que quebram uso
- [x] 01 Nova tela "Reatribuir Processos" (paginação no servidor, filtros, seleção em massa, destino, gravação em lotes) + diálogo de Coordenações lendo `processos_responsaveis`
- [x] 17 "Marcar como ciente" não pode sumir da tela (divergências ficam visíveis com aparência de já visto, filtro pendentes/todas, contagem só de pendentes, botão Reabrir)
- [x] 08 Botão "Buscar mais do servidor" com número correto e só quando há mais no servidor
- [~] 10 Ranking TST — RPC conferida no banco (retorna dados em <1s); a tela passou a exibir o erro real com "Tentar novamente". Aguarda o print/mensagem do erro para fechar a causa.

## Leva 2 — Agenda e recorrências
- [x] 12 Divergência de calendário Dra. Janaina x Admin (admin com coordenação selecionada agora usa também os responsáveis/membros, igual ao perfil do coordenador)
- [x] 13 Recorrente em dias úteis: série começa em dia útil e o intervalo conta dias úteis (tarefas, prazos e eventos)
- [x] 11 Nova situação "Cancelar e ocultar da agenda" (`cancelado_oculto`, registro preservado no banco)
- [x] 14 Definir a data direto no calendário ("Criar nesta data" no painel do dia, pré-preenchendo tarefa/prazo/evento)
- [x] 18 Baixa da pendência pela tela principal com pop-up completo (situação, data de cumprimento, comentário e, em recorrentes, somente esta / toda a série)

## Leva 3 — Análise DJEN e processos
- [x] 02 Preservar filtros ao voltar da Análise DJEN
- [x] 05 "Ver processo" abrindo em nova aba
- [x] 06 Partes logo abaixo do número do processo
- [x] 09 Pesquisa global sem trazer todas as publicações fora da Análise DJEN
- [x] 03 Processos e casos com pendentes primeiro
- [x] 04 Balãozinho de comentários no Painel de Controle com bolinha de não vistos

## Leva 4 — Complementos
- [x] 07 Processos em comum Dr. Thonmás / Dra. Janaina em planilha
- [~] 17b Exportar comentários em XLSX (pulado pelo usuário)
- [x] 16 Botão "Acatar" ao lado de cada sugestão da Judit (Monitoramento → Divergências Judit)
- [ ] 19 Diagnóstico do erro ao criar/editar usuário

## Audiências — pessoas fixas
- [x] Trigger no banco aplica pessoas fixas de AUDIÊNCIA em toda audiência criada
- [x] Cards do Kanban de audiências mostram responsáveis e envolvidos
- [x] Diálogo de reagendar/nova audiência mostra as pessoas replicadas
- [x] Editar audiência: campo de Envolvidos sempre visível, com fixos travados (cadeado)

## Ajustes 04/09
- [x] Recorrências mensais: exibir todas as ocorrências também na pasta completa do processo
- [x] Planilha Dossiês: respeitar filtro com/sem matérias e ordenar da distribuição mais antiga à mais recente

## Redesign tela do processo (04/09)
- [ ] Escolher direção visual (sem cantos arredondados, alinhada ao painel lateral) — protótipo deve incluir menu principal completo e chrome de admin (versão, alertas, novidades, usuário)

## Valida Kurier (07/09)
- [x] Comparar por login do Kurier usando as coordenações já vinculadas; foco na lista "Só Kurier" (o que o DJEN Termos Servidor não achou), comparação feita no banco

## Clipping de prazos (09/09)
- [x] Reproduzir o cabeçalho do modelo com logomarca da Paixão Côrtes
- [x] Manter a coluna Prazo (dias) como número em todas as linhas e evitar fórmulas com erro

## Distribuição TST (10/09)
- [x] Exibir pendências vermelhas e avisos amarelos na aba Distribuição TST da janela lateral direita
- [x] Inteligência Jurídica: filtro de Equipe usa as equipes da Distribuição TST; Tribunal reúne Distribuição TST e Processos e Casos

## WhatsApp — fila Z-API (15/09)
- [x] Identificar e interromper o envio de mensagens antigas acumuladas, preservando os 711 lembretes futuros

## Workflow pela Análise DJEN (10/09)
- [x] Iniciar um workflow reutilizável pelo menu Adicionar da publicação, herdando processo e coordenação
- [x] Preservar a publicação como origem da execução e vincular o primeiro item ao quadro da publicação

## Workflow no Painel de Controle
- [x] Botão Adicionar > Workflow abrindo IniciarWorkflowDialog
- [x] Coordenação única pré-selecionada (sem escolha); admin escolhe qualquer

## Etapas dos workflows (11/09)
- [x] Nova etapa e edição em painel lateral direito sobreposto
- [x] Campos próprios de prazo, tarefa, evento, audiência e parcelamento
- [x] Datas, recorrências, alertas e parcelas mensais alinhados aos cadastros normais

- [x] Corrigir risco no calendário para atividade com situação “Concluído com sucesso”.
## Inteligência Jurídica — Judit (24/09)
- [x] Corrigir Varas, Estados e Juízes recebidos como texto e eliminar linhas vazias
- [x] Oportunidades de acordo: corrigir filtro de coordenação que retornava 0 para coordenações não-b0f690ad
- [x] Análise da Judit: organizar resultados em abas (Tempo, Advogados, Assuntos, Varas e Região, Juízes)

## Geração de Peças Jurídicas com IA (estilo Vert/CyndIA)
- [x] Fase 1: tabelas tese_juridicas + pecas_geradas (RLS, índices, constraints)
- [x] Fase 1: tela Banco de Teses (menu lateral, CRUD, filtros por coordenação/tipo/área/busca)
- [x] Fase 2: RPC buscar_teses_aplicaveis (busca por score: tipo_peca + assunto/materia/fundamentos)
- [x] Fase 3: edge function gerar-peca-juridica (Gemini flash, contexto do processo, tese RAG, salva em pecas_geradas com custo/tokens)
- [x] Fase 3: aba "Peças IA" na ficha do processo (gerar, revisar, exportar)
- [x] Fase 5: revisão humana editável, exportar .docx só após revisão, registro de quem revisou e quando, exclusão de peça

- [x] Interromper solicitações repetidas de permissão no Supabase e concluir a validação da busca sem novas migrações.

- [x] Encerrar definitivamente o ciclo de solicitações de alteração no Supabase.

- [x] União coordenações Dra. Renata concluída; publicações DJEN mantidas na coordenação antiga por decisão do usuário


## Coordenações — 28/09/2026
- [x] Corrigir persistência da troca de cargo de membro
- [x] Modernizar tela com grade compacta e painel lateral direito

## Migração Projuris — Backup completo (retomar 05/10/2026)
- [x] Tela pronta: Processos → Tarefas → Andamentos (ver docs/migracao-projuris-backup.md)
- [ ] Tabelas de vínculo (tarefa, anexo, comentário, responsáveis, etiquetas) — aguardando equipe Projuris
- [ ] Etapa Anexos (vínculo ou 3 regras) — aguarda arquivovinculomodulo
- [ ] Etapa Comentários — aguarda tabela de vínculo

## App mobile (PWA)
- [x] Etapa 1 instalação e Etapa 2 estrutura (v8.4.0)
- [ ] Etapa 3: cartões no Painel, Processos, DJEN e Pautas
- [ ] Etapa 4: demais telas
- [x] Importar processos da planilha BASE_PAIXAO_102026.xlsx na Coordenação Citibank (269 processos)

## Distribuição de publicações GOL
- [x] Mostrar nomes cadastrados das coordenações e ampliar detalhes da revisão em lote.
- [x] Disponibilizar acesso à distribuição de uma única publicação.
- [ ] Conferir distribuição autenticada — sessão indisponível para o Supabase externo deste projeto.

## Importação de anexos Projuris
- [x] Corrigir busca de processos existentes pelo histórico auditado, reconhecer pastas extras do zip consolidado e disponibilizar conferência CSV; 14 testes aprovados, sem alterações no banco.
- [ ] Reconferir os 3.331 destinos, 1.778 ausentes e 11.605 nomes repetidos do pacote real — zip/CSVs estão apenas na sessão do usuário, não disponíveis aqui.
- [x] Corrigir reconhecimento dos caminhos e dos nomes interno/original/final; separar relatórios internos dos arquivos ausentes (12 testes aprovados).
- [x] Acelerar conferência/envio e mostrar progresso real nos dois modos, mantendo a proteção contra repetição.
- [x] Validar fila, auditoria em lotes, progresso parcial e apresentação das barras (7 testes aprovados).
- [ ] Medir envio com zip real — acesso autenticado indisponível no Supabase externo deste projeto.

## Desempenho do Painel de Controle
- [x] Reutilizar lotes já consultados de comentários, cobranças, publicações e workflows durante a paginação; 8 testes aprovados. Índices principais já existem; workflow tem apenas cerca de 417 linhas e consulta medida em 0,177 ms, sem justificativa para novo índice. Medição autenticada permanece pendente abaixo.
- [x] Remover consultas de resumos sem consumidores, adiar formulários fechados e consulta de exportação, reutilizar lista da agenda entre renderizações.
- [x] Validar regressões da paginação: 5 testes aprovados; prévia sem erros de compilação.
- [ ] Medir carregamento autenticado — Supabase externo sem sessão disponível; navegador chega somente à tela de entrada.
