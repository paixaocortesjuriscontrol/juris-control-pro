# Agenda futura: importação mais rápida e com barra de progresso o tempo todo

## Por que está lento e sem barra
- A barra só aparece na última fase (gravar atividades). Antes disso a tela fica só com o texto "Procurando processos…", sem porcentagem.
- Fases preparatórias rodam uma de cada vez:
  - busca dos 2.463 processos em 25 consultas em fila;
  - gravação do número PRO. nos processos já existentes **um processo por vez** (pode passar de 2.000 chamadas seguidas) — principal causa da demora;
  - etiquetas novas criadas uma a uma;
  - auditoria, responsáveis, etiquetas e comentários gravados em sequência dentro de cada lote.

## O que muda
1. **Barra única do começo ao fim**, com o nome da etapa (1/6 Conferindo atividades já migradas, 2/6 Processos, 3/6 Criando processos, 4/6 Etiquetas, 5/6 Atividades, 6/6 Finalizando), porcentagem, contadores (criados / erros) e tempo estimado restante.
2. **Conferência inicial também com barra** (leitura da planilha e verificação das já migradas).
3. **Mais rápido, sem mudar nenhuma regra**:
   - buscas de processos e de já migradas em paralelo (4 por vez);
   - número PRO. gravado em poucas chamadas agrupadas, em vez de uma por processo;
   - etiquetas novas criadas de uma só vez;
   - responsáveis, etiquetas, comentários e auditoria de cada lote gravados em paralelo;
   - até 3 lotes de atividades gravando ao mesmo tempo.
4. **Botão Cancelar** que para no fim do lote atual; o que já foi gravado fica registrado e pode ser desfeito pelo histórico.
5. Ao final, quadro com o resumo completo e o botão do relatório Excel.

## Detalhes técnicos
- Arquivo: `src/components/migracao/ImportarAgendaFuturaProjuris.tsx`; reutilizar `executarFila`/`criarGravadorLotes` de `src/lib/projurisImportQueue.ts` para concorrência limitada.
- Atualização do PRO.: agrupar por lote via `upsert` em `processos` não é seguro (campos obrigatórios); usar `update ... in(id)` não serve para valores diferentes — então chamadas paralelas limitadas (8 por vez) com filtro `identificador_projuris is null`.
- Estado de progresso com `{ etapa, feito, total, inicio }`, atualizado no máximo a cada 300 ms para não travar a tela.
- Regras (audiências pela lista, modelos, TAR./PRO., comentários "Importado Projuris") inalteradas; testes existentes continuam valendo.
