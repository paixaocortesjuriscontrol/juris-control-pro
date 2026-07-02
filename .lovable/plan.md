Você tem razão: minha proposta anterior de “suplemento por texto” não era paridade com o Servidor.

O diagnóstico correto é este:

- O Servidor não precisou de busca suplementar.
- O Servidor achou os 3 na Coordenação Dr. Thomás porque o motor do Servidor tem resgate entre coordenações dentro da própria tabela `publicacoes_djen_servidor`.
- Os mesmos 3 `id_djen` já existem também no Browser em outras coordenações, mas não na Coordenação Dr. Thomás:
  - `656901356` — Browser achou em Coordenação Santander Cível
  - `656937583` — Browser achou em Coordenação Santander Cível e Santander Trabalhista
  - `657205246` — Browser achou em Coordenação Dra. Vanessa Gomes - TST e Santander Trabalhista
- Portanto, a diferença persiste porque o Browser não está aplicando o mesmo resgate cross-coordenação isolado que o Servidor aplica.

Regra de isolamento mantida:

- Browser só pode ler/escrever `publicacoes_djen`.
- Servidor só pode ler/escrever `publicacoes_djen_servidor`.
- O comparador pode ler as duas apenas para diagnóstico visual/CSV.

Plano de implementação:

1. Corrigir o motor `DJEN Termos Browser` para ter o mesmo resgate cross-coordenação do Servidor, mas usando somente `publicacoes_djen`.
   - Buscar, no mesmo dia e tribunal, publicações já capturadas por outras coordenações do próprio Browser.
   - Validar novamente pelo mesmo monitoramento da coordenação alvo.
   - Para advogado, continuar validando somente em advogados/metadados/seção Advogado(s).
   - Persistir na coordenação alvo com `coordenacao_id` dela, sem usar a tabela do Servidor.

2. Chamar esse resgate no mesmo ponto lógico do Servidor: após a busca principal do termo/tribunal/dia.
   - Se a API não devolver a publicação diretamente para Dr. Thomás, mas ela já existir em outra coordenação do Browser, o Browser deve copiar/resgatar para Dr. Thomás.
   - Isso espelha o motivo pelo qual o Servidor funciona.

3. Não adicionar busca suplementar por texto, não alterar parâmetros da API e não misturar tabelas.
   - A rota de busca continua igual à do Servidor.
   - A correção é de resgate isolado, não de nova estratégia de busca.

4. Melhorar o CSV do comparador para explicar exatamente a diferença.
   - Adicionar colunas de auditoria:
     - `motivo_exato`
     - `existe_na_mesma_origem_outra_coord`
     - `coords_mesma_origem_outra_coord`
     - `capturado_na_mesma_origem_em`
     - `existe_na_outra_origem_outra_coord`
     - `coords_outra_origem_outra_coord`
   - Para este caso, o CSV deve indicar algo como:
     - `browser_tem_em_outra_coord_mas_nao_resgatou_para_coord_alvo`
     - e listar as coordenações Browser onde cada `id_djen` já existia.

5. Resultado esperado após nova execução Browser da Coordenação Dr. Thomás:
   - Os 3 `id_djen` devem ser resgatados de outras coordenações do próprio Browser para Dr. Thomás.
   - O comparador deve reduzir a diferença `Só Servidor = 3` para `0`, se não houver nova instabilidade/dados novos no período.