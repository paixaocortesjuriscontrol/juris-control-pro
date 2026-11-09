# Visão "Escritório" configurável por coordenação

## O que muda para o usuário
- Na gestão de cada coordenação (menu Coordenação) aparece uma nova opção: **"Membros veem as atividades de todos no Escritório"** (ligada ou desligada).
- **Ligada** (padrão, igual a hoje): todos os membros veem os prazos, tarefas, eventos e audiências de toda a coordenação no Escritório.
- **Desligada**: no Escritório, advogados, assistentes e estagiários dessa coordenação veem só os itens em que são **responsáveis ou envolvidos**.
- Coordenadores, assistentes de coordenação, administradores e o assistente jurídico geral continuam vendo tudo, seja qual for a opção.
- Só administradores, coordenadores e assistentes de coordenação daquela coordenação podem mudar a opção.

## Como funciona
1. Nova opção na coordenação, ligada por padrão, para nada mudar até alguém desligar.
2. Novo cartão "Visão Escritório" na página de gestão da coordenação, no mesmo estilo dos outros, com chave liga/desliga. Ao salvar, o sistema confere se a mudança foi gravada.
3. No Painel, modo Escritório: as coordenações com a opção desligada são lidas pela visão pessoal do usuário (só os itens em que ele é responsável ou envolvido). As demais continuam como hoje. Os contadores dos cartões seguem o mesmo filtro.
4. Teste novo: com a opção desligada, um membro comum não vê os itens dos outros, e o coordenador continua vendo tudo.

## Limite
- A regra vale para a tela **Escritório do Painel**. Ela não esconde os itens no banco: o item ainda abre pela ficha do processo, se a pessoa tiver acesso ao processo. Para bloquear também lá, seria preciso mudar as regras de acesso do banco, o que pode afetar outras telas.

## Detalhes técnicos
- Migração: `coordenacoes.escritorio_visao_completa boolean not null default true`. A gravação segue as regras de acesso atuais de `coordenacoes`.
- `escopoEscritorio.ts`: separar coordenações "completas" (`get_agenda_escritorio`) e "restritas" (`get_agenda_pessoal` + filtro `papelDoUsuario`), mesclando por ID, sem RPC nova. Isenção pelo cargo em `membros_coordenacao` (coordenador/assistente_coordenador) e por `podeVerTodasCoordenacoes`/admin.
- Na fase de carregamento, `get_painel_totais` só para as coordenações completas, para não mostrar contagem maior que a lista.
- Atualizar o teste `escopoEscritorio.test.ts` e registrar a regra em `AGENTS.md`.
