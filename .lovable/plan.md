# Por que o Kurier pegou a publicação 0000303-86.2019.5.10.0020 e o DJEN Termos não

## O que foi conferido na base (06/10/2026, horário de Brasília)

- A publicação (TRT10, disponibilizada em 06/10/2026, número DJEN 748482967) está no sistema **só pelo Kurier** (login paixaoc, gravada às 07:22). Não existe nem nas publicações nem nas descartadas do DJEN.
- **Há termos DJEN que deveriam pegá-la:** "OSMAR MENDES PAIXAO CORTES" e "CARLOS JOSE ELIAS JUNIOR" como advogado, sem condição extra, cobrindo o TRT10 (Coordenação GOL e Santander Trabalhista). Então não é falta de cadastro nem filtro errado.
- **A causa é o horário.** O DJEN Termos (motor Servidor) rodou uma única vez, das 04:30 às 04:53. O maior número DJEN que ele trouxe para 06/10 foi 748385000. Esta publicação tem número 748482967, ou seja, entrou no DJEN **depois** dessa rodada.
- O Kurier consultou depois (07:07–07:36) e por isso já a encontrou. Outras **88 publicações** do Kurier de 06/10 estão na mesma situação: liberadas pelo tribunal depois das 04:53.

Resumo: o tribunal continua soltando publicações do dia ao longo da manhã; o DJEN Termos só olha uma vez, de madrugada.

## O que fazer

1. **Agora:** rodar o DJEN Termos de novo para 06/10, para trazer esta e as outras liberadas mais tarde. Nada se repete, porque o sistema já evita duplicados.
2. **Daqui em diante:** acrescentar uma **segunda rodada automática do DJEN Termos (Servidor) pela manhã, às 10:00**, buscando de novo o dia. A rodada da madrugada continua igual.
3. **Conferência:** depois da nova rodada, comparar na tela Valida Kurier o dia 06/10 e confirmar que as "só Kurier" liberadas mais tarde caíram.

## Detalhes técnicos

- Evidência: `max(id_djen)` de `publicacoes_djen` fonte `servidor` em 06/10 = 748385000; 88 linhas `kurier` com `id_djen > 748482967`; única execução `djen_paralela_servidor` em `execucoes_servidor` às 07:30 UTC.
- Inclusão de novo horário no agendamento do `djen_paralela_servidor` (13:00 UTC), mesmo período (dia corrente), com a deduplicação existente (`dedup_key` / `id_djen`) evitando repetição e sem alterar regras de parte/advogado.
- Rodada manual imediata via enfileiramento existente (`enfileirar_execucao_servidor`) para 06/10.
