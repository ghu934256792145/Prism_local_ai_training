# VuePrismGraf

**A next-generation graph analytics, vector intelligence, and AI training platform built on a high-performance Rust engine with a Vue 3 frontend.**

> Graph + Matrix + Vector + AI — unified in a single local-first workbench. Everything Grafana cannot do.

---

## What is VuePrismGraf?

VuePrismGraf is a full-stack analytical workbench that replaces fragmented tooling (Neo4j Bloom, TensorBoard, PowerBI, Grafana) with a single coherent system. The Rust engine handles computation; Vue 3 handles rendering. Nothing runs in the cloud unless you choose it.

**The engine can:**
- traverse and query graphs at CSR speed
- perform matrix operations with block-sparse support
- run vector similarity search with cosine / euclidean / dot-product metrics
- stream AI inference via local Ollama models or HuggingFace endpoints
- simulate and monitor AI fine-tuning runs with live loss curves
- generate domain-specific training datasets from graph knowledge

---

## Feature Overview

### Core Explorers

| Page | Shortcut | Description |
|------|----------|-------------|
| Dashboard | `D` | Live engine stats, dataset cards, call-count metrics |
| Graph Explorer | `G` | Force-directed graph, BFS/DFS traversal, path finding |
| Matrix Explorer | `M` | Block-sparse heatmaps, correlation, matrix ops |
| Vector Explorer | `V` | Semantic scatter, cosine similarity search, cluster view |
| AI Workbench | `A` | Ollama chat, RAG context, streaming synthesis |
| Scenario Explorer | `S` | Pre-built analytical scenarios with graph/matrix/vector views |
| Data Collections | `C` | Dataset browser and management |
| Graph Compare | `X` | Side-by-side diff, merge, intersect two graphs |
| Graph Workbench | `W` | Live edit — add/remove nodes and edges, BFS animation |
| App Brain | `B` | Self-referential architecture map of the app itself |

### Industry Verticals

| Page | Shortcut | Standards / Domain |
|------|----------|--------------------|
| Scaffold Planner | — | Ringlock, Cuplock, H-Frame, Kwikstage systems |
| Manufacturing BOM | `F` | ISO 10303 (STEP), EIA-649, IPC-2581 |
| Pipeline / P&ID | `P` | ASME B36.10M, B16.5, B31.3, ISO 10628, ISA-5.1 |
| Network Security | `N` | DMZ, IDS/IPS, Zero Trust (NIST 800-207) |
| AI Training Lab | `I` | LLM fine-tune, LoRA/QLoRA, embeddings, Ollama/HuggingFace |
| Drug Discovery | `K` | Compound–target–pathway–disease knowledge graph |
| Genomics Explorer | `E` | p53 network, insulin signalling, PPI graphs |
| Semiconductor EDA | `U` | ALU netlist, RISC-V pipeline, timing analysis |
| Threat Intelligence | `R` | MITRE ATT&CK, APT29 campaign, ransomware kill chain |

### Dataset Registry — 28 Built-in Graphs

Kubernetes, ERP, Network Security, Zero Trust, Data Center, Supply Chain, Scaffold (×4), Manufacturing BOM (×3), Pipeline P&ID (×2), Drug Discovery, Genomics (×2), Semiconductor EDA (×2), Threat Intel (×2), plus topology primitives (mesh, star, ring, simple, empty).

---

## Tech Stack

```
Frontend              Backend (Rust)          AI Runtime
───────────           ──────────────────────  ──────────────
Vue 3.4               Axum 0.7                Ollama (local)
TypeScript 5          Tokio async runtime     HuggingFace API
Vue Router 4          Serde / serde_json      SSE streaming
Pinia 2               broadcast channels
Apache ECharts 5      OnceLock + Arc<RwLock>
VueUse 10             BFS/DFS engine
Vite 5                SIMD-ready compute
```

---

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 20+
- [Ollama](https://ollama.ai/) (optional — for AI features)

### 1. Start the Rust API

```bash
cd prism-core
cargo run -p prism-api
# Listening on http://0.0.0.0:3000
```

### 2. Start the Vue Dev Server

```bash
npm install
npm run dev
# http://localhost:8300
```

### 3. Build for Production

```bash
# Rust release binary
cd prism-core && cargo build --release

# Vue static assets -> dist/
npm run build
```

---

## Project Structure

```
VuePrismGraf/
├── prism-core/                     Rust workspace
│   └── crates/
│       ├── prism-engine/src/       Core computation modules
│       │   ├── graph.rs            CSR graph + BFS path finding
│       │   ├── matrix.rs           Block-sparse matrix ops
│       │   ├── vector.rs           Vector similarity search
│       │   ├── ai.rs               Ollama / HuggingFace client
│       │   ├── ai_trainer.rs       Training simulation + SSE broadcast
│       │   ├── store.rs            Global DynamicStore (RwLock)
│       │   ├── drug_discovery.rs   Pharma knowledge graph
│       │   ├── genomics.rs         Gene regulatory networks
│       │   ├── semiconductor.rs    EDA netlist graphs
│       │   ├── threat_intel.rs     MITRE ATT&CK graphs
│       │   ├── mfg_bom.rs          BOM explosion engine
│       │   ├── pipeline.rs         Pipeline MTO calculator
│       │   └── scaffold.rs         Scaffold BOM calculator
│       └── prism-api/src/main.rs   60+ Axum routes
│
└── src/                            Vue 3 frontend
    ├── pages/
    │   ├── Dashboard.vue
    │   ├── GraphExplorer.vue
    │   └── industries/
    │       ├── ai-training/        7 pages: Hub, Datasets, Builder, Config, Monitor, Registry, Playground
    │       ├── drug-discovery/
    │       ├── genomics/
    │       ├── semiconductor/
    │       ├── threat-intel/
    │       ├── scaffold/
    │       └── network-security/
    ├── composables/                usePrismAPI, useGraph, useMatrix, useVector, useTheme, useWebSocket
    ├── stores/                     Pinia: workbench (localStorage), AI (in-memory)
    └── router/index.ts             30+ routes
```

---

## API Surface

```
/api/graph/*          Graph traversal, path finding, centrality
/api/matrix/*         Matrix ops, sparse correlation
/api/vector/*         Vector CRUD, similarity search
/api/store/*          Live graph store: load, edit, import, traverse
/api/ai/*             Synthesis (JSON + SSE), model list
/api/train/*          Dataset CRUD, run management, SSE stream, model registry
/api/scaffold/*       BOM calculation, component graphs
/api/mfg/*            BOM explosion, component graphs
/api/pipeline/*       Material takeoff, P&ID graphs
/api/pharma/*         Drug-target-pathway graph
/api/genomics/*       Gene regulatory graphs
/api/semiconductor/*  EDA netlist graphs
/api/threat/*         ATT&CK campaign graphs
/api/scenarios/*      Pre-built scenarios
/api/nvme/*           NVMe device statistics
/api/ws               WebSocket push (graph change events)
```

Full API documentation: [TECHNICAL.md](TECHNICAL.md)

---

## AI Training Lab

End-to-end model training workflow:

1. **Build datasets** — generate Q&A from graph knowledge, upload JSONL/CSV, annotate manually, or synthesize via LLM
2. **Configure runs** — base model (Ollama / HuggingFace), approach (LoRA, QLoRA, Full Fine-tune, Embedding), hyperparameters
3. **Monitor live** — SSE-streamed loss curves, learning rate schedule, console log, stop control
4. **Registry** — compare trained models side-by-side by final loss, dataset size, and approach

---

## License

VuePrismGraf is proprietary software. See [LICENSE](LICENSE) for full terms.

Quick license summary:

- Non-commercial: You may view, run locally, and use the source for personal, educational, and non-commercial development and evaluation as allowed by the `LICENSE`.
- Commercial use: Any commercial use, redistribution, hosting, or incorporation into commercial products requires a separate written commercial license from the project Author.
- AI training: The `LICENSE` explicitly prohibits using the repository contents (code, documentation, datasets, outputs) as training, fine-tuning, or evaluation data for machine learning models without express permission.
- Contributions: By contributing you grant the Author broad rights to use and relicense your contributions as described in the `LICENSE`.
- Third-party software: Third-party dependencies and their licenses are summarized in `NOTICE`. If a Python virtual environment (`.venv/`) or other vendored packages are committed, please remove them before redistribution or ensure their licenses are included.

Contact for commercial licensing and questions: itnmore@proton.me
