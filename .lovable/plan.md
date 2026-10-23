# OR do motor DJEN Servidor: as OABs nunca são buscadas

## O que encontrei no motor (termo "DR. OSMAR + BRADESCO + TRABALHISTAS")

O cadastro está certo: OAB 15553, nome OSMAR MENDES PAIXAO CORTES, regiões "Todas" e OR `310314/OSMAR MENDES PAIXAO CORTES`. Mas o motor faz só **uma busca**:

1. **Busca principal:** só pelo nome do advogado.
2. **OAB 15553:** só é buscada se a busca pelo nome vier vazia **e** a região for uma UF específica. Como está "Todas as regiões", a busca pela OAB nunca acontece.
3. **OR 310314:** o motor pula a alternativa quando o nome dela é igual ao nome principal. Aqui é o mesmo nome, então a 310314 também nunca é buscada.

Resultado: o OR não tem efeito nenhum nesse termo, e o mesmo acontece nos outros 14 termos com o mesmo padrão (Dr. Thomás, Santander Cível, Dra. Beatriz Costa). Se a busca pelo nome no TRT24 não trouxe a publicação 765892809, não houve segunda tentativa. O Kurier pega porque busca pela OAB.

## Correção (só no motor, sem mexer nos cadastros)

1. Sempre buscar também pela OAB principal e pelas OABs do OR, além do nome, e juntar tudo sem repetir publicação.
2. Não pular a alternativa do OR só porque o nome é igual: se ela tiver OAB, buscar pela OAB.
3. Com "Todas as regiões", a API exige a UF da OAB. Usar a UF que o próprio DJEN informa para essa OAB nas publicações do advogado. Se não houver, tentar as UFs dos tribunais do termo, com limite de chamadas.
4. A validação continua igual: advogado só em advogados, e o "BRADESCO" obrigatório continua valendo.

## Validação

- Rodar de novo TRT24 em 23/10 para esse termo e confirmar que a 765892809 entra na Coordenação Dr. Thomás.
- Comparar o número de chamadas por rodada antes e depois. As buscas extras aumentam o uso da API e o risco de bloqueio (403).

## Detalhes técnicos

- `monitor-servidor/engines/paralela.js` `buscarTermo`: remover a condição `prevItems.length > 0` do `tentarFallbackOab` (vira busca complementar mesclada por `mesclarItensPorId`); trocar o `continue` de nome igual por "buscar só por OAB"; resolver a UF quando `uf = TODAS` via `numero_oab/uf_oab` dos `destinatarioadvogados` da busca por nome, com reserva nas UFs dos tribunais (teto configurável).
- O daemon da VPS Hostinger precisa puxar a alteração e ser reiniciado.
