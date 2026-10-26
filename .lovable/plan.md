# Por que o DJEN Servidor não achou a publicação do TRT24 (Bradesco / Dr. Osmar)

## O que já foi conferido
A Coordenação Dr. Thomás tem três termos que deveriam pegar a publicação 0024421-89.2025.5.24.0000 (TRT24, 23/10/2026). Os três incluem o TRT24:

| Termo | Como busca | Condição extra |
|---|---|---|
| DR. OSMAR + BRADESCO + TRABALHISTAS | advogado "OSMAR MENDES PAIXAO CORTES" (OAB 15553; OR 310314) | BRADESCO |
| Bradesco - Thomás | palavra-chave "BRADESCO" | OSMAR MENDES |
| PARTE - Bradesco - Thomás | parte "BRADESCO" (OR "OSMAR MENDES") | OSMAR MENDES |

- Em 23/10, o DJEN Servidor rodou às 04h30, 10h00 e 17h00 (Brasília), sem erro registrado.
- Os três termos acharam publicações de outros TRTs nesse dia, mas **nenhuma do TRT24**, nem mesmo entre as descartadas.
- Com o texto dessa publicação, as regras de validação do motor aprovariam a publicação nos três termos: Bradesco nas partes, Dr. Osmar entre os advogados.

**Conclusão provisória:** a publicação não foi descartada pelo filtro. Ela **nunca chegou ao motor**, porque a consulta ao DJEN do TRT24 não a trouxe. A causa exata ainda não está confirmada.

Hipóteses:
1. A busca por nome ("OSMAR MENDES PAIXAO CORTES" ou "BRADESCO") no TRT24 não retorna essa publicação, mas a busca por OAB retorna. O Kurier busca por OAB, e o motor só tenta a OAB em casos raros, como já identificado antes.
2. A consulta ao TRT24 terminou cedo. Em 23/10, o DJEN respondeu "muitas requisições" (429) mais de 750 vezes em cada rodada.
3. A publicação foi disponibilizada depois das 17h00, e a última rodada não a pegou.

## O que será feito
1. **Confirmar a causa:** consultar o DJEN do TRT24 de 23/10 pela VPS das quatro formas: nome do advogado, OAB 15553/DF, parte "BRADESCO" e texto "BRADESCO". Depois, ver qual delas traz a publicação 765892809 e conferir o horário de disponibilização.
2. **Corrigir conforme o resultado:**
   - Se só a busca por OAB trouxer a publicação: nos termos de advogado, buscar sempre também pela OAB principal e pelas OABs do OR, inclusive com "Todas as regiões". A UF vem da inscrição, por exemplo DF para 15553.
   - Se a consulta terminou cedo por excesso de 429: ao fim da rodada, repetir só os tribunais e termos afetados, e registrar a falha em vez de dar a rodada como concluída.
   - Se a publicação chegou tarde: nenhuma mudança no motor; ela entra na rodada seguinte.
3. **Recuperar a publicação:** reprocessar 23/10 no TRT24 para a Coordenação Dr. Thomás. Ela vai aparecer na Análise DJEN, sem duplicar a que veio do Kurier.

## Detalhes técnicos
- Motor: `monitor-servidor/engines/paralela.js`. Funções envolvidas: `baseParams` (advogado busca só por `nomeAdvogado`), `buscarTermo` (fallback `numeroOab` só com UF específica e resultado vazio; OR com mesmo nome é ignorado) e `buscarPaginado` (janela de 50, 4 tentativas por página em 429).
- Validação (`contemTermo`, `condicaoConcomitanteAtendida`): aprova o caso; não precisa de mudança.
- Nenhuma alteração de banco nem de cadastro dos termos.
