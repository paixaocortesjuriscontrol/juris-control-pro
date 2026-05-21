Alterar o critério de classificação CEJUSC no botão DOCS/TST da tela Análise DJEN para exigir "plataforma ZOOM" em vez de apenas "ZOOM" no conteúdo da publicação.

Mudança em `src/pages/AnaliseDjen.tsx`:
- Linha 2771: atualizar comentário de "palavra ZOOM" para "plataforma ZOOM"
- Linha 2772: trocar o regex `/\bzoom\b/i` para `/plataforma zoom/i` na condição de classificação CEJUSC