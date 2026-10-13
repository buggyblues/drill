"""Real, lazy-loaded BGE-M3 embeddings; not a mock and not a hosted-model fallback."""
import os
import threading
import secrets
from typing import Union
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Drill local embeddings")
_model = None
_lock = threading.Lock()

class Request(BaseModel):
    input: Union[str, list[str]]
    model: str = "BAAI/bge-m3"

@app.post("/embeddings")
def embeddings(body: Request, authorization: str = Header(default="")):
    key = os.environ.get("EMBEDDING_KEY", "")
    if key and not secrets.compare_digest(authorization, "Bearer " + key):
        raise HTTPException(status_code=401, detail="Unauthorized")
    texts = [body.input] if isinstance(body.input, str) else body.input
    if not texts or len(texts) > 8 or any(len(t) > 32000 for t in texts):
        raise HTTPException(status_code=422, detail="1–8 texts, at most 32,000 characters each")
    global _model
    with _lock:
        if _model is None:
            _model = SentenceTransformer(os.environ.get("MODEL_ID", "BAAI/bge-m3"), trust_remote_code=False)
        # First request downloads weights to a persistent volume. Provision model license/storage before production.
        vectors = _model.encode(texts, normalize_embeddings=True).tolist()
    if any(len(v) != 1024 for v in vectors):
        raise HTTPException(status_code=503, detail="Model must emit 1024 dimensions")
    return {"data": [{"index": i, "embedding": v} for i, v in enumerate(vectors)]}
