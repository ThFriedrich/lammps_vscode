# LAMMPS RAG System - Setup Guide

## What You Have

A complete RAG (Retrieval-Augmented Generation) system for LAMMPS with:
- **Custom Model**: `mistral-lammps:7b` - Mistral 7B fine-tuned for LAMMPS
- **Vector Database**: FAISS index with 316 embedded documentation chunks
- **Query Tools**: Multiple ways to interact with your LAMMPS knowledge base

## Files Created

```
train_agent/
├── preprocess_docs_RAG.py          # Extracts & chunks documentation
├── lammps_docs_chunks.json         # 316 processed chunks
├── build_faiss_index_ollama.py     # Builds FAISS vector index
├── faiss_index_ollama.index        # Vector index (768-dim, 316 vectors)
├── faiss_meta_ollama.json          # Metadata mapping
├── Modelfile                        # Ollama model definition
├── query_lammps.py                 # Simple RAG query tool
├── rag_agent.py                    # Full RAG agent (OpenAI-compatible)
├── mcp_server.py                   # MCP server for VS Code integration
└── mcp_config.json                 # MCP server configuration
```

## Usage Options

### 1. Simple Query Tool (Recommended)
```bash
cd /home/thomas/Documents/Git/lammps_vscode
python3 train_agent/query_lammps.py
```
Interactive prompt with retrieval-augmented answers.

### 2. Direct Model (No Retrieval)
```bash
ollama run mistral-lammps:7b
```

### 3. Python API
```python
import requests

# Query with retrieval
response = requests.post("http://127.0.0.1:11434/api/generate", json={
    "model": "mistral-lammps:7b",
    "prompt": "How do I use pair_style lj/cut?"
})
print(response.json()["response"])
```

## For GitHub Copilot Integration

The `mistral-lammps:7b` model runs via Ollama's API, but GitHub Copilot's agent mode currently only supports specific model providers (OpenAI, Azure OpenAI, Anthropic).

**Workaround Options:**

1. **Use the query tools directly** - Run `query_lammps.py` in a terminal while coding
2. **VS Code extension** - Create a custom extension that adds LAMMPS context to Copilot
3. **Copilot Instructions** - Add LAMMPS knowledge to your `.github/copilot-instructions.md`

### Option 3: Copilot Instructions (Quick Setup)

Create `.github/copilot-instructions.md` in your project:
```markdown
# LAMMPS Project Context

When helping with LAMMPS code:
- Prefer pair_style lj/cut for Lennard-Jones potentials
- Use fix nve/fix nvt/fix npt for time integration
- Common atom_style: atomic, molecular, full
- Use units real or metal for physical systems
- Always define pair_coeff after pair_style

For detailed LAMMPS help, user can run:
python3 train_agent/query_lammps.py
```

## Test the System

```bash
# Quick test
echo "How do I set up a Lennard-Jones potential?" | python3 -c "
import sys
sys.path.insert(0, 'train_agent')
from query_lammps import *
import json

index = faiss.read_index('train_agent/faiss_index_ollama.index')
metadata = json.load(open('train_agent/faiss_meta_ollama.json'))
chunks = json.load(open('train_agent/lammps_docs_chunks.json'))

query = sys.stdin.read().strip()
qvec = embed_query(query)
results = search_index(qvec, index, metadata, chunks, k=3)
answer = query_lammps_model(query, results)
print(answer)
"
```

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
