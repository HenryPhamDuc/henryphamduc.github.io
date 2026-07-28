# CHƯƠNG 1: TỔNG QUAN VỀ TRÍ TUỆ NHÂN TẠO VÀ CÁC MÔ HÌNH NGÔN NGỮ LỚN

## Giới thiệu chương

Trong thập kỷ qua, trí tuệ nhân tạo (AI) đã chuyển mình từ một khái niệm khoa học viễn tưởng thành công nghệ cốt lõi trong mọi ngành công nghiệp. Là một kỹ sư, bạn đang bước vào thời điểm bước ngoặt lịch sử: các mô hình ngôn ngữ lớn (Large Language Models - LLMs) như Claude, ChatGPT và Gemini đang tái định hình cách con người tương tác với máy tính. Chương này sẽ xây dựng nền tảng vững chắc để bạn hiểu bức tranh toàn cảnh trước khi đi vào chi tiết kỹ thuật.

---

## 1.1 Lịch sử phát triển của AI: Từ Rule-based đến Neural Networks

### 1.1.1 Thế hệ AI đầu tiên: Hệ thống dựa trên luật (1950-1980)

Trí tuệ nhân tạo được khai sinh chính thức tại Hội nghị Dartmouth năm 1956. Những tiên phong như Alan Turing, John McCarthy và Marvin Minsky đặt câu hỏi mang tính thời đại: "Liệu máy móc có thể suy nghĩ được không?"

Thế hệ AI đầu tiên hoạt động dựa trên **hệ thống chuyên gia (Expert Systems)** — con người lập trình hàng nghìn luật logic:

```
IF nhiệt độ > 38.5 AND ho_khan = TRUE THEN có_thể_cảm_cúm = TRUE
IF có_thể_cảm_cúm = TRUE AND đau_họng = TRUE THEN xác_suất_cúm = 85%
```

**Ưu điểm:** Giải thích được, kiểm soát được, hoạt động tốt trong phạm vi hẹp.

**Nhược điểm:** Không thể mở rộng, giòn (brittle) khi gặp tình huống mới, cần chuyên gia duy trì liên tục.

Ví dụ nổi tiếng: **MYCIN** (1972) — hệ thống chẩn đoán nhiễm khuẩn máu của Stanford, có khoảng 600 luật, đạt độ chính xác 65% (cao hơn cả bác sĩ tập sự).

### 1.1.2 Mùa đông AI và sự trỗi dậy của Machine Learning (1980-2010)

Hai "mùa đông AI" (1974-1980 và 1987-1993) xảy ra khi những hứa hẹn quá mức không được thực hiện. Kinh phí nghiên cứu cạn kiệt, niềm tin cộng đồng sụp đổ.

Tuy nhiên, trong bóng tối, một paradigm mới đang hình thành: **Machine Learning**. Thay vì lập trình luật, ta để máy tự học từ dữ liệu.

**Các cột mốc quan trọng:**

| Năm | Sự kiện |
|-----|---------|
| 1986 | Backpropagation được phổ biến bởi Rumelhart, Hinton, Williams |
| 1989 | Yann LeCun áp dụng CNN cho nhận dạng chữ viết tay |
| 1997 | Deep Blue của IBM đánh bại Kasparov ở cờ vua |
| 1998 | Support Vector Machines (SVM) thống trị NLP |
| 2006 | Geoffrey Hinton khởi động làn sóng Deep Learning |

### 1.1.3 Cuộc cách mạng Deep Learning (2010-2017)

Năm 2012 đánh dấu "Big Bang" của AI hiện đại: **AlexNet** — mạng neural sâu của Alex Krizhevsky — giành chiến thắng ImageNet với khoảng cách không tưởng, giảm error rate từ 26% xuống 15.3%.

Điều gì đã thay đổi?
1. **Dữ liệu lớn**: Internet tạo ra hàng tỷ ảnh, văn bản có nhãn
2. **Sức mạnh GPU**: NVIDIA CUDA cho phép song song hóa tính toán
3. **Kiến trúc mới**: Convolutional Neural Networks (CNN), Recurrent Neural Networks (RNN)

```python
# Ví dụ đơn giản: Neural network 2 lớp với numpy
import numpy as np

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def forward_pass(X, W1, W2):
    hidden = sigmoid(np.dot(X, W1))
    output = sigmoid(np.dot(hidden, W2))
    return output
```

### 1.1.4 Kỷ nguyên Transformer: Nền tảng của LLMs (2017-nay)

Năm 2017, nhóm Google Brain công bố paper **"Attention is All You Need"** — công trình thay đổi lịch sử AI. Kiến trúc **Transformer** ra đời, dựa hoàn toàn vào cơ chế **Self-Attention** thay cho RNN truyền thống.

Tại sao Transformer vượt trội?

- **Xử lý song song**: Không phụ thuộc tuần tự như RNN
- **Nắm bắt phụ thuộc dài hạn**: Có thể liên kết từ ở vị trí 1 với từ ở vị trí 1000
- **Khả năng mở rộng**: Có thể train với hàng nghìn GPU đồng thời

Từ Transformer, các mô hình ngôn ngữ lớn (LLMs) ra đời: GPT-1 (2018), BERT (2018), GPT-2 (2019), GPT-3 (2020), và đỉnh cao là ChatGPT (2022), Claude, Gemini.

---

## 1.2 Mô hình ngôn ngữ lớn là gì?

### 1.2.1 Định nghĩa và bản chất

**Mô hình ngôn ngữ lớn (Large Language Model - LLM)** là một mô hình học sâu được train trên lượng dữ liệu văn bản khổng lồ, có khả năng hiểu và tạo ra ngôn ngữ tự nhiên.

Về bản chất, một LLM là một **hàm xác suất**:

```
P(từ_tiếp_theo | ngữ_cảnh_trước_đó)
```

Khi bạn hỏi: "Thủ đô của Việt Nam là..."
LLM tính: P("Hà Nội" | "Thủ đô của Việt Nam là") ≈ 0.997

Nhưng "lớn" ở đây có nghĩa gì?

| Mô hình | Số tham số | Năm |
|---------|-----------|-----|
| GPT-1 | 117 triệu | 2018 |
| GPT-2 | 1.5 tỷ | 2019 |
| GPT-3 | 175 tỷ | 2020 |
| GPT-4 | ~1.8 nghìn tỷ (ước tính) | 2023 |
| Claude 3 Opus | ~2 nghìn tỷ (ước tính) | 2024 |
| Gemini Ultra | ~1.56 nghìn tỷ (ước tính) | 2023 |

### 1.2.2 Cách LLM "học"

Quá trình train một LLM diễn ra theo hai giai đoạn chính:

**Giai đoạn 1: Pre-training (Học trước)**

Mô hình được train trên corpus khổng lồ (hàng nghìn tỷ token từ Internet, sách, code, khoa học...) với nhiệm vụ đơn giản: **dự đoán từ tiếp theo**.

```
Input:  "Hà Nội là thủ đô của"
Target: "Việt"

Input:  "Hà Nội là thủ đô của Việt"
Target: "Nam"

Input:  "Hà Nội là thủ đô của Việt Nam"
Target: "."
```

Qua hàng nghìn tỷ ví dụ như vậy, mô hình học được ngữ pháp, ngữ nghĩa, kiến thức thực tế, lý luận logic, và thậm chí code.

**Giai đoạn 2: Fine-tuning với RLHF**

Sau pre-training, mô hình giỏi dự đoán nhưng chưa "hữu ích" cho người dùng. **Reinforcement Learning from Human Feedback (RLHF)** điều chỉnh mô hình:

1. Human trainers viết các câu trả lời mẫu tốt
2. Human rankers so sánh và xếp hạng các câu trả lời
3. **Reward model** học từ xếp hạng của người
4. LLM được tối ưu bằng PPO để tối đa hóa reward

### 1.2.3 Tokenization: Cách LLM "đọc" văn bản

LLM không đọc ký tự hay từ — chúng đọc **token**. Tokenizer chuyển đổi văn bản thành chuỗi số nguyên:

```python
# Ví dụ với tiktoken (tokenizer của OpenAI)
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")  # GPT-4 tokenizer
text = "Xin chào! Tôi là kỹ sư AI."
tokens = enc.encode(text)
print(tokens)  # [55, 1591, 19921, 0, 358, 487, 39723, 15682, 6932, 13]
print(len(tokens))  # 10 tokens
```

Điều này có ý nghĩa thực tế quan trọng:
- Tiếng Anh: ~1 token/từ
- Tiếng Việt: ~2-3 tokens/từ (tốn token hơn!)
- Code: hiệu quả hơn văn bản thường

---

## 1.3 Ba trụ cột: Claude, ChatGPT và Gemini

### 1.3.1 OpenAI và ChatGPT

**OpenAI** được thành lập năm 2015 bởi Elon Musk, Sam Altman và các nhà nghiên cứu hàng đầu với sứ mệnh "đảm bảo AI có lợi cho toàn nhân loại."

**ChatGPT** ra mắt ngày 30/11/2022 — sự kiện làm rung chuyển thế giới công nghệ. Trong vòng 5 ngày, nó đạt 1 triệu người dùng (so với Netflix mất 3.5 năm). Đây là lần đầu tiên công chúng rộng rãi trải nghiệm LLM thực sự mạnh mẽ.

Các mô hình chính:
- **GPT-3.5-turbo**: Nhanh, rẻ, phù hợp production
- **GPT-4**: Mạnh nhất, đa phương thức (text + image)
- **GPT-4o**: "Omni" — nhanh hơn, rẻ hơn GPT-4
- **o1, o3**: Mô hình lý luận (reasoning) chuyên sâu

### 1.3.2 Anthropic và Claude

**Anthropic** được thành lập năm 2021 bởi Dario Amodei, Daniela Amodei và nhiều cựu nhân viên OpenAI. Sứ mệnh: xây dựng AI an toàn và có thể hiểu được (interpretable).

Điểm khác biệt cốt lõi của Claude là **Constitutional AI (CAI)** — phương pháp huấn luyện độc đáo:
1. Định nghĩa "hiến pháp" (bộ nguyên tắc đạo đức)
2. Mô hình tự đánh giá câu trả lời theo hiến pháp
3. Tự cải thiện mà không cần human feedback cho mọi bước

Các phiên bản Claude:
- **Claude Instant**: Nhanh, tiết kiệm
- **Claude 2**: Cân bằng hiệu suất
- **Claude 3 (Haiku/Sonnet/Opus)**: Phân cấp tốc độ-chất lượng
- **Claude 3.5 Sonnet**: Hiện là model mạnh nhất của Anthropic

### 1.3.3 Google DeepMind và Gemini

**Google** có lợi thế khổng lồ: dữ liệu tìm kiếm, YouTube, Gmail, Maps, và đội ngũ nghiên cứu AI đẳng cấp thế giới (DeepMind, Google Brain).

**Gemini** (ra mắt 2023) là thế hệ mô hình đa phương thức gốc (natively multimodal):

- **Gemini Nano**: Chạy trên thiết bị (on-device)
- **Gemini Pro**: Cân bằng, phù hợp cho API
- **Gemini Ultra**: Mạnh nhất, vượt GPT-4 trên nhiều benchmark
- **Gemini 1.5**: Context window khổng lồ (1 triệu token!)

---

## 1.4 So sánh tổng quan ba mô hình

### 1.4.1 Bảng so sánh kỹ thuật

| Tiêu chí | ChatGPT (GPT-4o) | Claude (3.5 Sonnet) | Gemini (1.5 Pro) |
|----------|-----------------|---------------------|-----------------|
| Context window | 128K token | 200K token | 1M token |
| Multimodal | Text, Image, Audio, Video | Text, Image | Text, Image, Audio, Video |
| Code generation | Xuất sắc | Xuất sắc | Tốt |
| Lý luận logic | Xuất sắc | Xuất sắc | Tốt |
| Tiếng Việt | Tốt | Tốt | Tốt |
| API giá (input/1M tokens) | $5 | $3 | $3.5 |
| Tốc độ | Nhanh | Nhanh | Nhanh |

### 1.4.2 Điểm mạnh riêng biệt

**ChatGPT:**
- Hệ sinh thái plugin và GPT Store phong phú nhất
- Tích hợp DALL-E cho image generation
- Code Interpreter cho data analysis
- Brand recognition mạnh nhất

**Claude:**
- Context window lớn (200K) — lý tưởng cho tài liệu dài
- An toàn và ít "hallucination" hơn
- Câu trả lời dài, chi tiết, có cấu trúc
- Artifacts feature cho code/document generation

**Gemini:**
- Tích hợp sâu vào hệ sinh thái Google (Search, Docs, Sheets)
- Context window 1M token — phân tích toàn bộ codebase
- Natively multimodal (xử lý video tốt nhất)
- Google Search integration

---

## 1.5 Kiến trúc Transformer — Hiểu sâu hơn

### 1.5.1 Cơ chế Self-Attention

Đây là trái tim của mọi LLM hiện đại. Self-Attention cho phép mỗi token "nhìn" vào tất cả token khác trong chuỗi:

```python
import numpy as np

def self_attention(Q, K, V, d_k):
    """
    Q: Query matrix
    K: Key matrix  
    V: Value matrix
    d_k: dimension of key vectors
    """
    # Tính attention scores
    scores = np.dot(Q, K.T) / np.sqrt(d_k)
    
    # Softmax để chuẩn hóa
    attention_weights = np.exp(scores) / np.sum(np.exp(scores), axis=-1, keepdims=True)
    
    # Weighted sum của Values
    output = np.dot(attention_weights, V)
    return output, attention_weights
```

**Ví dụ trực quan:**

Câu: "Con mèo ngồi trên tấm thảm vì nó mệt"

Khi xử lý từ "nó", Self-Attention tính toán:
- "nó" liên quan đến "mèo" với weight cao (0.85)
- "nó" liên quan đến "thảm" với weight thấp (0.05)
- Mô hình hiểu "nó" = "mèo"

### 1.5.2 Multi-Head Attention

Một "head" attention chỉ học một loại relationship. **Multi-Head Attention** chạy nhiều head song song:

```
Head 1: Học quan hệ ngữ pháp (subject-verb)
Head 2: Học quan hệ coreference (đại từ → danh từ)
Head 3: Học quan hệ ngữ nghĩa (đồng nghĩa/trái nghĩa)
...
Head N: Học quan hệ vị trí (gần/xa)
```

### 1.5.3 Positional Encoding

Transformer không có khái niệm thứ tự vốn có (không như RNN). **Positional Encoding** thêm thông tin vị trí vào embedding:

```python
def positional_encoding(seq_len, d_model):
    PE = np.zeros((seq_len, d_model))
    for pos in range(seq_len):
        for i in range(0, d_model, 2):
            PE[pos, i] = np.sin(pos / (10000 ** (i/d_model)))
            PE[pos, i+1] = np.cos(pos / (10000 ** (i/d_model)))
    return PE
```

---

## 1.6 Các khái niệm thiết yếu cho kỹ sư AI

### 1.6.1 Context Window và Token Budget

**Context window** là "bộ nhớ ngắn hạn" của LLM — số token tối đa trong một lần inference.

Thực tế kỹ thuật quan trọng:

```
Total context = System prompt + Conversation history + User message + Response

Ví dụ với Claude 3.5 Sonnet (200K tokens):
- System prompt: 500 tokens
- Conversation history: 50,000 tokens
- User message: 1,000 tokens  
- Response: tối đa 148,500 tokens còn lại
```

Chi phí tính toán tăng **bậc hai** theo context length (O(n²)) với vanilla attention — đây là lý do LLMs tốn kém với context dài.

### 1.6.2 Temperature và Sampling Strategies

**Temperature** kiểm soát độ "sáng tạo" vs "chính xác":

```python
import numpy as np

def sample_with_temperature(logits, temperature=1.0):
    """
    temperature = 0: Deterministic (luôn chọn token có prob cao nhất)
    temperature = 1: Standard sampling
    temperature > 1: Sáng tạo hơn, ngẫu nhiên hơn
    """
    if temperature == 0:
        return np.argmax(logits)
    
    scaled_logits = logits / temperature
    probs = np.exp(scaled_logits) / np.sum(np.exp(scaled_logits))
    return np.random.choice(len(probs), p=probs)

# Ứng dụng thực tế:
# Code generation: temperature=0 (chính xác)
# Creative writing: temperature=0.9 (sáng tạo)
# Factual Q&A: temperature=0.2 (ổn định)
```

**Top-p (Nucleus Sampling):** Chọn từ tập token có tổng probability ≥ p

```python
def top_p_sampling(probs, p=0.9):
    sorted_idx = np.argsort(probs)[::-1]
    cumsum = np.cumsum(probs[sorted_idx])
    # Giữ lại tokens đến khi tổng xác suất đạt p
    nucleus = sorted_idx[cumsum <= p]
    return np.random.choice(nucleus)
```

### 1.6.3 Hallucination: Vấn đề cốt lõi của LLMs

**Hallucination** là khi LLM tạo ra thông tin sai nhưng nghe có vẻ đúng. Đây là hạn chế cơ bản:

```
User: "Einstein đã nhận giải Nobel năm nào?"
GPT-4 (hallucination): "Einstein nhận giải Nobel năm 1915 cho thuyết tương đối đặc biệt."
Thực tế: Einstein nhận giải Nobel năm 1921 cho hiệu ứng quang điện, không phải thuyết tương đối!
```

Nguyên nhân:
1. Train để "coherent", không phải "truthful"
2. Kiến thức bị "nén" và có thể mất chi tiết
3. Không có cơ chế kiểm tra nội tại

Cách giảm thiểu:
- **RAG (Retrieval-Augmented Generation)**: Cung cấp context thực tế
- **Tool use**: Cho LLM gọi API/database thay vì nhớ
- **Temperature thấp** cho factual tasks
- **Grounding**: Yêu cầu LLM trích dẫn nguồn

---

## 1.7 Hệ sinh thái và ứng dụng thực tế

### 1.7.1 Các lớp ứng dụng AI

```
┌─────────────────────────────────────────┐
│        End-user Applications            │
│    (ChatGPT, Claude.ai, Gemini.com)     │
├─────────────────────────────────────────┤
│         Application Layer               │
│  (Chatbots, Code Assistants, Copilots)  │
├─────────────────────────────────────────┤
│         Orchestration Layer             │
│    (LangChain, LlamaIndex, Haystack)    │
├─────────────────────────────────────────┤
│           API Layer                     │
│  (OpenAI API, Anthropic API, Vertex AI) │
├─────────────────────────────────────────┤
│         Foundation Models               │
│     (GPT-4, Claude, Gemini, Llama)      │
└─────────────────────────────────────────┘
```

### 1.7.2 Các use case chính theo ngành

**Engineering & Development:**
- Code generation (GitHub Copilot)
- Code review và bug detection
- Documentation generation
- Test case writing

**Data & Analytics:**
- SQL generation từ natural language
- Data visualization từ mô tả
- Report summarization
- Anomaly explanation

**Business:**
- Customer service automation
- Content creation
- Document processing
- Knowledge management

### 1.7.3 ROI và Business Case

Theo McKinsey (2023), generative AI có thể tạo ra giá trị từ $2.6 đến $4.4 nghìn tỷ USD mỗi năm. Các lĩnh vực hưởng lợi nhiều nhất:

1. **Software Engineering**: Tăng 20-45% năng suất developer
2. **Customer Operations**: Giảm 30-40% thời gian xử lý
3. **Marketing**: Giảm 60-70% thời gian tạo content
4. **R&D**: Rút ngắn 25-35% chu kỳ nghiên cứu

---

## 1.8 Lộ trình học cho kỹ sư

### 1.8.1 Prerequisite Knowledge

Trước khi đi sâu vào LLM applications, bạn cần vững:

**Python (bắt buộc):**
```python
# Nếu bạn chưa thoải mái với code này, hãy ôn lại Python trước:
import asyncio
import json
from typing import Optional, List, Dict
from dataclasses import dataclass

@dataclass
class Message:
    role: str
    content: str
    
async def chat_with_llm(messages: List[Message]) -> Optional[str]:
    # Async programming pattern
    # Type hints
    # Dataclasses
    pass
```

**API & HTTP Basics:**
- REST APIs, HTTP methods (GET, POST)
- JSON format
- Authentication (API keys, Bearer tokens)
- Rate limiting

**Cơ bản về ML (tốt nếu có):**
- Linear algebra cơ bản (vectors, matrices)
- Probability và statistics
- Gradient descent concept

### 1.8.2 Roadmap 20 chương của cuốn sách này

```
PHẦN 1: NỀN TẢNG (Chương 1-4)
├── Chương 1: Tổng quan AI và LLMs ← Bạn đang đây
├── Chương 2: Prompt Engineering cơ bản
├── Chương 3: Làm việc với OpenAI API (ChatGPT)
└── Chương 4: Làm việc với Anthropic API (Claude)

PHẦN 2: KỸ THUẬT TRUNG CẤP (Chương 5-9)
├── Chương 5: Làm việc với Google AI API (Gemini)
├── Chương 6: Prompt Engineering nâng cao
├── Chương 7: RAG - Retrieval Augmented Generation
├── Chương 8: LangChain và Orchestration Frameworks
└── Chương 9: Vector Databases và Embeddings

PHẦN 3: XÂY DỰNG ỨNG DỤNG (Chương 10-14)
├── Chương 10: Xây dựng Chatbot production
├── Chương 11: AI Agents và Tool Use
├── Chương 12: Fine-tuning và Custom Models
├── Chương 13: Multimodal Applications
└── Chương 14: Code Generation và Developer Tools

PHẦN 4: PRODUCTION & SCALE (Chương 15-17)
├── Chương 15: Deployment và Infrastructure
├── Chương 16: Monitoring, Evaluation và Testing
└── Chương 17: Cost Optimization

PHẦN 5: CHUYÊN SÂU (Chương 18-20)
├── Chương 18: AI Safety và Ethics
├── Chương 19: Emerging Patterns và Trends
└── Chương 20: Xây dựng AI Startup
```

---

## 1.9 Môi trường phát triển

### 1.9.1 Setup cơ bản

```bash
# Tạo virtual environment
python -m venv ai-env
source ai-env/bin/activate  # macOS/Linux
# ai-env\Scripts\activate  # Windows

# Cài đặt thư viện thiết yếu
pip install openai anthropic google-generativeai
pip install langchain langchain-community
pip install python-dotenv jupyter notebook
pip install numpy pandas matplotlib seaborn
pip install fastapi uvicorn  # Cho API server
pip install streamlit  # Cho demo UI nhanh
```

### 1.9.2 Quản lý API Keys an toàn

```python
# .env file (KHÔNG commit vào Git!)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# .gitignore
.env
*.env
env/
venv/
```

```python
# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    
    @classmethod
    def validate(cls):
        missing = []
        for key in ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"]:
            if not getattr(cls, key):
                missing.append(key)
        if missing:
            raise ValueError(f"Missing API keys: {', '.join(missing)}")
```

### 1.9.3 Test nhanh ba APIs

```python
# test_apis.py
import openai
import anthropic
import google.generativeai as genai
from config import Config

Config.validate()

def test_openai():
    client = openai.OpenAI(api_key=Config.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Say 'OpenAI working!' in Vietnamese"}],
        max_tokens=50
    )
    print("OpenAI:", response.choices[0].message.content)

def test_claude():
    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=50,
        messages=[{"role": "user", "content": "Say 'Claude working!' in Vietnamese"}]
    )
    print("Claude:", response.content[0].text)

def test_gemini():
    genai.configure(api_key=Config.GOOGLE_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content("Say 'Gemini working!' in Vietnamese")
    print("Gemini:", response.text)

if __name__ == "__main__":
    test_openai()
    test_claude()
    test_gemini()
```

---

## 1.10 Xu hướng và tương lai

### 1.10.1 Các xu hướng kỹ thuật 2024-2025

**1. Multimodality trở thành standard**
Không còn là "text only" — mọi mô hình frontier đều xử lý được image, audio, video.

**2. Long context revolution**
Từ 4K (GPT-3) → 128K (GPT-4) → 200K (Claude) → 1M (Gemini 1.5) → không giới hạn?

**3. AI Agents**
LLMs không chỉ trả lời mà còn thực hiện hành động: browse web, viết và chạy code, gọi APIs, điều khiển máy tính.

**4. Smaller, faster, cheaper models**
GPT-4o mini, Claude Haiku, Gemini Flash — chất lượng 80-90% với chi phí 5-10%.

**5. Open-source catching up**
Llama 3 (Meta), Mistral, Qwen 2 — open-source đang thu hẹp khoảng cách với closed-source.

### 1.10.2 Kỹ năng kỹ sư AI tương lai

```
2024: Prompt Engineering, RAG, API integration
2025: Agent development, fine-tuning, evaluation
2026: Multimodal systems, on-device AI
2027: AI-native architecture design
```

---

## Tóm tắt chương

Trong chương này, chúng ta đã:

1. **Điểm qua lịch sử AI** từ Expert Systems → Machine Learning → Deep Learning → LLMs
2. **Hiểu bản chất LLM**: Hàm xác suất khổng lồ được train trên văn bản
3. **So sánh ba trụ cột**: ChatGPT (hệ sinh thái), Claude (an toàn), Gemini (multimodal)
4. **Nắm kiến trúc Transformer**: Self-Attention, Multi-Head Attention, Positional Encoding
5. **Hiểu các khái niệm kỹ thuật**: Tokenization, Temperature, Hallucination
6. **Setup môi trường** phát triển cơ bản

## Bài tập thực hành

1. **Setup môi trường**: Cài đặt Python 3.11+, tạo virtual env, install dependencies
2. **Đăng ký API keys**: OpenAI (có free trial), Anthropic, Google AI Studio
3. **Chạy test_apis.py**: Xác nhận cả 3 APIs hoạt động
4. **Tokenizer experiment**: Dùng tiktoken, đếm số token trong một đoạn văn tiếng Anh vs tiếng Việt
5. **Temperature experiment**: Gọi API với temperature 0, 0.5, 1.0 và so sánh kết quả

## Câu hỏi ôn tập

1. Sự khác biệt cơ bản giữa hệ thống AI dựa trên luật và LLMs là gì?
2. Tại sao "Attention is All You Need" lại là bước đột phá?
3. RLHF giải quyết vấn đề gì mà pre-training không giải quyết được?
4. Tại sao hallucination là vấn đề khó giải quyết về mặt bản chất?
5. Trong dự án của bạn, khi nào nên dùng Claude thay vì ChatGPT?

---

*Chương tiếp theo: **Prompt Engineering cơ bản** — nghệ thuật và khoa học giao tiếp với LLMs*
