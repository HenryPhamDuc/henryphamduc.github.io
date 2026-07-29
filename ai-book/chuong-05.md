# CHƯƠNG 5: LÀM VIỆC VỚI GOOGLE GEMINI API

## Giới thiệu chương

Google Gemini đại diện cho một paradigm khác biệt: **natively multimodal** (được thiết kế từ đầu để xử lý text, image, audio, video đồng thời), context window khổng lồ 1M tokens, và tích hợp sâu với hệ sinh thái Google. Chương này khai thác toàn bộ sức mạnh của Gemini API.

---

## 5.1 Setup Gemini API

### 5.1.1 Installation và Authentication

```python
pip install google-generativeai
pip install google-cloud-aiplatform  # Cho Vertex AI (production)
```

```python
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configure API key (Google AI Studio - development)
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

# Available models
GEMINI_MODELS = {
    "flash": "gemini-1.5-flash",        # Nhanh, rẻ, đa năng
    "flash-8b": "gemini-1.5-flash-8b",  # Rẻ nhất
    "pro": "gemini-1.5-pro",            # Mạnh nhất, context 1M
    "flash-2": "gemini-2.0-flash",      # Thế hệ mới, nhanh
}
```

### 5.1.2 Basic Text Generation

```python
def chat_gemini(prompt: str, model_name: str = "gemini-1.5-flash") -> str:
    model = genai.GenerativeModel(model_name)
    response = model.generate_content(prompt)
    return response.text

# Với configuration
def chat_gemini_configured(prompt: str) -> str:
    generation_config = genai.types.GenerationConfig(
        temperature=0.7,
        top_p=0.95,
        top_k=40,
        max_output_tokens=2048,
        response_mime_type="text/plain",
    )
    
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    ]
    
    model = genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        generation_config=generation_config,
        safety_settings=safety_settings
    )
    
    response = model.generate_content(prompt)
    return response.text

# System instruction
def chat_with_system(system: str, user_message: str) -> str:
    model = genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        system_instruction=system
    )
    response = model.generate_content(user_message)
    return response.text
```

---

## 5.2 Multi-turn Chat

```python
class GeminiChat:
    """Stateful chat với Gemini"""
    
    def __init__(self, system_instruction: str = "", model: str = "gemini-1.5-flash"):
        self.model = genai.GenerativeModel(
            model_name=model,
            system_instruction=system_instruction
        )
        self.chat_session = self.model.start_chat(history=[])
    
    def send(self, message: str) -> str:
        response = self.chat_session.send_message(message)
        return response.text
    
    @property
    def history(self):
        return self.chat_session.history
    
    def get_history_text(self) -> str:
        """Xuất lịch sử chat dạng text"""
        lines = []
        for msg in self.history:
            role = "User" if msg.role == "user" else "Assistant"
            text = msg.parts[0].text
            lines.append(f"{role}: {text}")
        return "\n\n".join(lines)

# Demo
chat = GeminiChat("Bạn là expert về machine learning. Giải thích theo kiểu thực tế.")
print(chat.send("Overfitting là gì?"))
print(chat.send("Làm thế nào để detect overfitting?"))
print(chat.send("Các kỹ thuật regularization nào hiệu quả nhất?"))
```

---

## 5.3 Multimodal: Text + Image

```python
from PIL import Image
import requests
from io import BytesIO

model = genai.GenerativeModel("gemini-1.5-pro")

def analyze_image_gemini(image_source: str, question: str) -> str:
    """
    image_source: URL hoặc file path
    """
    if image_source.startswith("http"):
        response = requests.get(image_source)
        image = Image.open(BytesIO(response.content))
    else:
        image = Image.open(image_source)
    
    response = model.generate_content([image, question])
    return response.text

def compare_images(image1_path: str, image2_path: str, question: str) -> str:
    """So sánh hai ảnh"""
    img1 = Image.open(image1_path)
    img2 = Image.open(image2_path)
    
    response = model.generate_content([
        "Image 1:", img1,
        "Image 2:", img2,
        question
    ])
    return response.text

# Use cases đặc biệt của Gemini
def analyze_chart(chart_path: str) -> dict:
    """Extract data từ chart/graph"""
    chart = Image.open(chart_path)
    
    prompt = """
    Phân tích chart này và trả về JSON:
    {
        "chart_type": "bar/line/pie/scatter/...",
        "title": "chart title nếu có",
        "x_axis": {"label": "...", "values": [...]},
        "y_axis": {"label": "...", "unit": "..."},
        "data_series": [{"name": "...", "values": [...]}],
        "key_insights": ["insight 1", "insight 2"],
        "trend": "increasing/decreasing/stable/mixed"
    }
    Chỉ trả về JSON, không giải thích.
    """
    
    response = model.generate_content([chart, prompt])
    import json
    return json.loads(response.text)
```

---

## 5.4 Video Analysis — Gemini's Superpower

```python
import google.generativeai as genai
import time

def analyze_video_file(video_path: str, question: str) -> str:
    """
    Phân tích video file — tính năng độc đáo của Gemini!
    Hỗ trợ: mp4, mpeg, mov, avi, flv, mpg, webm, wmv, 3gpp
    Giới hạn: 1 giờ video hoặc 1GB
    """
    
    print(f"Uploading video: {video_path}")
    
    # Upload video
    video_file = genai.upload_file(
        path=video_path,
        display_name=video_path
    )
    
    # Chờ video processing
    while video_file.state.name == "PROCESSING":
        print("Processing video...")
        time.sleep(5)
        video_file = genai.get_file(video_file.name)
    
    if video_file.state.name == "FAILED":
        raise ValueError(f"Video processing failed")
    
    print("Video ready! Analyzing...")
    
    model = genai.GenerativeModel("gemini-1.5-pro")
    response = model.generate_content(
        [video_file, question],
        request_options={"timeout": 600}  # 10 phút timeout
    )
    
    return response.text

def analyze_youtube_video(youtube_url: str, question: str) -> str:
    """Phân tích YouTube video trực tiếp từ URL"""
    model = genai.GenerativeModel("gemini-1.5-pro")
    
    response = model.generate_content([
        {"file_data": {"mime_type": "video/mp4", "file_uri": youtube_url}},
        question
    ])
    
    return response.text

# Practical use cases
def meeting_transcript_from_video(video_path: str) -> dict:
    """Tự động tạo meeting notes từ recording"""
    
    prompt = """
    Đây là recording của một cuộc họp. Hãy tạo:
    1. Summary (200 từ)
    2. Danh sách người tham gia (nếu tự giới thiệu)
    3. Key decisions made
    4. Action items với assignee (nếu được đề cập)
    5. Follow-up questions cần clarify
    
    Format JSON.
    """
    
    return json.loads(analyze_video_file(video_path, prompt))
```

---

## 5.5 Audio Analysis

```python
def analyze_audio(audio_path: str, task: str) -> str:
    """
    Phân tích audio file
    Hỗ trợ: wav, mp3, aiff, aac, ogg, flac
    """
    
    audio_file = genai.upload_file(path=audio_path)
    
    model = genai.GenerativeModel("gemini-1.5-pro")
    response = model.generate_content([audio_file, task])
    
    return response.text

def transcribe_and_analyze(audio_path: str) -> dict:
    """Transcribe + phân tích sentiment và topics"""
    
    prompt = """
    Transcribe audio này và phân tích:
    {
        "transcript": "full text transcription",
        "language": "detected language",
        "duration_estimate": "estimated duration",
        "sentiment": "positive/neutral/negative",
        "main_topics": ["topic1", "topic2"],
        "speaker_count": "estimated number of speakers",
        "action_items": ["if any"]
    }
    """
    
    result = analyze_audio(audio_path, prompt)
    return json.loads(result)
```

---

## 5.6 Grounding với Google Search

```python
def chat_with_search_grounding(question: str) -> dict:
    """
    Gemini với Google Search integration
    Câu trả lời được grounded bởi kết quả search thực tế
    Giảm hallucination đáng kể!
    """
    
    model = genai.GenerativeModel("gemini-1.5-pro")
    
    # Enable search grounding
    tool = genai.protos.Tool(
        google_search_retrieval=genai.protos.GoogleSearchRetrieval()
    )
    
    response = model.generate_content(
        question,
        tools=[tool],
        generation_config=genai.types.GenerationConfig(temperature=0.0)
    )
    
    result = {
        "answer": response.text,
        "grounded": bool(response.candidates[0].grounding_metadata),
    }
    
    # Extract search queries used
    if response.candidates[0].grounding_metadata:
        metadata = response.candidates[0].grounding_metadata
        if hasattr(metadata, 'search_entry_point'):
            result["search_queries"] = metadata.search_entry_point.rendered_content
    
    return result

# Demo
result = chat_with_search_grounding("GDP của Việt Nam năm 2024 là bao nhiêu?")
print(f"Answer: {result['answer']}")
print(f"Search grounded: {result['grounded']}")
```

---

## 5.7 Long Context: Xử lý 1 Triệu Tokens

```python
def analyze_entire_codebase(directory: str, question: str) -> str:
    """
    Gemini 1.5 Pro: 1M token context = ~750K từ = toàn bộ codebase nhỏ!
    """
    import os
    
    # Collect all code files
    code_content = []
    total_chars = 0
    
    for root, dirs, files in os.walk(directory):
        # Skip node_modules, .git, etc.
        dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', '__pycache__', 'venv'}]
        
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.java', '.go', '.rs', '.cpp', '.h')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', errors='ignore') as f:
                    content = f.read()
                
                code_content.append(f"// File: {filepath}\n{content}")
                total_chars += len(content)
    
    codebase = "\n\n".join(code_content)
    estimated_tokens = total_chars // 4
    
    print(f"Total: {len(code_content)} files, ~{estimated_tokens:,} tokens")
    
    if estimated_tokens > 900_000:
        print("Warning: Approaching context limit!")
    
    model = genai.GenerativeModel("gemini-1.5-pro")
    
    response = model.generate_content(f"""
    <codebase>
    {codebase}
    </codebase>
    
    {question}
    """)
    
    return response.text

# Query examples:
# "Tìm tất cả security vulnerabilities trong codebase này"
# "Vẽ dependency graph của các modules"
# "Tìm code duplication > 20 lines"
# "Explain the overall architecture"
```

---

## 5.8 Structured Output với Gemini

```python
from pydantic import BaseModel
from typing import Optional
import json

class BugReport(BaseModel):
    title: str
    severity: str  # critical, high, medium, low
    category: str
    description: str
    steps_to_reproduce: list[str]
    expected_behavior: str
    actual_behavior: str
    suggested_fix: Optional[str]

def analyze_bug_with_schema(bug_description: str) -> BugReport:
    """Gemini với structured output (response schema)"""
    
    model = genai.GenerativeModel(
        "gemini-1.5-pro",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=BugReport,
        )
    )
    
    response = model.generate_content(f"""
    Phân tích bug report sau và điền vào schema:
    
    {bug_description}
    """)
    
    return BugReport.parse_raw(response.text)

# Demo
bug = analyze_bug_with_schema("""
    User báo cáo: Khi đặt hàng online, sau khi click "Thanh toán" 
    bị lỗi "500 Internal Server Error". Xảy ra khi giỏ hàng > 10 items.
    Trước đây hoạt động bình thường.
""")

print(f"Severity: {bug.severity}")
print(f"Category: {bug.category}")
```

---

## 5.9 Vertex AI cho Production

```python
# Production setup với Vertex AI (Google Cloud)
import vertexai
from vertexai.generative_models import GenerativeModel, Part

# Initialize Vertex AI
vertexai.init(
    project="your-gcp-project",
    location="us-central1"
)

def production_gemini_call(prompt: str) -> str:
    """Sử dụng Gemini qua Vertex AI cho production"""
    
    model = GenerativeModel("gemini-1.5-pro")
    
    response = model.generate_content(
        prompt,
        generation_config={
            "max_output_tokens": 2048,
            "temperature": 0.7,
        }
    )
    
    return response.text

# Vertex AI benefits:
# ✅ Enterprise SLA
# ✅ VPC support (private networking)
# ✅ Data residency compliance
# ✅ IAM integration
# ✅ Cloud monitoring
# ✅ No API key needed (ADC - Application Default Credentials)
```

---

## 5.10 So sánh thực tế: Khi nào dùng Gemini?

```python
"""
DÙNG GEMINI KHI:

1. MULTIMODAL HEAVY:
   - Phân tích video content
   - So sánh nhiều ảnh
   - Audio transcription + analysis
   
2. ULTRA LONG CONTEXT:
   - Analyze entire codebase (>100K tokens)
   - Process full legal documents
   - Multi-book research
   
3. GOOGLE ECOSYSTEM:
   - Integrate với Google Workspace (Docs, Sheets, Drive)
   - Google Search grounding
   - BigQuery integration
   
4. COST SENSITIVE (FAST TASKS):
   - Gemini Flash: Rẻ và nhanh nhất
   - Flash-8B: Siêu rẻ cho simple tasks
   
5. REAL-TIME GROUNDING:
   - Cần thông tin cập nhật nhất
   - Search-grounded responses

KHÔNG DÙNG GEMINI KHI:
- Cần fine-tuning dễ dàng (OpenAI tốt hơn)
- Cần safety cao nhất (Claude tốt hơn)  
- Cần coding chuyên sâu (Claude/GPT-4 tốt hơn)
"""

def smart_model_router(task: dict) -> str:
    """Tự động chọn model phù hợp nhất"""
    
    task_type = task.get("type")
    content_types = task.get("content_types", ["text"])
    token_estimate = task.get("estimated_tokens", 1000)
    
    # Video analysis → Gemini only
    if "video" in content_types:
        return "gemini-1.5-pro"
    
    # Ultra long context → Gemini
    if token_estimate > 100_000:
        return "gemini-1.5-pro"
    
    # Need search grounding → Gemini
    if task.get("needs_current_info", False):
        return "gemini-1.5-pro"
    
    # Safety critical → Claude
    if task.get("safety_critical", False):
        return "claude-3-5-sonnet-20241022"
    
    # Coding complex → Claude or GPT-4
    if task_type == "coding" and task.get("complexity") == "high":
        return "claude-3-5-sonnet-20241022"
    
    # Default: Fast and cheap
    if token_estimate < 5000:
        return "gemini-1.5-flash"
    
    return "gpt-4o"
```

---

## Tóm tắt chương

Gemini API nổi bật với:
- **Natively multimodal**: Text, Image, Audio, Video trong một API
- **1M token context**: Xử lý toàn bộ codebase
- **Google Search grounding**: Giảm hallucination
- **Vertex AI**: Enterprise production deployment
- **Structured output**: Pydantic schema support

---

*Chương tiếp theo: **Prompt Engineering nâng cao — Chain-of-Thought, ReAct, Tree-of-Thought***
