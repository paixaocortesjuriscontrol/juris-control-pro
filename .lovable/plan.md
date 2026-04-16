

## Adicionar botão "Duplicar" nos Termos DJEN

### O que fazer
Adicionar um botão de duplicação ao lado dos botões existentes (Editar/Excluir) em cada card/linha de termo monitorado. Ao clicar, abre o formulário de criação **pré-preenchido** com todos os campos do termo original, exceto o ID. O usuário pode então editar antes de salvar como novo registro.

### Investigação necessária
Preciso identificar a tela "Termos DJEN" e o componente que lista os monitoramentos para adicionar o botão no lugar certo. Pelo `useMonitoramentosDjen.ts`, sei que existe `criarMonitoramento` que aceita os campos `tipo`, `termo_busca`, `oab`, `uf`, `coordenacao_id`, `descricao`, `exclusoes`, `condicao_concomitante`, `termos_or`, `tribunais` — todos serão copiados.

### Implementação
1. **Localizar componente da listagem** (provavelmente `MonitoramentosDjenList.tsx` ou similar dentro de `src/components/monitoramentos/` ou `src/pages/`).
2. **Adicionar botão "Duplicar"** (ícone `Copy` do lucide-react) na linha de ações de cada termo, com tooltip "Duplicar termo".
3. **Handler `handleDuplicar(termo)`**: 
   - Cria objeto com todos os campos copiados (exceto `id`, `created_at`, `updated_at`, `criado_por`).
   - Sufixa a `descricao` com " (cópia)" para o usuário identificar.
   - Abre o modal/formulário de criação já preenchido com esse objeto via prop `initialData` ou estado.
4. **Ajustar formulário de criação** para aceitar dados iniciais e popular todos os campos (texto, OABs, exclusões, termos OR, tribunais selecionados).
5. Ao salvar, é criado um novo registro independente (não altera o original).

### Arquivos prováveis afetados
- **Editar**: componente da listagem de monitoramentos DJEN (a confirmar nome exato).
- **Editar**: componente do formulário de criação/edição de termo (para aceitar `initialData`).
- Sem mudanças no banco — usa `criarMonitoramento` existente.

