# Alerta de diferença entre execuções do DJEN Termos

Sempre que uma execução do **DJEN Termos** encontrar publicações a mais do que a execução anterior do mesmo dia (na mesma coordenação), enviar e-mail para os coordenadores daquela coordenação e para todos os administradores. Se não houver diferença, nenhum e-mail é enviado.

## Regras

- Escopo: apenas execuções do motor **Termos** (`djen_paralela_servidor` no servidor e `djen_paralela` local). Pautas, STF, Kurier e Processos ficam fora.
- Comparação: cada execução concluída é comparada com a execução de Termos imediatamente anterior do mesmo dia (BRT), coordenação por coordenação.
- Diferença = publicações vistas pela 1ª vez naquela execução (mesma lógica do "+N" já exibido no card "Execuções do dia por coordenação" da tela Análise DJEN).
- Coordenação com diferença 0 não entra no e-mail. Nenhuma coordenação com diferença, nenhum e-mail.
- Primeira execução do dia não gera alerta (não há execução anterior para comparar).
- Destinatários:
  - Coordenadores e assistentes de coordenação da coordenação afetada (roles `coordenador` / `assistente_coordenador`).
  - Todos os usuários com role `admin`, sempre, em um e-mail consolidado com todas as coordenações que tiveram diferença.
- Idempotência: cada execução é notificada uma única vez, registrada em tabela de controle (o cron repetido não reenvia).

## E-mail

HTML no padrão do escritório (mesmo cabeçalho/rodapé e remetente `Juris Control <alerta@juriscontrol.adv.br>` já usados nos alertas DJEN):

- Assunto: `DJEN Termos — novas publicações na execução das HH:MM — {Coordenação} — DD/MM/AAAA`
- Corpo: horário da execução atual e da anterior, tabela com Coordenação, total anterior, total atual e diferença (+N), e link para a tela Análise DJEN do dia.
- Versão admin: mesma estrutura, uma linha por coordenação e totais gerais.

## Detalhes técnicos

1. Nova tabela `public.alertas_diferenca_execucoes_djen` (`execucao_id`, `coordenacao_id`, `diferenca`, `enviado_em`, unique em `execucao_id + coordenacao_id`), com GRANTs (`service_role` total, `authenticated` select) e RLS.
2. Nova Edge Function `alertar-diferenca-djen-termos`:
   - lista execuções de Termos do dia (BRT) com status `concluido` em `execucoes_servidor` e `execucoes_agendadas`, ordenadas por `iniciado_em`;
   - monta os contadores por coordenação usando `publicacoes_djen_servidor_execucoes` / `publicacoes_djen_execucoes` (mesma agregação do hook `useExecucoesDoDiaPorCoordenacao`);
   - calcula a diferença contra a execução de Termos anterior; envia via Resend apenas às coordenações com diferença maior que zero e o consolidado aos admins;
   - grava as linhas de controle e é segura para rodar repetidamente.
3. Cron `pg_cron` a cada 5 minutos chamando a função (as execuções terminam em horários variáveis; o cron detecta a conclusão e envia logo depois).
4. Bump de versão em `src/constants/version.ts`.