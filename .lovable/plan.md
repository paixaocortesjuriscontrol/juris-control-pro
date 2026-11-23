# Retirar Estephany Cordeiro dos envolvidos das audiências da Coordenação Dra. Beatriz Costa

## O que encontrei
- Estephany Cordeiro é assistente de coordenação na **Coordenação Dra. Beatriz Costa**.
- Ela está como **envolvida** em **351 audiências** dessa coordenação (117 ainda vão acontecer).
- Em 80 delas ela também é **responsável**. Isso não muda: ela sai só da lista de envolvidos.
- Nenhuma audiência fica sem pessoa nenhuma depois da retirada.

## O que será feito
1. Guardar uma cópia de segurança das 351 ligações, para poder desfazer.
2. Retirar a Estephany como envolvida dessas 351 audiências, somente na Coordenação Dra. Beatriz Costa.
3. Conferir que sobraram 0 ligações dela como envolvida nessa coordenação e que as outras coordenações e os responsáveis não mudaram.

## O que não muda
- Audiências de outras coordenações.
- Os casos em que ela é responsável.
- Tarefas, prazos e eventos.
- As regras do sistema: em audiências novas, ela pode voltar a entrar se alguém a incluir ou se houver regra de pessoas fixas.

## Detalhes técnicos
- Backup em tabela `backup_envolvidos_estephany_20261123` (audiencia_id, usuario_id, created_at).
- Remoção em `audiencia_envolvidos` com filtro `usuario_id = 7af108e5-…` e `audiencia_id` das `audiencias_detectadas` com `coordenacao_id = d997ca10-…`.
- Antes, conferir se `responsaveis_fixos_tipo_tarefa` da coordenação inclui ela como envolvida em audiência e avisar se incluir.
