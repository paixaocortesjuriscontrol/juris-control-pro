## Objetivo

Fazer o **DJEN Servidor** usar as mesmas regras do **DJEN Browser** para busca por `parte`, mantendo cada coordenação independente e permitindo que a mesma publicação apareça em coordenações diferentes.

## Diagnóstico do caso Dr. Thomás

No comparador de 22/06/2026, a diferença é:

- Coordenação Dr. Thomás, tipo `parte`
- Browser: 29
- Servidor: 21
- Diferença: 8 publicações só no Browser

As 8 publicações são do monitoramento `OSMAR MENDES PAIXAO CORTES`:

```text
645932808  TJPI  0838957-27.2023.8.18.0140
645932816  TJPI  0838957-27.2023.8.18.0140
646312966  TJES  5012683-41.2026.8.08.0012
646516555  TJES  5012342-52.2025.8.08.0011
646699403  TJMT  1001435-62.2026.8.11.0013
646699409  TJMT  1001435-62.2026.8.11.0013
646839217  TJMA  0860621-68.2023.8.10.0001
647332027  TJES  5028025-62.2022.8.08.0035
```

O Browser não depende de existir publicação em outra coordenação. Ele faz a busca do monitoramento da coordenação usando `nomeParte`, marca o resultado como `__matchedByNomeParte`, e grava usando chave com `coordenacao_id`. Assim, cada coordenação é independente.

## Diferenças reais encontradas

### 1. Fallback obrigatório para Direto no Browser

No Browser, quando `tipo='parte'` roda por uma VPS e a VPS retorna vazio sem erro, ele faz uma validação obrigatória no caminho **Direto**:

- `src/hooks/useDjenTermosParalelaEngine.ts:1321-1329`

No Servidor, `buscarTermo` só repete a mesma chamada uma vez na mesma VPS:

- `monitor-servidor/engines/paralela.js:464-473`

Essa é a diferença mais provável para as 8 ausências: o Browser recupera quando a VPS retorna vazio/intermitente; o Servidor não tem equivalente.

### 2. Paginação do Servidor para cedo demais em páginas vazias

No Browser, `buscarPjeComunicaPaginado` com `continueUntilEmpty` encerra quando vem uma página vazia:

- `src/utils/pjeComunicaClient.ts:850-861`

No Servidor, a paginação já foi alterada para exigir duas páginas vazias seguidas:

- `monitor-servidor/engines/paralela.js:413-416`

Essa diferença não explica “menos no Servidor” diretamente, mas significa que as regras não estão exatamente iguais.

### 3. Timeout do Servidor menor que o Browser

O Browser usa timeout de 90s por requisição:

- `src/utils/pjeComunicaClient.ts:438-456`

O Servidor usa `DJEN_PROXY_TIMEOUT_MS` com padrão de 60s:

- `monitor-servidor/proxyPool.js:7`

Em tribunais lentos, isso pode fazer o Servidor falhar ou voltar vazio antes do Browser.

### 4. O resgate por outra coordenação não é a regra principal do Browser

O Browser possui `buscarPublicacoesParteJaEncontradasEmOutraCoordenacao`, mas ela lê somente a própria tabela do Browser (`publicacoes_djen`) e é complementar:

- `src/hooks/useDjenTermosParalelaEngine.ts:869-918`

Não vou criar leitura do Servidor na tabela do Browser, nem qualquer leitura cruzada nova. A correção será na busca normal do Servidor, para ele não depender de outras coordenações.

## Implementação proposta

Alterar apenas o código do **DJEN Servidor** para espelhar as regras do Browser.

### Arquivo 1: `monitor-servidor/engines/paralela.js`

1. Ajustar `buscarTermo` para `tipo='parte'`:
   - continuar usando somente `nomeParte`;
   - nunca enviar `texto`/`palavraChave` junto;
   - manter `__matchedByNomeParte = true` nos itens retornados;
   - manter a repetição após vazio, como o Browser faz;
   - adicionar equivalente servidor do fallback obrigatório do Browser: se a VPS retornar vazio para `parte`, tentar outra rota do próprio pool/consulta, sem consultar tabela do Browser.

2. Deixar claro no código que a regra é:
   - coordenação independente;
   - dedup por `coordenacao_id + id_djen`;
   - a mesma publicação pode ser gravada em coordenações diferentes.

3. Não adicionar leitura em `publicacoes_djen`.

### Arquivo 2: `monitor-servidor/proxyPool.js`

1. Igualar o timeout padrão do proxy ao Browser:
   - de 60s para 90s.

## O que não será feito

- Não ler `publicacoes_djen` no Servidor.
- Não usar publicação de outra coordenação como fonte de verdade.
- Não alterar schema do banco.
- Não alterar o comparador.
- Não mudar regra de validação de `parte` além do comportamento já existente no Browser.

## Validação

Depois da alteração:

1. Rodar DJEN Servidor para `Coordenação Dr. Thomás` no dia `2026-06-22`.
2. Conferir se os 8 `id_djen` acima aparecem em `publicacoes_djen_servidor` com `coordenacao_id` da Coordenação Dr. Thomás.
3. Rodar o comparador para o mesmo dia.
4. Resultado esperado:

```text
Coordenação Dr. Thomás | parte | servidor 29 | browser 29 | só browser 0
```

