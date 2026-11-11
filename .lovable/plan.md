# Retirar Jéssica Alves como envolvida fora da Coordenação Dra. Beatriz Costa

## O que encontrei
- Jéssica Alves só é membro da **Coordenação Dra. Beatriz Costa** (Assistente Coordenador). Ela não está em outras coordenações e não é envolvida fixa em nenhum tipo de tarefa de outra coordenação.
- Ela aparece como **envolvida** em apenas 2 itens de outras coordenações:
  1. Tarefa "RAZÕES FINAIS - 1001130-67.2026.5.02.0502 - ALEX BUONANNO - 5D", da Coordenação Santander Trabalhista (protocolada).
  2. Audiência "UNA", da Coordenação Citibank (pendente).
- Nenhum evento de outra coordenação tem a Jéssica como envolvida.

## O que vou fazer
- Retirar a Jéssica como envolvida só desses 2 itens. A tarefa e a audiência continuam no sistema, sem nenhuma outra alteração.
- Deixar tudo dela na Coordenação Dra. Beatriz Costa como está.
- Conferir depois que ela não aparece mais como envolvida em nenhum item de outra coordenação.

## Detalhes técnicos
- DELETE em `tarefa_envolvidos` (tarefa a0456367-…) e `audiencia_envolvidos` (audiência dd9dffc7-…) só para usuario_id 1b5a2aec-…, sem mudar a estrutura do banco nem o código.
