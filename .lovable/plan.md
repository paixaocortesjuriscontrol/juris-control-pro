# Etiqueta DJEN AUTOMÁTICO só nos processos que a rotina cadastrou

## Por que aconteceu
O plano aprovado previa que o processo que já estava na tela também ganharia a etiqueta, junto com a marca "já estava no sistema". A primeira busca, em 04/11 às 17:31 (horário de Brasília), marcou 157 processos:
- 84 novos, cadastrados pela rotina
- 73 que já existiam e mesmo assim receberam a etiqueta

## O que muda
1. **Daqui para frente:** a etiqueta só entra nos processos que a rotina cadastrar. No processo que já existe, a rotina apenas registra que ele apareceu no DJEN, sem colocar a etiqueta. Ela grava a marca "já existia" e preenche a data de distribuição se estiver vazia.
2. **Limpeza:** tirar a etiqueta DJEN AUTOMÁTICO dos 73 processos que já existiam. Nada mais muda neles.
3. **Relatório para Dra. Iara:** continua igual. O filtro "Já estavam no sistema" segue funcionando, porque depende da marca e não da etiqueta.

## Detalhes técnicos
- Migração recriando `gerar_distribuicoes_tst_auto`: inserir em `dados_benner_processo_tags` só no trecho que insere uma linha nova em `dados_benner`.
- Remover de `dados_benner_processo_tags` a etiqueta DJEN AUTOMÁTICO onde `dados_benner.ja_existia_antes_djen = true`.
