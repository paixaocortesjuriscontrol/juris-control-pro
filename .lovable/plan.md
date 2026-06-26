## Plano corrigido: regra simples e separada

Você está certo: a regra deve ser literal e sem atalhos.

```text
Busca por PARTE     => só valida em Parte(s) / destinatários / polos.
Busca por ADVOGADO  => só valida em Advogado(s) / destinatarioadvogados / seção de advogados.
```

## O que será ajustado

### 1. Remover a confiança cega no filtro `nomeParte` da API

No DJEN Local e no DJEN Servidor, a API pode devolver uma publicação quando o nome aparece como advogado, mesmo numa busca `nomeParte`.

Então:

- `__matchedByNomeParte` não pode mais aprovar sozinho.
- Para `tipo=parte`, o motor só aceita se o nome estiver em:
  - `destinatarios[]`
  - `poloAtivo` / `poloPassivo`
  - `partes_json`
  - seção textual `Parte(s)`
- Não aceitar nome encontrado no corpo geral da publicação.
- Não aceitar nome encontrado na seção `Advogado(s)`.

### 2. Separar advogado de parte na extração visual

Para a publicação original do anexo:

- `BANCO SANTANDER` e `DIEGO BARBOSA DE LIMA` ficam em **Parte(s)**.
- `OSMAR MENDES PAIXAO CORTES` e demais nomes da seção ficam em **Advogado(s)**.

Ou seja: ela pode ser válida para busca por **advogado OSMAR**, mas não para busca por **parte OSMAR**.

### 3. Aplicar nos dois motores

Arquivos-alvo:

- `src/hooks/useDjenTermosParalelaEngine.ts` — DJEN Local/Browser.
- `monitor-servidor/engines/paralela.js` — DJEN Servidor/VPS.

A lógica será a mesma nos dois para evitar nova divergência.

### 4. Corrigir o registro já gravado errado

Para o `id_djen=652018520` / processo `0821575-51.2025.8.20.5004`:

- manter o registro válido capturado por **advogado**;
- remover ou reclassificar como descartado o registro capturado por **parte OSMAR**, porque OSMAR aparece como advogado, não como parte.

### 5. Não fazer fallback que misture conceitos

Não vou criar fallback que use `Advogado(s)` para validar `tipo=parte`.
Não vou usar texto geral para salvar publicação de parte.
Não vou usar resultado da API como prova suficiente quando o tipo for `parte`.

## Resultado esperado

- Busca por parte só encontra publicações em que o nome está nas partes.
- Busca por advogado só encontra publicações em que o nome está como advogado.
- Essa publicação do TJRN deixa de entrar no monitoramento `PARTE OSMAR` e continua entrando no monitoramento de `ADVOGADO OSMAR`.
- Browser e Servidor passam a obedecer a mesma regra objetiva.

## Observação sobre desfazer versão anterior

Se você quiser voltar exatamente para um ponto anterior do projeto, use o histórico do Lovable:

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>
