# "Outra Matéria" entra na lista oficial e sai em branco na planilha

## Regra nova

1. **Banco de dados**: "Outra Matéria" passa a constar na lista oficial de pedidos (`materias_pedidos_oficiais`, ativa).
2. **Pendência**: processo que tem "Outra Matéria" entre as matérias selecionadas nunca gera a pendência "Matérias fora da lista oficial de pedidos", mesmo que todas as outras matérias estejam fora da lista. Continua valendo:
   - os sub-itens (Aparelhamento, Chance Turma, Chance Relator, Êxito) de "Outra Matéria" não são cobrados;
   - o aviso amarelo continua listando as outras matérias realmente fora da lista.
3. **Carga Benner**: o processo é exportado (não é mais rejeitado por causa de "Outra Matéria"). Na planilha, a linha correspondente a "Outra Matéria" vai com o **nome da matéria em branco** — o texto "Outra Matéria" nunca aparece na planilha. As demais matérias válidas continuam saindo normalmente.
4. Processo cuja única matéria válida seja "Outra Matéria" deixa de ser rejeitado e deixa de ficar pendente.

O bloqueio/rejeição de matérias realmente fora da lista oficial (que não sejam "Outra Matéria") continua exatamente como hoje.

## Detalhes técnicos

- Dados: inserir a linha `Outra Matéria` (ativo = true) em `materias_pedidos_oficiais`, se ainda não existir.
- `src/utils/materiasOficiaisCache.ts`: remover o curto-circuito `if (isOutraMateria(nome)) return false;` de `isMateriaOficialSync` — a matéria passa a ser resolvida pela lista carregada do banco.
- `src/utils/distribuicaoTstPendencias.ts`: com a mudança acima, `getMateriasForaDaLista` já conta "Outra Matéria" como válida, então a pendência `materias_fora_lista_oficial` não dispara. Manter o `continue` de `isOutraMateria` em `pendenciasMateriasAnalise` (sem cobrança de sub-itens).
- `src/components/distribuicao-tst/CargaBennerFromDb.tsx` (~linha 668): parar de tratar `isOutraMateria` como fora da lista; a matéria é mantida no conjunto exportável, mas com o nome substituído por string vazia ao montar a linha da planilha.
- `src/utils/gerarPlanilhaBenner.ts` (~linha 217): remover o filtro `!isOutraMateria(i.materia)` e aplicar a mesma substituição do nome por vazio.
- `src/pages/DistribuicaoTst.tsx`: checagem `processosComMateriaForaDaLista` continua ignorando "Outra Matéria" (já é o caso).
- Atualizar a memória do projeto (`mem://logic/distribuicao-tst/outra-materia-neutra`) com a regra nova.
