# CHƯƠNG 13: MULTIMODAL APPLICATIONS

## Giới thiệu chương

Multimodal AI xử lý nhiều loại dữ liệu đồng thời: text, image, audio, video. Đây là frontier của AI 2024-2025, mở ra hàng loạt use cases mới mà text-only AI không thể làm được.

---

## 13.1 Image Understanding

```python
import anthropic
import base64
from pathlib import Path

client = anthropic.Anthropic()

class ImageAnalyzer:
    """Comprehensive image analysis với Claude"""
    
    def __init__(self, model: str = "claude-3-5-sonnet-20241022"):
        self.client = anthropic.Anthropic()
        self.model = model
    
    def _load_image(self, source: str) -> dict:
        """Load image từ file path hoặc URL"""
        if source.startswith("http"):
            return {"type": "url", "url": source}
        else:
            data = base64.b64encode(Path(source).read_bytes()).decode()
            suffix = Path(source).suffix.lower()
            media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                          ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}
            media_type = media_types.get(suffix, "image/jpeg")
            return {"type": "base64", "media_type": media_type, "data": data}
    
    def describe(self, image_source: str, detail_level: str = "standard") -> str:
        """Mô tả nội dung ảnh"""
        prompts = {
            "brief": "Mô tả ảnh trong 1-2 câu.",
            "standard": "Mô tả chi tiết nội dung ảnh: objects, colors, layout, text.",
            "detailed": """Mô tả toàn diện:
            1. Main subjects và objects
            2. Colors và visual style
            3. Text nếu có
            4. Spatial relationships
            5. Mood/atmosphere
            6. Technical quality"""
        }
        
        return self._analyze(image_source, prompts.get(detail_level, prompts["standard"]))
    
    def extract_text(self, image_source: str, language: str = "vi") -> str:
        """OCR: Extract text từ ảnh"""
        prompt = f"Extract ALL text từ ảnh này. Language: {language}. Preserve formatting."
        return self._analyze(image_source, prompt)
    
    def analyze_chart(self, image_source: str) -> dict:
        """Extract data từ charts/graphs"""
        prompt = """Analyze chart và return JSON:
        {
            "chart_type": "bar/line/pie/scatter/table/...",
            "title": "chart title",
            "x_axis_label": "...",
            "y_axis_label": "...",
            "data_series": [{"name": "...", "values": [...], "labels": [...]}],
            "key_insights": ["insight1", "insight2"],
            "trend": "up/down/stable/mixed"
        }
        Only JSON, no explanation."""
        
        result = self._analyze(image_source, prompt)
        import json
        try:
            return json.loads(result)
        except:
            return {"raw": result}
    
    def review_ui(self, image_source: str) -> dict:
        """Review UI/UX design"""
        prompt = """Review UI design theo:
        {
            "overall_score": 1-10,
            "ux_issues": ["issue1", "issue2"],
            "accessibility_issues": ["wcag violation1"],
            "positive_aspects": ["good thing1"],
            "mobile_considerations": "responsive analysis",
            "priority_improvements": [{"issue": "...", "severity": "critical/high/medium/low", "fix": "..."}]
        }
        JSON only."""
        
        result = self._analyze(image_source, prompt)
        import json
        try:
            return json.loads(result)
        except:
            return {"raw": result}
    
    def detect_objects(self, image_source: str) -> list[dict]:
        """Detect và classify objects"""
        prompt = """List all objects với JSON:
        [{"object": "name", "confidence": "high/medium/low", 
          "position": "top-left/center/...", "count": 1}]
        JSON array only."""
        
        result = self._analyze(image_source, prompt)
        import json
        try:
            return json.loads(result)
        except:
            return []
    
    def compare(self, image1: str, image2: str, aspect: str = "general") -> str:
        """So sánh hai ảnh"""
        img1_data = self._load_image(image1)
        img2_data = self._load_image(image2)
        
        aspects = {
            "general": "So sánh hai ảnh tổng thể",
            "design": "So sánh design, style, visual quality",
            "content": "So sánh content và objects",
            "before_after": "Analyze differences như before/after comparison"
        }
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Image 1:"},
                    {"type": "image", "source": img1_data},
                    {"type": "text", "text": "Image 2:"},
                    {"type": "image", "source": img2_data},
                    {"type": "text", "text": aspects.get(aspect, aspects["general"])}
                ]
            }]
        )
        return response.content[0].text
    
    def _analyze(self, image_source: str, question: str) -> str:
        img_data = self._load_image(image_source)
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": img_data},
                    {"type": "text", "text": question}
                ]
            }]
        )
        return response.content[0].text

# Demo
analyzer = ImageAnalyzer()

# Analyze dashboard screenshot
ui_review = analyzer.review_ui("dashboard.png")
print(f"UX Score: {ui_review['overall_score']}/10")
for issue in ui_review['priority_improvements'][:3]:
    print(f"[{issue['severity'].upper()}] {issue['issue']}: {issue['fix']}")

# Extract data từ chart
chart_data = analyzer.analyze_chart("revenue_chart.png")
print(f"Chart type: {chart_data['chart_type']}")
print(f"Trend: {chart_data['trend']}")
```

---

## 13.2 Document Processing

```python
class DocumentProcessor:
    """Xử lý tài liệu phức tạp với multimodal AI"""
    
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.analyzer = ImageAnalyzer()
    
    def process_invoice(self, image_path: str) -> dict:
        """Extract structured data từ invoice"""
        prompt = """Extract invoice data as JSON:
        {
            "invoice_number": "...",
            "date": "YYYY-MM-DD",
            "vendor": {"name": "...", "address": "...", "tax_id": "..."},
            "customer": {"name": "...", "address": "..."},
            "items": [{"description": "...", "qty": 1, "unit_price": 0, "total": 0}],
            "subtotal": 0,
            "tax_rate": 0,
            "tax_amount": 0,
            "total": 0,
            "currency": "VND",
            "payment_terms": "...",
            "notes": "..."
        }
        JSON only. Use null for missing fields."""
        
        result = self.analyzer._analyze(image_path, prompt)
        import json
        return json.loads(result)
    
    def process_id_document(self, image_path: str) -> dict:
        """Extract thông tin từ CCCD/Passport (chú ý GDPR/privacy!)"""
        prompt = """Extract fields from ID document:
        {
            "document_type": "cccd/passport/...",
            "full_name": "...",
            "date_of_birth": "YYYY-MM-DD",
            "id_number": "...",
            "issue_date": "YYYY-MM-DD",
            "expiry_date": "YYYY-MM-DD",
            "nationality": "...",
            "address": "..."
        }
        JSON only. Null for unreadable fields."""
        
        result = self.analyzer._analyze(image_path, prompt)
        import json
        return json.loads(result)
    
    def analyze_medical_report(self, image_path: str) -> dict:
        """Phân tích báo cáo y tế (không thay thế bác sĩ!)"""
        prompt = """Analyze medical report:
        {
            "document_type": "lab_result/xray/prescription/...",
            "patient_info": "if visible",
            "test_results": [{"test": "...", "value": "...", "unit": "...", "reference": "..."}],
            "abnormal_values": ["list of out-of-range results"],
            "doctor_notes": "if any",
            "date": "...",
            "DISCLAIMER": "This is automated extraction only. Consult a doctor."
        }"""
        
        result = self.analyzer._analyze(image_path, prompt)
        import json
        return json.loads(result)
```

---

## 13.3 Video Analysis với Gemini

```python
import google.generativeai as genai
import time

class VideoAnalyzer:
    """Video analysis với Gemini 1.5 Pro"""
    
    def __init__(self):
        genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
        self.model = genai.GenerativeModel("gemini-1.5-pro")
    
    def upload_video(self, video_path: str) -> genai.File:
        """Upload video và chờ processing"""
        print(f"Uploading {video_path}...")
        video_file = genai.upload_file(path=video_path)
        
        while video_file.state.name == "PROCESSING":
            time.sleep(5)
            video_file = genai.get_file(video_file.name)
        
        if video_file.state.name != "ACTIVE":
            raise ValueError(f"Upload failed: {video_file.state.name}")
        
        print(f"Video ready: {video_file.uri}")
        return video_file
    
    def transcribe(self, video_path: str) -> str:
        """Transcribe video speech"""
        video_file = self.upload_video(video_path)
        response = self.model.generate_content([
            video_file,
            "Transcribe tất cả speech trong video này. Include timestamps [MM:SS]."
        ])
        return response.text
    
    def summarize(self, video_path: str, target_audience: str = "general") -> dict:
        """Tóm tắt nội dung video"""
        video_file = self.upload_video(video_path)
        
        prompt = f"""
        Analyze và tóm tắt video này cho {target_audience} audience:
        {{
            "title": "suggested title",
            "duration_estimate": "HH:MM",
            "summary": "2-3 sentence overview",
            "key_points": ["point1", "point2", "point3"],
            "chapters": [{{"time": "MM:SS", "title": "...", "description": "..."}}],
            "speakers": ["list if identified"],
            "topics": ["topic1", "topic2"],
            "action_items": ["if any"]
        }}
        JSON only.
        """
        
        response = self.model.generate_content([video_file, prompt])
        import json
        return json.loads(response.text)
    
    def find_moments(self, video_path: str, query: str) -> list[dict]:
        """Tìm kiếm moments trong video theo query"""
        video_file = self.upload_video(video_path)
        
        prompt = f"""
        Tìm tất cả moments trong video liên quan đến: "{query}"
        
        Return JSON array:
        [{{"timestamp": "MM:SS", "duration_seconds": 30, "description": "what happens", "relevance": 1-10}}]
        Sorted by timestamp. JSON only.
        """
        
        response = self.model.generate_content([video_file, prompt])
        import json
        try:
            return json.loads(response.text)
        except:
            return []

# Production use cases
video_analyzer = VideoAnalyzer()

# Meeting recording analysis
meeting_summary = video_analyzer.summarize("team_meeting.mp4", "business executive")
print(f"Key points: {meeting_summary['key_points']}")
print(f"Action items: {meeting_summary['action_items']}")

# Training video search
moments = video_analyzer.find_moments("training_video.mp4", "SQL injection prevention")
for m in moments:
    print(f"[{m['timestamp']}] {m['description']} (relevance: {m['relevance']}/10)")
```

---

## 13.4 Audio Applications

```python
from openai import OpenAI

client = OpenAI()

class AudioProcessor:
    """Xử lý audio với Whisper và TTS"""
    
    def transcribe(self, audio_path: str, language: str = None) -> dict:
        """Transcribe audio with word-level timestamps"""
        with open(audio_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=language,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"]
            )
        
        return {
            "text": transcript.text,
            "language": transcript.language,
            "duration": transcript.duration,
            "segments": [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text
                }
                for seg in transcript.segments
            ],
            "words": [
                {"word": w.word, "start": w.start, "end": w.end}
                for w in (transcript.words or [])
            ]
        }
    
    def translate_to_english(self, audio_path: str) -> str:
        """Translate audio sang English"""
        with open(audio_path, "rb") as f:
            translation = client.audio.translations.create(
                model="whisper-1",
                file=f
            )
        return translation.text
    
    def text_to_speech(self, text: str, output_path: str,
                       voice: str = "nova", speed: float = 1.0):
        """Convert text to speech"""
        # Voices: alloy, echo, fable, onyx, nova, shimmer
        response = client.audio.speech.create(
            model="tts-1-hd",  # Higher quality
            voice=voice,
            input=text,
            speed=speed
        )
        response.stream_to_file(output_path)
        return output_path
    
    def create_podcast_summary(self, audio_path: str) -> dict:
        """Podcast → Transcript → Summary → Key Quotes"""
        
        # Step 1: Transcribe
        transcript = self.transcribe(audio_path)
        
        # Step 2: Analyze với Claude
        claude_client = anthropic.Anthropic()
        response = claude_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": f"""
                Phân tích podcast transcript này:
                
                {transcript['text']}
                
                Return JSON:
                {{
                    "title": "suggested episode title",
                    "summary": "3-4 sentence summary",
                    "key_topics": ["topic1", "topic2"],
                    "key_quotes": ["memorable quote 1", "quote 2"],
                    "guest_info": "if applicable",
                    "takeaways": ["actionable takeaway1", "takeaway2"],
                    "tags": ["tag1", "tag2"]
                }}
                """
            }]
        )
        
        import json
        analysis = json.loads(response.content[0].text)
        analysis["duration"] = transcript["duration"]
        analysis["word_count"] = len(transcript["text"].split())
        
        return analysis
```

---

## 13.5 Multimodal Pipeline

```python
class DocumentIntelligencePipeline:
    """
    Complete pipeline: Scan → OCR → Extract → Classify → Store
    Use case: Tự động xử lý documents trong doanh nghiệp
    """
    
    def __init__(self):
        self.image_analyzer = ImageAnalyzer()
        self.doc_processor = DocumentProcessor()
    
    def process_document(self, file_path: str) -> dict:
        """Smart document processing"""
        
        # Step 1: Detect document type
        doc_type = self._detect_type(file_path)
        
        # Step 2: Extract based on type
        if doc_type == "invoice":
            data = self.doc_processor.process_invoice(file_path)
        elif doc_type == "id_card":
            data = self.doc_processor.process_id_document(file_path)
        elif doc_type == "chart":
            data = self.image_analyzer.analyze_chart(file_path)
        else:
            data = {
                "text": self.image_analyzer.extract_text(file_path),
                "description": self.image_analyzer.describe(file_path)
            }
        
        # Step 3: Validate và flag issues
        validation = self._validate(data, doc_type)
        
        return {
            "file": file_path,
            "document_type": doc_type,
            "extracted_data": data,
            "validation": validation,
            "confidence": self._calculate_confidence(data)
        }
    
    def _detect_type(self, image_path: str) -> str:
        prompt = """Classify document type: invoice/id_card/passport/chart/medical_report/contract/other
        One word only."""
        result = self.image_analyzer._analyze(image_path, prompt)
        return result.strip().lower().split()[0]
    
    def _validate(self, data: dict, doc_type: str) -> dict:
        issues = []
        
        if doc_type == "invoice":
            if not data.get("invoice_number"):
                issues.append("Missing invoice number")
            if not data.get("total") or data["total"] == 0:
                issues.append("Missing or zero total amount")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues
        }
    
    def _calculate_confidence(self, data: dict) -> float:
        """Estimate extraction confidence"""
        null_count = sum(1 for v in data.values() if v is None)
        total = len(data)
        return max(0, 1 - null_count / total) if total > 0 else 0

# Demo
pipeline = DocumentIntelligencePipeline()

result = pipeline.process_document("invoice_scan.jpg")
print(f"Type: {result['document_type']}")
print(f"Confidence: {result['confidence']:.0%}")
print(f"Valid: {result['validation']['valid']}")
if result['extracted_data'].get('total'):
    print(f"Total: {result['extracted_data']['total']:,.0f} VND")
```

---

## Tóm tắt chương

Multimodal Applications:
- **Image Analysis**: Describe, OCR, chart extraction, UI review, object detection
- **Document Processing**: Invoice, ID, medical reports
- **Video Analysis**: Upload → Transcribe → Summarize → Search (Gemini)
- **Audio**: Whisper STT, OpenAI TTS, podcast analysis
- **Pipeline**: Document intelligence end-to-end

---

*Chương tiếp theo: **Code Generation và Developer Tools***

---
---

# CHƯƠNG 14: CODE GENERATION VÀ DEVELOPER TOOLS

## Giới thiệu chương

Code generation là một trong những use cases mạnh nhất của LLMs. GitHub Copilot, Cursor, và các AI coding assistants đã thay đổi cách kỹ sư làm việc. Chương này xây dựng các developer tools AI-powered từ đầu.

---

## 14.1 Code Generation

```python
import anthropic

client = anthropic.Anthropic()

class CodeGenerator:
    """AI-powered code generator"""
    
    SYSTEM_PROMPT = """Bạn là senior software engineer expert.
    Khi viết code:
    - Luôn include type hints (Python) hoặc TypeScript types
    - Add docstrings/comments cho complex logic
    - Handle edge cases và errors
    - Follow best practices của language
    - Viết production-ready code, không prototype
    - Include unit tests nếu được yêu cầu"""
    
    def generate_function(self, description: str, language: str = "python",
                          include_tests: bool = True) -> dict:
        """Generate function từ description"""
        
        prompt = f"""
        Language: {language}
        
        Viết function theo description:
        {description}
        
        Requirements:
        - Full implementation, không placeholder
        - Type hints/annotations
        - Docstring với examples
        {'- Unit tests với pytest' if include_tests and language == 'python' else ''}
        
        Return JSON:
        {{
            "function_code": "...",
            "tests_code": "...",
            "usage_example": "...",
            "complexity": "O(...) time, O(...) space",
            "edge_cases_handled": ["case1", "case2"]
        }}
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=3000,
            system=self.SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )
        
        import json
        try:
            return json.loads(response.content[0].text)
        except:
            return {"function_code": response.content[0].text}
    
    def generate_api_endpoint(self, spec: dict, framework: str = "fastapi") -> str:
        """Generate REST API endpoint"""
        
        prompt = f"""
        Tạo {framework} API endpoint với spec sau:
        
        Method: {spec['method']}
        Path: {spec['path']}
        Description: {spec['description']}
        Request body: {spec.get('request_body', 'none')}
        Response: {spec.get('response', 'standard')}
        Auth required: {spec.get('auth', False)}
        
        Include:
        - Pydantic models cho request/response
        - Input validation
        - Error handling (400, 401, 404, 500)
        - Database operations (mock nếu cần)
        - OpenAPI docs string
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            system=self.SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def generate_from_tests(self, test_code: str, language: str = "python") -> str:
        """Test-Driven Development: Generate implementation từ tests"""
        
        prompt = f"""
        Implement code để pass các tests sau:
        
        ```{language}
        {test_code}
        ```
        
        Rules:
        - Implement chính xác để pass tất cả tests
        - Không modify tests
        - Minimal implementation, không over-engineer
        - Add edge case handling nếu tests cover chúng
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            system=self.SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

# Demo
generator = CodeGenerator()

# Generate a binary search function
result = generator.generate_function(
    description="Binary search trong sorted array. Return index hoặc -1 nếu không tìm thấy.",
    language="python",
    include_tests=True
)

print(result["function_code"])
print("\nTests:")
print(result["tests_code"])
print(f"\nComplexity: {result['complexity']}")
```

---

## 14.2 Code Review và Analysis

```python
class CodeReviewer:
    """Automated code review system"""
    
    REVIEWER_SYSTEM = """Bạn là senior code reviewer với 15+ năm kinh nghiệm.
    Review code nghiêm khắc nhưng constructive. Focus vào:
    1. Security vulnerabilities (OWASP Top 10)
    2. Performance issues
    3. Code quality và maintainability
    4. Best practices của language/framework
    5. Missing edge cases"""
    
    def review(self, code: str, language: str = "python",
               focus: list[str] = None) -> dict:
        """Full code review"""
        
        focus_areas = focus or ["security", "performance", "quality", "bugs"]
        
        prompt = f"""
        Review {language} code sau:
        
        ```{language}
        {code}
        ```
        
        Focus areas: {', '.join(focus_areas)}
        
        Return JSON:
        {{
            "overall_score": 1-10,
            "summary": "one paragraph summary",
            "critical_issues": [
                {{"issue": "...", "line": null, "fix": "...", "impact": "..."}}
            ],
            "warnings": [...],
            "suggestions": [...],
            "positives": ["what's good"],
            "refactored_code": "improved version if critical issues found"
        }}
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            system=self.REVIEWER_SYSTEM,
            messages=[{"role": "user", "content": prompt}]
        )
        
        import json
        try:
            return json.loads(response.content[0].text)
        except:
            return {"raw_review": response.content[0].text}
    
    def review_diff(self, old_code: str, new_code: str) -> str:
        """Review code diff/PR"""
        
        prompt = f"""
        Review thay đổi code này:
        
        BEFORE:
        ```
        {old_code}
        ```
        
        AFTER:
        ```
        {new_code}
        ```
        
        Analyze:
        1. Có introduce bugs không?
        2. Có cải thiện không?
        3. Breaking changes không?
        4. Test coverage đủ không?
        5. Approve, request changes, hay comment?
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            system=self.REVIEWER_SYSTEM,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def security_audit(self, code: str, language: str = "python") -> dict:
        """Deep security audit"""
        
        prompt = f"""
        Security audit code này theo OWASP Top 10:
        
        ```{language}
        {code}
        ```
        
        Check:
        - A01: Broken Access Control
        - A02: Cryptographic Failures
        - A03: Injection (SQL, Command, LDAP)
        - A04: Insecure Design
        - A05: Security Misconfiguration
        - A06: Vulnerable/Outdated Components
        - A07: Identification/Authentication Failures
        - A08: Software/Data Integrity Failures
        - A09: Security Logging Failures
        - A10: Server-Side Request Forgery
        
        JSON: [{{"vulnerability": "...", "owasp_category": "A0X", "severity": "critical/high/medium/low",
                  "line_hint": "...", "fix": "...", "example_attack": "..."}}]
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=3000,
            system=self.REVIEWER_SYSTEM,
            messages=[{"role": "user", "content": prompt}]
        )
        
        import json
        try:
            return json.loads(response.content[0].text)
        except:
            return []
```

---

## 14.3 Documentation Generator

```python
class DocGenerator:
    """Tự động tạo documentation từ code"""
    
    def generate_docstring(self, code: str, style: str = "google") -> str:
        """Generate docstring cho function/class"""
        
        styles = {
            "google": "Google style docstring",
            "numpy": "NumPy style docstring",
            "sphinx": "Sphinx/reST style docstring",
            "plain": "Simple plain text"
        }
        
        prompt = f"""
        Viết {styles.get(style, 'Google style')} docstring cho code này:
        
        {code}
        
        Include: description, Args, Returns, Raises, Examples.
        Return chỉ docstring (trong triple quotes), không cần code.
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def generate_readme(self, project_info: dict) -> str:
        """Generate README.md cho project"""
        
        prompt = f"""
        Tạo README.md chuyên nghiệp cho project:
        
        Project: {project_info['name']}
        Description: {project_info['description']}
        Tech stack: {project_info.get('tech_stack', 'Python')}
        Main features: {project_info.get('features', [])}
        
        Include:
        - Badges (build, coverage, license)
        - Table of Contents
        - Installation steps
        - Quick start với code examples
        - API reference summary
        - Contributing guide
        - License
        
        Format: Markdown với đầy đủ emojis và formatting đẹp.
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def generate_api_docs(self, openapi_spec: dict) -> str:
        """Generate API documentation từ OpenAPI spec"""
        
        import json
        prompt = f"""
        Generate beautiful API documentation từ OpenAPI spec:
        
        {json.dumps(openapi_spec, indent=2)[:3000]}
        
        Format: Markdown với:
        - Overview và authentication
        - Endpoints organized by tags
        - Request/response examples
        - Error codes table
        - Rate limiting info
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def add_docstrings_to_file(self, filepath: str) -> str:
        """Tự động thêm docstrings cho toàn bộ Python file"""
        import ast
        
        with open(filepath) as f:
            source = f.read()
        
        prompt = f"""
        Thêm Google-style docstrings cho tất cả functions/methods/classes chưa có docstring:
        
        ```python
        {source}
        ```
        
        Rules:
        - Chỉ thêm, không xóa code
        - Giữ nguyên indentation
        - Skip nếu đã có docstring
        Return: complete file với docstrings đã thêm.
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=6000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Save updated file
        updated_source = response.content[0].text
        if "```python" in updated_source:
            updated_source = updated_source.split("```python")[1].split("```")[0]
        
        with open(filepath, "w") as f:
            f.write(updated_source)
        
        return f"Updated {filepath} with docstrings"
```

---

## 14.4 Test Generation

```python
class TestGenerator:
    """Tự động generate test cases"""
    
    def generate_unit_tests(self, function_code: str,
                             test_framework: str = "pytest") -> str:
        """Generate comprehensive unit tests"""
        
        prompt = f"""
        Viết comprehensive unit tests cho:
        
        ```python
        {function_code}
        ```
        
        Framework: {test_framework}
        
        Include:
        1. Happy path tests
        2. Edge cases (empty, None, boundary values)
        3. Error cases (exceptions)
        4. Type tests nếu relevant
        5. Property-based tests (hypothesis) nếu phù hợp
        
        Use descriptive test names: test_function_name_when_condition_should_result()
        Mock external dependencies.
        Aim for 90%+ coverage.
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def generate_integration_tests(self, api_spec: str) -> str:
        """Generate API integration tests"""
        
        prompt = f"""
        Viết integration tests cho API:
        
        {api_spec}
        
        Include:
        - Happy path cho mỗi endpoint
        - Authentication tests
        - Validation error tests
        - Rate limiting tests
        - Database state verification
        
        Dùng pytest + httpx/requests. Mock external services.
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def generate_load_test(self, endpoint: str, expected_rps: int = 100) -> str:
        """Generate Locust load test script"""
        
        prompt = f"""
        Viết Locust load test cho:
        Endpoint: {endpoint}
        Expected RPS: {expected_rps}
        
        Include:
        - User behavior simulation
        - Realistic think times
        - Multiple test scenarios
        - Custom metrics
        """
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
```

---

## 14.5 Developer Copilot

```python
from fastapi import FastAPI
import subprocess
import tempfile
import os

app = FastAPI(title="AI Developer Copilot")
generator = CodeGenerator()
reviewer = CodeReviewer()
doc_gen = DocGenerator()
test_gen = TestGenerator()

@app.post("/generate/function")
async def generate_function_endpoint(
    description: str,
    language: str = "python",
    include_tests: bool = True
):
    return generator.generate_function(description, language, include_tests)

@app.post("/review/code")
async def review_code_endpoint(code: str, language: str = "python"):
    return reviewer.review(code, language)

@app.post("/review/security")
async def security_audit_endpoint(code: str, language: str = "python"):
    return reviewer.security_audit(code, language)

@app.post("/generate/tests")
async def generate_tests_endpoint(function_code: str):
    return {"tests": test_gen.generate_unit_tests(function_code)}

@app.post("/generate/docstring")
async def generate_docstring_endpoint(code: str, style: str = "google"):
    return {"docstring": doc_gen.generate_docstring(code, style)}

@app.post("/execute")
async def execute_code(code: str, language: str = "python"):
    """Safe code execution in sandbox"""
    if language != "python":
        return {"error": "Only Python supported"}
    
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write(code)
        temp_file = f.name
    
    try:
        result = subprocess.run(
            ["python3", temp_file],
            capture_output=True,
            text=True,
            timeout=30,
            cwd="/tmp"
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"error": "Execution timed out (30s)"}
    finally:
        os.unlink(temp_file)

@app.post("/debug")
async def debug_code(code: str, error: str, language: str = "python"):
    """AI debugging assistant"""
    
    prompt = f"""
    Debug code này:
    
    ```{language}
    {code}
    ```
    
    Error:
    ```
    {error}
    ```
    
    1. Root cause analysis
    2. Fixed code
    3. Explanation
    4. Prevention tips
    """
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"debug_response": response.content[0].text}
```

---

## Tóm tắt chương

Developer Tools với AI:
- **Code Generation**: Functions, API endpoints, TDD implementation
- **Code Review**: Security audit, diff review, OWASP check
- **Documentation**: Docstrings, README, API docs
- **Test Generation**: Unit, integration, load tests
- **Developer Copilot**: FastAPI backend tích hợp tất cả tools

---

*Chương tiếp theo: **Deployment và Infrastructure***
