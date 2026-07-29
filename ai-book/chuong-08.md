# CHƯƠNG 8: LANGCHAIN VÀ ORCHESTRATION FRAMEWORKS

## Giới thiệu chương

LangChain, LlamaIndex, và các orchestration frameworks giúp kỹ sư xây dựng AI applications phức tạp nhanh hơn bằng cách cung cấp abstractions sẵn có cho chains, agents, memory, và retrieval. Chương này đi từ "tự làm" sang "dùng framework" và biết khi nào nên dùng gì.

---

## 8.1 LangChain Overview

### 8.1.1 Tại sao cần Framework?

```python
# KHÔNG có framework: Phải tự handle mọi thứ
def manual_rag_chain(question, documents):
    # Embed question
    q_emb = embed(question)
    # Search
    docs = vector_search(q_emb)
    # Format prompt
    prompt = format_rag_prompt(question, docs)
    # Call LLM
    response = call_llm(prompt)
    # Parse output
    return parse_response(response)

# VỚI LangChain: Declarative, composable
from langchain.chains import RetrievalQA
chain = RetrievalQA.from_chain_type(
    llm=llm, retriever=vectorstore.as_retriever()
)
result = chain.invoke({"query": question})
```

### 8.1.2 Core Concepts

```python
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader, TextLoader, WebBaseLoader, CSVLoader
)

# 1. MODELS
claude = ChatAnthropic(model="claude-3-5-sonnet-20241022")
gpt4 = ChatOpenAI(model="gpt-4o")

# 2. PROMPTS
prompt = ChatPromptTemplate.from_messages([
    ("system", "Bạn là {role}. Trả lời bằng tiếng Việt."),
    ("human", "{question}")
])

# 3. OUTPUT PARSERS
str_parser = StrOutputParser()
json_parser = JsonOutputParser()

# 4. CHAINS (LCEL - LangChain Expression Language)
basic_chain = prompt | claude | str_parser

# Invoke
result = basic_chain.invoke({
    "role": "Python expert",
    "question": "Giải thích decorators"
})
```

---

## 8.2 LCEL: LangChain Expression Language

```python
# LCEL là pipe operator (|) để chain components

# Simple chain
chain = prompt | llm | StrOutputParser()

# Branch: RunnablePassthrough để giữ original input
from langchain_core.runnables import RunnableParallel

parallel_chain = RunnableParallel(
    answer=prompt | llm | StrOutputParser(),
    question=RunnablePassthrough()
)

result = parallel_chain.invoke({"question": "What is Python?"})
# result = {"answer": "Python is...", "question": "What is Python?"}

# Sequence với transformation
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {
        "context": retriever | format_docs,
        "question": RunnablePassthrough()
    }
    | prompt
    | llm
    | StrOutputParser()
)

# Conditional routing
from langchain_core.runnables import RunnableBranch

def classify_question(question):
    if any(kw in question.lower() for kw in ["code", "python", "bug"]):
        return "technical"
    return "general"

branch = RunnableBranch(
    (lambda x: classify_question(x["question"]) == "technical", technical_chain),
    general_chain  # Default
)
```

---

## 8.3 Document Loaders và Text Splitters

```python
from langchain_community.document_loaders import (
    PyPDFLoader, TextLoader, WebBaseLoader,
    GitLoader, NotionDBLoader, SlackDirectoryLoader
)
from langchain.text_splitter import (
    RecursiveCharacterTextSplitter,
    TokenTextSplitter,
    MarkdownHeaderTextSplitter
)

# PDF Loading
def load_pdf(pdf_path: str):
    loader = PyPDFLoader(pdf_path)
    pages = loader.load()
    print(f"Loaded {len(pages)} pages")
    return pages

# Web Loading
def load_website(url: str):
    loader = WebBaseLoader(url)
    docs = loader.load()
    return docs

# Splitting
def split_documents(documents, chunk_size=500, overlap=50):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    splits = splitter.split_documents(documents)
    print(f"Split into {len(splits)} chunks")
    return splits

# Markdown-aware splitting
md_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=[
        ("#", "header1"),
        ("##", "header2"),
        ("###", "header3"),
    ]
)

# Full ingestion pipeline
def ingest_documents(sources: List[str]) -> Chroma:
    all_docs = []
    
    for source in sources:
        if source.endswith(".pdf"):
            docs = load_pdf(source)
        elif source.startswith("http"):
            docs = load_website(source)
        else:
            loader = TextLoader(source)
            docs = loader.load()
        all_docs.extend(docs)
    
    splits = split_documents(all_docs)
    
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = Chroma.from_documents(
        documents=splits,
        embedding=embeddings,
        persist_directory="./chroma_db"
    )
    
    return vectorstore
```

---

## 8.4 Memory và Conversation History

```python
from langchain.memory import (
    ConversationBufferMemory,
    ConversationBufferWindowMemory,
    ConversationSummaryMemory,
    ConversationSummaryBufferMemory
)
from langchain.chains import ConversationChain

# Buffer Memory: Giữ toàn bộ history
buffer_memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

# Window Memory: Chỉ giữ N messages cuối
window_memory = ConversationBufferWindowMemory(
    k=5,  # Giữ 5 pairs
    memory_key="chat_history",
    return_messages=True
)

# Summary Memory: Summarize cũ, giữ mới
summary_memory = ConversationSummaryMemory(
    llm=claude,
    memory_key="chat_history",
    return_messages=True
)

# Summary + Buffer: Best of both worlds
smart_memory = ConversationSummaryBufferMemory(
    llm=claude,
    max_token_limit=2000,  # Summary nếu > 2000 tokens
    memory_key="chat_history",
    return_messages=True
)

# Conversation chain với memory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt_with_memory = ChatPromptTemplate.from_messages([
    ("system", "Bạn là helpful assistant. Nhớ context của conversation."),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}")
])

chain_with_memory = prompt_with_memory | claude | StrOutputParser()

# Sử dụng
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

store = {}

def get_session_history(session_id: str):
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

chain_with_history = RunnableWithMessageHistory(
    chain_with_memory,
    get_session_history,
    input_messages_key="input",
    history_messages_key="chat_history"
)

# Session-based conversations
config_user1 = {"configurable": {"session_id": "user_001"}}
response1 = chain_with_history.invoke({"input": "Tôi tên là Minh"}, config=config_user1)
response2 = chain_with_history.invoke({"input": "Tên tôi là gì?"}, config=config_user1)
# response2 sẽ nhớ "Minh"
```

---

## 8.5 LangChain Agents

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_community.utilities import WikipediaAPIWrapper

# Define custom tools
@tool
def calculate(expression: str) -> str:
    """Tính toán biểu thức toán học Python an toàn.
    Input: biểu thức Python như '2 + 2' hoặc 'sum([1,2,3])'
    """
    try:
        # Restricted eval - chỉ cho phép math operations
        allowed_names = {
            "abs": abs, "round": round, "sum": sum,
            "min": min, "max": max, "len": len
        }
        result = eval(expression, {"__builtins__": {}}, allowed_names)
        return str(result)
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def search_web(query: str) -> str:
    """Tìm kiếm thông tin hiện tại trên internet.
    Dùng khi cần thông tin mới hoặc real-time data.
    """
    search = DuckDuckGoSearchRun()
    return search.run(query)

@tool  
def query_database(sql_query: str) -> str:
    """Chạy SQL query read-only trên analytics database.
    Chỉ SELECT statements. Tables: sales, users, products.
    """
    import sqlite3
    # Mock database
    conn = sqlite3.connect(":memory:")
    # ... setup mock data
    try:
        cursor = conn.execute(sql_query)
        results = cursor.fetchall()
        return str(results[:20])  # Limit results
    except Exception as e:
        return f"SQL Error: {str(e)}"

# Create agent
tools = [calculate, search_web, query_database]

agent_prompt = ChatPromptTemplate.from_messages([
    ("system", """Bạn là helpful data analyst với quyền truy cập database và internet.
    Sử dụng tools khi cần thiết để trả lời chính xác nhất."""),
    MessagesPlaceholder("chat_history", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder("agent_scratchpad"),
])

agent = create_tool_calling_agent(claude, tools, agent_prompt)
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,  # Show reasoning
    max_iterations=10,
    handle_parsing_errors=True
)

# Run
result = executor.invoke({
    "input": "Tổng doanh thu tháng 11/2024 là bao nhiêu? So sánh với tháng trước."
})
print(result["output"])
```

---

## 8.6 LlamaIndex

```python
"""
LlamaIndex vs LangChain:
- LlamaIndex: Chuyên về data indexing và retrieval (RAG focused)
- LangChain: Tổng quát hơn (chains, agents, memory, tools)

Dùng LlamaIndex khi: Cần RAG phức tạp, structured data
Dùng LangChain khi: Cần agents, memory, complex workflows
"""

from llama_index.core import VectorStoreIndex, Document, Settings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.llms.anthropic import Anthropic as LlamaAnthropic
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.postprocessor import SimilarityPostprocessor

# Setup
Settings.llm = LlamaAnthropic(model="claude-3-5-sonnet-20241022")
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
Settings.node_parser = SentenceSplitter(chunk_size=512, chunk_overlap=20)

# Build index
def build_llamaindex(documents_text: List[str]) -> VectorStoreIndex:
    docs = [Document(text=text) for text in documents_text]
    index = VectorStoreIndex.from_documents(docs, show_progress=True)
    return index

# Advanced query engine
def create_advanced_query_engine(index):
    retriever = VectorIndexRetriever(
        index=index,
        similarity_top_k=5
    )
    
    postprocessors = [
        SimilarityPostprocessor(similarity_cutoff=0.7)
    ]
    
    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        node_postprocessors=postprocessors
    )
    
    return query_engine

# Sub-question query engine (cho multi-document)
from llama_index.core.query_engine import SubQuestionQueryEngine
from llama_index.core.tools import QueryEngineTool

def multi_document_qa(document_sets: Dict[str, List[str]]) -> SubQuestionQueryEngine:
    """
    Tự động chia câu hỏi phức tạp thành sub-questions,
    query từng document set, tổng hợp câu trả lời
    """
    tools = []
    
    for name, docs in document_sets.items():
        index = build_llamaindex(docs)
        engine = index.as_query_engine()
        
        tool = QueryEngineTool.from_defaults(
            query_engine=engine,
            name=name,
            description=f"Tìm kiếm trong {name}"
        )
        tools.append(tool)
    
    return SubQuestionQueryEngine.from_defaults(query_engine_tools=tools)
```

---

## 8.7 Khi nào dùng Framework vs Custom

```python
"""
USE FRAMEWORK WHEN:
✅ Rapid prototyping cần
✅ Standard use cases (RAG, chatbot, agent)
✅ Team không quen AI deep internals
✅ Need built-in integrations (100+ connectors)
✅ Production deadline gần

BUILD CUSTOM WHEN:
✅ Performance critical (framework overhead)
✅ Non-standard architecture
✅ Fine-grained control cần
✅ Debugging dễ hơn với custom code
✅ Minimal dependencies preferred

HYBRID (BEST PRACTICE):
✅ Dùng framework cho boilerplate
✅ Custom cho business logic
✅ Override framework components khi cần
"""

# Hybrid example: Custom retrieval + LangChain chain
class CustomRetriever:
    """Custom retriever với business logic"""
    
    def get_relevant_documents(self, query: str):
        # Custom retrieval với business rules
        docs = hybrid_search(query)
        docs = apply_access_control(docs, current_user)
        docs = rerank_by_recency(docs)
        return [Document(page_content=d["text"]) for d in docs]

from langchain_core.retrievers import BaseRetriever

class LangChainCompatibleRetriever(BaseRetriever):
    """Wrap custom retriever để dùng với LangChain"""
    
    def _get_relevant_documents(self, query: str):
        custom = CustomRetriever()
        return custom.get_relevant_documents(query)

# Bây giờ có thể dùng trong LangChain chain
retriever = LangChainCompatibleRetriever()
rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt | claude | StrOutputParser()
)
```

---

## Tóm tắt chương

- **LCEL**: Pipe operator để compose chains declaratively
- **Document Loaders**: PDF, Web, GitHub, Notion, etc.
- **Memory**: Buffer, Window, Summary - chọn theo use case
- **Agents**: Tool-calling với AgentExecutor
- **LlamaIndex**: RAG-focused, sub-question engine
- **Framework vs Custom**: Biết khi nào dùng gì

---

*Chương tiếp theo: **Vector Databases và Embeddings***
