# Envio em lote de processos nas coordenações Santander

## O que muda
- No menu **Coordenações**, ao abrir a **Coordenação Santander Cível** ou a **Coordenação Santander Trabalhista**, aparece o botão **Envio em lote de processos** (ao lado de "Assuntos"). Nas demais coordenações o botão não aparece.
- O botão abre um painel lateral direito onde a pessoa envia a planilha no modelo anexado (19 colunas: Tipo, Número do processo, Responsável, Sistema, Situação, Área, Coordenação Responsável, Tribunal, Justiça, Instância, Órgão Julgador, Rito processual, Comarca, UF, Cliente, Polo ativo, Polo passivo, Valor da causa, Pasta do Cliente).
- Antes de gravar, mostra uma prévia: quantos processos são novos, quantos já existem (serão atualizados só nos campos preenchidos) e quais linhas têm erro (ex.: número inválido, responsável não encontrado).
- Todos os processos entram na coordenação aberta; se a coluna "Coordenação Responsável" indicar outra, a linha é apontada como erro.
- Rito "Juizado Especial Civel"/"Vara Civel" é reconhecido pelos nomes da lista (sem acento também). Responsável é ligado pelo nome do usuário.
- Ao final, um resumo com criados, atualizados e rejeitados, com opção de baixar as linhas rejeitadas.
- Só admin, coordenador e assistente de coordenação membros da coordenação podem usar.

## Detalhes técnicos
- Novo `src/components/coordenacoes/EnvioLoteProcessosSheet.tsx` (Sheet lateral), leitura da planilha em Web Worker, gravação em lotes de 200 com yield.
- Reaproveitar o mapeamento/normalização já existentes em `ImportarProcessos.tsx` (CNJ, `normalizarRitoProcessual`, `garantirRito`, cliente) extraindo para `src/lib/loteProcessosSantander.ts` com testes de mapeamento das colunas e da regra de coordenação.
- Exibição do botão em `Coordenacoes.tsx` pelo nome da coordenação (Santander Cível / Santander Trabalhista).
- Sem mudança no banco: usa tabelas e permissões atuais de `processos`.
