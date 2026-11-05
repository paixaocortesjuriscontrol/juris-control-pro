# Cadastrar processos na Coordenação Adobe/Crefisa

A planilha tem 106 linhas, mas só **82 processos diferentes** (alguns se repetem). Todos estão "ATIVOS", são Reclamações Trabalhistas do TRT.

## O que será feito
1. Juntar as linhas repetidas: cada processo entra uma vez só.
2. Para cada processo:
   - **Já existe na Adobe/Crefisa:** não duplica, só completa campos vazios.
   - **Existe em outra coordenação:** compartilha com a Adobe/Crefisa (mesma regra do envio em lote), sem duplicar.
   - **Não existe:** cria na Adobe/Crefisa com status ativo e área trabalhista.
3. Campos usados: número do processo, autor (parte ativa), pasta, vara/tribunal (Jurisdição Atual), tipo de ação, último evento (em observação). A coluna "Advogado Principal do Cliente" fica como observação, porque esses advogados não são usuários do sistema.
4. Sem e-mails nem avisos.
5. No fim, informo quantos foram criados, compartilhados e quantos já existiam.

## Detalhes técnicos
- Coordenação localizada por nome em `coordenacoes` (ADOBE/CREFISA).
- Inserção via SQL com `find_processo_by_digits` para checar existência; vínculo em `processos_coordenacoes_responsaveis` para compartilhados.
- Nenhuma mudança de estrutura no banco nem de código.
