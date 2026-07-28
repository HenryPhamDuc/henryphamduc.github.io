# CHƯƠNG 9: VECTOR DATABASES VÀ EMBEDDINGS

## Giới thiệu chương

Embeddings và Vector Databases là xương sống của mọi ứng dụng AI hiện đại: RAG, semantic search, recommendation systems, anomaly detection. Chương này đi sâu vào lý thuyết embedding, các kỹ thuật tối ưu, và so sánh thực tế các vector databases phổ biến nhất.

---

## 9.1 Embedding là gì?

### 9.1.1 Từ Text sang Vector

Embedding chuyển đổi dữ liệu (text, image, audio) thành vector số học trong không gian nhiều chiều, trong đó **khoảng cách phản ánh sự tương đồng ngữ nghĩa**.

```python
# Ví dụ conceptual:
# "con mèo" → [0.21, -0.45, 0.78, ..., 0.33]  (1536 chiều)
# "con chó" → [0.19, -0.43, 0.75, ..., 0.31]  (gần với "mèo")
# "blockchain" → [-0.52, 0.88, -0.12, ..., 0.67]  (xa với "mèo")

from openai import OpenAI
import numpy as np

client = OpenAI()

def embed(text: str, model: str = "text-embedding-3-small") -> np.ndarray:
    response = client.embeddings.create(input=text, model=model)
    return np.array(response.data[0].embedding)

def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

# Demo
v_cat = embed("con mèo")
v_dog = embed("con chó")
v_bitcoin = embed("bitcoin blockchain")

print(f"mèo vs chó:      {cosine_sim(v_cat, v_dog):.3f}")   # ~0.85 (gần)
print(f"mèo vs bitcoin:  {cosine_sim(v_cat, v_bitcoin):.3f}") # ~0.15 (xa)
```

### 9.1.2 Các loại Embedding Models

```python
EMBEDDING_MODELS = {
    # OpenAI
    "text-embedding-3-small": {
        "dims": 1536, "max_tokens": 8191,
        "price_per_1M": 0.02,
        "best_for": "General purpose, cost-effective"
    },
    "text-embedding-3-large": {
        "dims": 3072, "max_tokens": 8191,
        "price_per_1M": 0.13,
        "best_for": "High accuracy requirements"
    },
    
    # Cohere
    "embed-multilingual-v3.0": {
        "dims": 1024, "max_tokens": 512,
        "price_per_1M": 0.10,
        "best_for": "Multilingual (100+ languages)"
    },
    
    # Voyage AI (dùng bởi Anthropic)
    "voyage-3": {
        "dims": 1024, "max_tokens": 32000,
        "price_per_1M": 0.06,
        "best_for": "Long documents, high quality"
    },
    "voyage-code-3": {
        "dims": 1024,
        "price_per_1M": 0.18,
        "best_for": "Code embedding - tốt nhất cho code search"
    },
    
    # Local/Open-source
    "all-MiniLM-L6-v2": {
        "dims": 384,
        "price_per_1M": 0,  # Free!
        "best_for": "Local deployment, privacy"
    },
    "bge-m3": {
        "dims": 1024,
        "price_per_1M": 0,
        "best_for": "SOTA open-source, multilingual"
    }
}
```

---

## 9.2 Similarity Metrics

```python
import numpy as np
from scipy.spatial.distance import euclidean

def compare_similarity_metrics(v1: np.ndarray, v2: np.ndarray) -> dict:
    """So sánh các distance metrics"""
    
    # 1. Cosine Similarity (phổ biến nhất cho NLP)
    # Đo góc giữa hai vectors, không bị ảnh hưởng bởi magnitude
    cosine = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
    
    # 2. Euclidean Distance (L2)
    # Đo khoảng cách thực tế trong không gian
    euclidean_dist = np.linalg.norm(v1 - v2)
    
    # 3. Dot Product
    # Như cosine nhưng có magnitude factor
    # Tốt khi vectors đã normalized
    dot = np.dot(v1, v2)
    
    # 4. Manhattan Distance (L1)
    manhattan = np.sum(np.abs(v1 - v2))
    
    return {
        "cosine_similarity": float(cosine),
        "euclidean_distance": float(euclidean_dist),
        "dot_product": float(dot),
        "manhattan_distance": float(manhattan)
    }

# Khi nào dùng gì?
"""
COSINE SIMILARITY:
✅ Text/document similarity (most common)
✅ Khi magnitude không quan trọng
✅ RAG retrieval

EUCLIDEAN (L2):
✅ Computer vision embeddings
✅ Khi magnitude quan trọng
✅ K-means clustering

DOT PRODUCT:
✅ Normalized vectors
✅ Faster computation
✅ Recommendation systems

MANHATTAN (L1):
✅ Sparse embeddings
✅ Anomaly detection
"""
```

---

## 9.3 Embedding Optimization

### 9.3.1 Dimensionality Reduction

```python
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import umap  # pip install umap-learn

def reduce_for_visualization(embeddings: np.ndarray, method: str = "tsne") -> np.ndarray:
    """Giảm chiều để visualize embeddings"""
    
    if method == "pca":
        reducer = PCA(n_components=2)
    elif method == "tsne":
        reducer = TSNE(n_components=2, random_state=42, perplexity=30)
    elif method == "umap":
        reducer = umap.UMAP(n_components=2, random_state=42)
    
    return reducer.fit_transform(embeddings)

def reduce_for_storage(embeddings: np.ndarray, target_dims: int = 256) -> np.ndarray:
    """
    Giảm chiều để giảm storage và tăng tốc search
    OpenAI text-embedding-3 hỗ trợ "dimensions" parameter!
    """
    # Option 1: Dùng PCA
    pca = PCA(n_components=target_dims)
    return pca.fit_transform(embeddings)

# OpenAI native dimension reduction
def embed_reduced(text: str, dims: int = 256) -> np.ndarray:
    """
    text-embedding-3 supports native dimension reduction
    Chất lượng tốt hơn PCA vì được train để reduce
    """
    response = client.embeddings.create(
        input=text,
        model="text-embedding-3-large",
        dimensions=dims  # 256, 512, 1024, 1536, 3072
    )
    return np.array(response.data[0].embedding)

# Benchmark: Speed vs Quality tradeoff
dims_benchmark = {
    3072: {"recall@10": 0.621, "storage_mb_per_1M": 12288},
    1536: {"recall@10": 0.604, "storage_mb_per_1M": 6144},
    1024: {"recall@10": 0.594, "storage_mb_per_1M": 4096},
    512:  {"recall@10": 0.570, "storage_mb_per_1M": 2048},
    256:  {"recall@10": 0.541, "storage_mb_per_1M": 1024},
}
```

### 9.3.2 Quantization

```python
import numpy as np

def quantize_embeddings(embeddings: np.ndarray, bits: int = 8) -> np.ndarray:
    """
    Quantization: Float32 → Int8/Int4
    Giảm storage 4x-8x với minimal accuracy loss
    """
    if bits == 8:
        # Scale to [-128, 127]
        min_val = embeddings.min(axis=1, keepdims=True)
        max_val = embeddings.max(axis=1, keepdims=True)
        scale = (max_val - min_val) / 255
        quantized = ((embeddings - min_val) / scale - 128).astype(np.int8)
        return quantized, scale, min_val
    
    elif bits == 1:
        # Binary quantization (EXTREME compression)
        # 1536 float32 = 6144 bytes → 192 bytes (32x smaller!)
        return np.sign(embeddings).astype(np.int8)

def binary_similarity(b1: np.ndarray, b2: np.ndarray) -> float:
    """Hamming distance cho binary embeddings"""
    xor = np.bitwise_xor(b1.view(np.uint8), b2.view(np.uint8))
    hamming = np.unpackbits(xor).sum()
    return 1 - hamming / len(b1) / 8  # Normalize

# Matryoshka Representation Learning (MRL)
# OpenAI text-embedding-3 được train theo MRL:
# First N dimensions đã là good representation!
def matryoshka_embed(text: str, dims_list=[64, 128, 256, 512, 1536]):
    """
    MRL cho phép dùng prefix của embedding với different tradeoffs
    """
    full_embedding = embed_reduced(text, dims=1536)
    return {dims: full_embedding[:dims] for dims in dims_list}
```

---

## 9.4 Semantic Search Systems

```python
class SemanticSearchEngine:
    """Production semantic search với caching và batching"""
    
    def __init__(self, model: str = "text-embedding-3-small"):
        self.model = model
        self.documents = []
        self.embeddings = None
        self._embed_cache = {}
    
    def embed_with_cache(self, text: str) -> np.ndarray:
        if text in self._embed_cache:
            return self._embed_cache[text]
        
        response = client.embeddings.create(input=text, model=self.model)
        embedding = np.array(response.data[0].embedding)
        self._embed_cache[text] = embedding
        return embedding
    
    def index(self, documents: list[dict], batch_size: int = 100):
        """Index documents với batch embedding"""
        self.documents = documents
        all_embeddings = []
        
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            texts = [d["text"] for d in batch]
            
            response = client.embeddings.create(input=texts, model=self.model)
            batch_embeddings = [e.embedding for e in response.data]
            all_embeddings.extend(batch_embeddings)
            
            print(f"Embedded {min(i + batch_size, len(documents))}/{len(documents)}")
        
        self.embeddings = np.array(all_embeddings)
        print(f"Index built: {self.embeddings.shape}")
    
    def search(self, query: str, top_k: int = 10, 
               threshold: float = 0.0) -> list[dict]:
        """Cosine similarity search với numpy (fast for <100K docs)"""
        
        query_emb = self.embed_with_cache(query)
        
        # Vectorized cosine similarity (much faster than loop)
        norms = np.linalg.norm(self.embeddings, axis=1)
        query_norm = np.linalg.norm(query_emb)
        similarities = self.embeddings @ query_emb / (norms * query_norm)
        
        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            if similarities[idx] >= threshold:
                results.append({
                    **self.documents[idx],
                    "similarity": float(similarities[idx])
                })
        
        return results
    
    def search_with_filter(self, query: str, filter_fn, top_k: int = 10):
        """Search + filter by metadata"""
        all_results = self.search(query, top_k=top_k * 3)
        filtered = [r for r in all_results if filter_fn(r)]
        return filtered[:top_k]

# Demo
engine = SemanticSearchEngine()

products = [
    {"text": "iPhone 15 Pro Max - 256GB - Titanium", "category": "phones", "price": 1299},
    {"text": "Samsung Galaxy S24 Ultra - 512GB", "category": "phones", "price": 1199},
    {"text": "MacBook Pro M3 - 16GB RAM", "category": "laptops", "price": 1999},
    {"text": "Sony WH-1000XM5 - Noise Canceling Headphones", "category": "audio", "price": 349},
    # ... more products
]

engine.index(products)

results = engine.search("flagship smartphone with great camera", top_k=3)
for r in results:
    print(f"{r['text']} | Similarity: {r['similarity']:.3f} | ${r['price']}")
```

---

## 9.5 Vector Databases So sánh

### 9.5.1 Pinecone

```python
from pinecone import Pinecone, ServerlessSpec

pc = Pinecone(api_key="your-pinecone-api-key")

# Create index
pc.create_index(
    name="knowledge-base",
    dimension=1536,
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1")
)

index = pc.Index("knowledge-base")

# Upsert vectors
def pinecone_upsert(documents: list[dict]):
    vectors = []
    
    for i, doc in enumerate(documents):
        embedding = embed(doc["text"])
        vectors.append({
            "id": f"doc_{i}",
            "values": embedding.tolist(),
            "metadata": {
                "text": doc["text"][:500],
                "source": doc.get("source", ""),
                "category": doc.get("category", "")
            }
        })
    
    # Upsert in batches of 100
    for i in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[i:i+100])

# Query
def pinecone_search(query: str, top_k: int = 5, filter: dict = None) -> list:
    query_emb = embed(query).tolist()
    
    results = index.query(
        vector=query_emb,
        top_k=top_k,
        include_metadata=True,
        filter=filter  # {"category": {"$eq": "phones"}}
    )
    
    return [
        {
            "text": match.metadata["text"],
            "score": match.score,
            "metadata": match.metadata
        }
        for match in results.matches
    ]
```

### 9.5.2 Qdrant

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue
)

# Local (development) hoặc Cloud (production)
qdrant = QdrantClient(":memory:")  # In-memory
# qdrant = QdrantClient(url="http://localhost:6333")  # Local Docker
# qdrant = QdrantClient(url="https://xxx.qdrant.io", api_key="...")  # Cloud

# Create collection
qdrant.create_collection(
    collection_name="knowledge",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
)

# Upsert
def qdrant_upsert(documents: list[dict]):
    points = []
    
    for i, doc in enumerate(documents):
        embedding = embed(doc["text"]).tolist()
        points.append(PointStruct(
            id=i,
            vector=embedding,
            payload={
                "text": doc["text"],
                "source": doc.get("source", ""),
                "date": doc.get("date", ""),
                "category": doc.get("category", "")
            }
        ))
    
    qdrant.upsert(collection_name="knowledge", points=points)

# Search with filter
def qdrant_search(query: str, top_k: int = 5, category: str = None) -> list:
    query_emb = embed(query).tolist()
    
    search_filter = None
    if category:
        search_filter = Filter(
            must=[FieldCondition(key="category", match=MatchValue(value=category))]
        )
    
    results = qdrant.search(
        collection_name="knowledge",
        query_vector=query_emb,
        limit=top_k,
        query_filter=search_filter,
        with_payload=True
    )
    
    return [
        {"text": r.payload["text"], "score": r.score, "metadata": r.payload}
        for r in results
    ]

# Qdrant advantages:
# ✅ Open source, self-hosted
# ✅ Rust-based = very fast
# ✅ Rich filtering capabilities
# ✅ Scalar quantization built-in
# ✅ Sparse vectors support (hybrid search)
```

### 9.5.3 pgvector (PostgreSQL)

```python
"""
pgvector: Vector search trong PostgreSQL
✅ Không cần thêm infrastructure nếu đã có Postgres
✅ ACID transactions
✅ SQL joins với vector results
✅ Familiar for backend developers
❌ Chậm hơn dedicated vector DBs ở scale lớn
"""

import psycopg2
import json

def setup_pgvector(conn_string: str):
    conn = psycopg2.connect(conn_string)
    cur = conn.cursor()
    
    # Install extension
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
    
    # Create table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            content TEXT,
            embedding vector(1536),
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Create index (IVFFlat for approximate search)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS documents_embedding_idx 
        ON documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)  -- Số clusters, ~sqrt(total_rows)
    """)
    
    conn.commit()
    return conn

def pgvector_upsert(conn, documents: list[dict]):
    cur = conn.cursor()
    
    for doc in documents:
        embedding = embed(doc["text"]).tolist()
        cur.execute(
            """
            INSERT INTO documents (content, embedding, metadata)
            VALUES (%s, %s, %s)
            """,
            (doc["text"], embedding, json.dumps(doc.get("metadata", {})))
        )
    
    conn.commit()

def pgvector_search(conn, query: str, top_k: int = 5) -> list:
    cur = conn.cursor()
    query_emb = embed(query).tolist()
    
    cur.execute(
        """
        SELECT content, metadata, 1 - (embedding <=> %s::vector) AS similarity
        FROM documents
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (query_emb, query_emb, top_k)
    )
    
    return [
        {"text": row[0], "metadata": row[1], "similarity": row[2]}
        for row in cur.fetchall()
    ]

# Operators:
# <-> Euclidean distance
# <=> Cosine distance
# <#> Inner product (negative dot product)
```

### 9.5.4 Chroma (Local Development)

```python
import chromadb

# Persistent local storage
chroma = chromadb.PersistentClient(path="./chroma_db")

collection = chroma.get_or_create_collection(
    name="documents",
    metadata={"hnsw:space": "cosine"},
    embedding_function=chromadb.utils.embedding_functions.OpenAIEmbeddingFunction(
        api_key="your-key",
        model_name="text-embedding-3-small"
    )
)

# Add documents (auto-embedding)
collection.add(
    documents=["Python là ngôn ngữ lập trình", "Docker là container platform"],
    metadatas=[{"category": "programming"}, {"category": "devops"}],
    ids=["doc1", "doc2"]
)

# Query (auto-embed query)
results = collection.query(
    query_texts=["Tôi muốn học lập trình"],
    n_results=2,
    where={"category": "programming"}  # Filter
)

# Chroma là best choice khi:
# ✅ Local development, prototyping
# ✅ Small-medium datasets (<1M vectors)
# ✅ No infrastructure overhead
# ✅ Python-native
```

---

## 9.6 So sánh Vector Databases

```python
VECTOR_DB_COMPARISON = {
    "Pinecone": {
        "type": "Managed cloud",
        "scale": "Billions of vectors",
        "setup": "5 minutes",
        "cost": "$$$ (starts $70/month)",
        "best_for": "Production, no ops team",
        "latency": "< 10ms",
        "features": ["Filtering", "Namespaces", "Serverless"]
    },
    "Qdrant": {
        "type": "Open-source / Managed",
        "scale": "Hundreds of millions",
        "setup": "15 minutes",
        "cost": "$ (self-hosted free, cloud affordable)",
        "best_for": "Balanced, high performance",
        "latency": "< 5ms",
        "features": ["Rich filtering", "Sparse vectors", "Quantization"]
    },
    "pgvector": {
        "type": "PostgreSQL extension",
        "scale": "Millions",
        "setup": "Already have Postgres?",
        "cost": "$ (Postgres cost)",
        "best_for": "Already using PostgreSQL",
        "latency": "10-50ms",
        "features": ["SQL joins", "ACID", "Familiar tooling"]
    },
    "Chroma": {
        "type": "Open-source local",
        "scale": "Millions",
        "setup": "1 minute",
        "cost": "Free",
        "best_for": "Development, prototyping",
        "latency": "< 20ms local",
        "features": ["Simple API", "Auto-embedding", "Python native"]
    },
    "Weaviate": {
        "type": "Open-source / Managed",
        "scale": "Billions",
        "setup": "30 minutes",
        "cost": "$ self-hosted",
        "best_for": "Complex schemas, GraphQL",
        "latency": "< 10ms",
        "features": ["GraphQL", "Multi-modal", "Modules ecosystem"]
    }
}

# Decision matrix
def choose_vector_db(requirements: dict) -> str:
    if requirements.get("managed_service") and not requirements.get("cost_sensitive"):
        return "Pinecone"
    
    if requirements.get("already_using_postgres"):
        return "pgvector"
    
    if requirements.get("environment") == "development":
        return "Chroma"
    
    if requirements.get("performance_critical"):
        return "Qdrant"
    
    if requirements.get("complex_filtering"):
        return "Qdrant or Weaviate"
    
    return "Qdrant"  # Default good choice
```

---

## 9.7 Approximate Nearest Neighbor (ANN) Algorithms

```python
"""
Tại sao cần ANN?
- Exact search: O(n × d) per query - quá chậm với millions of vectors
- ANN: O(log n) - nhanh hơn nhiều, accuracy ~95-99%

Algorithms:
- HNSW (Hierarchical Navigable Small World): Tốt nhất chất lượng
- IVFFlat: Nhanh, ít memory, cho large datasets
- Flat: Exact search, chậm nhất nhưng chính xác 100%
"""

import faiss
import numpy as np

def build_faiss_index(embeddings: np.ndarray, index_type: str = "hnsw") -> faiss.Index:
    """Build FAISS index (Facebook AI Similarity Search)"""
    
    d = embeddings.shape[1]  # Dimension
    
    if index_type == "flat":
        # Exact search (chậm nhưng chính xác)
        index = faiss.IndexFlatL2(d)
        
    elif index_type == "ivfflat":
        # Approximate, good for large datasets
        nlist = min(100, len(embeddings) // 10)
        quantizer = faiss.IndexFlatL2(d)
        index = faiss.IndexIVFFlat(quantizer, d, nlist, faiss.METRIC_L2)
        index.train(embeddings)  # Train required
        
    elif index_type == "hnsw":
        # Best quality ANN
        index = faiss.IndexHNSWFlat(d, 32)  # M=32 connections
        index.hnsw.efConstruction = 200     # Build accuracy
        index.hnsw.efSearch = 50            # Search accuracy
    
    # Add vectors
    index.add(embeddings.astype(np.float32))
    print(f"FAISS index: {index.ntotal} vectors, type={index_type}")
    
    return index

def faiss_search(index: faiss.Index, query: np.ndarray, top_k: int = 5):
    """Search FAISS index"""
    D, I = index.search(query.reshape(1, -1).astype(np.float32), top_k)
    return [(int(i), float(d)) for i, d in zip(I[0], D[0]) if i != -1]

# Performance comparison
"""
100K vectors, 1536 dims, top-5 search:

Index Type | Build Time | Query Time | Recall@10
Flat       | 0.1s       | 850ms      | 100%
IVFFlat    | 3s         | 5ms        | 95%
HNSW       | 30s        | 1ms        | 99%

1M vectors:
Flat       | 2s         | 8500ms     | 100%   ← Too slow
IVFFlat    | 30s        | 8ms        | 93%
HNSW       | 5min       | 1ms        | 98%   ← Best
"""
```

---

## 9.8 Embedding cho Code

```python
"""
Code embedding khác với text embedding:
- Cần hiểu syntax, không chỉ semantics
- Code duplication detection
- Similar code search
- Bug pattern matching
"""

import anthropic

def embed_code(code: str, language: str = "python") -> np.ndarray:
    """
    Code-aware embedding:
    1. Preprocess code
    2. Dùng code-specific model
    """
    
    # Preprocess: Normalize whitespace, add language hint
    processed = f"Language: {language}\n\n{code.strip()}"
    
    # Voyage AI code model (best for code)
    # import voyageai
    # voyage = voyageai.Client()
    # result = voyage.embed([processed], model="voyage-code-3")
    # return np.array(result.embeddings[0])
    
    # Fallback to OpenAI
    response = client.embeddings.create(
        input=processed,
        model="text-embedding-3-large"
    )
    return np.array(response.data[0].embedding)

class CodeSearchEngine:
    """Semantic code search trong codebase"""
    
    def __init__(self):
        self.functions = []
        self.embeddings = None
    
    def index_codebase(self, directory: str):
        """Parse và index tất cả functions trong directory"""
        import ast
        import os
        
        for root, _, files in os.walk(directory):
            for file in files:
                if file.endswith(".py"):
                    filepath = os.path.join(root, file)
                    with open(filepath, "r", errors="ignore") as f:
                        source = f.read()
                    
                    try:
                        tree = ast.parse(source)
                        for node in ast.walk(tree):
                            if isinstance(node, ast.FunctionDef):
                                func_code = ast.get_source_segment(source, node)
                                if func_code and len(func_code) > 50:
                                    self.functions.append({
                                        "name": node.name,
                                        "code": func_code,
                                        "file": filepath,
                                        "line": node.lineno,
                                        "docstring": ast.get_docstring(node) or ""
                                    })
                    except SyntaxError:
                        pass
        
        print(f"Found {len(self.functions)} functions")
        
        # Embed with docstring + code for better retrieval
        texts = [
            f"Function: {f['name']}\nDocstring: {f['docstring']}\nCode:\n{f['code']}"
            for f in self.functions
        ]
        
        # Batch embed
        all_embeddings = []
        batch_size = 50
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            response = client.embeddings.create(input=batch, model="text-embedding-3-small")
            all_embeddings.extend([e.embedding for e in response.data])
        
        self.embeddings = np.array(all_embeddings)
    
    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Tìm functions tương tự bằng natural language"""
        query_emb = embed(query)
        
        similarities = self.embeddings @ query_emb / (
            np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_emb)
        )
        
        top_idx = np.argsort(similarities)[::-1][:top_k]
        
        return [
            {**self.functions[i], "similarity": float(similarities[i])}
            for i in top_idx
        ]

# Demo
search_engine = CodeSearchEngine()
search_engine.index_codebase("./my_project")

results = search_engine.search("function that validates email addresses")
for r in results:
    print(f"{r['file']}:{r['line']} - {r['name']} (similarity: {r['similarity']:.3f})")
```

---

## 9.9 Multi-Modal Embeddings

```python
import anthropic
from PIL import Image
import base64

def embed_image_with_claude(image_path: str) -> str:
    """
    Claude không có embedding API cho images trực tiếp.
    Strategy: Image → Description → Text Embedding
    """
    
    client = anthropic.Anthropic()
    
    # 1. Generate description
    with open(image_path, "rb") as f:
        img_data = base64.b64encode(f.read()).decode()
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", 
                 "media_type": "image/jpeg", "data": img_data}},
                {"type": "text", "text": 
                 "Mô tả ảnh này chi tiết: màu sắc, objects, text, layout (max 200 từ)"}
            ]
        }]
    )
    
    description = response.content[0].text
    
    # 2. Embed description
    return embed(description), description

class MultiModalSearchEngine:
    """Search engine cho cả text và images"""
    
    def __init__(self):
        self.items = []  # [{type, content, embedding, metadata}]
    
    def add_image(self, image_path: str, metadata: dict = None):
        embedding, description = embed_image_with_claude(image_path)
        self.items.append({
            "type": "image",
            "content": image_path,
            "description": description,
            "embedding": embedding,
            "metadata": metadata or {}
        })
    
    def add_text(self, text: str, metadata: dict = None):
        embedding = embed(text)
        self.items.append({
            "type": "text",
            "content": text,
            "embedding": embedding,
            "metadata": metadata or {}
        })
    
    def search(self, query: str, top_k: int = 5, content_type: str = None):
        query_emb = embed(query)
        
        items = self.items
        if content_type:
            items = [i for i in items if i["type"] == content_type]
        
        scored = []
        for item in items:
            sim = cosine_sim(query_emb, item["embedding"])
            scored.append({**item, "similarity": sim})
        
        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:top_k]
```

---

## 9.10 Best Practices và Pitfalls

```python
"""
BEST PRACTICES:

1. CHUNKING STRATEGY:
   ✅ Semantic chunking > Fixed-size chunking
   ✅ Overlap giữa chunks (15-20%)
   ✅ Include metadata trong chunk text
   ✅ Don't mix document types in one collection

2. EMBEDDING QUALITY:
   ✅ Test different models cho your domain
   ✅ Code → voyage-code-3, text → text-embedding-3-small
   ✅ Multilingual → embed-multilingual-v3.0
   ✅ Normalize embeddings nếu dùng dot product

3. RETRIEVAL:
   ✅ top_k × 2-3 cho hybrid search, rồi re-rank
   ✅ Minimum similarity threshold (0.3-0.5)
   ✅ Query expansion cho better recall
   ✅ Re-rank với LLM cho precision

4. INDEXING:
   ✅ HNSW cho < 10M vectors, quality priority
   ✅ IVFFlat cho > 10M vectors, speed priority
   ✅ Batch upsert, không insert one-by-one
   ✅ Monitor index fragmentation

5. COST OPTIMIZATION:
   ✅ Cache embeddings (don't re-embed same text)
   ✅ Batch API calls
   ✅ Reduce dimensions khi không cần max quality
   ✅ text-embedding-3-small đủ tốt cho 90% use cases

COMMON PITFALLS:
   ❌ Chunks quá nhỏ (< 100 tokens) → mất context
   ❌ Chunks quá lớn (> 1000 tokens) → noise
   ❌ Không normalize queries và documents
   ❌ Quên update embeddings khi update documents
   ❌ Trust similarity score tuyệt đối (ngưỡng phụ thuộc model)
"""

class EmbeddingCache:
    """LRU cache cho embeddings"""
    
    def __init__(self, max_size: int = 10000):
        from functools import lru_cache
        self.cache = {}
        self.max_size = max_size
        self.hits = 0
        self.misses = 0
    
    def get(self, text: str) -> np.ndarray | None:
        key = hash(text)
        if key in self.cache:
            self.hits += 1
            return self.cache[key]
        self.misses += 1
        return None
    
    def set(self, text: str, embedding: np.ndarray):
        if len(self.cache) >= self.max_size:
            # Remove oldest (simple eviction)
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]
        self.cache[hash(text)] = embedding
    
    @property
    def hit_rate(self):
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0

embedding_cache = EmbeddingCache()

def cached_embed(text: str) -> np.ndarray:
    cached = embedding_cache.get(text)
    if cached is not None:
        return cached
    
    embedding = embed(text)
    embedding_cache.set(text, embedding)
    return embedding
```

---

## Tóm tắt chương

Vector Databases và Embeddings:
- **Embedding models**: OpenAI, Voyage, Cohere, local models
- **Similarity metrics**: Cosine (text), L2 (vision), dot product (normalized)
- **Optimization**: Dimensionality reduction, quantization, MRL
- **ANN algorithms**: HNSW (quality), IVFFlat (scale), Flat (exact)
- **Vector DBs**: Pinecone (managed), Qdrant (OSS), pgvector (SQL), Chroma (dev)
- **Code search**: Parse functions, embed docstrings + code
- **Caching**: LRU cache để giảm API calls

---

*Chương tiếp theo: **Xây dựng Chatbot Production***
