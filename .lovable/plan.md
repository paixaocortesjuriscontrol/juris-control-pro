Você está certo: no primeiro quadro do comparador a comparação deveria ser independente do tipo de termo. Pelo código atual, a chave principal já usa `coordenação + id_djen`, mas há dois pontos que deixam a leitura ambígua e podem gerar confusão:

1. O quadro principal ainda distribui os totais em buckets por tipo depois da comparação, então o texto “por tipo” aparece misturado com uma comparação que, na prática, deveria ser global por `id_djen`.
2. O CSV de exclusivas ainda não mostra dados suficientes para auditar rapidamente cada divergência.

Conferi a Coordenação Dr. Thomás em 23/06/2026 diretamente no banco, usando apenas `coordenação + id_djen`:

```text
Servidor: 47 id_djen únicos
Browser: 59 id_djen únicos
Em ambos: 43
Só servidor: 4
Só browser: 16
```

Ou seja: a diferença no primeiro quadro é real mesmo sem separar por tipo. Não é só efeito de classificação por `parte`, `palavra-chave` ou `advogado`.

Plano de ajuste:

1. Separar visualmente o comparador em duas leituras:
   - “Comparação global por publicação” usando somente `coordenação + id_djen` como chave quando houver `id_djen`.
   - “Quebra por tipo de monitoramento” apenas como diagnóstico secundário, sem sugerir que o primeiro total depende do tipo.

2. Renomear textos da UI para deixar explícito:
   - “Total Servidor”, “Total Browser”, “Em ambos”, “Só Servidor”, “Só Browser” = comparação global por publicação DJEN.
   - Tipo de pesquisa = apenas origem do monitoramento que capturou aquela publicação.

3. Ajustar o CSV para incluir, nas publicações exclusivas:
   - `id_djen`
   - `monitoramento_id`
   - `termo_busca`
   - `tipo_pesquisa`
   - `coordenação`
   - `tribunal`
   - `processo`
   - `data_publicacao/data_disponibilizacao`
   - `origem` (`so_servidor` ou `so_browser`)

4. Opcionalmente adicionar uma tabela curta na tela com “Publicações exclusivas por origem”, para que você não precise abrir o CSV toda vez.

5. Não mexer agora nas regras de busca/validação nem no reaproveitamento. Primeiro vamos deixar o comparador auditável e fiel ao que ele realmente está contando por `id_djen`; depois, se as 16 do Browser e as 4 do Servidor continuarem divergindo, investigamos cada `id_djen` com evidência concreta.