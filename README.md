
# Chat com OpenAI Responses API (FastAPI)

Backend em FastAPI que expõe um chat com streaming em tempo real (SSE), usando a OpenAI Responses API com um prompt pré-configurado no dashboard da OpenAI. O histórico de conversa é mantido através do encadeamento de previous_response_id, sem precisar reenviar todas as mensagens anteriores a cada chamada.
Funcionalidades


Streaming de respostas em tempo real via Server-Sent Events (SSE)
Uso de um prompt versionado da OpenAI (prompt_id + version) — o modelo é detectado automaticamente, sem precisar declará-lo no código
Continuidade de conversa via previous_response_id, sem reenviar todo o histórico
Endpoint de diagnóstico (/api/test) para validar a conexão com a API
Serve o frontend estático a partir da pasta static/



# Requisitos


Python 3.10+
Uma chave de API válida da OpenAI
Um prompt já criado no dashboard da OpenAI (prompt_id + version)



# Instalação

bash# Clone o repositório
git clone <url-do-repositorio>
cd <nome-do-projeto>

# Crie e ative um ambiente virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instale as dependências
pip install fastapi uvicorn openai python-dotenv

Dica: gere um requirements.txt com pip freeze > requirements.txt para fixar as versões usadas no seu ambiente.


# Configuração


Copie o arquivo de exemplo de variáveis de ambiente:


bash   cp _env.example .env


Edite o .env e adicione sua chave da OpenAI:


   OPENAI_API_KEY=sk-...


# Estrutura esperada do projeto

.
├── main.py
├── .env
├── .gitignore
└── static/
    └── index.html

O código espera encontrar um diretório static/ com pelo menos um arquivo index.html, servido na rota raiz (/).


# Executando

bashuvicorn main:app --reload

A aplicação sobe por padrão em http://localhost:8000.


# Endpoints

GET /

Serve a página inicial (static/index.html).

GET /api/test

Endpoint de diagnóstico. Faz uma chamada simples ao prompt configurado e retorna o status da conexão.

bashcurl http://localhost:8000/api/test


# Resposta esperada:

json{
  "status": "ok",
  "model": "gpt-4o-mini",
  "response": "conexão OK"
}

POST /api/chat

Envia uma mensagem e recebe a resposta via streaming (SSE).

Corpo da requisição:

json{
  "message": "Olá, tudo bem?",
  "previous_response_id": null
}

CampoObrigatórioDescriçãomessageSimTexto da mensagem do usuárioprevious_response_idNãoID da resposta anterior, usado para manter o contexto da conversa


# Formato dos eventos (SSE):

TipoDescriçãotextFragmento (delta) de texto da resposta, enviado incrementalmentedoneSinaliza o fim da resposta e retorna o response_id para reutilizar na próxima chamadaerrorRetornado em caso de falha durante o streaming

Exemplo com curl:

bashcurl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá!"}'


# Notas sobre o prompt

O PROMPT_ID e PROMPT_VERSION estão fixos em main.py. Esse prompt deve existir previamente no dashboard da OpenAI. O modelo associado a ele é detectado automaticamente na inicialização da aplicação (variável MODEL), então não é necessário declará-lo manualmente no código.


# Segurança


Nunca faça commit do arquivo .env — ele já está listado no .gitignore.
Trate a OPENAI_API_KEY como um segredo; não a exponha em logs ou no frontend.

