# Marcar matérias fora da lista oficial no seletor

## Objetivo
No seletor de matérias (Reclamante/Banco) da Distribuição TST, exibir o sufixo **"(fora lista do Benner)"** ao lado das matérias que existem no dicionário (`materias_benner`) mas **não** constam na lista oficial do Santander (`materias_pedidos_oficiais`) — ex.: "Deserção Recursal".

## Mudanças

**`src/components/distribuicao-tst/MateriasMultiSelect.tsx`**
1. Importar `ensureMateriasOficiais`, `materiasOficiaisCarregadas` e `isMateriaOficialSync` de `@/utils/materiasOficiaisCache`.
2. Em um `useEffect`, chamar `ensureMateriasOficiais()` e forçar re-render quando o cache terminar de carregar (state local `oficiaisProntas`), garantindo que a marcação apareça mesmo se o popover abrir antes do fetch.
3. Na listagem do popover, para cada matéria `m` tal que `!isOutraMateria(m.nome)` e `!isMateriaOficialSync(m.nome)`, renderizar ao lado do nome um texto discreto em vermelho/âmbar: `(fora lista do Benner)` — sem impedir a seleção.
4. Nos badges das matérias já selecionadas, aplicar o mesmo sufixo quando a matéria não for oficial, para que o usuário veja o aviso mesmo com o popover fechado.

## Observações
- Nenhuma mudança de validação: a matéria continua selecionável; a pendência/rejeição existente permanece como está.
- "Outra Matéria" nunca recebe o sufixo (é neutra por regra).
- A verificação usa a mesma normalização e o mesmo cache da crítica de pendências, então a marcação na tela será 100% consistente com o que a geração da planilha rejeitaria.
