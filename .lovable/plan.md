Deletar todas as publicações do DJEN Servidor de hoje (26/06/2026 BRT) para permitir nova execução.

## O que será feito

1. **DELETE em `publicacoes_djen_servidor`** filtrando por `data_disponibilizacao = '2026-06-26'` (BRT).
2. **DELETE em `publicacoes_djen_servidor_execucoes`** referentes a essas publicações de hoje (para limpar o vínculo execução↔publicação).
3. **Não tocar** em `publicacoes_djen` (Browser), conforme regra de isolamento Servidor × Browser.
4. **Não apagar** registros em `execucoes_servidor` (histórico de execuções fica preservado).

## Verificação antes do delete

Rodar um `SELECT COUNT(*)` por coordenação para mostrar quantas publicações serão removidas, e só então executar o DELETE.

## Após aprovação

Você executa novamente o DJEN Servidor e comparamos com o Browser.