## Objetivo
Aplicar no `monitor-servidor/engines/paralela.js` as 4 regras que você descreveu, **eliminando todos os caminhos de fallback** (mesmo os já desligados por flag) que ainda existem no código e poderiam — por engano de variável de ambiente ou por manutenção futura — fazer o Servidor divergir do Browser.

## As 4 regras (fixas no código, sem flag)

1. **Isolamento por coordenação**  
   - Toda dedup/lookup usa `coordenacao_id` na cláusula. Uma publicação pode existir em N coordenações; cada uma é independente.  
   - Remover qualquer query que cruze coordenações.

2. **Termo `parte` → só nas partes**  
   - Busca somente via `nomeParte` na API.  
   - Validação apenas em `validarParteMetadados` + `validarParteSecaoPartes` (já é o que o browser faz).  
   - **Nada de fallback** para `nomeAdvogado`, varredura `buscarTribunalDiaCompleto`, ou resgate por corpus do servidor.

3. **Termo `advogado` → só nos advogados**  
   - Busca via `numeroOab/ufOab/nomeAdvogado`.  
   - Validação: metadados `advogados/destinatarioadvogados` (nome exato OU OAB).  
   - Remover o fallback que aceitava o nome no corpo da publicação (`contemFrase(textoNorm, nomeNorm)`).

4. **Termo `palavra-chave` → só no conteúdo**  
   - Validação só no campo `conteudo/teor/texto` da publicação (sem concatenar nomes de advogados/destinatários).  
   - Suporte a `+` (AND) e `termos_or` mantidos, mas apenas dentro do `conteudo`.

## Mudanças em `monitor-servidor/engines/paralela.js`

### A. Apagar código de fallback (não vira flag, some do arquivo)
- Remover `ENABLE_PARTE_ADVOGADO_FALLBACK` e todo o bloco em `buscarTermo` que faz `paramsAdvogado`, `buscarTribunalDiaCompleto` e marca `__matchedByParteAdvogadoFallback`.
- Remover `ENABLE_PARTE_RESCUE_CORPUS`, a função `buscarPublicacoesParteServidorJaEncontradas` e a chamada em `buscarTermo`.
- Remover `buscarTribunalDiaCompleto`, `textoCompletoContemTermoParte`, `partePareceAdvogado` (sem uso após o item acima).
- Remover o ramo `__matchedByParteAdvogadoFallback` dentro de `contemTermo`.
- Remover o retry em VPS alternativa (`fallbackSlots.find(...)`) para `parte` — o browser homologado faz só 1 retry na MESMA VPS após 1,5s, e é isso que vamos manter.

### B. Tornar `advogado` estrito a metadados
Em `contemTermo`, ramo `tipo === "advogado"`:
- Remover: `if (nomeNorm && contemFrase(textoNorm, nomeNorm)) return true;`
- Remover: `if (od.length >= 3 && textoNorm.includes(od)) return true;`
- Remover as variantes equivalentes dentro do loop `termos_or`.
- Manter só `validarAdvogadoMetadados(pub, oab/oabDigits, nome)`.

### C. Tornar `palavra-chave` estrito ao conteúdo
- Criar helper `getConteudoPuro(pub)` que retorna apenas `obj.conteudo || obj.teor || obj.texto` (sem nomes de advogados/destinatários).
- No ramo `palavra-chave` (e `nome`) de `contemTermo`, trocar `buildTextoCompleto(pub, conteudo)` por `getConteudoPuro(pub)`.
- `condicaoConcomitanteAtendida` e `shouldExclude` para `palavra-chave/advogado` também passam a usar `getConteudoPuro` (parte continua usando partes estruturadas).

### D. Reforçar isolamento por coordenação na persistência
- Confirmar que `persistPublicacoes` nunca consulta sem `coordenacao_id` (já é o caso para `id_djen`).
- Quando não há `coordenacao_id` no monitoramento, logar `paralela.sem_coordenacao` e **não inserir** (evita poluição cruzada). Esses monitoramentos devem ser corrigidos pelo usuário, não silenciosamente misturados.

### E. Bump de versão e log
- `ENGINE_VERSION = "2026-06-25-regras-simples"`.
- Log inicial enumera as 4 regras aplicadas, facilitando confirmar no `pm2 logs` que a VPS está rodando a nova versão.

## O que NÃO muda
- Paginação, delays, checkpoint, banimento de unidade, pool de VPS, retry de 1,5s na mesma VPS — tudo idêntico ao que o Browser faz hoje.
- Schema do banco, edge functions, UI — nenhum arquivo fora de `monitor-servidor/engines/paralela.js` é tocado.

## Deploy
Após merge, na VPS Hostinger:
```
cd ~/monitor-servidor && git pull && pm2 restart jc-monitor-servidor
pm2 logs jc-monitor-servidor --lines 50 | grep paralela.start
```
Confirmar que aparece `engineVersion: "2026-06-25-regras-simples"`.

## Por que isso resolve o "varia por coordenação"
Hoje as únicas diferenças entre Servidor e Browser que sobreviveram são:
- Variáveis de ambiente que reativam fallbacks por engano numa coordenação e não em outra.
- Dois retries de VPS extras no `parte` que aumentam o recall do Servidor versus o Browser num tribunal/dia onde a primeira VPS devolveu vazio.
- Validação de `advogado` no corpo do texto que aceita publicações sem o advogado nos metadados.

Eliminando esses três pontos, a tupla `(tribunal, dia, termo, coordenação)` vai produzir o mesmo conjunto de publicações em qualquer ambiente.
