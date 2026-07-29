# Project: NotebookLM MCP + Claude Integration for Automated Research

**Được thêm vào Chương X: Siêu Nhận Thức Trong AI**

---

## 13. DỰ ÁN THỰC HÀNH: TÍCH HỢP NOTEBOOKLM MCP VỚI CLAUDE CHO NGHIÊN CỨU TỰ ĐỘNG

### 13.1 Tổng Quan Kiến Trúc

Mô hình **NotebookLM MCP + Claude** tạo ra một quy trình nghiên cứu thống nhất (unified research workflow) khắc phục được việc chuyển đổi ngữ cảnh (context switching) giữa thu thập dữ liệu và sinh mã/đầu ra.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESEARCHER (NGƯỜI)                           │
│  "Tạo bài thuyết trình về use case Cowork cho creators"        │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Natural language request
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLAUDE (ORCHESTRATOR)                      │
│  • Custom Skill: Autonomous Research → Presentation            │
│  • Phân tích request → Chuỗi truy vấn tuần tự                  │
│  • Tổng hợp insights → Context-aware prompt cho NotebookLM     │
└──────────────────────┬──────────────────────────────────────────┘
                       │ MCP Protocol (OAuth)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NOTEBOOKLM MCP SERVER                         │
│  • 50+ nguồn nghiên cứu (docs, PDFs, URLs, YouTube)            │
│  • Deep research: Briefing docs, Study guides, Audio overviews │
│  • Truy vấn ngữ nghĩa trên toàn bộ kho dữ liệu                  │
└─────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Quy trình truyền thống | Quy trình MCP-Based |
|-----------|------------------------|---------------------|
| **Truy xuất dữ liệu** | Truy vấn thủ công, lặp lại | Tự động, truy vấn tuần tự qua MCP |
| **Hiệu quả** | Tốn thời gian, dễ lỗi | Nhanh, ít can thiệp thủ công |
| **Chất lượng output** | Tóm tắt chung chung, mất dữ liệu | Nhận biết ngữ cảnh, chi tiết, liên quan |
| **Tiêu thụ tài nguyên** | Token cao do tìm kiếm lặp | Tối ưu token với tổng hợp tự động |

### 13.2 Cài Đặt NotebookLM MCP Server (Windows)

```powershell
# 1. Cài đặt Node.js (nếu chưa có)
winget install OpenJS.NodeJS.LTS

# 2. Clone & cài đặt NotebookLM MCP
git clone https://github.com/notebooklm/mcp-server.git
cd mcp-server
npm install

# 3. Xác thực (OAuth)
npm run auth
# → Mở trình duyệt → Đăng nhập Google → Cho phép truy cập NotebookLM

# 4. Cấu hình
# Chỉnh sửa config.json:
# {
#   "notebooklm": {
#     "notebook_ids": ["your-notebook-id-1", "your-notebook-id-2"],
#     "query_types": ["briefing_doc", "study_guide", "audio_overview", "mind_map"]
#   },
#   "server": { "port": 3000, "host": "localhost" }
# }

# 5. Test server
npm run test
# Kết quả mong đợi: "MCP Server running on http://localhost:3000"

# 6. Chạy nền (Production)
npm run start:prod
# Hoặc dùng PM2: npm i -g pm2 && pm2 start index.js --name notebooklm-mcp
```

### 13.3 Kết Nối MCP Server Với Claude Desktop

```json
// %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["C:\\path\\to\\mcp-server\\index.js"],
      "env": {
        "NOTEBOOKLM_API_KEY": "your-api-key",
        "MCP_PORT": "3000"
      }
    }
  }
}
```

Sau khi khởi động lại Claude Desktop:
1. Mở **Settings → Search and Tools**
2. Chọn **"Add External Connector"** → **NotebookLM MCP**
3. Xác thực OAuth → Chạy test query: *"Liệt kê 5 notebook gần nhất"*

### 13.4 Tạo Custom Claude Skills Cho Tự Động Hóa Nghiên Cứu

**Skill: Autonomous Research → Presentation Deck**

```json
// skills/research-to-presentation.json
{
  "name": "research-to-presentation",
  "description": "Tự động nghiên cứu từ NotebookLM và tạo bài thuyết trình",
  "parameters": {
    "type": "object",
    "properties": {
      "topic": { "type": "string", "description": "Chủ đề nghiên cứu" },
      "audience": { "type": "string", "enum": ["technical", "executive", "general", "creators"] },
      "slide_count": { "type": "integer", "minimum": 10, "maximum": 50, "default": 20 },
      "notebook_ids": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["topic", "audience"]
  },
  "workflow": [
    {
      "step": "decompose_topic",
      "prompt": "Phân tích chủ đề '{topic}' thành 5-7 câu hỏi nghiên cứu con cho audience {audience}"
    },
    {
      "step": "sequential_queries",
      "loop": "questions",
      "prompt": "Tìm kiếm trong NotebookLM: '{question}'. Trích xuất insights chính, citations, và conflicting views."
    },
    {
      "step": "synthesize",
      "prompt": "Tổng hợp {N} kết quả tìm kiếm. Xác định themes chung, outliers, gaps. Tạo outline {slide_count} slides."
    },
    {
      "step": "generate_deck",
      "prompt": "Tạo briefing document cho NotebookLM tạo presentation deck. Audience: {audience}. Format: Slides với title, bullet points, speaker notes, citations."
    }
  ],
  "output": {
    "presentation_deck": "Google Slides / PowerPoint / Markdown",
    "research_summary": "Briefing document (NotebookLM format)",
    "citations": "Danh sách nguồn với page/section references",
    "audio_overview": "Optional: Podcast-style audio summary"
  }
}
```

**Đăng ký skill với Claude:**
```bash
# Cách 1: Qua Claude Desktop UI
Settings → Skills → Import → Chọn file JSON

# Cách 2: Qua CLI (nếu có)
claude skill install research-to-presentation.json
```

### 13.5 Use Case Thực Tế: Nghiên Cứu Tự Động → Presentation Deck

**Input:** *"Tôi cần bài thuyết trình 20 slides về use case Cowork platforms cho content creators. Audience: creators. Nguồn: 50 notebooks trong NotebookLM."*

**Quy trình tự động:**

```mermaid
sequenceDiagram
    participant U as User
    participant C as Claude (Skill)
    participant N as NotebookLM MCP
    
    U->>C: "Tạo deck Cowork cho creators (20 slides)"
    C->>C: Decompose → 7 research questions
    loop 7 questions
        C->>N: Query: "Cowork monetization models"
        N-->>C: 5 sources + insights
        C->>N: Query: "Creator collaboration workflows"
        N-->>C: 8 sources + insights
        ...
    end
    C->>C: Synthesize → Outline 20 slides
    C->>N: Generate briefing_doc → Presentation deck
    N-->>C: Slides + citations + speaker notes
    C-->>U: Deck hoàn chỉnh + Research summary + Audio overview
```

**Outputs nhận được:**
- 📊 **Presentation Deck** (20 slides, citations mỗi slide)
- 📄 **Research Briefing Doc** (NotebookLM format, 15 pages)
- 🎧 **Audio Overview** (10-min podcast style)
- 🗺️ **Mind Map** (Interactive, linked to sources)
- 📋 **Citation Index** (Source → Page → Claim mapping)

### 13.6 Best Practices & Technical Considerations

| Lĩnh vực | Khuyến nghị |
|----------|-------------|
| **Token Optimization** | Dùng sequential queries thay vì single large query; cache NotebookLM responses |
| **Error Handling** | Retry với exponential backoff; fallback về manual query nếu MCP timeout |
| **Data Freshness** | Schedule nightly sync: `notebooklm sync --all` |
| **Access Control** | OAuth scopes tối thiểu: `notebooklm.read`, `notebooklm.query` |
| **Monitoring** | Log query latency, success rate, token usage per skill execution |
| **Versioning** | Skill versioning: `research-to-presentation@v1.2.0` |

### 13.7 Mở Rộng: Multi-Agent Research Pipeline

```python
# research_pipeline.py
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class AgentRole(Enum):
    PLANNER = "planner"           # Phân rã topic → research questions
    SEARCHER = "searcher"         # Query NotebookLM MCP
    ANALYST = "analyst"           # Phân tích, so sánh, tìm gaps
    SYNTHESIZER = "synthesizer"   # Tổng hợp → outline
    CRITIC = "critic"             # Review chất lượng, tìm bias
    FORMATTER = "formatter"       # Tạo output cuối (deck, doc, audio)

@dataclass
class ResearchTask:
    topic: str
    audience: str
    notebook_ids: List[str]
    output_formats: List[str]  # ["slides", "briefing_doc", "audio", "mindmap"]
    quality_threshold: float = 0.85

@dataclass
class MultiAgentResearchPipeline:
    mcp_client: Any
    claude_client: Any
    
    def execute(self, task: ResearchTask) -> dict:
        # 1. Planning
        plan = self.planner_agent(task)
        
        # 2. Parallel Search
        search_results = []
        for q in plan.questions:
            for nb_id in task.notebook_ids:
                result = self.searcher_agent(q, nb_id)
                search_results.append(result)
        
        # 3. Analysis
        analysis = self.analyst_agent(search_results)
        
        # 4. Synthesis
        outline = self.synthesizer_agent(analysis, task)
        
        # 5. Critic Loop
        quality = 0.0
        while quality < task.quality_threshold:
            draft = self.formatter_agent(outline, task)
            quality = self.critic_agent(draft, task)
            if quality < task.quality_threshold:
                outline = self.refine_outline(outline, quality.feedback)
        
        # 6. Final outputs
        return self.generate_outputs(draft, task.output_formats)
```

---

## 14. KẾ HOẠCH TRIỂN KHAI MÔI TRƯỜNG PC CÁ NHÂN (WINDOWS)

### 14.1 Mục Tiêu

Xây dựng **môi trường AI research & development** hoàn chỉnh trên Windows, tích hợp:
- NotebookLM MCP + Claude Desktop
- Local LLMs (Ollama) cho offline/private workloads
- Vector DB (Qdrant) cho RAG cá nhân
- Automation pipeline (Python + PowerShell)
- Monitoring & Cost tracking

### 14.2 Kiến Trúc Hệ Thống PC

```
┌────────────────────────────────────────────────────────────────┐
│                     WINDOWS HOST (PC Henry)                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ Claude      │ │ NotebookLM  │ │ Ollama      │ │ Qdrant    │ │
│  │ Desktop     │ │ MCP Server  │ │ (Local LLMs)│ │ (VectorDB)│ │
│  │ + Skills    │ │ (Node.js)   │ │ llama3.1,   │ │ Port 6333 │ │
│  │             │ │ Port 3000   │ │ codellama,  │ │           │ │
│  │             │ │             │ │ nomic-embed │ │           │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │
│         │               │               │              │        │
│         └───────────────┼───────────────┼──────────────┘        │
│                         ▼               ▼                       │
│              ┌─────────────────────────────────────────────┐   │
│              │           PYTHON AUTOMATION LAYER           │   │
│              │  • research_pipeline.py                     │   │
│              │  • cost_tracker.py                          │   │
│              │  • sync_scheduler.py (Windows Task)         │   │
│              │  • health_monitor.py                        │   │
│              └─────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│              ┌─────────────────────────────────────────────┐   │
│              │         DATA STORAGE (Local)                │   │
│              │  D:\AI_Data\                                │   │
│              │  ├── notebooks\ (NotebookLM exports)        │   │
│              │  ├── vectors\ (Qdrant data)                 │   │
│              │  ├── models\ (Ollama models)                │   │
│              │  ├── logs\ (pipeline runs, costs)           │   │
│              │  └── outputs\ (decks, reports, audio)       │   │
│              └─────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 14.3 Cài Đặt Chi Tiết (Windows PowerShell Admin)

```powershell
# ============================================================
# 1. PREREQUISITES
# ============================================================
# Chocolatey (Package Manager)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Core tools
choco install -y nodejs-lts python git vscode docker-desktop
choco install -y ollama qdrant
choco install -y ffmpeg  # cho audio processing

# Verify
node --version && python --version && ollama --version

# ============================================================
# 2. OLLAMA LOCAL LLMS
# ============================================================
# Start service
ollama serve

# Pull models (trong PowerShell khác)
ollama pull llama3.1:8b        # General purpose
ollama pull codellama:13b      # Coding
ollama pull nomic-embed-text   # Embeddings
ollama pull llava:7b           # Vision

# Test
ollama run llama3.1:8b "Test Vietnamese: Xin chào"

# ============================================================
# 3. QDRANT VECTOR DATABASE
# ============================================================
# Run as service
qdrant --config-path D:\AI_Data\qdrant\config.yaml

# Config: D:\AI_Data\qdrant\config.yaml
# storage:
#   path: D:\AI_Data\qdrant\storage
# service:
#   http_port: 6333
#   grpc_port: 6334

# Test
curl http://localhost:6333/collections

# ============================================================
# 4. NOTEBOOKLM MCP SERVER
# ============================================================
git clone https://github.com/notebooklm/mcp-server.git D:\AI_Tools\notebooklm-mcp
cd D:\AI_Tools\notebooklm-mcp
npm install

# Config: D:\AI_Tools\notebooklm-mcp\config.json
# {
#   "notebooklm": {
#     "notebook_ids": ["<your-notebook-ids>"],
#     "query_types": ["briefing_doc", "study_guide", "audio_overview", "mind_map"]
#   },
#   "server": { "port": 3000, "host": "127.0.0.1" },
#   "storage": { "cache_dir": "D:\\AI_Data\\mcp_cache" }
# }

# Auth
npm run auth

# Test
npm run test

# Install as Windows Service (NSSM)
# nssm install NotebookLM-MCP "node" "D:\AI_Tools\notebooklm-mcp\index.js"
# nssm set NotebookLM-MCP AppDirectory "D:\AI_Tools\notebooklm-mcp"
# nssm start NotebookLM-MCP

# ============================================================
# 5. CLAUDE DESKTOP + MCP CONFIG
# ============================================================
# File: %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["D:\\AI_Tools\\notebooklm-mcp\\index.js"],
      "env": { "MCP_PORT": "3000" }
    },
    "qdrant": {
      "command": "npx",
      "args": ["-y", "@qdrant/mcp-server", "--url", "http://localhost:6333"]
    },
    "ollama": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-ollama", "--host", "http://localhost:11434"]
    }
  }
}

# ============================================================
# 6. PYTHON AUTOMATION ENVIRONMENT
# ============================================================
python -m venv D:\AI_Env\research-env
D:\AI_Env\research-env\Scripts\Activate.ps1

pip install --upgrade pip
pip install \
  qdrant-client \
  ollama \
  langchain langchain-community langchain-ollama \
  anthropic openai google-generativeai \
  python-dotenv \
  pyyaml pydantic pydantic-settings \
  rich typer \
  schedule \
  psutil \
  matplotlib pandas openpyxl \
  python-pptx \
  jupyterlab

# Dev tools
pip install pytest pytest-asyncio black ruff mypy

# ============================================================
# 7. PROJECT STRUCTURE
# ============================================================
mkdir D:\AI_Projects\metacognition-research
cd D:\AI_Projects\metacognition-research

# Structure:
# .
# ├── config/
# │   ├── settings.yaml
# │   ├── skills/
# │   │   └── research-to-presentation.json
# │   └── prompts/
# ├── src/
# │   ├── __init__.py
# │   ├── pipeline/
# │   │   ├── __init__.py
# │   │   ├── research_pipeline.py
# │   │   ├── agents.py
# │   │   └── skills_manager.py
# │   ├── integrations/
# │   │   ├── __init__.py
# │   │   ├── notebooklm_mcp.py
# │   │   ├── qdrant_client.py
# │   │   └── ollama_client.py
# │   ├── utils/
# │   │   ├── __init__.py
# │   │   ├── cost_tracker.py
# │   │   ├── logger.py
# │   │   └── helpers.py
# │   └── cli.py
# ├── tests/
# ├── data/
# │   ├── inputs/
# │   └── outputs/
# ├── scripts/
# │   ├── sync_notebooks.ps1
# │   ├── backup_data.ps1
# │   └── health_check.ps1
# ├── requirements.txt
# ├── pyproject.toml
# └── README.md

# ============================================================
# 8. CONFIG FILES
# ============================================================

# config/settings.yaml
cat > config/settings.yaml << 'EOF'
app:
  name: "Metacognition Research Pipeline"
  version: "1.0.0"
  data_dir: "D:/AI_Data"
  log_level: "INFO"

notebooklm_mcp:
  host: "127.0.0.1"
  port: 3000
  notebook_ids: []  # Fill from NotebookLM
  timeout: 120
  retry_attempts: 3

qdrant:
  host: "127.0.0.1"
  port: 6333
  collection_prefix: "research_"
  vector_size: 768  # nomic-embed-text

ollama:
  host: "http://127.0.0.1:11434"
  models:
    chat: "llama3.1:8b"
    code: "codellama:13b"
    embed: "nomic-embed-text"
    vision: "llava:7b"

claude:
  desktop_config: "%APPDATA%/Claude/claude_desktop_config.json"
  skills_dir: "config/skills"

pipeline:
  default_quality_threshold: 0.85
  max_iterations: 3
  parallel_search: true
  cache_ttl_hours: 24

cost_tracking:
  enabled: true
  currency: "USD"
  models:
    claude-3.5-sonnet: { input: 3.0, output: 15.0 }  # per 1M tokens
    gpt-4o: { input: 5.0, output: 15.0 }
    gemini-1.5-pro: { input: 3.5, output: 10.5 }
  local_models_cost: 0.0

scheduler:
  sync_notebooks: "0 2 * * *"      # Daily 2 AM
  backup_data: "0 3 * * 0"         # Weekly Sunday 3 AM
  health_check: "*/15 * * * *"     # Every 15 min
  cost_report: "0 9 1 * *"         # Monthly 1st 9 AM
EOF

# config/skills/research-to-presentation.json
# (Copy từ section 13.4)

# ============================================================
# 9. CORE PYTHON MODULES
# ============================================================

# src/integrations/notebooklm_mcp.py
cat > src/integrations/notebooklm_mcp.py << 'EOF'
"""NotebookLM MCP Client Integration"""
import asyncio
import json
import httpx
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

class QueryType(Enum):
    BRIEFING_DOC = "briefing_doc"
    STUDY_GUIDE = "study_guide"
    AUDIO_OVERVIEW = "audio_overview"
    MIND_MAP = "mind_map"
    FAQ = "faq"
    TIMELINE = "timeline"

@dataclass
class NotebookLMQuery:
    question: str
    notebook_ids: List[str]
    query_type: QueryType = QueryType.BRIEFING_DOC
    max_sources: int = 10

@dataclass
class NotebookLMResponse:
    answer: str
    sources: List[Dict[str, Any]]
    citations: List[Dict[str, Any]]
    confidence: float
    query_type: QueryType

class NotebookLMMCPClient:
    def __init__(self, base_url: str = "http://127.0.0.1:3000", timeout: int = 120):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def query(self, query: NotebookLMQuery) -> NotebookLMResponse:
        payload = {
            "question": query.question,
            "notebook_ids": query.notebook_ids,
            "query_type": query.query_type.value,
            "max_sources": query.max_sources
        }
        response = await self.client.post(f"{self.base_url}/query", json=payload)
        response.raise_for_status()
        data = response.json()
        return NotebookLMResponse(
            answer=data["answer"],
            sources=data.get("sources", []),
            citations=data.get("citations", []),
            confidence=data.get("confidence", 0.0),
            query_type=query.query_type
        )
    
    async def sequential_queries(self, questions: List[str], notebook_ids: List[str], 
                                  query_type: QueryType = QueryType.BRIEFING_DOC) -> List[NotebookLMResponse]:
        """Chạy nhiều truy vấn tuần tự, tổng hợp kết quả"""
        results = []
        for q in questions:
            nlm_query = NotebookLMQuery(
                question=q, 
                notebook_ids=notebook_ids, 
                query_type=query_type
            )
            result = await self.query(nlm_query)
            results.append(result)
            # Rate limiting
            await asyncio.sleep(1)
        return results
    
    async def generate_output(self, content: str, output_type: QueryType, 
                              notebook_ids: List[str]) -> Dict[str, Any]:
        """Yêu cầu NotebookLM tạo output đặc thù (deck, audio, mindmap)"""
        payload = {
            "content": content,
            "output_type": output_type.value,
            "notebook_ids": notebook_ids
        }
        response = await self.client.post(f"{self.base_url}/generate", json=payload)
        response.raise_for_status()
        return response.json()
    
    async def health_check(self) -> bool:
        try:
            resp = await self.client.get(f"{self.base_url}/health")
            return resp.status_code == 200
        except:
            return False
    
    async def close(self):
        await self.client.aclose()
EOF

# src/integrations/qdrant_client.py
cat > src/integrations/qdrant_client.py << 'EOF'
"""Qdrant Vector Database Client for Personal RAG"""
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from typing import List, Dict, Any, Optional
import uuid
import numpy as np

class PersonalRAGClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 6333, 
                 collection_prefix: str = "research_", vector_size: int = 768):
        self.client = QdrantClient(host=host, port=port)
        self.collection_prefix = collection_prefix
        self.vector_size = vector_size
    
    def _collection_name(self, namespace: str) -> str:
        return f"{self.collection_prefix}{namespace}"
    
    def create_collection(self, namespace: str):
        name = self._collection_name(namespace)
        self.client.recreate_collection(
            collection_name=name,
            vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE)
        )
    
    def upsert_documents(self, namespace: str, documents: List[Dict[str, Any]], 
                         embeddings: List[List[float]]):
        """Insert documents with embeddings"""
        name = self._collection_name(namespace)
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=emb,
                payload=doc
            )
            for doc, emb in zip(documents, embeddings)
        ]
        self.client.upsert(collection_name=name, points=points)
    
    def search(self, namespace: str, query_vector: List[float], 
               limit: int = 10, score_threshold: float = 0.7,
               filter_conditions: Optional[Dict] = None) -> List[Dict[str, Any]]:
        name = self._collection_name(namespace)
        
        query_filter = None
        if filter_conditions:
            conditions = [
                FieldCondition(key=k, match=MatchValue(value=v))
                for k, v in filter_conditions.items()
            ]
            query_filter = Filter(must=conditions)
        
        results = self.client.search(
            collection_name=name,
            query_vector=query_vector,
            limit=limit,
            score_threshold=score_threshold,
            query_filter=query_filter,
            with_payload=True
        )
        return [
            {"score": r.score, "payload": r.payload, "id": r.id}
            for r in results
        ]
    
    def hybrid_search(self, namespace: str, query_text: str, query_vector: List[float],
                      limit: int = 10, alpha: float = 0.5) -> List[Dict[str, Any]]:
        """Kết hợp semantic + keyword search"""
        # Semantic search
        semantic_results = self.search(namespace, query_vector, limit=limit*2)
        
        # Keyword filter (simple text match in payload)
        keyword_results = self.client.scroll(
            collection_name=self._collection_name(namespace),
            scroll_filter=Filter(
                must=[FieldCondition(key="text", match=MatchValue(value=query_text))]
            ),
            limit=limit*2
        )[0]
        
        # Combine with Reciprocal Rank Fusion
        combined = {}
        for rank, r in enumerate(semantic_results):
            key = r["id"]
            combined[key] = combined.get(key, {"payload": r["payload"], "semantic_rank": 1e9, "keyword_rank": 1e9})
            combined[key]["semantic_rank"] = rank + 1
        
        for rank, r in enumerate(keyword_results):
            key = r.id
            combined[key] = combined.get(key, {"payload": r.payload, "semantic_rank": 1e9, "keyword_rank": 1e9})
            combined[key]["keyword_rank"] = rank + 1
        
        # RRF scoring
        scored = []
        for key, data in combined.items():
            semantic_score = 1.0 / (60 + data["semantic_rank"]) if data["semantic_rank"] < 1e9 else 0
            keyword_score = 1.0 / (60 + data["keyword_rank"]) if data["keyword_rank"] < 1e9 else 0
            rrf_score = alpha * semantic_score + (1 - alpha) * keyword_score
            scored.append({"id": key, "score": rrf_score, "payload": data["payload"]})
        
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]
EOF

# src/integrations/ollama_client.py
cat > src/integrations/ollama_client.py << 'EOF'
"""Ollama Local LLM Client"""
import ollama
from typing import List, Dict, Any, Optional, AsyncGenerator
import json

class OllamaClient:
    def __init__(self, host: str = "http://127.0.0.1:11434"):
        self.client = ollama.Client(host=host)
    
    def chat(self, model: str, messages: List[Dict[str, str]], 
             stream: bool = False, **kwargs) -> Dict[str, Any]:
        return self.client.chat(model=model, messages=messages, stream=stream, **kwargs)
    
    async def chat_stream(self, model: str, messages: List[Dict[str, str]], 
                          **kwargs) -> AsyncGenerator[str, None]:
        stream = await asyncio.to_thread(
            self.client.chat, model=model, messages=messages, stream=True, **kwargs
        )
        for chunk in stream:
            if chunk.get("message", {}).get("content"):
                yield chunk["message"]["content"]
    
    def embed(self, model: str, input: str | List[str]) -> List[List[float]]:
        resp = self.client.embed(model=model, input=input)
        return resp["embeddings"]
    
    def list_models(self) -> List[str]:
        return [m["name"] for m in self.client.list()["models"]]
    
    def pull_model(self, model: str) -> Dict[str, Any]:
        return self.client.pull(model=model)

# Cost tracking (local = $0)
class LocalModelCostTracker:
    @staticmethod
    def estimate_tokens(text: str) -> int:
        return len(text) // 4  # Rough estimate
    
    @staticmethod
    def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
        return 0.0  # Local models are free
EOF

# src/utils/cost_tracker.py
cat > src/utils/cost_tracker.py << 'EOF'
"""Cost Tracking for API-based Models"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from contextlib import contextmanager

@dataclass
class UsageRecord:
    timestamp: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    input_cost: float
    output_cost: float
    total_cost: float
    operation: str
    session_id: str

class CostTracker:
    def __init__(self, db_path: str = "D:/AI_Data/logs/cost_tracking.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    model TEXT,
                    provider TEXT,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    input_cost REAL,
                    output_cost REAL,
                    total_cost REAL,
                    operation TEXT,
                    session_id TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON usage(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_session ON usage(session_id)")
    
    # Model pricing (per 1M tokens)
    PRICING = {
        "claude-3.5-sonnet": {"provider": "anthropic", "input": 3.0, "output": 15.0},
        "claude-3-opus": {"provider": "anthropic", "input": 15.0, "output": 75.0},
        "claude-3-haiku": {"provider": "anthropic", "input": 0.25, "output": 1.25},
        "gpt-4o": {"provider": "openai", "input": 5.0, "output": 15.0},
        "gpt-4o-mini": {"provider": "openai", "input": 0.15, "output": 0.60},
        "gemini-1.5-pro": {"provider": "google", "input": 3.5, "output": 10.5},
        "gemini-1.5-flash": {"provider": "google", "input": 0.075, "output": 0.30},
    }
    
    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> Dict[str, float]:
        pricing = self.PRICING.get(model, {"input": 0, "output": 0})
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return {
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total_cost": input_cost + output_cost,
            "provider": pricing.get("provider", "unknown")
        }
    
    def record_usage(self, model: str, input_tokens: int, output_tokens: int, operation: str):
        costs = self.calculate_cost(model, input_tokens, output_tokens)
        record = UsageRecord(
            timestamp=datetime.now().isoformat(),
            model=model,
            provider=costs["provider"],
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            input_cost=costs["input_cost"],
            output_cost=costs["output_cost"],
            total_cost=costs["total_cost"],
            operation=operation,
            session_id=self.session_id
        )
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO usage (timestamp, model, provider, input_tokens, output_tokens,
                                 input_cost, output_cost, total_cost, operation, session_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (record.timestamp, record.model, record.provider, record.input_tokens,
                  record.output_tokens, record.input_cost, record.output_cost,
                  record.total_cost, record.operation, record.session_id))
    
    @contextmanager
    def track_operation(self, model: str, operation: str):
        """Context manager để track usage tự động"""
        class TokenCounter:
            def __init__(self):
                self.input_tokens = 0
                self.output_tokens = 0
        
        counter = TokenCounter()
        yield counter
        
        costs = self.calculate_cost(model, counter.input_tokens, counter.output_tokens)
        self.record_usage(model, counter.input_tokens, counter.output_tokens, operation)
    
    def get_session_report(self) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT model, provider, SUM(input_tokens) as total_input,
                       SUM(output_tokens) as total_output,
                       SUM(total_cost) as total_cost,
                       COUNT(*) as operations
                FROM usage WHERE session_id = ?
                GROUP BY model, provider
            """, (self.session_id,))
            rows = cursor.fetchall()
        
        total_cost = sum(r[4] for r in rows)
        return {
            "session_id": self.session_id,
            "total_cost_usd": total_cost,
            "by_model": [
                {"model": r[0], "provider": r[1], "input_tokens": r[2],
                 "output_tokens": r[3], "cost": r[4], "operations": r[5]}
                for r in rows
            ]
        }
    
    def get_monthly_report(self, year: int, month: int) -> Dict[str, Any]:
        start = f"{year}-{month:02d}-01"
        if month == 12:
            end = f"{year+1}-01-01"
        else:
            end = f"{year}-{month+1:02d}-01"
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT DATE(timestamp) as day, model, SUM(total_cost) as daily_cost,
                       SUM(input_tokens + output_tokens) as daily_tokens
                FROM usage 
                WHERE timestamp >= ? AND timestamp < ?
                GROUP BY day, model
                ORDER BY day
            """, (start, end))
            rows = cursor.fetchall()
        
        return {
            "period": f"{year}-{month:02d}",
            "daily_breakdown": [
                {"date": r[0], "model": r[1], "cost": r[2], "tokens": r[3]}
                for r in rows
            ],
            "total_cost": sum(r[2] for r in rows)
        }
EOF

# src/pipeline/research_pipeline.py (Multi-Agent)
cat > src/pipeline/research_pipeline.py << 'EOF'
"""Multi-Agent Research Pipeline with Metacognitive Checks"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
import asyncio
import json

from src.integrations.notebooklm_mcp import NotebookLMMCPClient, NotebookLMQuery, QueryType
from src.integrations.qdrant_client import PersonalRAGClient
from src.integrations.ollama_client import OllamaClient
from src.utils.cost_tracker import CostTracker

class AgentRole(Enum):
    PLANNER = "planner"
    SEARCHER = "searcher"
    ANALYST = "analyst"
    SYNTHESIZER = "synthesizer"
    CRITIC = "critic"
    FORMATTER = "formatter"

@dataclass
class ResearchTask:
    topic: str
    audience: str = "general"
    notebook_ids: List[str] = field(default_factory=list)
    output_formats: List[str] = field(default_factory=lambda: ["slides", "briefing_doc"])
    quality_threshold: float = 0.85
    max_iterations: int = 3

@dataclass
class AgentResult:
    role: AgentRole
    output: Any
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)

class MetacognitiveResearchPipeline:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.nlm = NotebookLMMCPClient(
            base_url=f"http://{config['notebooklm_mcp']['host']}:{config['notebooklm_mcp']['port']}",
            timeout=config['notebooklm_mcp']['timeout']
        )
        self.qdrant = PersonalRAGClient(
            host=config['qdrant']['host'],
            port=config['qdrant']['port'],
            collection_prefix=config['qdrant']['collection_prefix'],
            vector_size=config['qdrant']['vector_size']
        )
        self.ollama = OllamaClient(host=config['ollama']['host'])
        self.cost_tracker = CostTracker()
        
        self.agent_prompts = {
            AgentRole.PLANNER: """Bạn là Research Planner. Nhiệm vụ: Phân rã topic thành 5-7 câu hỏi nghiên cứu cụ thể, có thứ tự ưu tiên.
Input: {topic}, audience: {audience}
Output JSON: {"questions": ["q1", "q2", ...], "priority_rationale": "..."}""",
            
            AgentRole.SEARCHER: """Bạn là Search Agent. Dùng NotebookLM MCP truy xuất dữ liệu.
Input: question, notebook_ids
Gọi tool query_notebooklm. Trả về: sources, key_claims, confidence, gaps.""",
            
            AgentRole.ANALYST: """Bạn là Analyst. So sánh sources, tìm patterns, contradictions, gaps.
Input: search_results từ nhiều queries
Output JSON: {"patterns": [...], "contradictions": [...], "gaps": [...], "key_insights": [...]}""",
            
            AgentRole.SYNTHESIZER: """Bạn là Synthesizer. Tạo outline presentation/report từ analysis.
Input: analysis, task (topic, audience, output_formats)
Output JSON: {"outline": [{"slide": 1, "title": "...", "bullets": [...], "citations": [...]}], "narrative_arc": "..."}""",
            
            AgentRole.CRITIC: """Bạn là Critic gay gắt. Review output cho: accuracy, completeness, bias, citation quality.
Cho điểm 0-1. Nếu < threshold, cung cấp feedback cụ thể để cải thiện.
Output JSON: {"score": 0.0-1.0, "feedback": "...", "issues": ["..."], "passes_threshold": true/false}""",
            
            AgentRole.FORMATTER: """Bạn là Formatter. Tạo output cuối: slides/briefing_doc/audio/mindmap theo template.
Input: outline, task
Output: formatted content ready for NotebookLM generation."""
        }
    
    async def _run_agent(self, role: AgentRole, context: Dict[str, Any]) -> AgentResult:
        prompt = self.agent_prompts[role].format(**context)
        
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(context, ensure_ascii=False)}
        ]
        
        response = self.ollama.chat(
            model=self.config['ollama']['models']['chat'],
            messages=messages,
            format="json"
        )
        
        try:
            output = json.loads(response["message"]["content"])
        except:
            output = {"raw": response["message"]["content"]}
        
        return AgentResult(role=role, output=output, confidence=0.8, metadata={"model": "local"})
    
    async def _search_notebooklm(self, question: str, notebook_ids: List[str]) -> Dict:
        query = NotebookLMQuery(question=question, notebook_ids=notebook_ids)
        response = await self.nlm.query(query)
        return {
            "question": question,
            "answer": response.answer,
            "sources": response.sources,
            "citations": response.citations,
            "confidence": response.confidence
        }
    
    async def execute(self, task: ResearchTask) -> Dict[str, Any]:
        print(f"🔬 Starting research: {task.topic}")
        
        # 1. PLANNING
        print("  📋 Planning...")
        plan_result = await self._run_agent(AgentRole.PLANNER, {
            "topic": task.topic, "audience": task.audience
        })
        questions = plan_result.output.get("questions", [])
        print(f"     Generated {len(questions)} research questions")
        
        # 2. SEARCH (Parallel across notebooks)
        print("  🔍 Searching NotebookLM...")
        all_search_results = []
        for q in questions:
            for nb_id in task.notebook_ids:
                result = await self._search_notebooklm(q, [nb_id])
                all_search_results.append(result)
        
        print(f"     Completed {len(all_search_results)} queries")
        
        # 3. ANALYSIS
        print("  🧠 Analyzing...")
        analysis_result = await self._run_agent(AgentRole.ANALYST, {
            "search_results": all_search_results
        })
        
        # 4. SYNTHESIS
        print("  ✍️ Synthesizing...")
        synth_result = await self._run_agent(AgentRole.SYNTHESIZER, {
            "analysis": analysis_result.output,
            "task": {"topic": task.topic, "audience": task.audience, "output_formats": task.output_formats}
        })
        outline = synth_result.output.get("outline", [])
        
        # 5. CRITIC LOOP
        print("  🔍 Quality Review...")
        iteration = 0
        quality = 0.0
        current_outline = outline
        
        while quality < task.quality_threshold and iteration < task.max_iterations:
            iteration += 1
            print(f"     Iteration {iteration}/{task.max_iterations}")
            
            format_result = await self._run_agent(AgentRole.FORMATTER, {
                "outline": current_outline, "task": task
            })
            
            critic_result = await self._run_agent(AgentRole.CRITIC, {
                "draft": format_result.output, "task": task,
                "threshold": task.quality_threshold
            })
            
            quality = critic_result.output.get("score", 0.0)
            passes = critic_result.output.get("passes_threshold", False)
            
            if not passes and iteration < task.max_iterations:
                feedback = critic_result.output.get("feedback", "")
                refine_context = {
                    "outline": current_outline,
                    "feedback": feedback,
                    "task": task
                }
                refine_result = await self._run_agent(AgentRole.SYNTHESIZER, refine_context)
                current_outline = refine_result.output.get("outline", current_outline)
        
        print(f"     Final quality: {quality:.2f} (threshold: {task.quality_threshold})")
        
        # 6. FINAL FORMATTING
        print("  📦 Formatting outputs...")
        final_result = await self._run_agent(AgentRole.FORMATTER, {
            "outline": current_outline, "task": task
        })
        
        # 7. GENERATE OUTPUTS via NotebookLM
        outputs = {}
        content = json.dumps(final_result.output, ensure_ascii=False)
        
        for fmt in task.output_formats:
            if fmt == "slides":
                qtype = QueryType.BRIEFING_DOC
            elif fmt == "audio":
                qtype = QueryType.AUDIO_OVERVIEW
            elif fmt == "mindmap":
                qtype = QueryType.MIND_MAP
            else:
                qtype = QueryType.STUDY_GUIDE
            
            try:
                nlm_output = await self.nlm.generate_output(content, qtype, task.notebook_ids)
                outputs[fmt] = nlm_output
            except Exception as e:
                outputs[fmt] = {"error": str(e)}
        
        # Session cost report
        cost_report = self.cost_tracker.get_session_report()
        
        return {
            "topic": task.topic,
            "questions": questions,
            "search_results_count": len(all_search_results),
            "analysis": analysis_result.output,
            "outline": current_outline,
            "final_outputs": outputs,
            "quality_score": quality,
            "iterations": iteration,
            "cost_report": cost_report
        }

# CLI Entry
async def main():
    import yaml
    with open("config/settings.yaml") as f:
        config = yaml.safe_load(f)
    
    pipeline = MetacognitiveResearchPipeline(config)
    
    task = ResearchTask(
        topic="Cowork platforms use cases for content creators",
        audience="creators",
        notebook_ids=["nb_1", "nb_2", "nb_3"],  # Fill from NotebookLM
        output_formats=["slides", "briefing_doc", "audio", "mindmap"],
        quality_threshold=0.85
    )
    
    result = await pipeline.execute(task)
    print("\n✅ Research Complete!")
    print(f"Quality: {result['quality_score']:.2f}")
    print(f"Outputs: {list(result['final_outputs'].keys())}")
    print(f"Session Cost: ${result['cost_report']['total_cost_usd']:.4f}")

if __name__ == "__main__":
    asyncio.run(main())
EOF

# ============================================================
# 10. POWERSHELL MAINTENANCE SCRIPTS
# ============================================================

# scripts/sync_notebooks.ps1
cat > scripts/sync_notebooks.ps1 << 'EOF'
<# 
.SYNOPSIS
    Sync NotebookLM data to local vector DB
.DESCRIPTION
    Pulls latest notebook content via MCP, generates embeddings, upserts to Qdrant
#>

param(
    [string]$ConfigPath = "D:\AI_Projects\metacognition-research\config\settings.yaml",
    [string]$NotebookIds = "all"
)

$ErrorActionPreference = "Stop"

Write-Host "🔄 Starting NotebookLM Sync..." -ForegroundColor Cyan

# Load config
$config = (Get-Content $ConfigPath -Raw) | ConvertFrom-Yaml

# Python sync script
$pythonScript = @"
import asyncio
import yaml
from src.integrations.notebooklm_mcp import NotebookLMMCPClient, NotebookLMQuery, QueryType
from src.integrations.qdrant_client import PersonalRAGClient
from src.integrations.ollama_client import OllamaClient

async def sync():
    with open('$ConfigPath') as f:
        config = yaml.safe_load(f)
    
    nlm = NotebookLMMCPClient(
        base_url=f"http://{config['notebooklm_mcp']['host']}:{config['notebooklm_mcp']['port']}"
    )
    
    qdrant = PersonalRAGClient(
        host=config['qdrant']['host'],
        port=config['qdrant']['port'],
        collection_prefix=config['qdrant']['collection_prefix']
    )
    
    ollama = OllamaClient(host=config['ollama']['host'])
    
    # Get notebook list
    # notebooks = await nlm.list_notebooks()
    notebook_ids = config['notebooklm_mcp']['notebook_ids']
    
    for nb_id in notebook_ids:
        print(f"Syncing notebook: {nb_id}")
        
        # Get full content (using study guide for comprehensive extraction)
        query = NotebookLMQuery(
            question="Extract all key concepts, frameworks, and insights from this notebook",
            notebook_ids=[nb_id],
            query_type=QueryType.STUDY_GUIDE
        )
        response = await nlm.query(query)
        
        # Chunk and embed
        chunks = chunk_text(response.answer, chunk_size=500, overlap=50)
        embeddings = ollama.embed(config['ollama']['models']['embed'], chunks)
        
        # Prepare documents
        documents = [
            {
                "text": chunk,
                "notebook_id": nb_id,
                "source": "notebooklm",
                "query_type": QueryType.STUDY_GUIDE.value,
                "citations": response.citations
            }
            for chunk in chunks
        ]
        
        # Upsert to Qdrant
        qdrant.create_collection(nb_id)
        qdrant.upsert_documents(nb_id, documents, embeddings)
        print(f"  Upserted {len(chunks)} chunks for {nb_id}")

def chunk_text(text, chunk_size=500, overlap=50):
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
    return chunks

asyncio.run(sync())
"@

# Run sync
python -c $pythonScript

Write-Host "✅ Sync Complete!" -ForegroundColor Green
EOF

# scripts/health_check.ps1
cat > scripts/health_check.ps1 << 'EOF'
<#
.SYNOPSIS
    Health check for all AI services
#>

$services = @(
    @{Name="Ollama"; URL="http://127.0.0.1:11434/api/tags"; Port=11434},
    @{Name="Qdrant"; URL="http://127.0.0.1:6333/collections"; Port=6333},
    @{Name="NotebookLM MCP"; URL="http://127.0.0.1:3000/health"; Port=3000}
)

$results = @()

foreach ($svc in $services) {
    try {
        $response = Invoke-WebRequest -Uri $svc.URL -TimeoutSec 5 -UseBasicParsing
        $status = if ($response.StatusCode -eq 200) "HEALTHY" else "DEGRADED"
        $details = $response.Content.Substring(0, [Math]::Min(100, $response.Content.Length))
    } catch {
        $status = "DOWN"
        $details = $_.Exception.Message
    }
    
    $results += [PSCustomObject]@{
        Service = $svc.Name
        Port    = $svc.Port
        Status  = $status
        Details = $details
    }
}

$results | Format-Table -AutoSize

# Exit code for monitoring
$downCount = ($results | Where-Object {$_.Status -eq "DOWN"}).Count
if ($downCount -gt 0) {
    Write-Host "⚠️ $downCount service(s) DOWN" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ All services HEALTHY" -ForegroundColor Green
    exit 0
}
EOF

# scripts/backup_data.ps1
cat > scripts/backup_data.ps1 << 'EOF'
<#
.SYNOPSIS
    Backup AI data to external drive / cloud
#>

$sourceDir = "D:\AI_Data"
$backupDir = "E:\AI_Backup\$(Get-Date -Format 'yyyy-MM-dd')"
$logFile = "D:\AI_Data\logs\backup_$(Get-Date -Format 'yyyyMMdd').log"

Start-Transcript -Path $logFile -Append

Write-Host "📦 Starting backup: $sourceDir -> $backupDir" -ForegroundColor Cyan

# Create backup directory
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# Robocopy with logging
$exclude = @(".git", "__pycache__", "*.pyc", "*.log", "node_modules")
$robocopyArgs = @(
    $sourceDir, $backupDir,
    "/MIR",           # Mirror (delete extraneous)
    "/R:2", "/W:5",   # Retry 2 times, wait 5 sec
    "/LOG+:$logFile",
    "/TEE",           # Output to console
    "/XD", $exclude
)

$exitCode = robocopy @robocopyArgs

if ($exitCode -le 7) {
    Write-Host "✅ Backup completed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Backup failed with exit code: $exitCode" -ForegroundColor Red
}

Stop-Transcript
EOF

# ============================================================
# 11. WINDOWS TASK SCHEDULER SETUP (Run as Admin)
# ============================================================

cat > scripts/setup_scheduled_tasks.ps1 << 'EOF'
<#
.SYNOPSIS
    Register Windows Scheduled Tasks for automation
.REQUIRES
    Run as Administrator
#>

$scriptDir = "D:\AI_Projects\metacognition-research\scripts"
$pythonExe = "D:\AI_Env\research-env\Scripts\python.exe"
$projectDir = "D:\AI_Projects\metacognition-research"

# Daily NotebookLM Sync (2:00 AM)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File `"$scriptDir\sync_notebooks.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "AI_NotebookLM_Sync" -Action $action -Trigger $trigger -Settings $settings -Description "Daily NotebookLM to Qdrant sync" -Force

# Weekly Backup (Sunday 3:00 AM)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File `"$scriptDir\backup_data.ps1`""
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3:00AM
Register-ScheduledTask -TaskName "AI_Data_Backup" -Action $action -Trigger $trigger -Settings $settings -Description "Weekly AI data backup" -Force

# Health Check (Every 15 minutes)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File `"$scriptDir\health_check.ps1`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(15) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "AI_Health_Check" -Action $action -Trigger $trigger -Settings $settings -Description "Health check every 15 min" -Force

# Monthly Cost Report (1st of month 9:00 AM)
$action = New-ScheduledTaskAction -Execute $pythonExe -Argument "-m src.cli cost-report --monthly"
$trigger = New-ScheduledTaskTrigger -Monthly -DaysOfMonth 1 -At 9:00AM
Register-ScheduledTask -TaskName "AI_Cost_Report" -Action $action -Trigger $trigger -Settings $settings -Description "Monthly AI API cost report" -Force

Write-Host "✅ All scheduled tasks registered" -ForegroundColor Green
EOF

# ============================================================
# 12. REQUIREMENTS.TXT & PYPROJECT.TOML
# ============================================================

cat > requirements.txt << 'EOF'
# Core
qdrant-client==1.8.0
ollama==0.3.0
httpx==0.27.0
pyyaml==6.0.1

# LLM & Orchestration
langchain==0.2.0
langchain-community==0.2.0
langchain-ollama==0.1.0
anthropic==0.39.0
openai==1.35.0
google-generativeai==0.8.0

# Data & ML
numpy==1.26.0
pandas==2.2.0
matplotlib==3.8.0
scikit-learn==1.4.0

# Document Processing
python-pptx==0.6.23
openpyxl==3.1.0
pdfplumber==0.11.0
marker-pdf==1.10.0

# Utilities
python-dotenv==1.0.1
pydantic==2.7.0
pydantic-settings==2.3.0
rich==13.7.0
typer==0.12.0
schedule==1.2.0
psutil==5.9.0

# Dev
pytest==8.2.0
pytest-asyncio==0.23.0
black==24.3.0
ruff==0.4.0
mypy==1.9.0

# Jupyter
jupyterlab==4.2.0
ipykernel==6.29.0
EOF

cat > pyproject.toml << 'EOF'
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "metacognition-research"
version = "1.0.0"
description = "Metacognitive AI Research Pipeline with NotebookLM MCP Integration"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "qdrant-client>=1.8.0",
    "ollama>=0.3.0",
    "httpx>=0.27.0",
    "pyyaml>=6.0.1",
    "langchain>=0.2.0",
    "langchain-community>=0.2.0",
    "langchain-ollama>=0.1.0",
    "anthropic>=0.39.0",
    "openai>=1.35.0",
    "google-generativeai>=0.8.0",
    "numpy>=1.26.0",
    "pandas>=2.2.0",
    "matplotlib>=3.8.0",
    "python-pptx>=0.6.23",
    "openpyxl>=3.1.0",
    "pdfplumber>=0.11.0",
    "python-dotenv>=1.0.1",
    "pydantic>=2.7.0",
    "pydantic-settings>=2.3.0",
    "rich>=13.7.0",
    "typer>=0.12.0",
    "schedule>=1.2.0",
    "psutil>=5.9.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "black>=24.3.0",
    "ruff>=0.4.0",
    "mypy>=1.9.0",
    "jupyterlab>=4.2.0",
    "ipykernel>=6.29.0",
]

[tool.black]
line-length = 100
target-version = ['py311']

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
EOF

# ============================================================
# 13. README.MD
# ============================================================

cat > README.md << 'EOF'
# Metacognition Research Pipeline

**AI Research Automation with NotebookLM MCP + Claude + Local LLMs**

Hệ thống nghiên cứu tự động kết hợp:
- 🧠 **NotebookLM MCP** - Deep research engine
- 🤖 **Claude Desktop + Custom Skills** - Orchestration & generation
- 🏠 **Ollama Local LLMs** - Private, free inference
- 🔍 **Qdrant Vector DB** - Personal RAG
- 📊 **Cost Tracking** - API usage monitoring

## Kiến Trúc

```
┌─────────────┐     MCP/OAuth      ┌──────────────────┐
│   Claude    │ ◄────────────────► │  NotebookLM MCP  │
│  Desktop    │                    │   (Node.js)      │
│  + Skills   │                    │   Port 3000      │
└──────┬──────┘                    └────────┬─────────┘
       │                                    │
       ▼                                    ▼
┌─────────────┐                    ┌──────────────────┐
│   Ollama    │                    │     Qdrant       │
│  (Local)    │                    │  (Vector DB)     │
│  llama3.1   │                    │   Port 6333      │
│  codellama  │                    └──────────────────┘
│  nomic-embed│
└─────────────┘
```

## Quick Start

```powershell
# 1. Prerequisites (Admin)
choco install nodejs-lts python git ollama qdrant

# 2. Local LLMs
ollama serve &
ollama pull llama3.1:8b && ollama pull codellama:13b && ollama pull nomic-embed-text

# 3. Vector DB
qdrant --config-path D:\AI_Data\qdrant\config.yaml

# 4. NotebookLM MCP
git clone https://github.com/notebooklm/mcp-server.git D:\AI_Tools\notebooklm-mcp
cd D:\AI_Tools\notebooklm-mcp && npm install && npm run auth

# 5. Python Env
python -m venv D:\AI_Env\research-env
D:\AI_Env\research-env\Scripts\Activate.ps1
pip install -r requirements.txt

# 6. Configure
# - Edit config/settings.yaml (notebook_ids, paths)
# - Edit %APPDATA%\Claude\claude_desktop_config.json (MCP servers)
# - Import config/skills/research-to-presentation.json vào Claude

# 7. Run Pipeline
cd D:\AI_Projects\metacognition-research
python -m src.cli research --topic "Your topic" --audience creators --notebooks nb_1 nb_2
```

## Custom Skills

Import `config/skills/research-to-presentation.json` vào Claude Desktop:
- Settings → Skills → Import

Skill: **Autonomous Research → Presentation Deck**
- Input: Topic, Audience, Notebook IDs
- Output: Slides + Briefing Doc + Audio + Mind Map

## Scheduled Tasks (Auto-registered)

| Task | Schedule | Purpose |
|------|----------|---------|
| `AI_NotebookLM_Sync` | Daily 2:00 AM | Sync notebooks → Qdrant |
| `AI_Data_Backup` | Weekly Sun 3:00 AM | Backup to external drive |
| `AI_Health_Check` | Every 15 min | Monitor all services |
| `AI_Cost_Report` | Monthly 1st 9:00 AM | API cost report |

## Cost Tracking

```bash
# Session report
python -m src.cli cost-report --session

# Monthly report
python -m src.cli cost-report --monthly 2025 01
```

## Directory Structure

```
D:\AI_Data\
├── qdrant\storage\          # Vector DB data
├── mcp_cache\               # NotebookLM cache
├── logs\                    # Pipeline logs, cost DB
└── outputs\                 # Generated decks, reports, audio

D:\AI_Projects\metacognition-research\
├── config\                  # YAML config, skills, prompts
├── src\                     # Python pipeline
├── scripts\                 # PowerShell maintenance
└── tests\
```

## Metacognitive Principles Applied

1. **AI as Mirror, not Oracle** - Skills yêu cầu AI phản biện, không chỉ trả lời
2. **Think First, AI Second** - Planner agent forces decomposition before search
3. **Verification is Bottleneck** - Critic loop với quality threshold
4. **Calibrate Confidence** - Cost tracker + quality scores
5. **Three Habits** - Humility, Flexibility, Vigilance baked into agent prompts

## License

MIT
EOF

echo "=== PROJECT STRUCTURE CREATED ==="