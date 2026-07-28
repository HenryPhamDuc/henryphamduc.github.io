# CHƯƠNG 7: RAG - RETRIEVAL AUGMENTED GENERATION

## Giới thiệu chương

RAG là kỹ thuật quan trọng nhất trong AI engineering hiện nay. Thay vì dựa vào "ký ức" của LLM (có thể lỗi thời, sai, hoặc thiếu), RAG cho phép LLM tra cứu thông tin thực tế từ knowledge base trước khi trả lời. Kết quả: ít hallucination hơn, thông tin cập nhật, và có thể cite nguồn.

---

## 7.1 Tại sao cần RAG?

### 7.1.1 Vấn đề với Pure LLM

```python
# Không có RAG - LLM chỉ dựa vào training data
user: "Chính sách nghỉ phép của công ty chúng tôi là gì?"
llm: "Thông thường, chính sách nghỉ phép gồm 12 ngày phép năm..." ← SẮP SAI!

# Với RAG - LLM tra cứu tài liệu nội bộ trước
user: "Chính sách nghỉ phép của công ty chúng tôi là gì?"
rag_system: [Tra cứu HR Policy Document] → [Tìm thấy: 15 ngày phép/năm, 5 ngày phép bệnh]
llm: "Theo HR Policy (cập nhật 01/2024), nhân viên được 15 ngày phép năm..." ← CHÍNH XÁC!
```

### 7.1.2 RAG vs Fine-tuning

| Tiêu chí | RAG | Fine-tuning |
|----------|-----|-------------|
| Cập nhật dữ liệu | Real-time | Cần retrain |
| Chi phí setup | Thấp-Trung | Cao |
| Chi phí inference | Cao hơn (retrieval) | Thấp hơn |
| Accuracy | Cao với good retrieval | Phụ thuộc data quality |
| Explainability | Có thể cite nguồn | Black box hơn |
| Phù hợp | Dynamic knowledge | Static behavior |

---

## 7.2 Kiến trúc RAG cơ bản

### 7.2.1 Pipeline Overview

```
Document Ingestion:
Documents → Chunking → Embedding → Vector Store

Query Pipeline:
User Query → Embed Query → Vector Search → Retrieve Top-K → 
Augment Prompt → LLM → Response
```

### 7.2.2 Implementation từ đầu

```python
import numpy as np
from openai import OpenAI
from anthropic import Anthropic
from typing import List, Dict, Optional
import json

client_openai = OpenAI()
client_anthropic = Anthropic()

class SimpleRAG:
    """
    RAG implementation từ đầu - không dùng framework
    Giúp hiểu core concepts
    """
    
    def __init__(self, embedding_model: str = "text-embedding-3-small"):
        self.embedding_model = embedding_model
        self.documents = []  # [{"text": str, "metadata": dict, "embedding": list}]
    
    # ===== INGESTION PIPELINE =====
    
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """
        Chia text thành chunks với overlap
        Overlap giúp không mất context ở boundary
        """
        words = text.split()
        chunks = []
        
        i = 0
        while i < len(words):
            chunk_words = words[i:i + chunk_size]
            chunk = " ".join(chunk_words)
            chunks.append(chunk)
            i += chunk_size - overlap  # Overlap: step back by 'overlap' words
        
        return chunks
    
    def embed_text(self, text: str) -> List[float]:
        """Chuyển text thành vector embedding"""
        response = client_openai.embeddings.create(
            input=text,
            model=self.embedding_model
        )
        return response.data[0].embedding
    
    def add_document(self, text: str, metadata: Dict = None, chunk_size: int = 500):
        """Thêm document vào knowledge base"""
        chunks = self.chunk_text(text, chunk_size)
        
        for i, chunk in enumerate(chunks):
            embedding = self.embed_text(chunk)
            self.documents.append({
                "text": chunk,
                "metadata": {**(metadata or {}), "chunk_index": i},
                "embedding": embedding
            })
        
        print(f"Added {len(chunks)} chunks from document")
    
    def add_documents_batch(self, documents: List[Dict]):
        """Batch ingestion (hiệu quả hơn)"""
        all_chunks = []
        
        for doc in documents:
            chunks = self.chunk_text(doc["text"], doc.get("chunk_size", 500))
            for i, chunk in enumerate(chunks):
                all_chunks.append({
                    "text": chunk,
                    "metadata": {**doc.get("metadata", {}), "chunk_index": i}
                })
        
        # Batch embedding (1 API call thay vì N calls)
        texts = [c["text"] for c in all_chunks]
        response = client_openai.embeddings.create(
            input=texts,
            model=self.embedding_model
        )
        
        for chunk, emb_data in zip(all_chunks, response.data):
            chunk["embedding"] = emb_data.embedding
            self.documents.append(chunk)
        
        print(f"Batch added {len(all_chunks)} chunks")
    
    # ===== RETRIEVAL PIPELINE =====
    
    def cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        a, b = np.array(v1), np.array(v2)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    
    def retrieve(self, query: str, top_k: int = 5, 
                 min_similarity: float = 0.3) -> List[Dict]:
        """Tìm kiếm các chunks liên quan nhất"""
        
        query_embedding = self.embed_text(query)
        
        scored_docs = []
        for doc in self.documents:
            similarity = self.cosine_similarity(query_embedding, doc["embedding"])
            if similarity >= min_similarity:
                scored_docs.append({
                    "text": doc["text"],
                    "metadata": doc["metadata"],
                    "similarity": similarity
                })
        
        # Sort by similarity (highest first)
        scored_docs.sort(key=lambda x: x["similarity"], reverse=True)
        return scored_docs[:top_k]
    
    # ===== GENERATION PIPELINE =====
    
    def generate(self, query: str, context_docs: List[Dict], 
                 model: str = "claude") -> str:
        """Generate answer với retrieved context"""
        
        # Build context string
        context_parts = []
        for i, doc in enumerate(context_docs, 1):
            source = doc["metadata"].get("source", f"Document {i}")
            context_parts.append(f"[Source {i}: {source}]\n{doc['text']}")
        
        context = "\n\n---\n\n".join(context_parts)
        
        prompt = f"""Dựa trên các tài liệu tham khảo sau để trả lời câu hỏi.
Chỉ dùng thông tin từ tài liệu. Nếu không tìm thấy thông tin, hãy nói rõ.
Trích dẫn nguồn khi có thể.

Tài liệu tham khảo:
{context}

Câu hỏi: {query}

Câu trả lời:"""
        
        if model == "claude":
            response = client_anthropic.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        else:
            response = client_openai.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024
            )
            return response.choices[0].message.content
    
    def query(self, question: str, top_k: int = 5) -> Dict:
        """Full RAG pipeline"""
        
        # Step 1: Retrieve relevant documents
        retrieved = self.retrieve(question, top_k=top_k)
        
        if not retrieved:
            return {
                "answer": "Không tìm thấy thông tin liên quan trong knowledge base.",
                "sources": [],
                "retrieved_count": 0
            }
        
        # Step 2: Generate answer
        answer = self.generate(question, retrieved)
        
        return {
            "answer": answer,
            "sources": [{"text": d["text"][:200], 
                        "similarity": round(d["similarity"], 3),
                        "metadata": d["metadata"]} 
                       for d in retrieved],
            "retrieved_count": len(retrieved)
        }

# Demo sử dụng
rag = SimpleRAG()

# Ingest documents
rag.add_document(
    text="""
    Chính sách nghỉ phép của Công ty XYZ (Cập nhật 01/2024):
    
    1. Nghỉ phép năm: Nhân viên được 15 ngày phép/năm. 
    Sau 3 năm thâm niên: 18 ngày. Sau 5 năm: 21 ngày.
    
    2. Nghỉ bệnh: 10 ngày/năm có hưởng lương đầy đủ.
    Cần giấy xác nhận của bác sĩ cho nghỉ > 2 ngày liên tiếp.
    
    3. Nghỉ lễ: Theo quy định Nhà nước (hiện tại 11 ngày).
    
    4. Nghỉ thai sản: 6 tháng theo quy định (mẹ), 5 ngày (bố).
    
    5. Quy trình xin phép: Submit request trên HR Portal ít nhất 3 ngày trước.
    Cần approved bởi direct manager và HR.
    """,
    metadata={"source": "HR Policy 2024", "department": "HR"}
)

# Query
result = rag.query("Tôi được nghỉ bao nhiêu ngày bệnh?")
print(result["answer"])
print(f"\nSources: {len(result['sources'])} documents")
```

---

## 7.3 Chunking Strategies

```python
from abc import ABC, abstractmethod

class ChunkingStrategy(ABC):
    @abstractmethod
    def chunk(self, text: str) -> List[str]:
        pass

class FixedSizeChunking(ChunkingStrategy):
    """Chia đều theo số words - đơn giản nhất"""
    
    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def chunk(self, text: str) -> List[str]:
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i:i + self.chunk_size])
            chunks.append(chunk)
            i += self.chunk_size - self.overlap
        return chunks

class SemanticChunking(ChunkingStrategy):
    """Chia theo paragraphs/sections - giữ nguyên semantic units"""
    
    def chunk(self, text: str) -> List[str]:
        # Chia theo double newlines (paragraphs)
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        # Merge very short paragraphs
        merged = []
        current = ""
        
        for para in paragraphs:
            if len(current) + len(para) < 800:  # Max chunk size
                current = (current + "\n\n" + para).strip()
            else:
                if current:
                    merged.append(current)
                current = para
        
        if current:
            merged.append(current)
        
        return merged

class SentenceWindowChunking(ChunkingStrategy):
    """Chunk theo sentence windows - tốt nhất cho Q&A"""
    
    def __init__(self, window_size: int = 5, stride: int = 3):
        self.window_size = window_size
        self.stride = stride
    
    def chunk(self, text: str) -> List[str]:
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        for i in range(0, len(sentences), self.stride):
            window = sentences[i:i + self.window_size]
            if window:
                chunks.append(" ".join(window))
        
        return chunks

class RecursiveChunking(ChunkingStrategy):
    """
    Recursive character text splitter - cách của LangChain
    Tốt nhất cho code và structured documents
    """
    
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", " ", ""]
    
    def chunk(self, text: str) -> List[str]:
        return self._split(text, self.separators)
    
    def _split(self, text: str, separators: List[str]) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text]
        
        separator = separators[0] if separators else ""
        parts = text.split(separator)
        
        chunks = []
        current = ""
        
        for part in parts:
            if len(current) + len(part) <= self.chunk_size:
                current = (current + separator + part).strip()
            else:
                if current:
                    chunks.append(current)
                if len(part) > self.chunk_size and len(separators) > 1:
                    # Recursive: try smaller separator
                    sub_chunks = self._split(part, separators[1:])
                    chunks.extend(sub_chunks)
                    current = ""
                else:
                    current = part
        
        if current:
            chunks.append(current)
        
        return chunks
```

---

## 7.4 Advanced Retrieval Techniques

```python
class AdvancedRAG(SimpleRAG):
    """RAG với advanced retrieval strategies"""
    
    def hybrid_search(self, query: str, top_k: int = 5, 
                      alpha: float = 0.5) -> List[Dict]:
        """
        Hybrid Search: Kết hợp semantic search + keyword search
        alpha=1.0: Pure semantic
        alpha=0.0: Pure keyword (BM25)
        alpha=0.5: Balanced (thường tốt nhất)
        """
        
        # Semantic results
        semantic_results = self.retrieve(query, top_k=top_k * 2)
        
        # Keyword results (simplified BM25-like)
        query_words = set(query.lower().split())
        keyword_results = []
        
        for doc in self.documents:
            doc_words = set(doc["text"].lower().split())
            overlap = len(query_words & doc_words)
            if overlap > 0:
                keyword_results.append({
                    "text": doc["text"],
                    "metadata": doc["metadata"],
                    "keyword_score": overlap / len(query_words)
                })
        
        keyword_results.sort(key=lambda x: x["keyword_score"], reverse=True)
        keyword_results = keyword_results[:top_k * 2]
        
        # Combine scores (RRF - Reciprocal Rank Fusion)
        combined = {}
        
        for rank, doc in enumerate(semantic_results):
            key = doc["text"][:100]
            combined[key] = combined.get(key, {})
            combined[key]["doc"] = doc
            combined[key]["semantic_score"] = 1 / (rank + 60)  # RRF formula
        
        for rank, doc in enumerate(keyword_results):
            key = doc["text"][:100]
            combined[key] = combined.get(key, {})
            combined[key]["doc"] = doc
            combined[key]["keyword_score"] = 1 / (rank + 60)
        
        # Hybrid score
        results = []
        for key, data in combined.items():
            semantic = data.get("semantic_score", 0)
            keyword = data.get("keyword_score", 0)
            hybrid = alpha * semantic + (1 - alpha) * keyword
            
            doc = data["doc"]
            doc["hybrid_score"] = hybrid
            results.append(doc)
        
        results.sort(key=lambda x: x["hybrid_score"], reverse=True)
        return results[:top_k]
    
    def query_expansion(self, query: str) -> List[str]:
        """
        Mở rộng query với synonyms và related terms
        Giúp tìm kiếm toàn diện hơn
        """
        
        expansion_prompt = f"""
        Câu hỏi gốc: "{query}"
        
        Tạo 3 cách diễn đạt khác nhau cho cùng ý, bao gồm:
        - Synonyms
        - Related terms
        - More specific version
        
        Format: ["query1", "query2", "query3"]
        Chỉ return JSON array.
        """
        
        response = client_anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=200,
            messages=[{"role": "user", "content": expansion_prompt}]
        )
        
        try:
            expanded = json.loads(response.content[0].text)
            return [query] + expanded  # Include original
        except:
            return [query]
    
    def rerank(self, query: str, candidates: List[Dict], top_k: int = 3) -> List[Dict]:
        """
        Re-ranking: Dùng LLM để re-score candidates
        Chậm hơn nhưng chính xác hơn vector similarity
        """
        
        rerank_prompt = f"""
        Query: {query}
        
        Rate each passage's relevance (0-10):
        
        {chr(10).join(f'Passage {i+1}: {c["text"][:300]}' for i, c in enumerate(candidates))}
        
        Return JSON: [{{"rank": 1, "score": 9}}, ...]
        """
        
        response = client_anthropic.messages.create(
            model="claude-3-haiku-20240307",  # Haiku for speed
            max_tokens=200,
            messages=[{"role": "user", "content": rerank_prompt}]
        )
        
        try:
            rankings = json.loads(response.content[0].text)
            scored = [(candidates[r["rank"]-1], r["score"]) for r in rankings]
            scored.sort(key=lambda x: x[1], reverse=True)
            return [doc for doc, score in scored[:top_k]]
        except:
            return candidates[:top_k]
    
    def multi_query_rag(self, question: str) -> Dict:
        """
        Multi-query RAG: Expand → Search → Deduplicate → Generate
        """
        
        # Expand query
        queries = self.query_expansion(question)
        print(f"Expanded to {len(queries)} queries: {queries}")
        
        # Retrieve for each query
        all_docs = []
        seen_texts = set()
        
        for q in queries:
            docs = self.retrieve(q, top_k=3)
            for doc in docs:
                text_key = doc["text"][:100]
                if text_key not in seen_texts:
                    all_docs.append(doc)
                    seen_texts.add(text_key)
        
        if not all_docs:
            return {"answer": "Không tìm thấy thông tin liên quan.", "sources": []}
        
        # Re-rank
        top_docs = self.rerank(question, all_docs, top_k=5)
        
        # Generate
        answer = self.generate(question, top_docs)
        
        return {
            "answer": answer,
            "queries_used": queries,
            "sources": [d["metadata"] for d in top_docs]
        }
```

---

## 7.5 Vector Databases

```python
"""
Production RAG cần Vector Database thay vì in-memory list.

Options:
- Pinecone: Managed, dễ dùng, đắt
- Weaviate: Open-source, feature-rich
- Qdrant: Open-source, fast, Rust-based
- Chroma: Local-first, tốt cho development
- pgvector: PostgreSQL extension (nếu đã có Postgres)
- Milvus: Scalable, self-hosted
"""

# Chroma - tốt nhất để bắt đầu
import chromadb

def setup_chroma_rag():
    """Setup RAG với ChromaDB"""
    
    client = chromadb.PersistentClient(path="./chroma_db")
    
    collection = client.get_or_create_collection(
        name="knowledge_base",
        metadata={"hnsw:space": "cosine"}  # Cosine similarity
    )
    
    return collection

def ingest_to_chroma(collection, documents: List[Dict]):
    """Ingest documents vào ChromaDB"""
    
    # Embed all documents
    texts = [doc["text"] for doc in documents]
    
    embeddings_response = client_openai.embeddings.create(
        input=texts,
        model="text-embedding-3-small"
    )
    embeddings = [e.embedding for e in embeddings_response.data]
    
    collection.add(
        documents=texts,
        embeddings=embeddings,
        metadatas=[doc.get("metadata", {}) for doc in documents],
        ids=[f"doc_{i}" for i in range(len(documents))]
    )
    
    print(f"Ingested {len(documents)} documents")

def query_chroma(collection, query: str, top_k: int = 5) -> List[Dict]:
    """Query ChromaDB"""
    
    # Embed query
    query_embedding = client_openai.embeddings.create(
        input=query,
        model="text-embedding-3-small"
    ).data[0].embedding
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    
    docs = []
    for text, metadata, distance in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0]
    ):
        docs.append({
            "text": text,
            "metadata": metadata,
            "similarity": 1 - distance  # Convert distance to similarity
        })
    
    return docs
```

---

## 7.6 RAG Evaluation

```python
class RAGEvaluator:
    """Đánh giá chất lượng RAG system"""
    
    def evaluate_retrieval(self, query: str, retrieved: List[Dict], 
                          ground_truth_docs: List[str]) -> Dict:
        """
        Metrics:
        - Precision@K: Trong K docs retrieved, bao nhiêu % relevant?
        - Recall@K: Trong tổng relevant docs, retrieve được bao nhiêu %?
        - MRR: Mean Reciprocal Rank
        """
        retrieved_texts = [d["text"] for d in retrieved]
        
        # Check relevance
        tp = sum(1 for doc in retrieved_texts if doc in ground_truth_docs)
        
        precision = tp / len(retrieved_texts) if retrieved_texts else 0
        recall = tp / len(ground_truth_docs) if ground_truth_docs else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        
        # MRR
        mrr = 0
        for rank, doc in enumerate(retrieved_texts, 1):
            if doc in ground_truth_docs:
                mrr = 1 / rank
                break
        
        return {
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1": round(f1, 3),
            "mrr": round(mrr, 3)
        }
    
    def evaluate_generation(self, question: str, answer: str, 
                           context: str, reference: str = None) -> Dict:
        """
        RAGAS-inspired metrics:
        - Faithfulness: Answer có grounded trong context không?
        - Answer Relevance: Answer có trả lời question không?
        - Context Precision: Context có relevant không?
        """
        
        faithfulness_prompt = f"""
        Context: {context[:1000]}
        Answer: {answer}
        
        Đánh giá: Answer có hoàn toàn dựa trên context không?
        (0-1, 1 = hoàn toàn faithful, 0 = hallucination)
        Chỉ return số thập phân.
        """
        
        faithfulness = float(ask_claude(faithfulness_prompt, temperature=0))
        
        relevance_prompt = f"""
        Question: {question}
        Answer: {answer}
        
        Đánh giá: Answer có thực sự trả lời question không?
        (0-1, 1 = hoàn toàn relevant)
        Chỉ return số thập phân.
        """
        
        relevance = float(ask_claude(relevance_prompt, temperature=0))
        
        return {
            "faithfulness": round(faithfulness, 3),
            "answer_relevance": round(relevance, 3),
            "overall": round((faithfulness + relevance) / 2, 3)
        }
```

---

## 7.7 Production RAG Architecture

```python
"""
Production RAG Stack:

┌──────────────────────────────────────────────┐
│              API Layer (FastAPI)              │
├──────────────────────────────────────────────┤
│           RAG Orchestrator                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  Query   │ │ Retrieve │ │   Generate   │ │
│  │ Expansion│ │& Rerank  │ │  + Cite      │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
├──────────────────────────────────────────────┤
│  ┌───────────────┐  ┌──────────────────────┐ │
│  │ Vector Store  │  │   Document Store     │ │
│  │  (Qdrant)     │  │   (PostgreSQL/S3)    │ │
│  └───────────────┘  └──────────────────────┘ │
├──────────────────────────────────────────────┤
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Embedding │ │  LLM API │ │  Cache     │ │
│  │   Service  │ │(Anthropic│ │  (Redis)   │ │
│  └────────────┘ └──────────┘ └────────────┘ │
└──────────────────────────────────────────────┘
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import redis
import hashlib

app = FastAPI()
cache = redis.Redis(host='localhost', port=6379)

class QueryRequest(BaseModel):
    question: str
    collection: str = "default"
    top_k: int = 5
    use_cache: bool = True

class QueryResponse(BaseModel):
    answer: str
    sources: List[Dict]
    cached: bool
    latency_ms: float

@app.post("/query", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    import time
    start = time.time()
    
    # Check cache
    cache_key = hashlib.md5(f"{request.question}{request.collection}".encode()).hexdigest()
    
    if request.use_cache:
        cached = cache.get(cache_key)
        if cached:
            result = json.loads(cached)
            result["cached"] = True
            result["latency_ms"] = (time.time() - start) * 1000
            return QueryResponse(**result)
    
    # RAG query
    rag = get_rag_instance(request.collection)  # Connection pooling
    result = rag.query(request.question, top_k=request.top_k)
    
    # Cache for 1 hour
    cache.setex(cache_key, 3600, json.dumps({
        "answer": result["answer"],
        "sources": result["sources"]
    }))
    
    return QueryResponse(
        answer=result["answer"],
        sources=result["sources"],
        cached=False,
        latency_ms=(time.time() - start) * 1000
    )
```

---

## Tóm tắt chương

RAG là cornerstone của production AI applications:
- **Chunking**: Fixed-size, semantic, sentence window, recursive
- **Embedding**: OpenAI text-embedding-3, batch processing
- **Retrieval**: Semantic search, hybrid search, query expansion
- **Re-ranking**: LLM-based re-scoring for precision
- **Vector DBs**: Chroma (dev), Qdrant/Pinecone (production)
- **Evaluation**: RAGAS metrics - faithfulness, relevance

---

*Chương tiếp theo: **LangChain và Orchestration Frameworks***
