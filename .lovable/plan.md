

## Plano Atualizado: Tela "Dados Benner"

### Alteracoes em relacao ao plano anterior

Dois itens faltantes foram identificados e serao adicionados:

**1. Campo "Contrato" (novo campo separado do Dossie)**
- Adicionar coluna `contrato` (TEXT) na tabela `dados_benner`
- No formulario, posicionar o campo "Contrato" logo apos o campo "Dossie" (coluna A), antes de "Tribunal"
- Campo de texto livre para o numero do contrato do cliente com o Santander

**2. Botao "Buscar Dossie" ao lado do campo Dossie**
- Ao lado do campo "Dossie" no formulario, adicionar um botao com icone de busca
- Ao clicar, busca na tabela `processos` pelo campo `dossie_tst` (ou `numero`) que contenha o valor digitado
- Se encontrar, preenche automaticamente campos disponiveis (tribunal, turma, relator, etc.) vindos do processo cadastrado
- Exibe feedback visual: resultado encontrado ou "Nenhum processo encontrado"

### Resumo da implementacao completa

1. **Migration SQL**: Criar tabela `dados_benner` com todas as 34 colunas (A-AH) + campo extra `contrato` + `status` (rascunho/pronto_envio/planilhado/enviado) + `user_id`, `created_at`, `updated_at`, `coordenacao_id`. RLS para usuarios autenticados.

2. **Pagina `src/pages/DadosBenner.tsx`**: Listagem com filtros por status, botoes de acao (Novo, Gerar Planilha, Regerar, Marcar Enviado).

3. **Formulario `src/components/benner/DadosBennerForm.tsx`**: Todos os campos organizados por secao colorida:
   - Campo Dossie (A) com **botao "Buscar"** que consulta `processos` por `dossie_tst` ou `numero`
   - Campo **Contrato** (novo, apos Dossie)
   - Campos B-AH conforme planilha
   - Toggle "Pronto para Enviar"

4. **Geracao XLSX**: Reutiliza logica do CargaBenner para exportar registros prontos, atualizar status para "planilhado".

5. **Sidebar + Rota**: Item "Dados Benner" no menu, rota `/dados-benner`.

### Campos do formulario (ordem final)

| # | Campo | Tipo |
|---|-------|------|
| A | Dossie + Botao Buscar | texto + botao |
| - | **Contrato** | texto |
| B | Tribunal | select (TST/STF/STJ) |
| C-AH | (demais campos conforme plano anterior) | varios |

