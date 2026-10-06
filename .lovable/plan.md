# Admin. TST: nova opção "Atualizar Geral"

## O que conferi
- A planilha "Base Módulo TST - Paixão - 05-10-26" tem 9.456 processos, com 45 colunas. São as mesmas colunas da importação principal: Dossiê, Processo, Equipe, Turma, Relator, data de distribuição etc.
- A base da Distribuição TST tem hoje cerca de 16 mil fichas: 10.750 na Coordenação Dra. Renata Oficial e 5.305 sem coordenação. Por isso, a diferença a arquivar pode ser grande, e a tela mostra tudo antes de gravar.

## Como vai funcionar
Novo cartão "Atualizar Geral" no Admin. TST, no grupo Importações Distribuição TST. Só administrador pode usar.

1. **Enviar a planilha.** A leitura é feita sem travar a tela.
2. **Conferência, sem gravar nada.** A tela compara a planilha com a base, pelo Dossiê e pelo número do processo, e mostra três listas:
   - **Novos:** estão na planilha e não estão na base. Serão cadastrados.
   - **Arquivar:** estão na base e não estão na planilha. Serão arquivados.
   - **Mantidos:** estão nos dois e não mudam.
   Cada lista pode ser baixada em Excel antes de confirmar.
3. **Confirmar.** Aparece um aviso com as quantidades. A gravação é feita em lotes, com barra de progresso:
   - Os novos são cadastrados com os dados da planilha, do mesmo jeito que na importação principal.
   - Os que não estão na planilha são arquivados com o motivo "Ausente na Base Módulo TST de [data]". Eles vão para a tela "Arquivados", de onde podem ser restaurados.
4. **Relatório final** em Excel, com os cadastrados, os arquivados e os erros. Tudo também fica registrado na Auditoria de Importações em Lote.

## Regras de segurança
- Os processos mantidos não são alterados.
- O arquivamento usa o mesmo processo de hoje, que guarda uma cópia completa da ficha, com responsáveis e etiquetas, para restaurar depois.
- Se a planilha vier com poucas linhas, menos da metade do tamanho da base, a tela bloqueia e pede uma segunda confirmação. Isso evita arquivar quase tudo por engano.

## Ponto a confirmar
- As 5.305 fichas sem coordenação também entram na comparação e podem ser arquivadas? Na proposta, sim, porque a planilha é a base inteira do módulo TST.

## Detalhes técnicos
- Nova página `src/pages/admin-tst/AtualizarGeral.tsx`, com rota `/admin-tst/atualizar-geral` e cartão `adminOnly` em `AdminTst.tsx`.
- Leitura pelo `planilhaTstReader.worker.ts`. O processo é normalizado para os 20 dígitos (sem o apóstrofo inicial) e o dossiê é usado como chave. A comparação usa a chave processo+dossiê; se o dossiê estiver vazio, usa só o processo.
- A base é carregada paginada (de 1.000 em 1.000) de `dados_benner` com `aba_origem` não nulo.
- Novos: inserção em lotes de 200, com o mesmo mapeamento de colunas do `DistribuicaoTstImport` e `aba_origem = 'Atualizar Geral'`.
- Arquivar: chamada da RPC `arquivar_dados_benner(_id, _motivo)` em lotes de 50, com 4 em paralelo.
- Registro com `auditoriaLoteAdminTst`. Sem mudança de estrutura no banco.
