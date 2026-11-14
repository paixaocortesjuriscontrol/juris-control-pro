# Reimportação do Santander Cível com relatório profissional

## Os 7 processos com erro
Todos já estavam cadastrados em **outra coordenação**, e o sistema não aceita o mesmo número duas vezes:
4064 1013710-27.2024.8.26.0003 · 5442 0001925-57.2024.5.10.0011 · 6036 0000029-18.2025.8.12.0017 · 10095 0003828-43.2025.8.26.0126 · 11309 5129544-63.2026.8.09.0051 · 12393 5001446-88.2026.8.21.0063 · 13543 0018711-50.2023.8.26.0001

## 1. Apagar a importação de hoje (só Santander Cível)
- Hoje existem **15.936 processos** no Santander Cível, todos criados entre 21:05 e 21:30 de 13/11/2026 (Brasília) por esta importação.
- Antes, guardo uma cópia de segurança. Depois apago só esses processos e as etiquetas aplicadas neles.
- Não mexo em processos, tarefas, etiquetas cadastradas, modelos ou usuários de outras coordenações, nem nos 7 processos de outras equipes.

## 2. Processo que já existe em outra coordenação
- A importação **inclui a coordenação escolhida na tela como coordenação responsável** desse processo.
- **Só preenche campos vazios** com o que vem da planilha (cliente, partes, comarca, valor etc.). Nunca troca um dado que já existe.
- Aplica as etiquetas da planilha.
- No relatório aparece como **"Vinculado – já existia em outra coordenação"**, com o nome da coordenação e a lista dos campos preenchidos.

## 3. Relatório Excel profissional
- **Capa/Resumo:** título, coordenação, quem importou, início e fim em Brasília, situação, e quadro de totais com cores.
- **Atenção:** só o que precisa de ação (vinculados de outra coordenação, erros, etiquetas não aplicadas), com explicação em português, sem mensagens técnicas.
- **Clientes não encontrados:** um nome por linha, com quantidade de processos sem cliente.
- **Processos:** lista completa com resultado, coordenação e detalhe.
- **Linhas ignoradas:** as 8 sem número.
- Visual: fonte Arial, cabeçalho colorido e congelado, filtros, larguras ajustadas, linhas alternadas, cores por resultado.

## Detalhes técnicos
- Limpeza via SQL: backup em `backup_limpeza_santander` (processos + etiquetas_itens), depois delete por `coordenacao_id` Cível e `created_at >= '2026-11-14 00:00 UTC'`, em lotes.
- `importacaoPlanilhaCompleta.ts`: antes do insert, buscar existentes por dígitos em todas as coordenações; para os de outras, upsert em `processos_coordenacoes_responsaveis`, update apenas de colunas nulas/vazias, etiquetas; resultado `vinculado_outra`. Traduzir erros (23505 etc.).
- Registrar falhas de etiqueta por processo; agrupar clientes não encontrados.
- Reescrever o gerador do relatório com ExcelJS/estilos. Testes para "só preenche vazios" e tradução de erros.
