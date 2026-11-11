# Planilha de audiências da Dra. Janaina — correções

## O que foi confirmado no banco
- **Nome das partes vazio:** nenhuma das audiências conferidas tem o campo "polo ativo" preenchido. A planilha só lê esse campo e não busca as partes no processo.
- **"Presencial Presencial":** a planilha junta o tipo ("Instrução Presencial") com a modalidade ("Presencial"), repetindo a palavra.
- **Duplicadas na planilha:** 0001915-25.2025.5.18.0053 (17/11 11:30) e 0001596-71.2026.5.10.0012 (18/11 08:07) têm **dois registros iguais** gravados (mesmo processo, data e hora), criados em dias diferentes. A planilha mostra os dois.
- **Faltando na planilha:** 0000300-87 (17/11 15:00) e 0000535-54 (19/11 13:30) existem como pendentes. A causa ainda não está confirmada.

## O que vou fazer
1. **Partes:** quando a audiência não tiver o polo ativo, preencher com as partes do processo (reclamante e cliente/reclamada), sem advogados.
2. **Tipo de audiência:** só acrescentar a modalidade quando ela já não estiver escrita no tipo.
3. **Duplicadas:** na planilha, mostrar uma linha só quando processo + data + hora forem iguais. Depois, perguntar se quer que eu junte os registros repetidos no banco (sem apagar comentários/vínculos).
4. **Faltando:** rodar a busca da planilha com o período e filtros dela para ver em qual etapa as duas caem (coordenação, filtro do painel ou data em Brasília) e corrigir essa etapa.
5. Teste pequeno: "Instrução Presencial" + "Presencial" vira "Instrução Presencial"; duas linhas iguais viram uma.

## Detalhes técnicos
- Arquivo: `src/pages/PainelControle.tsx` (`buscarItensAudienciasExport` / `exportarAudienciasPlanilha`).
- Partes: buscar `processos_partes` (polo ativo/passivo) por `processo_id` em lotes de 200, junto da consulta de UF/comarca.
- Dedup por `numero|data|hora` após montar `linhas`.
- Nenhuma mudança de permissões.
