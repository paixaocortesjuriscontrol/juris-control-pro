# Memory: features/notifications/pdf-executive-report
Updated: now

A Central de Notificações permite gerar um relatório PDF executivo e profissional. O usuário pode selecionar todas as coordenações ou grupos específicos para o relatório. 

## Estrutura do PDF
- **Capa**: Título, período e identidade visual do escritório
- **Sumário Executivo**: Totalizadores simples (sem cores) e tabela comparativa entre coordenações
- **Detalhamento por Coordenação**: Tabelas formatadas para cada tipo de alerta:
  - **DJEN**: Processo, Conteúdo (resumo), Data
  - **Audiências**: Processo, Tipo, Data/Hora, Local, Parte, Advogado
  - **Intimações**: Processo, Tipo, Descrição, Data, Prazo
  - **Redistribuições**: Processo, Vara Origem → Vara Destino, Responsável, Data
  - **Andamentos**: Processo, Descrição completa, Data

## Totalizador de Alertas
O "Total Alertas" conta apenas: DJEN + Audiências + Intimações + Redistribuições (não inclui andamentos na contagem de alertas, mas os andamentos são listados no detalhamento).

## Estilo
Layout profissional com tabelas limpas, sem cores excessivas. Fundo branco, bordas cinza, zebra striping sutil.
