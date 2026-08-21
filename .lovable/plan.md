# Descobrir onde o DEJT está publicando os cadernos de pauta

Hoje o motor só sabe olhar um lugar: `https://diario.jt.jus.br/cadernos/` (arquivos sem data) e o índice `dejt.html`. O índice está parado em 18/08/2026, e as URLs datadas de `dejt.jt.jus.br` respondem 403 para IPs de datacenter. A função de sondagem atual (`dejt-probe-edicoes`) testa apenas 6 padrões de URL fixos, direto da Edge Function (sem proxy), então ela não consegue distinguir "não existe" de "bloqueado".

O objetivo deste plano é responder com evidência: **existe outro endereço servindo o caderno Judiciário de 19, 20 e 21/08?**

## Como descobrir (3 frentes)

### 1. Sondagem ampliada de padrões de URL
Ampliar `dejt-probe-edicoes` para varrer, por tribunal e por data:
- variações de pasta datada (`/cadernos/AAAA/MM/DD/`, `/AAAAMMDD/`, `/AAAA-MM-DD/`)
- variações de nome (`Diario_J_02.pdf`, `Diario_J_TRT2.pdf`, sufixos de data, `_1`/`_2` para edições extras)
- hosts alternativos conhecidos da JT (`diario.jt.jus.br`, `dejt.jt.jus.br`, `pje.jt.jus.br`, portais próprios de cada TRT)
- cada URL testada **duas vezes**: direto da Edge Function e via pool de proxies (`/fetch` nas VPS), para separar bloqueio de inexistência

Saída: tabela com status, content-type, tamanho, `last-modified` e se o corpo começa com `%PDF`.

### 2. Descoberta pelo próprio site (em vez de adivinhar URL)
Baixar e ler o HTML/JS das páginas de consulta do DEJT via proxy, e extrair:
- o formulário/endpoint real usado pelo "Baixar caderno" (método, parâmetros, cookies exigidos)
- todos os links `.pdf` e chamadas de API presentes na página
- o `Location` de eventuais redirects (é comum o portal redirecionar para um bucket/CDN diferente)

Isso revela o repositório atual sem tentativa e erro.

### 3. Checagem cruzada em fontes secundárias
Para cada data faltante, verificar se a mesma pauta aparece em fontes que já usamos ou que são públicas:
- DJEN/PJe Comunica (o que já entra no motor de Termos)
- portal de pautas de julgamento do TST e dos TRTs alvo

Se a pauta existe em fonte secundária, isso confirma que a publicação ocorreu e que só o repositório mudou de lugar.

## Entregável

Uma tela de diagnóstico em Administração → "Sonda DEJT", com:
- campos: tribunais, intervalo de datas, usar proxy (sim/não)
- botão Executar, barra de progresso e tabela de resultados ordenada (só PDF válido em destaque)
- botão "Copiar relatório" para registrar a evidência

Nada é gravado na base de publicações — é somente leitura/diagnóstico.

## Detalhes técnicos

- Estender `supabase/functions/dejt-probe-edicoes/index.ts`: gerador de candidatos parametrizado, execução com concorrência limitada (6 em paralelo), timeout curto por URL (8s), `HEAD` primeiro e `GET` de 1º range apenas quando `HEAD` não é conclusivo.
- Reusar o pool de proxies existente (`djen_proxy_pool` + rota `/fetch`) para as tentativas "via VPS". Onde o `/fetch` responder 404, marcar o resultado como `proxy-desatualizado` em vez de falha da fonte — hoje só a VPS Hostinger tem a rota.
- Modo "scraping do portal": buscar HTML via proxy, extrair `href`/`action`/`fetch(` com regex e devolver a lista de endpoints encontrados.
- Nova página `src/pages/SondaDejt.tsx` + rota e item de menu em Administração; sem alteração no motor `buscar-dejt-pautas` neste plano.

## Depois do diagnóstico

Com o endereço confirmado, a mudança no motor é pequena e pontual: adicionar o padrão vencedor em `buildDejtPdfUrls` (`supabase/functions/_shared/dejtTribunais.ts`) e deixar o índice `dejt.html` como fallback. Isso fica para um segundo passo, já com evidência na mão.
