# CHƯƠNG 4: LÀM VIỆC VỚI ANTHROPIC API (Claude)

## Giới thiệu chương

Anthropic API mang lại những capabilities độc đáo: context window 200K tokens, Constitutional AI safety, và thiết kế API sạch sẽ. Claude đặc biệt xuất sắc trong writing, analysis, coding, và xử lý tài liệu dài. Chương này đi sâu vào mọi tính năng của Anthropic API.

---

## 4.1 Anthropic SDK cơ bản

### 4.1.1 Setup và Authentication

```python
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

# Khởi tạo client
client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
)

# Async client cho production
async_client = anthropic.AsyncAnthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
)
```

### 4.1.2 Messages API

```python
def chat_claude(user_message: str, 
                system: str = "",
                model: str = "claude-3-5-sonnet-20241022") -> str:
    """Basic Claude chat"""
    
    kwargs = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": user_message}]
    }
    
    if system:
        kwargs["system"] = system
    
    response = client.messages.create(**kwargs)
    return response.content[0].text

# Các models hiện có:
CLAUDE_MODELS = {
    "opus": "claude-3-opus-20240229",       # Mạnh nhất, chậm nhất, đắt nhất
    "sonnet": "claude-3-5-sonnet-20241022", # Cân bằng tốt nhất (recommended)
    "haiku": "claude-3-5-haiku-20241022",  # Nhanh, rẻ, đủ mạnh
}
```

### 4.1.3 Response Structure

```python
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)

# Response structure:
print(response.id)           # msg_...
print(response.type)         # "message"
print(response.role)         # "assistant"
print(response.content)      # List of content blocks
print(response.model)        # Model used
print(response.stop_reason) # "end_turn" | "max_tokens" | "tool_use"

# Usage tracking
print(response.usage.input_tokens)   # Tokens trong input
print(response.usage.output_tokens)  # Tokens trong output
print(response.usage.cache_creation_input_tokens)  # Prompt caching
print(response.usage.cache_read_input_tokens)       # Cache hits

# Content blocks (có thể nhiều blocks)
for block in response.content:
    if block.type == "text":
        print(block.text)
    elif block.type == "tool_use":
        print(f"Tool: {block.name}, Input: {block.input}")
```

---

## 4.2 Multi-turn Conversations

```python
class ClaudeConversation:
    """Quản lý multi-turn conversations với Claude"""
    
    def __init__(self, system: str = "", model: str = "claude-3-5-sonnet-20241022"):
        self.client = anthropic.Anthropic()
        self.model = model
        self.system = system
        self.history = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0
    
    def chat(self, message: str, **kwargs) -> str:
        self.history.append({"role": "user", "content": message})
        
        params = {
            "model": self.model,
            "max_tokens": 2048,
            "messages": self.history,
            **kwargs
        }
        if self.system:
            params["system"] = self.system
        
        response = self.client.messages.create(**params)
        
        assistant_message = response.content[0].text
        self.history.append({"role": "assistant", "content": assistant_message})
        
        # Track tokens
        self.total_input_tokens += response.usage.input_tokens
        self.total_output_tokens += response.usage.output_tokens
        
        return assistant_message
    
    def cost_estimate(self) -> float:
        """Ước tính chi phí (claude-3-5-sonnet: $3/$15 per 1M)"""
        input_cost = self.total_input_tokens * 3 / 1_000_000
        output_cost = self.total_output_tokens * 15 / 1_000_000
        return input_cost + output_cost
    
    def trim_history(self, keep_last_n: int = 10):
        """Giữ lại N pairs cuối để không vượt context"""
        # Luôn giữ lại system prompt
        pairs = len(self.history) // 2
        if pairs > keep_last_n:
            self.history = self.history[-(keep_last_n * 2):]

# Demo
conv = ClaudeConversation(
    system="Bạn là Python expert. Giải thích ngắn gọn, dùng code ví dụ."
)
print(conv.chat("List comprehension là gì?"))
print(conv.chat("Cho tôi ví dụ phức tạp hơn"))
print(conv.chat("Performance so sánh với for loop như thế nào?"))
print(f"\nEstimated cost: ${conv.cost_estimate():.6f}")
```

---

## 4.3 Streaming với Claude

```python
import anthropic

def stream_claude(message: str, system: str = ""):
    """Stream response từ Claude"""
    
    kwargs = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": message}],
    }
    if system:
        kwargs["system"] = system
    
    full_text = ""
    input_tokens = 0
    output_tokens = 0
    
    with client.messages.stream(**kwargs) as stream:
        for event in stream:
            # Events: message_start, content_block_start, content_block_delta,
            #         content_block_stop, message_delta, message_stop
            
            if hasattr(event, 'type'):
                if event.type == "content_block_delta":
                    if hasattr(event.delta, 'text'):
                        print(event.delta.text, end="", flush=True)
                        full_text += event.delta.text
                        
                elif event.type == "message_start":
                    input_tokens = event.message.usage.input_tokens
                    
                elif event.type == "message_delta":
                    output_tokens = event.usage.output_tokens
    
    print()  # newline
    print(f"\nTokens - Input: {input_tokens}, Output: {output_tokens}")
    return full_text

# Async streaming cho FastAPI
async def stream_claude_async(message: str):
    async with async_client.messages.stream(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        messages=[{"role": "user", "content": message}]
    ) as stream:
        async for text in stream.text_stream:
            yield text
```

---

## 4.4 Tool Use với Claude

### 4.4.1 Định nghĩa Tools

```python
# Claude dùng JSON Schema để định nghĩa tools
tools = [
    {
        "name": "run_python_code",
        "description": """
        Chạy Python code và trả về output.
        Dùng khi cần tính toán, xử lý data, hoặc verify code.
        """,
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python code để chạy"
                },
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds (default: 30)",
                    "default": 30
                }
            },
            "required": ["code"]
        }
    },
    {
        "name": "query_database",
        "description": "Chạy SQL query trên database",
        "input_schema": {
            "type": "object",
            "properties": {
                "sql": {"type": "string", "description": "SQL query"},
                "database": {
                    "type": "string",
                    "enum": ["analytics", "production_readonly"],
                    "description": "Which database to query"
                }
            },
            "required": ["sql", "database"]
        }
    }
]
```

### 4.4.2 Tool Use Loop

```python
import subprocess
import json

def execute_python(code: str, timeout: int = 30) -> str:
    """Safely execute Python code in sandbox"""
    try:
        result = subprocess.run(
            ["python3", "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        if result.returncode == 0:
            return result.stdout or "Code executed successfully (no output)"
        else:
            return f"Error: {result.stderr}"
    except subprocess.TimeoutExpired:
        return f"Timeout after {timeout}s"
    except Exception as e:
        return f"Execution error: {str(e)}"

def claude_agent(user_message: str, max_turns: int = 10) -> str:
    """Claude agent với tool use loop"""
    
    messages = [{"role": "user", "content": user_message}]
    
    for turn in range(max_turns):
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            tools=tools,
            messages=messages
        )
        
        # Thêm response vào messages
        messages.append({"role": "assistant", "content": response.content})
        
        if response.stop_reason == "end_turn":
            # Claude hoàn thành, không cần gọi tool nữa
            return response.content[0].text
        
        if response.stop_reason == "tool_use":
            # Xử lý tool calls
            tool_results = []
            
            for block in response.content:
                if block.type == "tool_use":
                    print(f"🔧 Calling tool: {block.name}")
                    print(f"   Input: {json.dumps(block.input, indent=2)}")
                    
                    # Execute tool
                    if block.name == "run_python_code":
                        result = execute_python(
                            block.input["code"],
                            block.input.get("timeout", 30)
                        )
                    else:
                        result = f"Tool {block.name} not implemented"
                    
                    print(f"   Result: {result[:200]}...")
                    
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result)
                    })
            
            # Thêm tool results vào messages
            messages.append({"role": "user", "content": tool_results})
    
    return "Max turns reached"

# Demo
result = claude_agent("""
Tính fibonacci số thứ 100 bằng Python (dùng dynamic programming).
Sau đó verify bằng cách tính lại bằng recursive với memoization.
So sánh kết quả.
""")
print(result)
```

---

## 4.5 Vision với Claude

```python
import base64
import httpx
from pathlib import Path

def claude_vision_url(image_url: str, question: str) -> str:
    """Phân tích ảnh từ URL"""
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "url",
                            "url": image_url,
                        },
                    },
                    {
                        "type": "text",
                        "text": question
                    }
                ],
            }
        ],
    )
    return response.content[0].text

def claude_vision_file(image_path: str, question: str) -> str:
    """Phân tích ảnh từ file local"""
    suffix = Path(image_path).suffix.lower()
    media_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }
    media_type = media_type_map.get(suffix, "image/jpeg")
    
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {"type": "text", "text": question}
                ],
            }
        ],
    )
    return response.content[0].text

def analyze_multiple_images(images: list[str], question: str) -> str:
    """Phân tích nhiều ảnh cùng lúc (Claude hỗ trợ up to 20 images)"""
    content = []
    
    for i, image_path in enumerate(images[:20]):  # Max 20 images
        with open(image_path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": data}
        })
        content.append({"type": "text", "text": f"[Image {i+1}: {image_path}]"})
    
    content.append({"type": "text", "text": question})
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        messages=[{"role": "user", "content": content}]
    )
    return response.content[0].text
```

---

## 4.6 Prompt Caching (Giảm chi phí tới 90%)

```python
def create_cached_system_prompt(static_content: str):
    """
    Prompt Caching: Tái sử dụng phần static của prompt
    
    Giá với caching:
    - Cache write: $3.75/1M tokens (25% đắt hơn)
    - Cache read: $0.30/1M tokens (90% rẻ hơn!)
    - Không cache: $3/1M tokens
    
    Nên dùng khi: system prompt > 1024 tokens và được tái sử dụng nhiều
    """
    
    # System prompt với cache_control
    system_with_cache = [
        {
            "type": "text",
            "text": static_content,
            "cache_control": {"type": "ephemeral"}  # Cache 5 phút
        }
    ]
    
    return system_with_cache

# Ví dụ: Document analysis với large knowledge base
def analyze_document_with_cache(document: str, question: str) -> str:
    """
    Pattern: Cache large document, ask multiple questions
    Tiết kiệm 90% trên lần call thứ 2 trở đi!
    """
    
    # Document lớn được cache
    cached_content = [
        {
            "type": "text",
            "text": f"<document>\n{document}\n</document>",
            "cache_control": {"type": "ephemeral"}  # Cache 5 phút
        },
        {
            "type": "text",
            "text": f"\n\nQuestion: {question}"
        }
    ]
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": cached_content}]
    )
    
    # Check nếu có cache hit
    cache_stats = response.usage
    if hasattr(cache_stats, 'cache_read_input_tokens'):
        print(f"Cache hit: {cache_stats.cache_read_input_tokens} tokens from cache")
        savings = cache_stats.cache_read_input_tokens * (3 - 0.30) / 1_000_000
        print(f"Estimated savings: ${savings:.6f}")
    
    return response.content[0].text

# Real use case: Code review bot
class DocumentQABot:
    def __init__(self, document_path: str):
        with open(document_path) as f:
            self.document = f.read()
        self.question_count = 0
    
    def ask(self, question: str) -> str:
        self.question_count += 1
        # Lần đầu: cache write (~25% đắt hơn)
        # Lần 2+: cache read (90% rẻ hơn!)
        return analyze_document_with_cache(self.document, question)
```

---

## 4.7 Batch API của Anthropic

```python
def run_anthropic_batch(requests: list[dict]) -> str:
    """
    Anthropic Message Batches API
    - 50% rẻ hơn standard API
    - Xử lý trong 24 giờ
    - Ideal cho: data processing, evaluations, content generation
    """
    
    batch_requests = []
    for i, req in enumerate(requests):
        batch_requests.append(
            anthropic.types.message_create_params.MessageCreateParamsNonStreaming(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                messages=req["messages"],
                system=req.get("system", "")
            )
        )
    
    # Create batch (Anthropic SDK specific format)
    batch = client.messages.batches.create(
        requests=[
            {"custom_id": f"req-{i}", "params": req}
            for i, req in enumerate(batch_requests)
        ]
    )
    
    print(f"Batch ID: {batch.id}")
    print(f"Status: {batch.processing_status}")
    return batch.id

def poll_batch(batch_id: str, poll_interval: int = 60) -> list:
    """Polling cho batch results"""
    import time
    
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        
        if batch.processing_status == "ended":
            break
        
        progress = batch.request_counts
        print(f"Processing... {progress.succeeded}/{progress.processing} done")
        time.sleep(poll_interval)
    
    results = []
    for result in client.messages.batches.results(batch_id):
        if result.result.type == "succeeded":
            results.append({
                "id": result.custom_id,
                "content": result.result.message.content[0].text
            })
    
    return results
```

---

## 4.8 Constitutional AI và Safety Features

```python
def safe_content_generator(topic: str, audience: str = "general") -> str:
    """
    Claude có built-in safety thông qua Constitutional AI.
    Không cần custom safety filters như với GPT.
    Nhưng vẫn có thể configure behavior qua system prompt.
    """
    
    safety_config = {
        "children": "Nội dung an toàn cho trẻ em, không có violence hay adult content",
        "medical": "Luôn khuyến nghị tham khảo bác sĩ, không đưa ra chẩn đoán",
        "financial": "Luôn nhắc đây không phải financial advice, recommend chuyên gia",
        "general": "Nội dung phù hợp cho người lớn, balanced và factual"
    }
    
    system = f"""
    Tạo nội dung về {topic}.
    Audience: {audience}
    Safety guidelines: {safety_config.get(audience, safety_config['general'])}
    """
    
    return chat_claude(f"Tạo nội dung về: {topic}", system=system)

# Claude's harm avoidance là built-in, nhưng có thể fine-tune qua prompt
def configure_claude_behavior(
    persona: str,
    capabilities: list[str],
    restrictions: list[str]
) -> str:
    """Tạo system prompt để configure Claude behavior"""
    
    return f"""
    {persona}
    
    Bạn CÓ THỂ:
    {chr(10).join(f'- {c}' for c in capabilities)}
    
    Bạn KHÔNG:
    {chr(10).join(f'- {r}' for r in restrictions)}
    
    Nếu user yêu cầu điều gì nằm ngoài phạm vi trên, giải thích lịch sự và redirect.
    """
```

---

## 4.9 Long Document Processing

```python
def process_long_document(document: str, task: str) -> str:
    """
    Claude 3.5 Sonnet: 200K token context window
    Có thể xử lý tài liệu rất dài trong một call!
    """
    
    # Estimate token count (rough: 1 token ≈ 4 chars)
    estimated_tokens = len(document) // 4
    print(f"Estimated document tokens: {estimated_tokens:,}")
    
    if estimated_tokens > 180_000:  # Leave buffer for system/response
        print("Document too long! Consider chunking or summarization first.")
        return process_chunked(document, task)
    
    prompt = f"""
    <document>
    {document}
    </document>
    
    Task: {task}
    """
    
    return chat_claude(prompt, model="claude-3-5-sonnet-20241022")

def process_chunked(document: str, task: str, chunk_size: int = 50000) -> str:
    """Xử lý tài liệu siêu dài bằng cách chia chunks"""
    
    # Chia theo paragraphs, không phải characters
    paragraphs = document.split('\n\n')
    chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        if len(current_chunk) + len(para) > chunk_size:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = para
        else:
            current_chunk += "\n\n" + para
    
    if current_chunk:
        chunks.append(current_chunk)
    
    # Xử lý từng chunk
    summaries = []
    for i, chunk in enumerate(chunks):
        print(f"Processing chunk {i+1}/{len(chunks)}...")
        summary = chat_claude(
            f"Tóm tắt phần {i+1}/{len(chunks)} của document này:\n\n{chunk}",
            system="Tóm tắt chính xác, giữ lại key facts và numbers"
        )
        summaries.append(summary)
    
    # Final synthesis
    all_summaries = "\n\n---\n\n".join(f"Part {i+1}: {s}" for i, s in enumerate(summaries))
    return chat_claude(
        f"Dựa trên {len(chunks)} phần tóm tắt sau:\n\n{all_summaries}\n\nHãy {task}",
        system="Tổng hợp thành câu trả lời đầy đủ và coherent"
    )
```

---

## 4.10 Error Handling và Monitoring

```python
import anthropic
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

class ClaudeProductionClient:
    """Production-ready Claude client"""
    
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.metrics = {
            "total_calls": 0,
            "successful_calls": 0,
            "failed_calls": 0,
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "total_latency_ms": 0,
        }
    
    def chat(self, messages: list, system: str = "", model: str = "claude-3-5-sonnet-20241022",
             max_retries: int = 3, **kwargs) -> Optional[str]:
        
        start_time = time.time()
        self.metrics["total_calls"] += 1
        
        for attempt in range(max_retries):
            try:
                params = {
                    "model": model,
                    "max_tokens": kwargs.get("max_tokens", 1024),
                    "messages": messages,
                }
                if system:
                    params["system"] = system
                params.update({k: v for k, v in kwargs.items() if k != "max_tokens"})
                
                response = self.client.messages.create(**params)
                
                # Update metrics
                latency = (time.time() - start_time) * 1000
                self.metrics["successful_calls"] += 1
                self.metrics["total_input_tokens"] += response.usage.input_tokens
                self.metrics["total_output_tokens"] += response.usage.output_tokens
                self.metrics["total_latency_ms"] += latency
                
                return response.content[0].text
                
            except anthropic.RateLimitError as e:
                wait = 2 ** attempt
                logger.warning(f"Rate limit hit. Waiting {wait}s...")
                time.sleep(wait)
                
            except anthropic.APIStatusError as e:
                if e.status_code == 529:  # Overloaded
                    wait = 5 * (attempt + 1)
                    logger.warning(f"API overloaded. Waiting {wait}s...")
                    time.sleep(wait)
                else:
                    logger.error(f"API error {e.status_code}: {e.message}")
                    self.metrics["failed_calls"] += 1
                    raise
                    
            except anthropic.APIConnectionError:
                logger.error("Connection failed")
                self.metrics["failed_calls"] += 1
                if attempt == max_retries - 1:
                    raise
                time.sleep(2)
        
        self.metrics["failed_calls"] += 1
        return None
    
    def get_metrics(self) -> dict:
        m = self.metrics
        avg_latency = (m["total_latency_ms"] / m["successful_calls"] 
                      if m["successful_calls"] > 0 else 0)
        
        # Cost calculation
        input_cost = m["total_input_tokens"] * 3 / 1_000_000
        output_cost = m["total_output_tokens"] * 15 / 1_000_000
        
        return {
            **m,
            "success_rate": m["successful_calls"] / max(m["total_calls"], 1),
            "avg_latency_ms": round(avg_latency, 2),
            "total_cost_usd": round(input_cost + output_cost, 6),
        }
```

---

## Tóm tắt chương

Chương 4 đã cover đầy đủ Anthropic API:
- Messages API cơ bản và multi-turn conversations
- Streaming cho UX tốt hơn
- Tool Use với agentic loop
- Vision API cho image analysis
- **Prompt Caching** — tính năng độc đáo tiết kiệm 90% chi phí
- Batch API cho offline processing
- Long document processing (200K context)
- Production patterns và monitoring

---

*Chương tiếp theo: **Làm việc với Google Gemini API***
