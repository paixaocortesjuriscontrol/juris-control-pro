# Importar PDF Certidão: não alterar processos já existentes

Hoje a importação sobrescreve a data de distribuição dos processos que já estão na base. Isso será removido.

## Novo comportamento

- Processo novo (não existe na base): cadastrado com a data da certidão, como hoje.
- Processo já existente: nada é alterado — nem a Data Distribuição Real, nem a data da planilha, nem qualquer outro campo.
- No relatório em Excel, esses casos passam a aparecer na aba Duplicados com o motivo "Já existe na base — nenhum dado foi alterado".
- O resumo final deixa de contar "atualizados": mostra cadastrados, duplicados e rejeitados.
- Texto da página ajustada: em vez de "terão a data de distribuição atualizada", passa a dizer que processos já existentes são apenas listados no relatório, sem alteração.

## Detalhes técnicos

- `src/components/distribuicao-tst/CertidaoPdfImport.tsx`: remover o laço de `update` em `dados_benner` (`data_distribuicao_planilha` / `data_distribuicao_real`) para `paraAtualizar`; manter a detecção por dígitos apenas para classificar como duplicado. Ajustar motivo, progresso (pular a faixa 40–55) e mensagem final; na auditoria (`finalizarAuditoriaLote`) registrar esses itens como `acao: "ignorado"` e `atualizados: 0`.
- `src/pages/admin-tst/ImportarCertidaoPdf.tsx`: atualizar `descricao` e `comoUsar`.
