# Importação Santander Cível: etiquetas, reimportação sem duplicar, velocidade e tela travando

## O que será feito
1. **Conferir a causa das etiquetas faltando** (primeiro passo): comparar, nos processos já importados, as etiquetas da planilha com as gravadas. A leitura da planilha já separa por vírgula/ponto e vírgula; a suspeita é que lotes inteiros de etiquetas falharam ao gravar (um erro derruba o lote todo e só aparece como aviso), mas isso ainda não está confirmado.
2. **Reimportar sem duplicar e corrigindo**: ao enviar a planilha de novo, processo que já existe no Santander Cível não é criado de novo; o sistema completa as etiquetas que faltam (sem apagar as que já existem) e liga o Acompanhamento Especial quando houver CAPTURA. Os demais dados do processo não são alterados.
3. **Mais rápido**: buscar responsáveis e clientes de uma vez, e não um a um; gravar etiquetas em lotes menores com repetição individual só do que falhar; ignorar vínculos de etiqueta que já existem.
4. **Tela sem travar**: durante a importação, a tela mostra só uma barra de progresso e contadores (importados, corrigidos, erros), sem redesenhar a lista de 16 mil linhas a cada lote; a lista detalhada aparece ao final, paginada, com botão para baixar o relatório em Excel.
5. **Relatório final**: total da planilha, novos, já existentes corrigidos (com quantas etiquetas acrescentadas), erros com motivo.

## Detalhes técnicos
- `src/lib/importacaoPlanilhaCompleta.ts`: `existentes` vira `Map<digitos, id>`; para existentes, ler `etiquetas_itens` (entidade='processo') em lotes de `.in()` com até 200 ids, inserir só os pares faltantes; `update acompanhamento_especial=true` quando houver CAPTURA e ainda estiver falso. Inserção de vínculos em lotes de 300 com fallback individual e erros contados no resultado. Responsáveis/clientes: uma consulta por lote de nomes e casamento por `normNome` no cliente. Ceder a vez ao navegador (`setTimeout 0`) entre lotes.
- `src/pages/ImportarProcessos.tsx`: no caminho `formatoCompleto`, não atualizar o estado da lista por linha; guardar progresso em estado leve e aplicar resultados só no fim; tabela final paginada.
- Testes em `importacaoPlanilhaCompleta.test.ts`: vírgula gera várias etiquetas; reimportação calcula só os vínculos faltantes; processo existente não é inserido.
