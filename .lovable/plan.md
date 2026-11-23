# Retirar Estephany Cordeiro das audiências da Coordenação Dra. Beatriz Costa

## O que encontrei
- Estephany Cordeiro é assistente de coordenação na **Coordenação Dra. Beatriz Costa**.
- Ela aparece em **451 audiências** dessa coordenação: **351 como envolvida** e **180 como responsável**. Em algumas ela tem os dois papéis.
- Nenhuma audiência fica sem pessoa nenhuma depois da retirada. Todas continuam com outro responsável ou envolvido.

## O que será feito
1. Guardar uma cópia de segurança de todas as ligações dela (envolvida e responsável), para poder desfazer.
2. Retirar a Estephany como envolvida e como responsável dessas 451 audiências, somente na Coordenação Dra. Beatriz Costa.
3. Conferir que não sobrou nenhuma ligação dela nessa coordenação e que nenhuma audiência ficou sem pessoa.

## O que não muda
- Audiências de outras coordenações.
- Tarefas, prazos e eventos.
- As regras do sistema: em audiências novas, ela pode voltar a entrar se alguém a incluir ou se houver regra de pessoas fixas. Vou conferir essa regra e avisar se ela estiver lá.

## Detalhes técnicos
- Backup em tabela própria com as linhas de `audiencia_envolvidos` e `audiencias_advogados` removidas.
- Remoção filtrada por `usuario_id`/`advogado_id = 7af108e5-…` e por audiências com `coordenacao_id = d997ca10-…`.
- Conferir `responsaveis_fixos_tipo_tarefa` da coordenação para audiência.
