# Skill Shard - RAG com rastreabilidade de fontes e mitigação de alucinações

**Autor:** Vinícius Machado

[English version](README.en.md)

Trabalho de Conclusão de Curso em Engenharia de Software na UniAcademia.

## Objetivo

Desenvolver um Sistema de Geração Aumentada por Recuperação (RAG) para reduzir alucinações e permitir a rastreabilidade das fontes em consultas a documentos.

O sistema permite:

- Responder a perguntas com base em documentos TXT, Markdown, CSV, JSON e PDF;
- Listar automaticamente os documentos compatíveis de `data/` na base de conhecimento, desativados por padrão;
- Reduzir a ocorrência de alucinações;
- Apresentar as fontes usadas na elaboração das respostas.
- Visualizar relações de metadados entre documentos ativados na base de conhecimento.

## Pré-requisitos

- [Python](https://www.python.org/downloads/)
- No Debian ou Ubuntu, instale o Python e outras ferramentas usando `sudo apt install python3 python3-venv python3-pip`.

## Como usar

1. Para evitar conflitos entre versões das dependências, crie um ambiente virtual com `python3 -m venv venv`.
2. No Windows, ative o ambiente virtual com `.\venv\Scripts\Activate`.
3. No Debian ou Ubuntu, ative o ambiente virtual com `source venv/bin/activate`.
4. Instale as dependências do projeto com `python3 -m pip install -r requirements.txt`.
5. Na raiz do repositório, configure `LLM_API_KEY` e `LLM_MODEL_ID` no arquivo `.env`. Use o arquivo `env.example` como referência. [Consulte as chaves API do Gemini](https://aistudio.google.com/api-keys)
6. Em um terminal na raiz do repositório, entre na pasta `backend` com `cd backend` e inicie o backend com `python -m uvicorn app.main:app --reload`. O caminho `app.main:app` é necessário porque os módulos do backend importam a partir de `app`.
7. Em outro terminal, inicie o servidor da interface na pasta `frontend` com `python -m http.server 5500` e abra `http://localhost:5500` no navegador.
8. Ao carregar a interface, os documentos habilitados são sincronizados com o backend para armazenamento e indexação. O chat envia `POST http://127.0.0.1:8000/ask` com a pergunta e os IDs dos documentos; a API retorna a resposta como uma string JSON.
9. Ao terminar, encerre o ambiente virtual com `deactivate`.

Ao carregar a interface, os documentos habilitados são sincronizados e indexados antes de liberar o chat. O backend local persiste o conteúdo original, os trechos e os embeddings em `backend/data/vectors.sqlite3`. O Live Server deve ignorar a pasta `backend/` para que alterações no banco não recarreguem a página. Depois da sincronização, cada pergunta envia somente os IDs dos documentos, não o conteúdo completo. O status mostra o carregamento; se falhar, use **Verificar novamente**. A geração de embeddings e respostas continua dependendo da API Gemini.

Depois de ativar e indexar documentos, abra **Base de conhecimento → Visualizar grafo de entidades**. Selecione um nó ou uma ligação para consultar as evidências de origem.

É muito importante que os documentos não sejam muito grandes para não ultrapassar os limites de cota da API. O processo de embedding faz diversas requisições por minuto, o que pode facilmente chegar no limite da API do Gemini. [Consulte os limites da doc. oficial](https://aistudio.google.com/docs/rate-limits)

## Endpoints

- `GET /ready`: verifica a configuração e a disponibilidade do modelo ao iniciar e após falhas nas perguntas. Apenas verificações *bem-sucedidas* ficam em cache por 15 segundos. Use `GET /ready?refresh=true` para ignorar o cache. Se o modelo estiver indisponível, o envio de perguntas é bloqueado até a conexão ser restabelecida.
- `GET /health`: verifica se o backend está ativo. As chamadas ao modelo expiram após 45 segundos.
- `POST /index`: recebe `{"documents": [{"id": "...", "name": "...", "content": "...", "encoding": "text"}]}`, divide os documentos habilitados em trechos e persiste originais, trechos e embeddings. Retorna `{"indexed_chunks": n}`; responde `422` para documentos inválidos ou sem texto legível e `502` se a API de embeddings falhar. A interface chama esse endpoint ao iniciar e quando a base é alterada.
- `GET /graph`: retorna `{"nodes": [...], "edges": [...]}` para os documentos indexados. Nós têm `id`, `label` e `type`; arestas têm `id`, `source`, `target`, `label` e `evidence` (ID/nome do documento, título do item e URL de origem opcional). Repita `document_ids` para filtrar, por exemplo `/graph?document_ids=id-1&document_ids=id-2`; sem filtro, retorna todos os documentos indexados. As regras locais, sem uso de tokens, leem os metadados estruturados em Markdown (`Tipo`, `Projeto`, `Produto`, `Hierarquia` e `Tags`) e armazenam o resultado durante a indexação. Esta primeira versão não infere entidades a partir de texto livre. Retorna `409` se algum documento solicitado não estiver indexado.
- `POST /ask`: recebe `{"question": "...", "document_ids": [...]}` e recupera os trechos já armazenados; documentos inexistentes ou ainda não indexados resultam em `409`.
- `DELETE /documents?document_id=...`: remove do banco local o documento, seus trechos e vetores associados.

## Arquitetura

backend/ <br>
├── app/ <br>
│ ├── ingestion/ # extração de documentos, divisão em trechos e embeddings <br>

frontend/ <br>
├── index.html <br>
├── style/ <br>
└── script/ <br>

## Tecnologias

- **Interface:** HTML, CSS e JavaScript puro
- **Backend:** Python
- **LLM:** Gemini (API)
- **Armazenamento vetorial:** SQLite local (`backend/data/vectors.sqlite3`)

### Recursos visuais

[Material Icons](https://fonts.google.com/icons?icon.size=24&icon.color=%23EEE&icon.style=Sharp)

## Metodologia de Avaliação

Comparação de três configurações:

1. Modelo sem RAG (linha de base);
2. RAG tradicional, com busca vetorial;
3. RAG com uma camada de relações entre entidades.

As perguntas de teste serão **factuais** e **relacionais**. As respostas serão classificadas manualmente como:

- Correta e fundamentada;
- Correta, mas mal fundamentada;
- Alucinação.
