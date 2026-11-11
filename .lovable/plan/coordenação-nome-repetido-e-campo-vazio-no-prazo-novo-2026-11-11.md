# Coordenação: nome repetido e campo vazio no prazo novo

## O que conferi
- Existe **uma só** coordenação da Dra. Janaina ("Coordenação Dra. Janaina Catunda"). Ela é coordenadora e membro dessa coordenação. Os dados estão corretos.
- **Nome repetido:** a tela de nova tarefa mostra o nome com a área no final ("... - trabalhista"). Quando o item já tem coordenação, a tela inclui a mesma coordenação de novo, sem a área. Por isso aparecem as duas.
- **Campo vazio (print da Análise DJEN):** o site que ela usa ainda está na versão 9.9.0, sem a correção de ontem, que não foi publicada. Mesmo assim, vou reforçar o prazo novo para não depender do carregamento da lista.

## O que vou mudar
1. Mostrar a coordenação **sem** a área e **uma vez só** na lista.
2. Prazo, tarefa, evento e audiência **novos** já abrem com a coordenação do usuário, inclusive na Análise DJEN, sem esperar a lista carregar.
3. Subir a versão para 9.9.1 com essas notas, para a Dra. Janaina conferir que está na versão nova.
4. Depois disso, é preciso **publicar** e ela atualizar com **Ctrl + F5**.

## Detalhes técnicos
- `NovaTarefaDialog.tsx` (~l.1298): remover sufixo `- ${c.area}`; lista única por `id` juntando `coordExtra` e `coordenacoesDisponiveis`.
- `PrazoDialog.tsx`, `EventoDialog.tsx`, `AudienciaFormSimplificado.tsx`, `NovaTarefaDialog.tsx`: em item novo, usar `useCoordenacaoPadrao()` (com fallback `unicaCoordenacaoId`) no reset e quando o valor ainda estiver vazio.
- `src/constants/version.ts`: entrada 9.9.1.
- Sem mudanças no banco.
