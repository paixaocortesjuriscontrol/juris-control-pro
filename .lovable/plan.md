# Como o Astrea pega no PJe, e o que podemos fazer igual

## Como o Astrea faz (pelo que se sabe do mercado; o funcionamento interno deles não é público)

O Astrea não "pesquisa" no site do PJe como uma pessoa faz, porque isso esbarra no captcha. Ele usa três caminhos:
1. **DJEN (o mesmo que usamos):** a lista oficial de comunicações do CNJ, consultada várias vezes ao dia. Assim pega também o que o tribunal libera mais tarde.
2. **Acesso como advogado (login do escritório):** com o certificado ou o login do advogado, o sistema entra no PJe e lê os **expedientes/intimações pendentes** do advogado. Esse acesso não tem captcha, porque passa pelo **MNI**, a porta oficial dos tribunais para sistemas.
3. **Fornecedores de recortes** (do tipo do Kurier), que leem os diários e repassam.

O link "validação" que você mandou só abre o documento quando já se sabe o código dele. Não serve para pesquisar.

## O que já temos no Juris

- DJEN Termos: uma rodada às 04:30. Perde o que sai depois, como as duas publicações de 06/10.
- Kurier: cobre essa falha.
- **MNI já existe no sistema:** certificados A1 no Cofre de Senhas e proxy com mTLS. Hoje é usado para baixar documentos e dados dos processos, mas ainda não para ler as intimações pendentes.

## Proposta

1. **Segunda rodada do DJEN Termos às 10:00**, buscando o mesmo dia (resolve o caso de hoje, em todos os tribunais).
2. **Rodar agora para 06/10**, para recuperar as publicações perdidas.
3. **Novo: "Intimações pendentes via PJe (MNI)", começando pelo TRT10.** Para cada advogado com certificado no Cofre, consultar no PJe as intimações pendentes dele e gravar na Análise DJEN com a origem "PJe". As regras de repetição e as coordenações continuam as atuais. É o mesmo caminho que sistemas como o Astrea usam.
   - Cuidado: em alguns tribunais, ler a intimação pelo MNI pode **contar como ciência** e abrir o prazo. Por isso a primeira versão só **lista** as intimações pendentes (sem abrir o teor) e é testada antes com um advogado só.

## Detalhes técnicos

- Item 1: novo horário (13:00 UTC) para `djen_paralela_servidor`; deduplicação atual por `id_djen`/`dedup_key`.
- Item 2: `enfileirar_execucao_servidor` para 06/10.
- Item 3: operação MNI `consultarAvisosPendentes` (sem `consultarTeorComunicacao` na primeira versão) através do proxy n8n já usado por `testar-mni`; endpoint MNI do TRT10; gravação em `publicacoes_djen` com `fonte='pje_mni'`, respeitando o isolamento por coordenação.
