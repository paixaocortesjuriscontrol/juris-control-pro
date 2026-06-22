## Diagnóstico atual

Pelo comparador anexado:

- Dr. Thomás / `parte`: Servidor 21, Browser 23
- Em comum: 17
- Só Browser: 6
- Só Servidor: 4

Consulta no banco mostrou que as 6 publicações “só Browser” da coordenação Dr. Thomás já existem no `publicacoes_djen_servidor`, mas gravadas na Coordenação Santander Cível:

```text
645932816  TJPI  0838957-27.2023.8.18.0140
646312966  TJES  5012683-41.2026.8.08.0012
646516555  TJES  5012342-52.2025.8.08.0011
646699403  TJMT  1001435-62.2026.8.11.0013
646839217  TJMA  0860621-68.2023.8.10.0001
647332027  TJES  5028025-62.2022.8.08.0035
```

Ou seja: a busca do Servidor encontrou as publicações, mas a regra de “resgate de parte encontrada em outra coordenação” não está trazendo para Dr. Thomás como o Browser faz.

## Causa provável

No Browser, o resgate lê `publicacoes_djen`, onde o conteúdo é salvo no formato DJEN-like/enriquecido, incluindo seção `Parte(s)` e metadados. A validação `validarParteMetadados` / `validarParteSecaoPartes` consegue confirmar a parte.

No Servidor, o resgate lê `publicacoes_djen_servidor`, mas o conteúdo salvo é o texto bruto da API. Para essas 6, o termo OSMAR aparece como advogado no corpo, enquanto a parte estruturada é Santander. Como o resgate exige casar em partes estruturadas ou seção `Parte(s)`, ele descarta essas publicações ao tentar copiar para Dr. Thomás.

## Plano de correção

Alterar somente `monitor-servidor/engines/paralela.js`.

1. Manter a busca normal por `parte` exatamente como está:
   - usar só `nomeParte`;
   - não enviar `palavraChave`;
   - manter retry/fallback por VPS já implementado.

2. Corrigir apenas o resgate entre coordenações do Servidor para espelhar o Browser no contexto do Servidor:
   - quando uma publicação já encontrada em outra coordenação tiver o mesmo `id_djen`/tribunal/dia e o termo constar no conteúdo, marcar como `__matchedByNomeParte` e permitir gravar também na coordenação atual;
   - não depender da validação por `partes_json`, porque no Servidor a publicação pode ter sido salva a partir de monitoramento `advogado`, e as partes estruturadas não contêm o advogado buscado;
   - manter a chave com `coordenacao_id + id_djen`, permitindo a mesma publicação em coordenações diferentes.

3. Remover/ajustar comentários que dizem que o resgate precisa validar somente seção `Parte(s)` no Servidor, pois isso é justamente o que impede a paridade neste caso.

4. Não fazer:
   - nenhuma leitura em tabela do Browser;
   - nenhuma migração/schema;
   - nenhuma alteração no comparador;
   - nenhuma alteração no frontend.

## Validação após aplicar

1. Executar novamente DJEN Servidor para Coordenação Dr. Thomás em 2026-06-22.
2. Conferir se os 6 `id_djen` acima aparecem também em `publicacoes_djen_servidor` com `coordenacao_id` de Dr. Thomás.
3. Rodar o comparador novamente.
4. Esperado para `parte`: reduzir “só Browser” de 6 para 0 ou próximo disso, mantendo independência por coordenação.