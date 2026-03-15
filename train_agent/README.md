# LAMMPS RAG System

## Overview

A Retrieval-Augmented Generation (RAG) system for the LAMMPS VS Code extension. It provides:
- **Documentation chat** — answer LAMMPS questions using local LLM + retrieved doc context
- **Script checking** — deterministic syntax validation against command documentation
- **Deep analysis** — LLM-powered cross-command consistency and physics checks

The system runs entirely locally via [Ollama](https://ollama.com) with `nomic-embed-text` for embeddings and a configurable chat model (default: `qwen3:4b`).

## Pipeline

```
 1. Preprocessing                2. Embedding                    3. Runtime (TypeScript)
┌───────────────────────┐       ┌──────────────────────┐        ┌──────────────────────────┐
│ preprocess_docs_RAG.py│       │build_embeddings_json.│        │  src/rag_system.ts       │
│                       │       │         py           │        │  LammpsRagSystem         │
│ Reads:                │       │                      │        │                          │
│  · src/doc_obj.ts     │──►    │ lammps_docs_chunks   │──►     │  Loads chunks + embeddings│
│  · rst/*.rst          │ JSON  │       .json          │ JSON   │  Cosine similarity search │
│  · lammps/examples/   │       │                      │        │  Ollama chat streaming    │
│  · lmps.tmLanguage    │       │ embeddings.json      │──►     │  Deterministic syntax     │
│       .json           │       │  (768-dim vectors)   │        │    validation             │
└───────────────────────┘       └──────────────────────┘        └──────────────────────────┘
```

## Files

```
train_agent/
├── preprocess_docs_RAG.py          # Step 1: Extract & chunk documentation
├── lammps_docs_chunks.json         # Chunked docs (~2770 chunks, ≤1500 tokens each)
├── build_embeddings_json.py        # Step 2: Generate embeddings via Ollama
├── embeddings.json                 # Pre-computed embeddings (768-dim, aligned with chunks)
├── build_faiss_index_ollama.py     # Alternative: build FAISS index (optional)
├── faiss_index_ollama.index        # FAISS binary index (optional, not used at runtime)
├── faiss_meta_ollama.json          # FAISS metadata sidecar (optional)
└── faiss_index_ollama_embeddings.json  # FAISS-exported embeddings (optional)
```

The TypeScript runtime only needs `lammps_docs_chunks.json` and `embeddings.json`. The FAISS files are an alternative Python-side search path and are not required.

## Prerequisites

- [Ollama](https://ollama.com) running locally (`http://127.0.0.1:11434`)
- Models pulled: `nomic-embed-text` (embeddings), plus a chat model (e.g. `qwen3:4b`, `qwen3:8b`)
- Python 3 with `tiktoken` and `requests` (for preprocessing/embedding steps only)

## Rebuilding the Data

### Step 1: Preprocess documentation into chunks

```bash
python3 train_agent/preprocess_docs_RAG.py
```

Reads four documentation sources and produces `lammps_docs_chunks.json`:
- **`src/doc_obj.ts`** — structured command docs (syntax, parameters, examples)
- **`rst/*.rst`** — general RST documentation (howto guides, developer docs)
- **`syntaxes/lmps.tmLanguage.json`** — syntax keywords and style names
- **`~/Documents/Git/lammps/examples/`** — LAMMPS example input scripts

Chunk types: `command_doc`, `example_script`, `syntax_reference`, `general_doc`.

### Step 2: Generate embeddings

```bash
python3 train_agent/build_embeddings_json.py
```

Embeds all chunks via Ollama's `nomic-embed-text` model (768-dim vectors, batches of 8). Produces `embeddings.json` with format:

```json
{ "dimension": 768, "count": 2770, "embeddings": [[...], ...] }
```

Embeddings are index-aligned with `lammps_docs_chunks.json`.

### Full rebuild (both steps)

```bash
python3 train_agent/preprocess_docs_RAG.py && python3 train_agent/build_embeddings_json.py
```

### Environment variables

Both embedding scripts support configuration via env vars:

| Variable | Default | Description |
|---|---|---|
| `CHUNKS_FILE` | `train_agent/lammps_docs_chunks.json` | Input chunks path |
| `OUTPUT_FILE` | `train_agent/embeddings.json` | Output embeddings path |
| `OLLAMA_BASE` | `http://127.0.0.1:11434` | Ollama server URL |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model name |
| `BATCH_SIZE` | `8` | Texts per embedding request |

## Maintenance

**Rebuild index after documentation updates:**
```bash
# 1. Re-extract documentation
python3 train_agent/preprocess_docs_RAG.py

# 2. Rebuild FAISS index
export OLLAMA_EMBED_MODEL="embeddinggemma"
export BATCH_SIZE=1
export REQUEST_TIMEOUT=300
python3 train_agent/build_faiss_index_ollama.py
```

## Environment Variables

```bash
# Ollama configuration
export OLLAMA_BASE="http://127.0.0.1:11434"
export OLLAMA_EMBED_MODEL="embeddinggemma"
export OLLAMA_LLM_MODEL="mistral-lammps:7b"

# Index files
export INDEX_FILE="train_agent/faiss_index_ollama.index"
export META_FILE="train_agent/faiss_meta_ollama.json"
export CHUNKS_FILE="train_agent/lammps_docs_chunks.json"

# Retrieval settings
export TOP_K=5
export REQUEST_TIMEOUT=120
```
