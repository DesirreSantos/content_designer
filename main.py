import os
import json
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

PROMPT_ID = "pmpt_6a5667ebffb88197979acdbb0f25e9eb0288546da047e27f"
PROMPT_VERSION = "1"
# Busca o modelo do prompt armazenado; fallback para gpt-4o-mini
_probe = client.responses.create(
    prompt={"id": PROMPT_ID, "version": PROMPT_VERSION},
    input=".",
)
MODEL = _probe.model
logger.info("Modelo detectado do prompt: %s", MODEL)

BASE_DIR = Path(__file__).parent


class ChatRequest(BaseModel):
    message: str
    previous_response_id: str | None = None


@app.get("/")
async def serve_index():
    return FileResponse(str(BASE_DIR / "static" / "index.html"))


@app.get("/api/test")
async def test_connection():
    """Endpoint de diagnóstico — abra no browser: http://localhost:8000/api/test"""
    try:
        response = client.responses.create(
            prompt={"id": PROMPT_ID, "version": PROMPT_VERSION},
            input="Diga apenas: conexão OK",
        )
        return {"status": "ok", "model": response.model, "response": response.output_text}
    except Exception as e:
        logger.error("Erro no /api/test: %s", e)
        return {"status": "error", "message": str(e)}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    def generate():
        kwargs = {
            "model": MODEL,
            "prompt": {"id": PROMPT_ID, "version": PROMPT_VERSION},
            "input": request.message,
        }
        if request.previous_response_id:
            kwargs["previous_response_id"] = request.previous_response_id

        logger.info("Mensagem: %s", request.message[:80])

        try:
            response_id = None
            with client.responses.stream(**kwargs) as stream:
                for event in stream:
                    if event.type == "response.output_text.delta":
                        yield f"data: {json.dumps({'type': 'text', 'text': event.delta})}\n\n"
                    elif event.type == "response.completed":
                        response_id = event.response.id
            logger.info("Concluído. response_id=%s", response_id)
            yield f"data: {json.dumps({'type': 'done', 'response_id': response_id})}\n\n"
        except Exception as e:
            logger.error("Erro no stream: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
