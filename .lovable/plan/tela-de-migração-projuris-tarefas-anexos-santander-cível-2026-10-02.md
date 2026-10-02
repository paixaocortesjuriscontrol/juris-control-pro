# Tela de Migração Projuris (tarefas + anexos) — Santander Cível

## Objetivo

Criar uma tela, só para administradores, que restaura o backup do Projuris na coordenação **Santander Cível**: processos, tarefas (prazos, audiências, eventos) e todos os arquivos anexos dos zips. O envio é feito pela própria tela, porque os zips passam de 20 MB.

## Como a tela funciona (assistente em 5 etapas)

1. **Enviar arquivos**
   - Arraste as planilhas e os zips, que podem ser grandes e vários.
   - Os zips são lidos no próprio navegador, arquivo por arquivo, sem precisar descompactar antes.
   - Barra de progresso por arquivo e possibilidade de continuar depois se a conexão cair.
2. **Mapear colunas**
   - O sistema reconhece as colunas do Projuris (identificador da tarefa, número CNJ, título, datas, responsável, situação).
   - Você confere e ajusta.
   - O mapeamento fica salvo para os próximos lotes.
3. **Conferência prévia** (nada é gravado ainda)
   - Totais: processos novos x existentes, tarefas por tipo, quantas são duplicadas e quantos anexos foram ligados ou ficaram sem dono.
   - O tipo de cada tarefa é classificado pelo título, como na Santander Trabalhista (audiência, prazo, evento etc.), e pode ser corrigido na lista.
   - Responsáveis do Projuris ligados aos usuários da coordenação, com lista do que não foi reconhecido.
   - Tarefas vencidas ficam como cumpridas, mantendo a situação da planilha quando houver.
4. **Importar**
   - A gravação é feita em lotes, com progresso, e pode ser pausada ou cancelada.
   - Não duplica processos nem tarefas: reconhece pelo identificador da tarefa do Projuris e pelo número do processo.
   - Os anexos vão para a tarefa ou, se não for possível, para o processo, com o nome original.
5. **Relatório final**
   - Excel com tudo o que entrou, o que foi pulado e por quê, e os anexos sem vínculo.
   - Histórico de cada migração, com opção de desfazer um lote inteiro.

## Pendência antes de construir

Os zips e as planilhas ainda não chegaram para eu analisar. A estrutura exata, ou seja, os nomes das colunas e como os anexos estão organizados dentro do zip, será confirmada com o primeiro lote real. Ajusto o reconhecimento das colunas se o formato for diferente do que já vimos do Projuris. Se possível, envie uma planilha de exemplo e um zip pequeno (menos de 20 MB) aqui no chat.

## Detalhes técnicos

- Rota `/migracao-projuris`, protegida por `AdminRoute` com verificação extra de `is_admin`, e item no menu Administração (`adminOnly`).
- Leitura de zip no navegador com `@zip.js/zip.js` (streaming, sem carregar tudo na memória). Planilhas lidas em web worker (padrão `tarefasParser.worker.ts`).
- Anexos enviados ao bucket existente `documentos_processos` com upload resumível (TUS) e paralelismo limitado. Cada arquivo gera uma linha em `documentos` (`tarefa_id`/`processo_id`, `uploaded_by`), seguindo o fluxo de `ItemAnexos.tsx`.
- Vínculo anexo↔tarefa pelo caminho/nome dentro do zip (identificador da tarefa ou CNJ). Regra final definida após inspecionar o zip real.
- Novas tabelas: `migracoes_projuris` (lote, status, contadores, mapeamento) e `migracoes_projuris_itens` (linha de origem, id criado, status, motivo). Ambas com GRANT e RLS somente admin. Elas permitem retomar, gerar relatório e desfazer.
- Deduplicação: `tarefas` recebe `origem = 'projuris'` + chave externa (identificador Projuris) armazenada em `migracoes_projuris_itens`. Processos são casados por número normalizado em todas as coordenações; se existirem em outra coordenação, Santander Cível entra como responsável em `processos_coordenacoes_responsaveis`.
- Judit não é consultada por padrão, mas fica como opção na etapa 3 para processos novos.
