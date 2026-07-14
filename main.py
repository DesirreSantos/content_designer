import os
import json
import base64
import logging
from io import BytesIO
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

PROMPT_ID = "pmpt_6a5667ebffb88197979acdbb0f25e9eb0288546da047e27f"
PROMPT_VERSION = "1"

_probe = client.responses.create(
    prompt={"id": PROMPT_ID, "version": PROMPT_VERSION},
    input=".",
)
MODEL = _probe.model
logger.info("Modelo detectado: %s", MODEL)

BASE_DIR = Path(__file__).parent

IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


def build_input(message: str, file_bytes: bytes | None, file_type: str, filename: str) -> str | list:
    if not file_bytes:
        return message

    if file_type in IMAGE_TYPES:
        b64 = base64.b64encode(file_bytes).decode()
        return [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": message or "Analise esta imagem."},
                    {"type": "input_image", "image_url": f"data:{file_type};base64,{b64}"},
                ],
            }
        ]

    # PDF: extrai texto com pypdf
    if file_type == "application/pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(file_bytes))
            file_text = "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception as e:
            logger.warning("Falha ao ler PDF: %s", e)
            file_text = "[Não foi possível extrair o texto do PDF]"
    else:
        file_text = file_bytes.decode("utf-8", errors="replace")

    combined = message or "Analise o conteúdo deste arquivo."
    combined += f"\n\n---\nArquivo: {filename}\n\n{file_text}"
    return combined


@app.get("/")
async def serve_index():
    return FileResponse(str(BASE_DIR / "static" / "index.html"))


@app.get("/api/test")
async def test_connection():
    try:
        r = client.responses.create(
            prompt={"id": PROMPT_ID, "version": PROMPT_VERSION},
            input="Diga apenas: conexão OK",
        )
        return {"status": "ok", "model": r.model, "response": r.output_text}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/chat")
async def chat(
    message: str = Form(""),
    previous_response_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    file_bytes = None
    file_type = ""
    filename = ""

    if file and file.filename:
        file_bytes = await file.read()
        file_type = file.content_type or ""
        filename = file.filename
        logger.info("Arquivo: %s (%s, %d bytes)", filename, file_type, len(file_bytes))

    input_data = build_input(message, file_bytes, file_type, filename)

    def generate():
        kwargs = {
            "model": MODEL,
            "prompt": {"id": PROMPT_ID, "version": PROMPT_VERSION},
            "input": input_data,
        }
        if previous_response_id:
            kwargs["previous_response_id"] = previous_response_id

        logger.info("Enviando mensagem: %s", str(message)[:80])

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
