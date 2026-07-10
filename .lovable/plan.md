## Lista de OABs do Dr. Osmar Mendes Paixão Côrtes cadastradas no sistema

10 OABs distintas encontradas (fonte: `monitoramentos_djen.termos_or`, principalmente nos monitoramentos "Santander Cível - Dr. Osmar" e "OAB TODAS DR. OSMAR + SMILES + WEBJET"):

| OAB | UF | Como aparece no sistema |
|---|---|---|
| 15553 | DF | OAB principal — usada com `uf=TODAS` em todos os monitoramentos trabalhistas/TST/DJEN |
| 310314 | SP (provável) | Bradesco, Montreal, Super Quadra, Base, New York, Villaggio, Parque Planalto, Serviço de Apoio, TJSP |
| 27284 | GO (confirmado) | Mapeamento Kurier traz explicitamente "27284 GO", "OAB27284.GO" |
| 22731-A | Suplementar (UF não gravada) | Santander Cível |
| 41196-A | Suplementar (UF não gravada) | Santander Cível |
| 87961 | Não gravada no banco | Santander Cível |
| 21572 | Não gravada no banco | Santander Cível |
| 75879 | Não gravada no banco | Santander Cível |
| 164494 | Não gravada no banco | Santander Cível |
| 184565 | Não gravada no banco | Santander Cível |

## Observação

O sistema não tem uma tabela mestre de advogados/inscrições — as OABs vivem soltas dentro do array `termos_or` de cada monitoramento, sem UF associada por OAB. Para 5 delas (87961, 21572, 75879, 164494, 184565) não consigo determinar a UF pelo banco.

## Próximo passo sugerido (aguardando sua decisão)

Se quiser, posso:
1. **Só entregar essa lista** — não mexer em nada. (É o que você pediu.)
2. **Confirmar as UFs faltantes com você** e gravar cada OAB com sua UF explícita nos monitoramentos (formato `NÚMERO/UF/NOME` no `termos_or`), para eliminar essa ambiguidade.
3. **Criar uma tabela `advogados_oabs`** (id, oab, uf, nome, ativo) como cadastro mestre, e passar os monitoramentos a referenciar essa lista em vez de repetir OABs em cada `termos_or`.

Como este pedido é só informativo, a opção 1 encerra o assunto. Me diga se quer avançar para 2 ou 3.
