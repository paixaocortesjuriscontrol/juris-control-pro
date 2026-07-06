---
name: DEJT Pautas usam data_publicacao
description: Filtros e contadores de DEJT Pautas devem usar data_publicacao como dia da pauta
type: feature
---
DEJT Pautas devem ser filtradas e contadas pelo dia legal da pauta em `data_publicacao`, não pela `data_disponibilizacao` do PDF.

Exemplo crítico: o caderno disponibilizado em 03/07/2026 pode publicar legalmente pautas em 06/07/2026. Na tela Análise DJEN, o filtro “Somente hoje” e o card “Pautas DEJT” para 06/07 devem olhar `data_publicacao = 06/07`, mesmo que `data_disponibilizacao = 03/07`.
