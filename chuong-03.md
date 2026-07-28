# CHƯƠNG 3: LÀM VIỆC VỚI OPENAI API (ChatGPT)

## Giới thiệu chương

OpenAI API là cổng vào hệ sinh thái AI mạnh mẽ nhất hiện nay. Với GPT-4o, DALL-E 3, Whisper, và hàng chục models chuyên dụng, OpenAI cung cấp một platform đầy đủ cho mọi use case AI. Chương này dạy bạn từ API call đầu tiên đến các pattern production-ready.

---

## 3.1 Thiết lập OpenAI SDK

### 3.1.1 Installation và Authentication

```bash
pip install openai
pip install python-dotenv
```

```python
# config.py
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Khởi tạo client (dùng lại, không tạo mới mỗi lần call)
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    timeout=30.0,           # Timeout 30 giây
    max_retries=2,           # Tự retry 2 lần khi lỗi
)
```

### 3.1.2 Chat Completions API

```python
def chat_simple(message: str, model: str = "gpt-4o") -> str:
    """Basic chat completion"""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "user", "content": message}
        ],
        max_tokens=1000,
        temperature=0.7,
    )
    return response.choices[0].message.content

# Sử dụng
result = chat_simple("Giải thích Docker trong 3 câu")
print(result)
```

### 3.1.3 Multi-turn Conversation

```python
from typing import List, Dict

class OpenAIChat:
    """Stateful conversation manager"""
    
    def __init__(self, system_prompt: str = "", model: str = "gpt-4o"):
        self.model = model
        self.messages: List[Dict] = []
        if system_prompt:
            self.messages.append({"role": "system", "content": system_prompt})
    
    def send(self, message: str) -> str:
        self.messages.append({"role": "user", "content": message})
        
        response = client.chat.completions.create(
            model=self.model,
            messages=self.messages,
            max_tokens=1500,
            temperature=0.7
        )
        
        assistant_message = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": assistant_message})
        
        return assistant_message
    
    def reset(self):
        """Xóa conversation history (giữ system prompt)"""
        self.messages = [m for m in self.messages if m["role"] == "system"]
    
    @property
    def token_count(self) -> int:
        """Ước tính số tokens đã dùng"""
        total_chars = sum(len(m["content"]) for m in self.messages)
        return total_chars // 4  # Rough estimate: 1 token ≈ 4 chars

# Demo
chat = OpenAIChat("You are a helpful Python tutor. Explain things simply.")
print(chat.send("Closure là gì?"))
print(chat.send("Cho ví dụ thực tế về closure?"))
print(chat.send("Khi nào thì dùng closure thay vì class?"))
```

---

## 3.2 Streaming Responses

### 3.2.1 Basic Streaming

```python
def chat_streaming(message: str):
    """Stream response để cải thiện UX"""
    stream = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": message}],
        stream=True,
    )
    
    full_response = ""
    for chunk in stream:
        if chunk.choices[0].delta.content is not None:
            content = chunk.choices[0].delta.content
            print(content, end="", flush=True)
            full_response += content
    
    print()  # New line after completion
    return full_response

chat_streaming("Giải thích Kubernetes trong 5 bước")
```

### 3.2.2 Async Streaming cho FastAPI

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio

app = FastAPI()

@app.post("/chat/stream")
async def chat_stream_endpoint(message: str):
    """Server-Sent Events streaming endpoint"""
    
    async def generate():
        stream = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": message}],
            stream=True,
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                yield f"data: {json.dumps({'content': content})}\n\n"
        
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )
```

---

## 3.3 Function Calling (Tool Use)

### 3.3.1 Cơ bản về Function Calling

Function Calling cho phép GPT quyết định khi nào cần gọi external functions:

```python
import json
from datetime import datetime

# Định nghĩa các tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Lấy thông tin thời tiết hiện tại của một thành phố",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "Tên thành phố, ví dụ: 'Hà Nội', 'TP.HCM'"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Đơn vị nhiệt độ"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_database",
            "description": "Tìm kiếm thông tin trong database nội bộ",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "table": {"type": "string", "enum": ["products", "orders", "users"]},
                    "limit": {"type": "integer", "default": 10}
                },
                "required": ["query", "table"]
            }
        }
    }
]

# Mock implementations
def get_weather(city: str, unit: str = "celsius") -> dict:
    return {"city": city, "temperature": 28, "unit": unit, "condition": "Sunny"}

def search_database(query: str, table: str, limit: int = 10) -> list:
    return [{"id": 1, "name": f"Result for {query}", "table": table}]

def run_tool(tool_name: str, tool_args: dict):
    if tool_name == "get_weather":
        return get_weather(**tool_args)
    elif tool_name == "search_database":
        return search_database(**tool_args)
    raise ValueError(f"Unknown tool: {tool_name}")

# Agentic loop
def agent_chat(user_message: str) -> str:
    messages = [{"role": "user", "content": user_message}]
    
    while True:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )
        
        choice = response.choices[0]
        messages.append({"role": "assistant", "content": choice.message.content, 
                         "tool_calls": choice.message.tool_calls})
        
        # Nếu không có tool call, trả về response
        if choice.finish_reason == "stop":
            return choice.message.content
        
        # Xử lý tool calls
        if choice.message.tool_calls:
            for tool_call in choice.message.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
                
                result = run_tool(func_name, func_args)
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result)
                })

# Demo
print(agent_chat("Thời tiết Hà Nội hôm nay thế nào?"))
print(agent_chat("Tìm 5 sản phẩm bán chạy nhất"))
```

---

## 3.4 Vision API (Image Analysis)

```python
import base64
from pathlib import Path

def analyze_image(image_path: str, question: str) -> str:
    """Phân tích hình ảnh với GPT-4o Vision"""
    
    # Đọc và encode ảnh
    image_data = Path(image_path).read_bytes()
    base64_image = base64.b64encode(image_data).decode("utf-8")
    
    # Determine media type
    suffix = Path(image_path).suffix.lower()
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }.get(suffix, "image/jpeg")
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{base64_image}",
                            "detail": "high"  # "low" tiết kiệm token hơn
                        }
                    },
                    {
                        "type": "text",
                        "text": question
                    }
                ]
            }
        ],
        max_tokens=1000
    )
    
    return response.choices[0].message.content

# Use cases
result = analyze_image("error_screenshot.png", 
    "Đây là error log từ hệ thống production. Phân tích nguyên nhân và hướng xử lý.")
    
result = analyze_image("ui_design.png",
    "Review UI design này về UX best practices và accessibility")
    
result = analyze_image("architecture_diagram.png",
    "Giải thích architecture diagram này và identify single points of failure")
```

---

## 3.5 Embeddings API

```python
from openai import OpenAI
import numpy as np

client = OpenAI()

def get_embedding(text: str, model: str = "text-embedding-3-small") -> list[float]:
    """Chuyển văn bản thành vector embedding"""
    response = client.embeddings.create(
        input=text,
        model=model  # text-embedding-3-small: 1536 dims, $0.02/1M tokens
                     # text-embedding-3-large: 3072 dims, $0.13/1M tokens
    )
    return response.data[0].embedding

def cosine_similarity(v1: list, v2: list) -> float:
    """Tính độ tương đồng giữa hai vectors"""
    a, b = np.array(v1), np.array(v2)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def semantic_search(query: str, documents: list[str], top_k: int = 3) -> list:
    """Tìm kiếm ngữ nghĩa trong danh sách documents"""
    query_embedding = get_embedding(query)
    
    results = []
    for doc in documents:
        doc_embedding = get_embedding(doc)
        similarity = cosine_similarity(query_embedding, doc_embedding)
        results.append({"document": doc, "similarity": similarity})
    
    return sorted(results, key=lambda x: x["similarity"], reverse=True)[:top_k]

# Demo semantic search
knowledge_base = [
    "Python là ngôn ngữ lập trình interpreted, dynamic typing",
    "Docker là platform để containerize applications",
    "Kubernetes orchestrates Docker containers ở scale",
    "FastAPI là Python web framework hiệu suất cao",
    "PostgreSQL là relational database mạnh mẽ và feature-rich",
]

results = semantic_search("Tôi cần deploy ứng dụng Python lên cloud", knowledge_base)
for r in results:
    print(f"Similarity: {r['similarity']:.3f} | {r['document']}")
```

---

## 3.6 Audio: Whisper và TTS

```python
# Speech-to-Text với Whisper
def transcribe_audio(audio_file_path: str, language: str = "vi") -> str:
    """Chuyển audio thành văn bản"""
    with open(audio_file_path, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language,
            response_format="text"
        )
    return transcription

# Text-to-Speech
def text_to_speech(text: str, output_path: str, voice: str = "alloy"):
    """Chuyển văn bản thành audio"""
    # Voices: alloy, echo, fable, onyx, nova, shimmer
    response = client.audio.speech.create(
        model="tts-1",      # tts-1-hd cho quality cao hơn
        voice=voice,
        input=text
    )
    response.stream_to_file(output_path)

# Voice bot demo
def voice_assistant():
    print("Voice Assistant started. Say something!")
    
    # Record audio (cần thư viện pyaudio)
    audio_path = record_audio(duration=5)
    
    # Transcribe
    user_message = transcribe_audio(audio_path)
    print(f"You said: {user_message}")
    
    # Get AI response
    response = chat_simple(user_message)
    print(f"Assistant: {response}")
    
    # Speak response
    text_to_speech(response, "response.mp3")
    play_audio("response.mp3")
```

---

## 3.7 Error Handling và Production Patterns

```python
import time
from openai import OpenAI, RateLimitError, APITimeoutError, APIConnectionError
import logging

logger = logging.getLogger(__name__)

class RobustOpenAIClient:
    """Production-ready OpenAI client với error handling đầy đủ"""
    
    def __init__(self):
        self.client = OpenAI()
        self.total_tokens_used = 0
        self.total_cost = 0.0
    
    def chat(self, 
             messages: list,
             model: str = "gpt-4o",
             max_retries: int = 3,
             **kwargs) -> str:
        
        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    **kwargs
                )
                
                # Track usage
                usage = response.usage
                self.total_tokens_used += usage.total_tokens
                self._update_cost(model, usage)
                
                return response.choices[0].message.content
                
            except RateLimitError as e:
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                logger.warning(f"Rate limited. Waiting {wait_time}s... (attempt {attempt+1})")
                time.sleep(wait_time)
                if attempt == max_retries - 1:
                    raise
                    
            except APITimeoutError:
                logger.error(f"Timeout on attempt {attempt+1}")
                if attempt == max_retries - 1:
                    raise
                    
            except APIConnectionError as e:
                logger.error(f"Connection error: {e}")
                raise  # Không retry connection errors
    
    def _update_cost(self, model: str, usage):
        pricing = {
            "gpt-4o": (5/1_000_000, 15/1_000_000),
            "gpt-4o-mini": (0.15/1_000_000, 0.60/1_000_000),
        }
        if model in pricing:
            input_rate, output_rate = pricing[model]
            cost = (usage.prompt_tokens * input_rate + 
                   usage.completion_tokens * output_rate)
            self.total_cost += cost
    
    def get_usage_report(self) -> dict:
        return {
            "total_tokens": self.total_tokens_used,
            "estimated_cost_usd": round(self.total_cost, 6)
        }
```

---

## 3.8 Batch API cho Large-scale Processing

```python
import json

def process_batch(inputs: list[str], 
                  system_prompt: str,
                  model: str = "gpt-4o-mini") -> list[str]:
    """
    Batch API: 50% rẻ hơn, dùng cho offline processing
    Không phải realtime — kết quả trong 24 giờ
    """
    
    # Tạo batch requests file
    requests = []
    for i, text in enumerate(inputs):
        requests.append({
            "custom_id": f"request-{i}",
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                "max_tokens": 500
            }
        })
    
    # Ghi JSONL file
    with open("batch_input.jsonl", "w") as f:
        for req in requests:
            f.write(json.dumps(req) + "\n")
    
    # Upload file
    with open("batch_input.jsonl", "rb") as f:
        batch_input_file = client.files.create(file=f, purpose="batch")
    
    # Tạo batch job
    batch = client.batches.create(
        input_file_id=batch_input_file.id,
        endpoint="/v1/chat/completions",
        completion_window="24h"
    )
    
    print(f"Batch created: {batch.id}")
    print(f"Status: {batch.status}")
    return batch.id

def get_batch_results(batch_id: str) -> list[dict]:
    """Lấy kết quả batch sau khi hoàn thành"""
    batch = client.batches.retrieve(batch_id)
    
    if batch.status != "completed":
        print(f"Batch not ready. Status: {batch.status}")
        return []
    
    # Download results
    result_file = client.files.content(batch.output_file_id)
    results = []
    
    for line in result_file.text.strip().split("\n"):
        result = json.loads(line)
        custom_id = result["custom_id"]
        content = result["response"]["body"]["choices"][0]["message"]["content"]
        results.append({"id": custom_id, "content": content})
    
    return results
```

---

## 3.9 OpenAI Assistants API

```python
class AssistantManager:
    """Quản lý OpenAI Assistants với persistent state"""
    
    def __init__(self, name: str, instructions: str, tools: list = None):
        self.assistant = client.beta.assistants.create(
            name=name,
            instructions=instructions,
            tools=tools or [{"type": "code_interpreter"}, {"type": "file_search"}],
            model="gpt-4o"
        )
        self.threads = {}
    
    def create_thread(self, user_id: str) -> str:
        """Mỗi user có thread riêng"""
        thread = client.beta.threads.create()
        self.threads[user_id] = thread.id
        return thread.id
    
    def chat(self, user_id: str, message: str) -> str:
        thread_id = self.threads.get(user_id) or self.create_thread(user_id)
        
        # Thêm message vào thread
        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=message
        )
        
        # Chạy assistant
        run = client.beta.threads.runs.create_and_poll(
            thread_id=thread_id,
            assistant_id=self.assistant.id,
        )
        
        if run.status == "completed":
            messages = client.beta.threads.messages.list(thread_id=thread_id)
            return messages.data[0].content[0].text.value
        else:
            raise Exception(f"Run failed with status: {run.status}")
    
    def upload_file(self, file_path: str) -> str:
        """Upload file để assistant có thể đọc"""
        with open(file_path, "rb") as f:
            file = client.files.create(file=f, purpose="assistants")
        return file.id

# Demo: Data Analysis Assistant
analyst = AssistantManager(
    name="Data Analyst",
    instructions="""
    Bạn là data analyst chuyên về business intelligence.
    Khi nhận được data, hãy:
    1. Phân tích xu hướng
    2. Tìm anomalies
    3. Đưa ra actionable insights
    4. Tạo visualizations khi cần
    """,
    tools=[{"type": "code_interpreter"}]
)

response = analyst.chat("user123", "Phân tích doanh thu Q3 2024 theo region")
```

---

## 3.10 Best Practices tổng hợp

### 3.10.1 Production Checklist

```python
"""
OpenAI Production Checklist:

SECURITY:
✅ API key trong environment variable, không hardcode
✅ API key rotation strategy
✅ Rate limiting ở application layer
✅ Input sanitization trước khi đưa vào prompt
✅ Output validation trước khi dùng

RELIABILITY:
✅ Retry logic với exponential backoff
✅ Timeout configuration
✅ Fallback model (gpt-4o-mini nếu gpt-4o fail)
✅ Circuit breaker pattern

COST:
✅ Token counting trước khi call
✅ Max tokens limit
✅ Batch API cho offline tasks
✅ Caching cho repeated queries
✅ Model selection theo task complexity

OBSERVABILITY:
✅ Log tất cả requests/responses
✅ Track token usage per user/feature
✅ Alert khi cost bất thường
✅ Latency monitoring
"""
```

---

## Tóm tắt chương

Chương 3 đã cover:
- Chat Completions API cơ bản và multi-turn conversations
- Streaming cho UX tốt hơn
- Function Calling cho AI agents
- Vision API cho image analysis
- Embeddings cho semantic search
- Audio: Whisper (STT) và TTS
- Error handling và production patterns
- Batch API cho cost optimization
- Assistants API với persistent state

---

*Chương tiếp theo: **Làm việc với Anthropic API (Claude)***
