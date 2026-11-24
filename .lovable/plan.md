# Publicações do processo na Distribuição TST

## O que muda
- No painel lateral direito da Distribuição TST, entra a aba **Publicações (N)**, ao lado de "Distribuição TST". O número aparece só quando houver publicações.
- Na ficha completa, entra a aba **Publicações (N)**, ao lado de "Anexos".
- A aba lista as publicações do DJEN encontradas para o número do processo, da mais nova para a mais antiga. Cada uma mostra:
  - a data de disponibilização e a de publicação;
  - o tribunal e o tipo;
  - o começo do texto, com a opção de abrir o texto inteiro.
- A cópia de um mesmo aviso que chegou por mais de um login aparece uma vez só.
- Sem publicação, a aba mostra "Nenhuma publicação encontrada para este processo".
- A aba só lê as publicações: não marca como lida nem cria atividades, e não muda permissões.

## Detalhes técnicos
- Novo componente `PublicacoesProcessoTst` em `src/components/distribuicao-tst/`, usado em `ProcessoOverlaySheet.tsx` e `DistribuicaoTstDetail.tsx`.
- Consulta `publicacoes_djen` por `dedup_processo_digits`, só com os dígitos do número, e soma as do processo ligado em `publicacoes_djen_processos`, sem repetir.
- Usa `useQuery` com chave por número. A consulta roda ao abrir a ficha ou o painel, para que o total apareça na aba.
- Para não repetir cópias, usa a mesma chave de conteúdo que a Análise DJEN já usa.
- O acesso segue as permissões que já existem no banco. Não há mudança no banco.
