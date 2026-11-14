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

---

# Problemas novos encontrados

## 1) Gabriella Silva "não encontrada"
- O cadastro dela existe e está ativo, mas o nome está escrito **"Grabriella Silva"** (com "r" a mais). A planilha traz "GABRIELLA SILVA", por isso a importação não a reconheceu (105 atividades ficaram sem ela).
- Correção:
  - corrigir o nome do cadastro para "Gabriella Silva" (só o nome, nada mais);
  - a importação passa a aceitar pequenas diferenças de grafia (até 2 letras no primeiro nome, mesmo sobrenome) quando só existir uma pessoa parecida; se houver dúvida, continua indo para o relatório;
  - colocar Gabriella como responsável nas 105 atividades já importadas sem ela (somente as desta importação, pelo TAR.). Lucas Fournier (1 atividade) será conferido do mesmo jeito.
- Lista de usuários do menu Administração: ela não aparece lá. A causa ainda não foi confirmada; o primeiro passo é abrir a tela com os dados reais e descobrir o que a esconde (filtro de filial, papel ou limite da lista), e então corrigir.

## 2) Coordenação mostra 8001 processos para a Isabela e o resto zerado
- No banco, os 15.936 processos do Santander Cível estão **todos com Isabela Constantino como responsável**, porque a planilha de processos trazia "ISABELA CONSTANTINO" em todas as linhas. Ninguém mais ficou zerado por erro na importação.
- O número 8001 (50%) está errado: a tela de coordenação conta os processos baixando a lista inteira, e o servidor corta a lista em um limite. Correção: contar direto no banco (contagem exata), para mostrar 15.936 (100%).
- Se a distribuição correta for outra (por exemplo, pelos responsáveis das atividades da agenda futura), é preciso a planilha com o responsável real de cada processo. Sem ela, nada será alterado.

## Detalhes técnicos (novos itens)
- `src/hooks/useCoordenacoes.ts`: trocar `select("id")` por `select("id", { count: "exact", head: true })` para principais; vínculos em `processos_responsaveis` contados à parte, sem baixar linhas (ou RPC de contagem distinta se precisar unir as duas).
- `src/components/migracao/ImportarAgendaFuturaProjuris.tsx`: `casar` com distância de edição ≤ 2 no primeiro nome + sobrenome igual, só com candidato único.
- Ajuste de dados: `profiles.nome` da Gabriella; inserir `tarefa_responsaveis`/`audiencias_advogados` para os itens da migração "Agenda Futura" cujo campo Responsáveis do Projuris contém GABRIELLA SILVA (lidos da planilha enviada), sem duplicar.
- `src/pages/Administracao.tsx`: investigar por que o perfil não aparece antes de alterar.
