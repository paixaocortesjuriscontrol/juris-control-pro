---
name: DJEN Paralela parte sem palavra-chave
description: DJEN Termos Paralelo must never search parte terms by palavra-chave or fallback text
type: constraint
---
No `useDjenTermosParalelaEngine.ts`, monitoramentos com `tipo === 'parte'` devem buscar exclusivamente via `nomeParte` na API PJE Comunica.

Regras obrigatórias:
- Nunca enviar `palavraChave` para termo do tipo `parte`.
- Nunca criar fallback de `parte` para palavra-chave/texto.
- Nunca aplicar retry alternativo que transforme parte em outro tipo de busca.
- Resultados vindos de `nomeParte` podem ser marcados com `__matchedByNomeParte` para evitar descarte quando o TST não retorna metadados completos.

Motivo: esse comportamento já foi corrigido anteriormente; voltar para palavra-chave em termos por parte gera capturas erradas, 429 e perda de publicações.