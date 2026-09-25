# Alimentar o Banco de Teses com peças reais do escritório

## Resposta curta
Sim, vale a pena. Hoje o Banco de Teses está vazio (0 teses cadastradas), por isso o gerador sempre avisa "nenhuma tese encontrada" e escreve a peça só com conhecimento genérico. Com peças reais do escritório, a IA passa a seguir os argumentos, a jurisprudência e o estilo da casa.

## O que pedir aos advogados
- As 5 a 10 melhores peças de cada tipo (contestação, recurso ordinário, contrarrazões, memoriais), de preferência já vitoriosas.
- Em Word (.docx) ou PDF com texto (não escaneado).
- Uma por tese/assunto principal (ex.: horas extras, dano moral, vínculo, terceirização Santander).
- Nomes de partes podem ficar: o sistema remove dados pessoais antes de guardar.

## O que construir para receber essas peças
1. **Botão "Importar peças"** na tela Banco de Teses: envia vários arquivos de uma vez, escolhendo coordenação e área.
2. **Leitura pela IA** de cada arquivo: identifica tipo de peça, matéria, assunto, tipo de recurso, palavras-chave e extrai os fundamentos (argumentos, artigos, súmulas, julgados), retirando nomes, CPFs e números de processo.
3. **Revisão antes de salvar**: cada peça vira uma tese em "rascunho" (inativa); o coordenador confere, ajusta e ativa. Só teses ativas são usadas pelo gerador.
4. **Peça-modelo guardada junto**: o texto original fica anexado à tese para a IA imitar a estrutura e o estilo.
5. **Busca melhor**: quando não houver tese com o mesmo tipo de peça, usar a mais parecida pela matéria, e mostrar na tela qual tese foi usada e por quê.

## Detalhes técnicos
- Coluna nova em `teses_juridicas`: `peca_modelo text`, `origem_arquivo text`; teses importadas entram com `ativo = false`.
- Edge function `importar-tese-peca`: recebe texto extraído no navegador (docx via JSZip/mammoth, PDF via pdfjs já usado no projeto), chama Gemini (`geminiChatCompletionsFetch`, gemini-flash-latest) com saída JSON, anonimiza e grava; custo em `ai_usage_logs`.
- `gerar-peca-juridica`: incluir `peca_modelo` (limitado) no prompt como referência de estilo.
- `buscar_teses_aplicaveis`: fallback por matéria/assunto quando `tipo_peca` não bate.
- Sem Lovable Gateway, seguindo o padrão do projeto.
