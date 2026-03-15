#!/usr/bin/env python3
"""
Build a FAISS index using embeddings from a local Ollama service.

Environment variables:
  OLLAMA_BASE (optional) - default: http://127.0.0.1:11434/v1
  OLLAMA_EMBED_MODEL (optional) - model name exposed by Ollama for embeddings
  OPENAI_API_KEY (optional) - if your Ollama server expects a Bearer token

Output:
  - train_agent/faiss_index_ollama.index
  - train_agent/faiss_meta_ollama.json

This script is defensive: retries, timeout, and per-item probing on failures.
"""

import os
import sys
import json
import time
from typing import List, Optional

try:
    import requests
except Exception:
    print("Missing dependency 'requests'. Install with: python3 -m pip install requests")
    raise

try:
    import numpy as np
    import faiss
except Exception:
    print("Missing dependency 'faiss' or 'numpy'. Install with: python3 -m pip install faiss-cpu numpy")
    raise

try:
    from tqdm import tqdm
except Exception:
    tqdm = None

CHUNKS_FILE = os.environ.get("CHUNKS_FILE", "train_agent/lammps_docs_chunks.json")
INDEX_FILE = os.environ.get("INDEX_FILE", "train_agent/faiss_index_ollama.index")
META_FILE = os.environ.get("META_FILE", "train_agent/faiss_meta_ollama.json")

OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "http://127.0.0.1:11434/v1")
OLLAMA_EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "8"))  # nomic-embed-text handles larger batches
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "120"))
RETRIES = int(os.environ.get("RETRIES", "3"))


def embed_texts_ollama(texts: List[str], model=OLLAMA_EMBED_MODEL, batch_size=BATCH_SIZE) -> List[Optional[np.ndarray]]:
    """Call local Ollama/OpenAI-compatible embeddings endpoint and return list of float32 vectors or None on failure."""
    headers = {"Content-Type": "application/json"}
    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    url = OLLAMA_BASE.rstrip("/") + "/embeddings"

    out: List[Optional[np.ndarray]] = []
    total = len(texts)
    iterator = range(0, total, batch_size)
    if tqdm:
        iterator = tqdm(iterator, desc="Embedding batches", unit="batch")

    for i in iterator:
        batch = texts[i:i+batch_size]
        payload = {"model": model, "input": batch}
        print(f"Requesting embeddings for batch {i // batch_size + 1} / {((total-1)//batch_size)+1} (size={len(batch)})")

        last_exc = None
        for attempt in range(1, RETRIES + 1):
            try:
                r = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
                if r.status_code != 200:
                    print(f"Non-200 response from Ollama (attempt {attempt}):", r.status_code)
                    print(r.text[:1000])
                    last_exc = RuntimeError("Ollama embedding request failed")
                    time.sleep(0.5 * attempt)
                    continue

                data = r.json()
                if "data" not in data:
                    print("Unexpected response from Ollama (no 'data' field):", data)
                    last_exc = RuntimeError("Unexpected Ollama response")
                    time.sleep(0.5 * attempt)
                    continue

                for item in data["data"]:
                    vec = np.array(item["embedding"], dtype=np.float32)
                    out.append(vec)

                last_exc = None
                break

            except requests.exceptions.RequestException as e:
                last_exc = e
                print(f"Request to Ollama failed on attempt {attempt}: {e}")
                time.sleep(0.5 * attempt)

        if last_exc is not None:
            # Probe individually to isolate problematic inputs
            print(f"Batch failed after {RETRIES} attempts — probing individual items in batch of size {len(batch)}")
            for j, single in enumerate(batch):
                success = False
                for attempt in range(1, 3):
                    try:
                        r = requests.post(url, json={"model": model, "input": [single]}, headers=headers, timeout=REQUEST_TIMEOUT)
                        if r.status_code != 200:
                            print(f"Single-item non-200 (index {i+j}, attempt {attempt}):", r.status_code)
                            print(r.text[:500])
                            time.sleep(0.2)
                            continue
                        data = r.json()
                        if "data" not in data:
                            print(f"Single-item unexpected response (index {i+j}):", data)
                            time.sleep(0.2)
                            continue
                        vec = np.array(data["data"][0]["embedding"], dtype=np.float32)
                        out.append(vec)
                        success = True
                        break
                    except requests.exceptions.RequestException as e:
                        print(f"Single-item request exception (index {i+j}, attempt {attempt}): {e}")
                        time.sleep(0.2)

                if not success:
                    print(f"Embedding failed for item index {i + j}: len(text)={len(single)} — inserting None placeholder")
                    out.append(None)

        # polite pause
        time.sleep(0.01)

    return out


def main():
    if not os.path.exists(CHUNKS_FILE):
        print(f"Chunks file not found: {CHUNKS_FILE}")
        print("Run preprocess_docs_RAG.py first to generate chunks.")
        sys.exit(1)

    with open(CHUNKS_FILE, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    texts = [c.get("text", "") for c in chunks]
    # Save all relevant metadata fields for each chunk type
    meta = []
    for c in chunks:
        m = {
            "id": c.get("id"),
            "type": c.get("type"),
            "chunk_number": c.get("chunk_number")
        }
        # Add type-specific fields
        if c.get("command"):
            m["command"] = c.get("command")
        if c.get("name"):
            m["name"] = c.get("name")
        if c.get("title"):
            m["title"] = c.get("title")
        if c.get("category"):
            m["category"] = c.get("category")
        if c.get("filename"):
            m["filename"] = c.get("filename")
        meta.append(m)

    print(f"Embedding {len(texts)} chunks using Ollama at {OLLAMA_BASE} (model={OLLAMA_EMBED_MODEL})")
    vectors = embed_texts_ollama(texts, model=OLLAMA_EMBED_MODEL, batch_size=BATCH_SIZE)

    # Determine embedding dim from first successful vector
    dim = None
    for v in vectors:
        if v is not None:
            dim = v.shape[0]
            break

    if dim is None:
        print("Error: no successful embeddings returned; aborting.")
        sys.exit(1)

    # Replace None placeholders with zero vectors of the right dim
    xb_list = []
    for idx, v in enumerate(vectors):
        if v is None:
            xb_list.append(np.zeros(dim, dtype=np.float32))
        else:
            xb_list.append(v.astype(np.float32))

    xb = np.vstack(xb_list)

    print(f"Building FAISS index (dim={dim}, n={xb.shape[0]})")
    index = faiss.IndexFlatL2(dim)
    index = faiss.IndexIDMap(index)
    ids = np.arange(xb.shape[0]).astype('int64')
    index.add_with_ids(xb, ids)

    os.makedirs(os.path.dirname(INDEX_FILE) or ".", exist_ok=True)
    faiss.write_index(index, INDEX_FILE)
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    # Export embeddings to JSON for TypeScript RAG
    embeddings_file = INDEX_FILE.replace(".index", "_embeddings.json")
    print(f"Exporting embeddings to {embeddings_file}...")
    with open(embeddings_file, "w") as f:
        json.dump({
            "dimension": int(dim),
            "count": int(xb.shape[0]),
            "embeddings": xb.tolist()
        }, f)
    
    size_mb = os.path.getsize(embeddings_file) / (1024 * 1024)
    print(f"✓ Exported {xb.shape[0]} embeddings ({dim} dims, {size_mb:.1f} MB)")

    print("Saved index to", INDEX_FILE)
    print("Saved metadata to", META_FILE)


if __name__ == "__main__":
    main()
