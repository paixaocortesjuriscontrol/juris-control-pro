# Importar Processos da Dra. Beatriz Costa dentro do menu Coordenações

## Objetivo
Levar a mesma importação de processos que hoje existe em Administração → Importar Dados → aba "Dra. Beatriz Costa" para dentro do painel da coordenação, visível **somente** na Coordenação Dra. Beatriz Costa.

## O que muda na tela

1. **Botão novo no painel da coordenação**
   - Ao abrir a Coordenação Dra. Beatriz Costa no menu Coordenações, aparece um botão **"Importar Processos"** junto aos demais (Tarefa em Lote, Pautas Excel, Responsáveis Fixos etc.).
   - O botão só aparece para essa coordenação (identificada pelo ID fixo `COORDENACAO_BEATRIZ_COSTA_ID`, já existente em `src/constants/coordenacoesEspeciais.ts`). Nenhuma outra coordenação mostra o botão.

2. **Tela de importação dentro do painel**
   - Ao clicar, abre a mesma tela de importação da aba "Dra. Beatriz Costa" (componente `BeatrizCostaImportTab`), dentro do painel lateral da coordenação (ou em uma janela sobre ela, o que couber melhor na largura).
   - A coordenação já vem **preenchida e travada** em "Dra. Beatriz Costa" — sem risco de importar para a equipe errada.
   - Todo o resto funciona igual: leitura de todas as abas da planilha, validação, barra de progresso, lista de acompanhamento e gravação com a categoria de importação "beatriz_costa".

3. **Nada muda no menu Administração**
   - A aba original em Importar Dados continua existindo e funcionando como hoje.

## Detalhes técnicos

- `src/pages/Coordenacoes.tsx`: adicionar botão condicionado a `selectedCoord.id === COORDENACAO_BEATRIZ_COSTA_ID`; ao abrir, buscar clientes e membros da coordenação e renderizar o `BeatrizCostaImportTab` em um dialog amplo.
- `src/components/importar/BeatrizCostaImportTab.tsx`: aceitar prop opcional `coordenacaoFixa` — quando presente, pré-seleciona a coordenação e desabilita o seletor.
- Sem mudanças no banco de dados, sem novas permissões: quem já vê o painel da coordenação vê o botão.

## Verificação
- Conferir a compilação e, se possível, abrir a tela logado para validar o botão e o seletor travado.
