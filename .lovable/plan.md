# Execução DJEN Servidor que nunca termina e botão "Destravar"

## O que encontrei (10/11/2026, horário de Brasília)
- As execuções das **04:30** e das **10:00** buscaram os 236 itens (todos "concluído"), mas nunca foram marcadas como finalizadas. O servidor continuou mandando sinal de vida até 15:20, por isso o sistema não as encerrou sozinho.
- Ou seja: o travamento acontece **depois da busca**, na etapa final (gravar resumo, descartar duplicadas, avisos), e não na consulta ao DJEN.
- Às 15:25 alguém clicou em Destravar e as duas ficaram como "Canceladas". As execuções das 06:00, 07:30, 13:00 e 15:00 terminaram normalmente. Agora não há nada rodando e os servidores estão livres.
- O botão "Destravar (350s sem sinal)" na tela é da execução das 15:00, que **já terminou** às 15:00:27. A tela não percebeu o fim e continuou mostrando a execução como ativa.

## O que vou fazer
1. **Tela:** só mostrar Executando/Cancelar/Destravar quando a execução estiver de fato em andamento no banco; ao terminar, a tela atualiza sozinha e libera "Executar Servidor".
2. **Proteção no servidor:** se todos os itens estiverem concluídos e a execução não for finalizada em 10 minutos, o sistema a finaliza como "concluída com aviso" (sem perder o que foi encontrado) e avisa os administradores, como já acontece com o sinal de vida parado.
3. **Causa da etapa final:** investigar no código do servidor (VPS) qual passo após a busca fica preso e colocar limite de tempo nele, registrando no erro qual passo demorou.
4. **Conferir as execuções das 04:30 e 10:00:** verificar se as publicações encontradas foram gravadas na Análise DJEN; se faltar alguma, recuperar.

## Detalhes técnicos
- `execucoes_servidor`: casos com `progresso.itens` 100% `concluido`, `heartbeat_at` atualizando e sem `finalizado_em`.
- Ajustar `reaper_execucoes_servidor_travadas` com a regra "itens completos + sem finalização há 10 min" (não enfileira retomada).
- Componente do botão na tela DJEN Servidor: derivar estado de `status` + `finalizado_em` e invalidar a consulta ao receber a finalização.
- Worker: timeout por passo na finalização (descarte de duplicadas, resumo, alerta de diferença).
