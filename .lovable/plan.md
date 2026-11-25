# Recuperar os anexos do Projuris já enviados

## O que foi encontrado
- Entre 02/10 e 07/11/2026 foram enviados 40.776 anexos do Projuris.
- Os arquivos continuam guardados (40.776 arquivos no armazenamento de documentos dos processos).
- Mas só 48 ainda aparecem no sistema: 40.728 fichas de anexo foram apagadas junto com a limpeza anterior, e por isso não aparecem nos processos nem nas tarefas.
- A importação de hoje não religou anexos: nenhuma das 98.605 tarefas novas tem anexo.

## O que fazer
1. Fazer cópia de segurança do registro da migração dos anexos.
2. Recriar a ficha de cada anexo cujo arquivo ainda existe, ligada ao mesmo processo de antes (a pasta do arquivo guarda o processo). Não reenviar nenhum arquivo.
3. Pular anexos cujo processo não existe mais e listar esses casos num Excel.
4. Religar às tarefas novas os 3.037 anexos que antes eram de tarefas, usando o código da tarefa no Projuris, quando a tarefa nova existir e for até 13/11/2026.
5. Conferir no fim: quantos anexos voltaram aos processos, quantos às tarefas e quantos ficaram de fora.

## Detalhes técnicos
- Fonte: `migracoes_projuris_itens` tipo `anexo` (path em `dados.path`, prefixo = `processo_id`) cruzado com `storage.objects` do bucket `documentos_processos` (nome, tamanho).
- Inserção em lotes em `documentos` (nome, url/path, processo_id, uploaded_by = autor do lote original), atualizando `registro_id` do item para o novo documento.
- Vínculo com tarefa: `vinculo_anexo_tarefa.chave_externa` (código Projuris) → item `tarefa` criado na migração de hoje → `documentos.tarefa_id`.
- Sem avisos à equipe (`app.sem_notificacao`), nada apagado.
