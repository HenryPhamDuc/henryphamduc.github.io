# CHƯƠNG 10: XÂY DỰNG CHATBOT PRODUCTION

## Giới thiệu chương

Chatbot là ứng dụng AI phổ biến nhất. Nhưng sự khác biệt giữa một chatbot "demo" và "production" là rất lớn: session management, scalability, fallback strategies, analytics, safety filters, và tích hợp hệ thống. Chương này xây dựng chatbot enterprise-grade từ đầu đến cuối.

---

## 10.1 Architecture của Production Chatbot

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                     │
│         Web / Mobile / WhatsApp / Slack             │
└─────────────────┬───────────────────────────────────┘
                  │ WebSocket / REST / SSE
┌─────────────────▼───────────────────────────────────┐
│                  API Gateway                        │
│         Rate Limiting, Auth, Load Balancing         │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│              Chat Orchestrator                      │
│  ┌───────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │ Intent    │ │  Context   │ │   Response       │  │
│  │ Router    │ │  Manager   │ │   Generator      │  │
│  └───────────┘ └────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌─────────────┐ ┌───────────────┐   │
│  │ Session DB │ │  RAG System │ │  LLM APIs     │   │
│  │  (Redis)   │ │  (Chroma)   │ │(Claude/GPT-4) │   │
│  └────────────┘ └─────────────┘ └───────────────┘   │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌────────────┐ ┌─────────────┐    │
│  │  Analytics   │ │  Safety    │ │  Fallback   │    │
│  │  (Posthog)   │ │  Filter    │ │  Handler    │    │
│  └──────────────┘ └────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## 10.2 Session Management

```python
import redis
import json
import uuid
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import List, Optional

@dataclass
class Message:
    role: str           # "user" | "assistant" | "system"
    content: str
    timestamp: str
    metadata: dict = None
    
    def to_dict(self) -> dict:
        return asdict(self)

@dataclass 
class Session:
    session_id: str
    user_id: str
    created_at: str
    updated_at: str
    messages: List[Message]
    metadata: dict
    
    @property
    def message_count(self):
        return len(self.messages)
    
    @property
    def token_estimate(self):
        total_chars = sum(len(m.content) for m in self.messages)
        return total_chars // 4

class SessionManager:
    """Redis-backed session manager"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379",
                 ttl_hours: int = 24, max_messages: int = 100):
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.ttl = ttl_hours * 3600
        self.max_messages = max_messages
    
    def create_session(self, user_id: str, metadata: dict = None) -> Session:
        session = Session(
            session_id=str(uuid.uuid4()),
            user_id=user_id,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            messages=[],
            metadata=metadata or {}
        )
        self._save(session)
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        data = self.redis.get(f"session:{session_id}")
        if not data:
            return None
        
        raw = json.loads(data)
        raw["messages"] = [Message(**m) for m in raw["messages"]]
        return Session(**raw)
    
    def add_message(self, session_id: str, role: str, content: str,
                    metadata: dict = None) -> Session:
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        msg = Message(
            role=role,
            content=content,
            timestamp=datetime.utcnow().isoformat(),
            metadata=metadata or {}
        )
        session.messages.append(msg)
        session.updated_at = datetime.utcnow().isoformat()
        
        # Trim old messages if needed
        if len(session.messages) > self.max_messages:
            # Keep first message (often important context)
            # Remove oldest middle messages
            session.messages = session.messages[:1] + session.messages[-(self.max_messages-1):]
        
        self._save(session)
        return session
    
    def _save(self, session: Session):
        data = {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "messages": [m.to_dict() for m in session.messages],
            "metadata": session.metadata
        }
        self.redis.setex(
            f"session:{session.session_id}",
            self.ttl,
            json.dumps(data)
        )
    
    def get_user_sessions(self, user_id: str) -> List[str]:
        return list(self.redis.smembers(f"user_sessions:{user_id}"))
    
    def delete_session(self, session_id: str):
        self.redis.delete(f"session:{session_id}")
    
    def get_context_messages(self, session: Session, 
                             max_tokens: int = 50000) -> List[dict]:
        """Convert session to LLM-ready messages, respecting token limit"""
        messages = []
        total_tokens = 0
        
        for msg in reversed(session.messages):
            msg_tokens = len(msg.content) // 4
            if total_tokens + msg_tokens > max_tokens:
                break
            messages.insert(0, {"role": msg.role, "content": msg.content})
            total_tokens += msg_tokens
        
        return messages
```

---

## 10.3 Intent Classification và Routing

```python
import anthropic
from enum import Enum

class Intent(Enum):
    CUSTOMER_SUPPORT = "customer_support"
    PRODUCT_INQUIRY = "product_inquiry"
    TECHNICAL_HELP = "technical_help"
    COMPLAINT = "complaint"
    ESCALATE_HUMAN = "escalate_human"
    SMALL_TALK = "small_talk"
    OUT_OF_SCOPE = "out_of_scope"

class IntentClassifier:
    """Classify user intent để route đến đúng handler"""
    
    def __init__(self):
        self.client = anthropic.Anthropic()
    
    def classify(self, message: str, context: List[dict] = None) -> tuple[Intent, float]:
        """Returns (intent, confidence)"""
        
        context_str = ""
        if context:
            recent = context[-3:]  # Last 3 messages for context
            context_str = "\n".join(f"{m['role']}: {m['content']}" for m in recent)
        
        prompt = f"""
Classify the following user message into one intent category.

{f'Recent conversation:{chr(10)}{context_str}' if context_str else ''}

User message: "{message}"

Categories:
- customer_support: Order issues, returns, account problems
- product_inquiry: Product questions, pricing, availability
- technical_help: Technical bugs, how-to questions
- complaint: Negative feedback, complaints
- escalate_human: Explicitly wants human agent
- small_talk: Greetings, casual conversation
- out_of_scope: Unrelated to our business

Respond ONLY with JSON: {{"intent": "category", "confidence": 0.95, "reason": "brief reason"}}
"""
        
        response = self.client.messages.create(
            model="claude-3-haiku-20240307",  # Fast model for classification
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
        
        try:
            result = json.loads(response.content[0].text)
            intent = Intent(result["intent"])
            confidence = float(result["confidence"])
            return intent, confidence
        except:
            return Intent.SMALL_TALK, 0.5

class ChatRouter:
    """Route messages đến handler phù hợp"""
    
    def __init__(self):
        self.classifier = IntentClassifier()
        self.handlers = {
            Intent.CUSTOMER_SUPPORT: self.handle_support,
            Intent.PRODUCT_INQUIRY: self.handle_product,
            Intent.TECHNICAL_HELP: self.handle_technical,
            Intent.COMPLAINT: self.handle_complaint,
            Intent.ESCALATE_HUMAN: self.handle_escalation,
            Intent.SMALL_TALK: self.handle_small_talk,
            Intent.OUT_OF_SCOPE: self.handle_out_of_scope,
        }
    
    async def route(self, message: str, session: Session) -> dict:
        context = session.messages[-6:]
        context_dicts = [{"role": m.role, "content": m.content} for m in context]
        
        intent, confidence = self.classifier.classify(message, context_dicts)
        
        # Log for analytics
        print(f"Intent: {intent.value} (confidence: {confidence:.2f})")
        
        # Low confidence → general handler
        if confidence < 0.6:
            intent = Intent.SMALL_TALK
        
        handler = self.handlers.get(intent, self.handle_small_talk)
        response = await handler(message, session)
        
        return {
            "response": response,
            "intent": intent.value,
            "confidence": confidence
        }
    
    async def handle_support(self, message: str, session: Session) -> str:
        # Query knowledge base về support policies
        rag_context = query_knowledge_base(message, collection="support_docs")
        
        return await generate_response(
            message=message,
            session=session,
            system="""Bạn là customer support agent chuyên nghiệp.
            Luôn empathetic, solution-focused, và escalate khi cần.""",
            context_docs=rag_context
        )
    
    async def handle_escalation(self, message: str, session: Session) -> str:
        # Create support ticket
        ticket_id = create_support_ticket(session)
        
        return f"""Tôi hiểu bạn muốn nói chuyện với nhân viên của chúng tôi.
        
Tôi đã tạo ticket #{ticket_id} cho bạn. Đội support sẽ liên hệ trong vòng 2 giờ làm việc.

Trong khi chờ, có điều gì tôi có thể hỗ trợ thêm không?"""
```

---

## 10.4 Safety và Content Moderation

```python
class SafetyFilter:
    """Multi-layer safety filtering"""
    
    def __init__(self):
        self.client = anthropic.Anthropic()
        
        # Keyword-based fast filter (layer 1)
        self.blocklist = {
            "violence", "illegal", "hack", "exploit",
            # ... domain-specific blocklist
        }
        
        # Category scores
        self.thresholds = {
            "hate": 0.7,
            "harassment": 0.7,
            "self_harm": 0.5,
            "sexual": 0.8,
            "violence": 0.7,
        }
    
    def quick_filter(self, text: str) -> bool:
        """Fast keyword-based pre-filter"""
        text_lower = text.lower()
        return any(word in text_lower for word in self.blocklist)
    
    def llm_safety_check(self, text: str) -> dict:
        """
        LLM-based safety classification
        Chỉ dùng khi quick_filter không catch
        """
        response = self.client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=200,
            system="You are a content safety classifier. Be objective and precise.",
            messages=[{
                "role": "user",
                "content": f"""Rate this text for safety (0-1, 1 = most harmful):
                
Text: "{text}"

Return JSON only:
{{
    "safe": true/false,
    "hate": 0.0,
    "harassment": 0.0,
    "self_harm": 0.0,
    "sexual": 0.0,
    "violence": 0.0,
    "reason": "brief explanation"
}}"""
            }]
        )
        
        try:
            return json.loads(response.content[0].text)
        except:
            return {"safe": True}  # Default safe on parse error
    
    def check(self, user_input: str, bot_output: str = None) -> dict:
        """Full safety check on input and/or output"""
        
        result = {"input_safe": True, "output_safe": True, "blocked": False}
        
        # Layer 1: Quick filter
        if self.quick_filter(user_input):
            scores = self.llm_safety_check(user_input)
            
            for category, threshold in self.thresholds.items():
                if scores.get(category, 0) > threshold:
                    result["input_safe"] = False
                    result["blocked"] = True
                    result["reason"] = f"Content violates {category} policy"
                    break
        
        # Check output if provided
        if bot_output and not result["blocked"]:
            if self.quick_filter(bot_output):
                scores = self.llm_safety_check(bot_output)
                if not scores.get("safe", True):
                    result["output_safe"] = False
                    result["blocked"] = True
                    result["reason"] = "Bot response contains unsafe content"
        
        return result

class PIIDetector:
    """Phát hiện và ẩn Personally Identifiable Information"""
    
    import re
    
    PATTERNS = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone_vn": r'\b(0[3-9][0-9]{8}|(\+84)[3-9][0-9]{8})\b',
        "cccd": r'\b\d{12}\b',  # Vietnamese ID
        "credit_card": r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
    }
    
    def detect(self, text: str) -> dict:
        import re
        found = {}
        for pii_type, pattern in self.PATTERNS.items():
            matches = re.findall(pattern, text)
            if matches:
                found[pii_type] = matches
        return found
    
    def redact(self, text: str) -> tuple[str, dict]:
        import re
        redacted = text
        found = {}
        
        for pii_type, pattern in self.PATTERNS.items():
            matches = re.findall(pattern, redacted)
            if matches:
                found[pii_type] = matches
                redacted = re.sub(pattern, f"[{pii_type.upper()}]", redacted)
        
        return redacted, found
```

---

## 10.5 Full Chatbot Implementation

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI(title="Production Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
session_manager = SessionManager()
router = ChatRouter()
safety_filter = SafetyFilter()
pii_detector = PIIDetector()

# Anthropic client
claude_client = anthropic.AsyncAnthropic()

@app.post("/sessions")
async def create_session(user_id: str):
    """Tạo session mới"""
    session = session_manager.create_session(user_id)
    return {"session_id": session.session_id}

@app.post("/chat/{session_id}")
async def chat(session_id: str, message: str):
    """REST endpoint cho chat"""
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    # Safety check input
    safety = safety_filter.check(message)
    if safety["blocked"]:
        return {"response": "Xin lỗi, tôi không thể xử lý yêu cầu này.", 
                "blocked": True}
    
    # Redact PII before sending to LLM
    clean_message, pii_found = pii_detector.redact(message)
    if pii_found:
        print(f"PII detected and redacted: {list(pii_found.keys())}")
    
    # Add user message to session
    session_manager.add_message(session_id, "user", message)
    
    # Route and generate response
    result = await router.route(clean_message, session)
    
    # Safety check output
    output_safety = safety_filter.check("", result["response"])
    if output_safety["blocked"]:
        result["response"] = "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại."
    
    # Add assistant response to session
    session_manager.add_message(session_id, "assistant", result["response"])
    
    return result

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint cho streaming"""
    
    await websocket.accept()
    
    session = session_manager.get_session(session_id)
    if not session:
        await websocket.send_json({"error": "Session not found"})
        await websocket.close()
        return
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            message = data.get("message", "")
            
            # Safety check
            safety = safety_filter.check(message)
            if safety["blocked"]:
                await websocket.send_json({
                    "type": "error",
                    "content": "Nội dung không phù hợp"
                })
                continue
            
            # Add to session
            session_manager.add_message(session_id, "user", message)
            
            # Reload session for updated history
            session = session_manager.get_session(session_id)
            context = session_manager.get_context_messages(session)
            
            # Stream response
            full_response = ""
            
            async with claude_client.messages.stream(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system="""Bạn là customer support assistant của Công ty XYZ.
                Trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp.""",
                messages=context
            ) as stream:
                async for text in stream.text_stream:
                    full_response += text
                    await websocket.send_json({
                        "type": "stream",
                        "content": text
                    })
            
            # Signal completion
            await websocket.send_json({"type": "done"})
            
            # Save response to session
            session_manager.add_message(session_id, "assistant", full_response)
            
    except WebSocketDisconnect:
        print(f"Client disconnected: {session_id}")
```

---

## 10.6 Analytics và Monitoring

```python
from dataclasses import dataclass
from datetime import datetime
import time

@dataclass
class ChatMetrics:
    session_id: str
    user_id: str
    message: str
    intent: str
    response_time_ms: float
    input_tokens: int
    output_tokens: int
    cost_usd: float
    safety_blocked: bool
    feedback: Optional[int]  # 1-5 stars
    timestamp: str

class ChatAnalytics:
    """Track metrics cho chatbot"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        self.buffer = []  # Buffer events before bulk insert
    
    def track(self, metrics: ChatMetrics):
        self.buffer.append(metrics)
        
        # Flush every 100 events
        if len(self.buffer) >= 100:
            self.flush()
    
    def flush(self):
        if not self.buffer:
            return
        
        # Bulk insert to DB
        self.db.executemany(
            """INSERT INTO chat_metrics VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            [(m.session_id, m.user_id, m.message, m.intent,
              m.response_time_ms, m.input_tokens, m.output_tokens,
              m.cost_usd, m.safety_blocked, m.feedback, m.timestamp)
             for m in self.buffer]
        )
        self.buffer.clear()
    
    def get_dashboard(self, days: int = 7) -> dict:
        """Dashboard metrics"""
        return {
            "total_conversations": self.db.execute(
                "SELECT COUNT(DISTINCT session_id) FROM chat_metrics WHERE timestamp > ?",
                [(datetime.now() - timedelta(days=days)).isoformat()]
            ).fetchone()[0],
            
            "avg_response_time_ms": self.db.execute(
                "SELECT AVG(response_time_ms) FROM chat_metrics WHERE timestamp > ?",
                [(datetime.now() - timedelta(days=days)).isoformat()]
            ).fetchone()[0],
            
            "top_intents": self.db.execute(
                """SELECT intent, COUNT(*) as count 
                   FROM chat_metrics GROUP BY intent 
                   ORDER BY count DESC LIMIT 5"""
            ).fetchall(),
            
            "total_cost_usd": self.db.execute(
                "SELECT SUM(cost_usd) FROM chat_metrics WHERE timestamp > ?",
                [(datetime.now() - timedelta(days=days)).isoformat()]
            ).fetchone()[0],
            
            "safety_block_rate": self.db.execute(
                """SELECT AVG(CASE WHEN safety_blocked THEN 1.0 ELSE 0.0 END)
                   FROM chat_metrics WHERE timestamp > ?""",
                [(datetime.now() - timedelta(days=days)).isoformat()]
            ).fetchone()[0],
            
            "avg_user_rating": self.db.execute(
                """SELECT AVG(feedback) FROM chat_metrics 
                   WHERE feedback IS NOT NULL AND timestamp > ?""",
                [(datetime.now() - timedelta(days=days)).isoformat()]
            ).fetchone()[0]
        }
```

---

## 10.7 Fallback và Graceful Degradation

```python
class FallbackHandler:
    """Handle failures gracefully"""
    
    FALLBACK_RESPONSES = [
        "Xin lỗi, tôi đang gặp một chút vấn đề kỹ thuật. Vui lòng thử lại sau.",
        "Hệ thống đang bận, xin thử lại trong vài giây.",
        "Tôi cần một chút thời gian. Bạn có thể hỏi lại không?",
    ]
    
    ESCALATION_TRIGGERS = [
        "muốn nói chuyện với người thật",
        "gặp nhân viên",
        "hotline",
        "complaint",
        "khiếu nại",
    ]
    
    async def handle_with_fallback(self, 
                                    primary_fn,
                                    fallback_fn,
                                    *args, **kwargs):
        """Try primary, fallback on failure"""
        try:
            return await primary_fn(*args, **kwargs)
        except Exception as e:
            print(f"Primary handler failed: {e}. Using fallback.")
            try:
                return await fallback_fn(*args, **kwargs)
            except Exception as e2:
                print(f"Fallback also failed: {e2}")
                return {
                    "response": self.FALLBACK_RESPONSES[0],
                    "error": True
                }
    
    def should_escalate(self, message: str) -> bool:
        """Check if user wants human escalation"""
        msg_lower = message.lower()
        return any(trigger in msg_lower for trigger in self.ESCALATION_TRIGGERS)
    
    async def handle_api_overload(self, session: Session, message: str) -> str:
        """Response khi LLM API overloaded"""
        
        # Try simpler model first
        try:
            response = await call_llm(
                model="claude-3-haiku-20240307",  # Faster/cheaper model
                message=message,
                session=session
            )
            return response
        except:
            pass
        
        # Template response as last resort
        return self._template_response(message)
    
    def _template_response(self, message: str) -> str:
        """Rule-based responses for common queries"""
        
        TEMPLATES = {
            "giờ": "Chúng tôi làm việc T2-T6, 8h-18h. Thứ 7: 8h-12h.",
            "địa chỉ": "Trụ sở: 123 Nguyễn Huệ, Q1, TP.HCM",
            "hotline": "Hotline: 1800-xxxx (miễn phí)",
            "email": "Email: support@company.com",
        }
        
        msg_lower = message.lower()
        for keyword, response in TEMPLATES.items():
            if keyword in msg_lower:
                return response
        
        return "Cảm ơn bạn đã liên hệ. Nhân viên sẽ hỗ trợ bạn trong thời gian sớm nhất."
```

---

## 10.8 Testing Chatbot

```python
import pytest
import asyncio

class ChatbotTester:
    """Automated testing framework cho chatbot"""
    
    def __init__(self, chatbot_url: str):
        self.url = chatbot_url
    
    async def run_conversation(self, turns: List[tuple]) -> List[dict]:
        """
        Simulate multi-turn conversation
        turns = [("user message", expected_intent), ...]
        """
        import httpx
        
        async with httpx.AsyncClient() as client:
            # Create session
            resp = await client.post(f"{self.url}/sessions", params={"user_id": "test_user"})
            session_id = resp.json()["session_id"]
            
            results = []
            for message, expected_intent in turns:
                resp = await client.post(
                    f"{self.url}/chat/{session_id}",
                    params={"message": message}
                )
                result = resp.json()
                
                results.append({
                    "message": message,
                    "response": result["response"],
                    "intent": result.get("intent"),
                    "intent_correct": result.get("intent") == expected_intent
                })
            
            return results
    
    def evaluate_responses(self, conversations: List[List[dict]]) -> dict:
        """LLM-based quality evaluation"""
        
        scores = []
        for conv in conversations:
            for turn in conv:
                score = self._evaluate_turn(turn)
                scores.append(score)
        
        return {
            "avg_quality": sum(s["quality"] for s in scores) / len(scores),
            "avg_relevance": sum(s["relevance"] for s in scores) / len(scores),
            "intent_accuracy": sum(1 for t in [t for c in conversations for t in c]
                                   if t["intent_correct"]) / len(scores),
        }
    
    def _evaluate_turn(self, turn: dict) -> dict:
        """Evaluate một turn với LLM judge"""
        
        prompt = f"""
Rate this chatbot response:
User: {turn['message']}
Bot: {turn['response']}

JSON: {{"quality": 1-10, "relevance": 1-10, "issues": "if any"}}
"""
        response = call_claude_sync(prompt, temperature=0)
        return json.loads(response)

# Test cases
TEST_SCENARIOS = [
    [
        ("Tôi muốn trả hàng", "customer_support"),
        ("Sản phẩm bị lỗi", "complaint"),
        ("Tôi muốn gặp nhân viên", "escalate_human"),
    ],
    [
        ("Xin chào", "small_talk"),
        ("Cho hỏi giá iPhone 15", "product_inquiry"),
        ("Có bảo hành không?", "product_inquiry"),
    ]
]
```

---

## 10.9 Deployment

```python
# docker-compose.yml
"""
version: '3.8'
services:
  chatbot-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:pass@db:5432/chatbot
    depends_on:
      - redis
      - db
    deploy:
      replicas: 3  # Scale horizontally
      
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy lru
    
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: chatbot
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
"""

# Dockerfile
"""
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
"""

# Health check endpoint
@app.get("/health")
async def health_check():
    checks = {}
    
    # Check Redis
    try:
        redis_client.ping()
        checks["redis"] = "ok"
    except:
        checks["redis"] = "error"
    
    # Check LLM API
    try:
        claude_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}]
        )
        checks["llm_api"] = "ok"
    except:
        checks["llm_api"] = "error"
    
    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "healthy" if all_ok else "degraded", "checks": checks}
```

---

## Tóm tắt chương

Production Chatbot cần:
- **Architecture**: API Gateway → Orchestrator → Session → LLM
- **Session Management**: Redis-backed, token-aware history trimming
- **Intent Classification**: Fast routing với Claude Haiku
- **Safety**: Multi-layer filtering (keyword + LLM)
- **PII Detection**: Redact before sending to LLM
- **Streaming**: WebSocket cho realtime UX
- **Analytics**: Track intent, latency, cost, ratings
- **Fallback**: Graceful degradation khi LLM unavailable
- **Testing**: Automated conversation testing với LLM judge

---

*Chương tiếp theo: **AI Agents và Tool Use***
