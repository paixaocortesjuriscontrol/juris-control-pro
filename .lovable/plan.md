Plano ajustado:

1. Remover qualquer busca por pedaço do termo
- Não criar busca por palavra isolada como `SEU`, `ZÉ`, `QUIMICA` ou similares.
- Para `palavra-chave`, enviar sempre a expressão inteira configurada: exemplo `SEU ZÉ`, `UNIÃO QUÍMICA`.
- Manter apenas variações equivalentes do termo inteiro, como com e sem acento: `UNIÃO QUÍMICA` e `UNIAO QUIMICA`.

2. Corrigir o motor DJEN Paralela
- No `useDjenTermosParalelaEngine.ts`, remover o comportamento que, em termos com `+`, escolhe apenas a maior parte do termo para pesquisar.
- Para `palavra-chave`, buscar pelo termo completo; para termos com `+`, cada segmento deve ser tratado como condição AND na validação, mas a chamada inicial não deve virar busca por pedaço solto.

3. Preservar a validação correta
- A validação local continuará exigindo a frase exata na ordem, com fronteira de palavra.
- Assim, `SEU ZÉ` casa com `SEU ZÉ MANÉ`.
- Mas `SEU ZÉ` não casa com apenas `SEU`, apenas `ZÉ`, nem com palavras fora da ordem.

4. Alinhar os demais fluxos DJEN que também montam busca por palavra-chave
- Conferir `useBuscaDjenDireta.ts`, `useSincronizarDjenBrowser.ts` e `useWorkerDjenVps.ts` para garantir que eles só enviem o termo inteiro e suas variações integrais, nunca tokens isolados.

5. Atualizar a memória/regra do projeto
- Registrar que busca por palavra-chave DJEN nunca deve fatiar o termo em palavras individuais; só pode usar a frase inteira e variações integrais normalizadas.

6. Validação final
- Verificar no código que `UNIÃO QUÍMICA` é enviado como expressão completa.
- Confirmar que a regra de match aceita `UNIÃO QUÍMICA FARMACÊUTICA` por conter a frase completa no início.