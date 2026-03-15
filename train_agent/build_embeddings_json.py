#!/usr/bin/env python3
"""
Build embeddings.json from lammps_docs_chunks.json using Ollama's nomic-embed-text.

Output format matches what rag_system.ts expects:
{
    "dimension": 768,
    "count": N,
    "embeddings": [[...], [...], ...]  // one per chunk, aligned by index
}
"""

import os
import sys
import json
import time
import requests

CHUNKS_FILE = os.environ.get("CHUNKS_FILE", "train_agent/lammps_docs_chunks.json")
OUTPUT_FILE = os.environ.get("OUTPUT_FILE", "train_agent/embeddings.json")
OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "http://127.0.0.1:11434")
EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "8"))
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "120"))
RETRIES = int(os.environ.get("RETRIES", "3"))


def embed_batch(texts, model, url, timeout):
    """Embed a batch of texts via Ollama OpenAI-compat endpoint."""
    headers = {"Content-Type": "application/json"}
    payload = {"model": model, "input": texts}
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=timeout)
            if r.status_code != 200:
                print(f"  Non-200 (attempt {attempt}): {r.status_code} {r.text[:200]}")
                time.sleep(0.5 * attempt)
                continue
            data = r.json()
            if "data" not in data:
                print(f"  Unexpected response (attempt {attempt}): {str(data)[:200]}")
                time.sleep(0.5 * attempt)
                continue
            return [item["embedding"] for item in data["data"]]
        except requests.exceptions.RequestException as e:
            print(f"  Request failed (attempt {attempt}): {e}")
            time.sleep(0.5 * attempt)
    return None


def embed_single(text, model, url, timeout):
    """Embed a single text (fallback for failed batches)."""
    result = embed_batch([text], model, url, timeout)
    if result:
        return result[0]
    return None


def main():
    if not os.path.exists(CHUNKS_FILE):
        print(f"Chunks file not found: {CHUNKS_FILE}")
        sys.exit(1)

    with open(CHUNKS_FILE, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    texts = [c.get("text", "") for c in chunks]
    total = len(texts)
    url = OLLAMA_BASE.rstrip("/") + "/v1/embeddings"

    print(f"Embedding {total} chunks using {EMBED_MODEL} at {OLLAMA_BASE}")
    print(f"Batch size: {BATCH_SIZE}, Timeout: {REQUEST_TIMEOUT}s")

    all_embeddings = []
    dim = None
    failed_indices = []

    for i in range(0, total, BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (total - 1) // BATCH_SIZE + 1
        print(f"Batch {batch_num}/{total_batches} (chunks {i}-{i + len(batch) - 1})")

        result = embed_batch(batch, EMBED_MODEL, url, REQUEST_TIMEOUT)

        if result is not None:
            for vec in result:
                all_embeddings.append(vec)
                if dim is None:
                    dim = len(vec)
        else:
            # Fallback: try each item individually
            print(f"  Batch failed, trying individually...")
            for j, text in enumerate(batch):
                vec = embed_single(text, EMBED_MODEL, url, REQUEST_TIMEOUT)
                if vec is not None:
                    all_embeddings.append(vec)
                    if dim is None:
                        dim = len(vec)
                else:
                    failed_indices.append(i + j)
                    # Placeholder zero vector (will be filled once we know dim)
                    all_embeddings.append(None)

        time.sleep(0.01)

    if dim is None:
        print("ERROR: No successful embeddings. Aborting.")
        sys.exit(1)

    # Replace None placeholders with zero vectors
    for idx in range(len(all_embeddings)):
        if all_embeddings[idx] is None:
            all_embeddings[idx] = [0.0] * dim

    if failed_indices:
        print(f"WARNING: {len(failed_indices)} chunks failed to embed: {failed_indices}")

    assert len(all_embeddings) == total, \
        f"Embedding count ({len(all_embeddings)}) != chunk count ({total})"

    output = {
        "dimension": dim,
        "count": total,
        "embeddings": all_embeddings
    }

    print(f"Writing {total} embeddings (dim={dim}) to {OUTPUT_FILE}")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f)

    print("Done.")


if __name__ == "__main__":
    main()
