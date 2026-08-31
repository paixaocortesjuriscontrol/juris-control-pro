# Análise DJEN: divergência de 4 processos no Diário de 28/08

## O que a apuração mostrou

A base está completa — o que divergiu foi a **data usada no filtro da tela**.

O DJEN traz dois campos: **disponibilização** (dia em que o ato saiu no Diário, 28/08 = sexta) e **publicação** (dia útil seguinte, 31/08 = segunda, conforme a regra legal). A leitura manual da Dra. Priscila usa o Diário de 28/08 (disponibilização); a tela, quando filtrada por "Data de publicação = 28/08", devolve na verdade o Diário de **27/08**, e joga o material do dia 28 para o filtro de 31/08.

Números conferidos na coordenação Dra. Renata com termos do João:

- Pauta de Julgamento com **disponibilização em 28/08**: **41 processos** — exatamente os 41 processos do arquivo enviado.
- Mesmo recorte por **data de publicação = 28/08**: 58 processos (é o Diário de 27/08).

Os 5 processos citados:

| Processo | Disponibilização | Publicação no sistema | Situação |
|---|---|---|---|
| AIRR 0000349-15.2022.5.05.0342 | 28/08 | 31/08 | ficou fora do recorte de 28/08 |
| AIRR 0001082-22.2018.5.17.0007 | 28/08 | 31/08 | ficou fora do recorte de 28/08 |
| AIRR 0001066-97.2020.5.17.0007 | 28/08 | 31/08 | ficou fora do recorte de 28/08 |
| RRAg 10363-29.2022.5.15.0003 | 28/08 | 31/08 | ficou fora do recorte de 28/08 |
| RRAg 0185600-59.2008.5.02.0026 | 27/08 | 28/08 | está na base, mas caiu no arquivo **Temas IRR** (sobrestamento por IRR nº 29), não na Pauta/Intimações |

São **os 4 processos da diferença** relatada. Nenhuma publicação foi perdida na captura, e o conteúdo integral (com a conclusão/decisão) está gravado em todos eles.

### Conferência dos dois arquivos (feita agora)

Comparando o arquivo manual `PAUTA_28.08.26.docx` com o gerado pelo sistema usando **disponibilização = 28/08** (`JURISCONTROL_PAUTA_31.08.26.docx`):

- Manual: **41 processos**.
- Sistema: **41 processos**.
- Faltando no sistema: **nenhum**. Sobrando no sistema: **nenhum**. Os conjuntos são idênticos, processo a processo.

Conclusão: com o filtro de disponibilização, o arquivo do sistema bate 100% com a leitura manual. A divergência anterior era só do campo de data usado no filtro.


## O que será feito

1. **Deixar a data do Diário explícita e ser o padrão**
   - No cabeçalho de filtros da Análise DJEN, rotular claramente os dois campos: "Data de disponibilização (dia do Diário)" e "Data de publicação (dia útil seguinte)".
   - Ao usar "Data de publicação", exibir um aviso na tela informando qual Diário aquele recorte representa e sugerindo o filtro por disponibilização para conferência de Diário.

2. **Docs TST identificado pelo Diário correto**
   - Nomear os arquivos e o cabeçalho interno pela **data do Diário do recorte** (disponibilização), não pela data de hoje — hoje os arquivos saem como `JURISCONTROL_PAUTA_31.08.26` mesmo quando o conteúdo é do Diário de 28/08.
   - No cabeçalho de cada documento, imprimir o recorte usado: campo de data, período e coordenação.

3. **Rodapé de conferência por categoria**
   - Ao final de cada .docx, listar os números de processo incluídos (em ordem), permitindo conferência 1:1 com a leitura manual sem abrir o arquivo inteiro.
   - No resumo pós-geração, mostrar a contagem por categoria e a data de Diário considerada.

4. **Evitar a leitura de "sem conclusão"**
   - Nos documentos gerados em modo resumo (Prazos Gerais e Lista de Distribuição), garantir que o trecho final inclua o dispositivo/decisão ("determino", "nego seguimento", "sobrestamento" etc.) e não apenas as últimas linhas de assinatura/intimados.
   - Sinalizar no documento quando a publicação foi classificada em outra categoria por regra (ex.: Temas IRR), para o caso do RRAg 0185600-59.2008.

## Detalhes técnicos

- `src/pages/AnaliseDjen.tsx`: rótulos e aviso dos filtros de data; em `handleGerarDocsTST`, derivar `dataStr` do filtro de disponibilização/publicação em vigor (fallback para hoje), acrescentar bloco de recorte no cabeçalho e a lista de processos no rodapé de cada categoria.
- `extractResumoSemIA`: priorizar a janela a partir do último marcador de dispositivo antes de cortar os parágrafos finais.
- Regras de classificação em `src/lib/classificarPublicacaoTst.ts` permanecem inalteradas (validadas: 41/41 na coordenação, nenhum item de pauta descartado pelo filtro de acórdão).
- Nenhuma alteração de banco, Edge Function ou de motor de captura.

## Sobre nova varredura

Não é necessário recapturar 28/08: as publicações estão gravadas. Basta regerar os Docs TST filtrando por **disponibilização 28/08** para obter o arquivo idêntico à leitura manual.
