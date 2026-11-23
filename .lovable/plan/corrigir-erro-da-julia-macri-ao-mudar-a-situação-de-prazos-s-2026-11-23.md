# Corrigir erro da Julia Macri ao mudar a situação de prazos (Santander Cível)

## O que foi conferido
- A Julia é **Assistente** na Santander Cível, sem exceção individual. Pela configuração gravada em 19/11 às 09h00 (BRT), assistentes só podem **mudar a situação** de prazos — então a permissão dela está correta, ninguém mexeu.
- O prazo da imagem (COMPROVAÇÃO DE PGTO, 0002328-47.2026.8.27.2722) veio da importação Projuris e está **sem "data base"** gravada.
- Ao salvar só a situação (Revisão), a tela preenche a data base automaticamente e envia esse campo junto. O sistema entende isso como edição de dados e bloqueia, mostrando "Sua coordenação só permite mudar a situação deste agendamento".
- Isso explica por que "antes funcionava": afeta prazos sem data base, comuns nos importados. Há 296 abertos assim na Santander Cível (1.068 na Santander Trabalhista e outros em demais coordenações).

## O que será feito
1. Na tela de prazo, ao editar, a data base só será enviada se a pessoa realmente alterou datas/dias; se o prazo não tinha data base e as datas continuam iguais, ela não é enviada.
2. Mesma conferência para outros campos preenchidos automaticamente pelo formulário quando o registro original está vazio (ex.: dias/unidade do prazo), para que mudar só a situação não esbarre na regra.
3. Bloqueios da coordenação continuam iguais; nenhum dado é alterado no banco.
4. Teste automático: prazo sem data base, mudando só a situação, não envia data base.
5. Versão v10.3.3 no menu.

## Detalhes técnicos
- `PrazoDialog.tsx`, bloco de edição (`mudancas`): hoje só remove `data_base` quando igual à original; passar a remover também quando `original.data_base` é nulo e `data_vencimento`/`prazo_dias` não mudaram. Extrair para helper testável em `src/lib`.
- Trigger `bloquear_configuracao_agendamento` não muda.
