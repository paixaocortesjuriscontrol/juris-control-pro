# Memory: features/monitoring/djen-termos-pro-engine
Updated: 24/02/2026

O 'DJEN Termos Pro' utiliza:

1. **Parser de termos_or**: Cada entrada em `termos_or` é parseada via `parsearTermoOr()` que extrai OAB e nome de formatos como "16733/LEANDRO ARTIAGA E VIEIRA" ou "NOME/OAB". Para cada advogado parseado, o engine faz buscas separadas por `nomeAdvogado` (não `palavraChave`/`texto`) e opcionalmente por `oab`, garantindo que a API PJE Comunica retorne publicações específicas de cada advogado.

2. **Retry para tribunais superiores**: Se a busca inicial por OAB+UF+Tribunal não retornar resultados para o tribunal específico, o motor realiza automaticamente uma busca secundária usando apenas Nome + Tribunal.

3. **Validação via metadados estruturados**: Usa `destinatarioadvogados` para OAB/nome exatos e `destinatarios` para partes, com fallback para texto.

4. **Normalização de acentos**: Nomes são normalizados (NFD) antes de enviar à API.

IMPORTANTE: Os `termos_or` com formato "OAB/NOME" são parseados tanto na busca (para gerar chamadas API separadas por advogado) quanto na validação (para verificar OAB e nome nos metadados estruturados).
