# CHƯƠNG 11: AI AGENTS VÀ TOOL USE

## Giới thiệu chương

AI Agent là bước tiến hóa từ "chatbot trả lời" sang "AI thực hiện". Agents có thể lập kế hoạch, gọi tools, thực thi code, browse web, và hoàn thành tasks phức tạp một cách tự động. Đây là frontier của AI engineering năm 2024-2025.

---

## 11.1 Từ LLM đến Agent

```
LLM: Nhận input → Trả output (một lần)
     User: "Doanh thu Q3?" → "Tôi không có thông tin này"

Agent: Nhận task → Lập plan → Thực hiện steps → Trả kết quả
     User: "Doanh thu Q3?" 
     → Think: "Cần query database"
     → Action: query_db("SELECT SUM(revenue) FROM orders WHERE quarter=3")
     → Observe: $2.3M
     → Think: "Cần so sánh với Q2"
     → Action: query_db("SELECT SUM(revenue) FROM orders WHERE quarter=2")
     → Observe: $1.9M
     → Response: "Q3 đạt $2.3M, tăng 21% so với Q2 ($1.9M)"
```

---

## 11.2 Tool Definition và Execution

```python
import anthropic
import json
from typing import Any, Callable

class Tool:
    """Wrapper cho một tool function"""
    
    def __init__(self, name: str, description: str, 
                 function: Callable, parameters: dict):
        self.name = name
        self.description = description
        self.function = function
        self.parameters = parameters
        self.call_count = 0
        self.error_count = 0
    
    def to_anthropic_format(self) -> dict:
        """Convert sang format của Anthropic API"""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": self.parameters["properties"],
                "required": self.parameters.get("required", [])
            }
        }
    
    def execute(self, **kwargs) -> Any:
        self.call_count += 1
        try:
            result = self.function(**kwargs)
            return result
        except Exception as e:
            self.error_count += 1
            return f"Tool error: {str(e)}"

# Tool definitions
import subprocess
import sqlite3
import requests

def python_executor(code: str, timeout: int = 30) -> str:
    """Chạy Python code trong sandbox"""
    try:
        result = subprocess.run(
            ["python3", "-c", code],
            capture_output=True, text=True, timeout=timeout
        )
        if result.returncode == 0:
            return result.stdout or "(no output)"
        return f"Error: {result.stderr}"
    except subprocess.TimeoutExpired:
        return f"Timeout after {timeout}s"

def web_search(query: str, n_results: int = 5) -> str:
    """Search web với DuckDuckGo"""
    url = f"https://api.duckduckgo.com/?q={query}&format=json&no_redirect=1"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        results = data.get("RelatedTopics", [])[:n_results]
        return json.dumps([{
            "text": r.get("Text", ""),
            "url": r.get("FirstURL", "")
        } for r in results if "Text" in r])
    except Exception as e:
        return f"Search error: {e}"

def read_file(filepath: str) -> str:
    """Đọc file nội dung"""
    try:
        with open(filepath, 'r', errors='ignore') as f:
            content = f.read()
        return content[:10000]  # Limit
    except Exception as e:
        return f"File error: {e}"

def write_file(filepath: str, content: str) -> str:
    """Ghi nội dung vào file"""
    try:
        with open(filepath, 'w') as f:
            f.write(content)
        return f"Written {len(content)} chars to {filepath}"
    except Exception as e:
        return f"Write error: {e}"

# Tool registry
TOOLS = [
    Tool(
        name="run_python",
        description="Execute Python code. Returns stdout or error.",
        function=python_executor,
        parameters={
            "properties": {
                "code": {"type": "string", "description": "Python code to run"},
                "timeout": {"type": "integer", "description": "Timeout in seconds", "default": 30}
            },
            "required": ["code"]
        }
    ),
    Tool(
        name="web_search",
        description="Search the internet for current information.",
        function=web_search,
        parameters={
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "n_results": {"type": "integer", "description": "Number of results", "default": 5}
            },
            "required": ["query"]
        }
    ),
    Tool(
        name="read_file",
        description="Read contents of a file.",
        function=read_file,
        parameters={
            "properties": {
                "filepath": {"type": "string", "description": "Path to file"}
            },
            "required": ["filepath"]
        }
    ),
    Tool(
        name="write_file",
        description="Write content to a file.",
        function=write_file,
        parameters={
            "properties": {
                "filepath": {"type": "string", "description": "Path to file"},
                "content": {"type": "string", "description": "Content to write"}
            },
            "required": ["filepath", "content"]
        }
    ),
]
```

---

## 11.3 Agent Loop

```python
class ClaudeAgent:
    """General-purpose Claude agent"""
    
    def __init__(self, tools: list[Tool], system: str = "",
                 model: str = "claude-3-5-sonnet-20241022",
                 max_iterations: int = 20,
                 verbose: bool = True):
        self.client = anthropic.Anthropic()
        self.tools = {t.name: t for t in tools}
        self.tool_schemas = [t.to_anthropic_format() for t in tools]
        self.system = system or self._default_system()
        self.model = model
        self.max_iterations = max_iterations
        self.verbose = verbose
        self.execution_log = []
    
    def _default_system(self) -> str:
        return """Bạn là AI agent có khả năng sử dụng tools để hoàn thành tasks.

Approach:
1. Phân tích task cần làm gì
2. Chọn tool phù hợp
3. Thực thi và quan sát kết quả
4. Lặp lại cho đến khi hoàn thành
5. Báo cáo kết quả cuối cùng

Luôn verify kết quả trước khi báo cáo."""
    
    def run(self, task: str) -> str:
        """Run agent trên một task"""
        
        messages = [{"role": "user", "content": task}]
        
        if self.verbose:
            print(f"\n🤖 Agent starting task: {task[:100]}...")
            print("=" * 60)
        
        for iteration in range(self.max_iterations):
            # Call LLM
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.system,
                tools=self.tool_schemas,
                messages=messages
            )
            
            # Add response to messages
            messages.append({"role": "assistant", "content": response.content})
            
            # Check stop condition
            if response.stop_reason == "end_turn":
                # Extract final text response
                for block in response.content:
                    if hasattr(block, 'text'):
                        if self.verbose:
                            print(f"\n✅ Task complete after {iteration+1} iterations")
                        return block.text
                return "Task completed"
            
            # Process tool calls
            if response.stop_reason == "tool_use":
                tool_results = []
                
                for block in response.content:
                    if block.type == "tool_use":
                        tool_name = block.name
                        tool_input = block.input
                        
                        if self.verbose:
                            print(f"\n🔧 [{iteration+1}] Calling: {tool_name}")
                            print(f"   Input: {json.dumps(tool_input, ensure_ascii=False)[:200]}")
                        
                        # Execute tool
                        tool = self.tools.get(tool_name)
                        if tool:
                            result = tool.execute(**tool_input)
                        else:
                            result = f"Tool '{tool_name}' not found"
                        
                        if self.verbose:
                            result_preview = str(result)[:300]
                            print(f"   Result: {result_preview}")
                        
                        # Log execution
                        self.execution_log.append({
                            "iteration": iteration + 1,
                            "tool": tool_name,
                            "input": tool_input,
                            "result": str(result)[:500]
                        })
                        
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(result)
                        })
                
                messages.append({"role": "user", "content": tool_results})
        
        return f"Max iterations ({self.max_iterations}) reached"
    
    def get_stats(self) -> dict:
        """Thống kê về agent execution"""
        tool_usage = {}
        for log in self.execution_log:
            t = log["tool"]
            tool_usage[t] = tool_usage.get(t, 0) + 1
        
        return {
            "total_iterations": len(self.execution_log),
            "tool_usage": tool_usage,
            "tools_with_errors": {
                name: tool.error_count 
                for name, tool in self.tools.items() 
                if tool.error_count > 0
            }
        }
```

---

## 11.4 Specialized Agents

```python
class DataAnalysisAgent(ClaudeAgent):
    """Agent chuyên phân tích data"""
    
    def __init__(self):
        data_tools = TOOLS + [
            Tool(
                name="query_database",
                description="Run SQL query on analytics database (read-only)",
                function=self._query_db,
                parameters={
                    "properties": {
                        "sql": {"type": "string", "description": "SQL SELECT query"},
                    },
                    "required": ["sql"]
                }
            ),
            Tool(
                name="create_chart",
                description="Create visualization and save as PNG",
                function=self._create_chart,
                parameters={
                    "properties": {
                        "data": {"type": "string", "description": "JSON data"},
                        "chart_type": {"type": "string", "enum": ["bar", "line", "pie", "scatter"]},
                        "title": {"type": "string"},
                        "output_file": {"type": "string"}
                    },
                    "required": ["data", "chart_type", "title", "output_file"]
                }
            )
        ]
        
        super().__init__(
            tools=data_tools,
            system="""Bạn là Data Analyst AI. Khi được yêu cầu phân tích:
            1. Query database để lấy data cần thiết
            2. Dùng Python để phân tích và tính toán
            3. Tạo visualization phù hợp
            4. Viết executive summary với key insights
            5. Đưa ra recommendations cụ thể
            
            Luôn verify số liệu trước khi báo cáo."""
        )
    
    def _query_db(self, sql: str) -> str:
        # Mock DB query
        if "revenue" in sql.lower():
            return json.dumps({"Q1": 1500000, "Q2": 1900000, "Q3": 2300000})
        return "No data found"
    
    def _create_chart(self, data: str, chart_type: str, title: str, output_file: str) -> str:
        import matplotlib.pyplot as plt
        
        chart_data = json.loads(data)
        plt.figure(figsize=(10, 6))
        
        if chart_type == "bar":
            plt.bar(chart_data.keys(), chart_data.values())
        elif chart_type == "line":
            plt.plot(list(chart_data.keys()), list(chart_data.values()), marker='o')
        
        plt.title(title)
        plt.tight_layout()
        plt.savefig(output_file)
        plt.close()
        return f"Chart saved to {output_file}"

class CodeAgent(ClaudeAgent):
    """Agent chuyên viết và debug code"""
    
    def __init__(self, language: str = "python"):
        super().__init__(
            tools=TOOLS,
            system=f"""Bạn là {language} coding agent.
            
Approach:
1. Hiểu requirements
2. Plan solution
3. Write code
4. Run và test code
5. Fix bugs nếu có
6. Verify output correct
7. Refactor nếu cần

Best practices:
- Viết clean, readable code
- Add docstrings và comments
- Handle edge cases
- Write tests"""
        )

class ResearchAgent(ClaudeAgent):
    """Agent chuyên research"""
    
    def __init__(self):
        super().__init__(
            tools=[t for t in TOOLS if t.name in ["web_search", "run_python", "write_file"]],
            system="""Bạn là Research Agent chuyên thu thập và tổng hợp thông tin.

Process:
1. Tìm kiếm nhiều sources (ít nhất 3)
2. Cross-reference information để verify
3. Ghi chú sources
4. Tổng hợp findings
5. Viết report có structure

Output format: Executive Summary → Key Findings → Details → Sources"""
        )
```

---

## 11.5 Multi-Agent Systems

```python
class AgentOrchestrator:
    """Điều phối nhiều agents làm việc cùng nhau"""
    
    def __init__(self):
        self.agents = {
            "research": ResearchAgent(),
            "data": DataAnalysisAgent(),
            "code": CodeAgent(),
        }
        self.client = anthropic.Anthropic()
    
    def plan(self, complex_task: str) -> list[dict]:
        """Dùng LLM để lập kế hoạch và assign subtasks"""
        
        planning_prompt = f"""
        Complex task: {complex_task}
        
        Available agents:
        - research: Thu thập thông tin từ internet
        - data: Phân tích database và tạo charts
        - code: Viết và chạy code
        
        Chia task thành subtasks, mỗi subtask giao cho một agent.
        Format JSON:
        [
            {{"agent": "research", "task": "...", "output": "..."}},
            {{"agent": "data", "task": "...", "output": "...", "depends_on": 0}},
        ]
        """
        
        response = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=[{"role": "user", "content": planning_prompt}]
        )
        
        return json.loads(response.content[0].text)
    
    def execute(self, complex_task: str) -> str:
        """Execute multi-agent workflow"""
        
        subtasks = self.plan(complex_task)
        results = {}
        
        for i, subtask in enumerate(subtasks):
            agent_name = subtask["agent"]
            task = subtask["task"]
            
            # Check dependencies
            depends_on = subtask.get("depends_on")
            if depends_on is not None:
                prev_result = results.get(depends_on, "")
                task = f"{task}\n\nContext from previous step:\n{prev_result}"
            
            print(f"\n[{i+1}/{len(subtasks)}] {agent_name.upper()} agent: {task[:80]}...")
            
            agent = self.agents[agent_name]
            result = agent.run(task)
            results[i] = result
        
        # Synthesize
        synthesis_prompt = f"""
        Task: {complex_task}
        
        Results from agents:
        {json.dumps(results, indent=2)}
        
        Synthesize all results into a comprehensive final report.
        """
        
        final = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{"role": "user", "content": synthesis_prompt}]
        )
        
        return final.content[0].text

# Demo
orchestrator = AgentOrchestrator()
result = orchestrator.execute(
    "Phân tích thị trường AI tools năm 2024: "
    "tìm top 10 tools, phân tích pricing, "
    "viết Python script để visualize market share, "
    "tạo executive report cho CEO"
)
print(result)
```

---

## 11.6 Agent Safety

```python
class SafeAgent(ClaudeAgent):
    """Agent với safety guardrails"""
    
    DANGEROUS_OPERATIONS = [
        "rm -rf", "drop table", "delete from",
        "format", "sudo", "chmod 777"
    ]
    
    def __init__(self, tools: list[Tool], require_confirmation: bool = True):
        self.require_confirmation = require_confirmation
        super().__init__(tools=tools)
    
    def _is_dangerous(self, tool_name: str, tool_input: dict) -> bool:
        """Check nếu operation có thể nguy hiểm"""
        input_str = json.dumps(tool_input).lower()
        return any(op in input_str for op in self.DANGEROUS_OPERATIONS)
    
    def _confirm(self, tool_name: str, tool_input: dict) -> bool:
        """Xin phép user trước khi thực hiện dangerous operation"""
        print(f"\n⚠️  CONFIRMATION REQUIRED")
        print(f"Tool: {tool_name}")
        print(f"Input: {json.dumps(tool_input, indent=2)}")
        user_input = input("Proceed? (yes/no): ").strip().lower()
        return user_input in ["yes", "y"]
    
    def run(self, task: str) -> str:
        """Override với safety check"""
        
        messages = [{"role": "user", "content": task}]
        
        for iteration in range(self.max_iterations):
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.system,
                tools=self.tool_schemas,
                messages=messages
            )
            
            messages.append({"role": "assistant", "content": response.content})
            
            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, 'text'):
                        return block.text
            
            if response.stop_reason == "tool_use":
                tool_results = []
                
                for block in response.content:
                    if block.type == "tool_use":
                        # Safety check
                        if self._is_dangerous(block.name, block.input):
                            if self.require_confirmation:
                                if not self._confirm(block.name, block.input):
                                    result = "Operation cancelled by user"
                                else:
                                    tool = self.tools.get(block.name)
                                    result = tool.execute(**block.input) if tool else "Tool not found"
                            else:
                                result = "Dangerous operation blocked by safety policy"
                        else:
                            tool = self.tools.get(block.name)
                            result = tool.execute(**block.input) if tool else "Tool not found"
                        
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(result)
                        })
                
                messages.append({"role": "user", "content": tool_results})
        
        return "Max iterations reached"
```

---

## Tóm tắt chương

AI Agents:
- **Tool Definition**: JSON Schema cho Anthropic/OpenAI APIs
- **Agent Loop**: Think → Act → Observe → Repeat
- **Specialized Agents**: Data Analysis, Code, Research
- **Multi-Agent**: Orchestrator phân chia và điều phối subtasks
- **Safety**: Dangerous operation detection, human-in-the-loop

---

*Chương tiếp theo: **Fine-tuning và Custom Models***

---
---

# CHƯƠNG 12: FINE-TUNING VÀ CUSTOM MODELS

## Giới thiệu chương

Fine-tuning là quá trình điều chỉnh một pre-trained LLM cho domain hoặc task cụ thể. Khi nào nên fine-tune? Làm thế nào để chuẩn bị data? Các kỹ thuật PEFT/LoRA là gì? Chương này giải đáp tất cả.

---

## 12.1 Fine-tuning vs RAG vs Prompting

```python
DECISION_MATRIX = """
DÙNG PROMPTING KHI:
✅ Task standard, model đã biết
✅ Cần flexibility
✅ Development nhanh
✅ Budget hạn chế

DÙNG RAG KHI:
✅ Cần knowledge domain-specific, hay thay đổi
✅ Cần cite sources
✅ Knowledge base > vài MB
✅ Không muốn train

DÙNG FINE-TUNING KHI:
✅ Cần specific format/style nhất quán
✅ Task lặp đi lặp lại millions lần (cost)
✅ Domain quá specialized (y tế, pháp lý)
✅ Cần tốc độ tối đa (shorter prompts)
✅ Privacy: không muốn data qua prompt

DÙNG FULL TRAINING KHI:
✅ Foundation model không phù hợp
✅ Custom architecture cần
✅ Data khổng lồ của riêng bạn
✅ Budget hàng triệu USD
"""
```

---

## 12.2 Fine-tuning với OpenAI

```python
from openai import OpenAI
import json

client = OpenAI()

# 1. Chuẩn bị training data (JSONL format)
training_examples = [
    {
        "messages": [
            {"role": "system", "content": "Bạn là customer support agent của ShopVN."},
            {"role": "user", "content": "Đơn hàng #12345 của tôi ở đâu?"},
            {"role": "assistant", "content": "Chào bạn! Để tra cứu đơn #12345, vui lòng cho tôi biết email đặt hàng. Thường đơn hàng mất 3-5 ngày làm việc."}
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "Bạn là customer support agent của ShopVN."},
            {"role": "user", "content": "Tôi muốn đổi trả sản phẩm"},
            {"role": "assistant", "content": "Chính sách đổi trả của ShopVN: 30 ngày kể từ ngày nhận hàng. Sản phẩm cần còn nguyên tem, hộp. Vui lòng liên hệ 1800-xxxx để được hướng dẫn."}
        ]
    },
    # Cần ít nhất 10 examples, khuyến nghị 50-500+
]

# Ghi training file
def create_training_file(examples: list, filename: str = "training.jsonl"):
    with open(filename, "w") as f:
        for example in examples:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")
    return filename

# 2. Upload training file
def upload_training_data(filepath: str) -> str:
    with open(filepath, "rb") as f:
        response = client.files.create(file=f, purpose="fine-tune")
    print(f"File uploaded: {response.id}")
    return response.id

# 3. Create fine-tuning job
def create_finetuning_job(training_file_id: str, 
                           base_model: str = "gpt-4o-mini-2024-07-18") -> str:
    job = client.fine_tuning.jobs.create(
        training_file=training_file_id,
        model=base_model,
        hyperparameters={
            "n_epochs": 3,           # 3-10 epochs thường đủ
            "batch_size": "auto",    # OpenAI tự chọn
            "learning_rate_multiplier": "auto"
        },
        suffix="shopvn-support"  # Model name: gpt-4o-mini-...:shopvn-support
    )
    
    print(f"Fine-tuning job created: {job.id}")
    print(f"Status: {job.status}")
    return job.id

# 4. Monitor training
import time

def monitor_job(job_id: str):
    while True:
        job = client.fine_tuning.jobs.retrieve(job_id)
        print(f"Status: {job.status}")
        
        if job.status == "succeeded":
            print(f"✅ Model ready: {job.fine_tuned_model}")
            return job.fine_tuned_model
        
        elif job.status == "failed":
            print(f"❌ Training failed: {job.error}")
            return None
        
        # Show recent events
        events = client.fine_tuning.jobs.list_events(job_id, limit=5)
        for event in events.data:
            print(f"  [{event.created_at}] {event.message}")
        
        time.sleep(60)  # Check every minute

# 5. Use fine-tuned model
def use_finetuned_model(model_id: str, message: str) -> str:
    response = client.chat.completions.create(
        model=model_id,
        messages=[
            {"role": "system", "content": "Bạn là customer support agent của ShopVN."},
            {"role": "user", "content": message}
        ]
    )
    return response.choices[0].message.content
```

---

## 12.3 LoRA và PEFT

```python
"""
PEFT = Parameter-Efficient Fine-Tuning
Fine-tune chỉ một phần nhỏ parameters → nhanh hơn, rẻ hơn

LoRA (Low-Rank Adaptation):
- Thay vì update W (huge matrix), train ΔW = A × B
- A: (d × r), B: (r × k) với r << min(d, k)
- Rank r=8-16 thường đủ
- Giảm trainable params từ billions xuống millions

QLoRA (Quantized LoRA):
- LoRA + 4-bit quantization
- Chạy 65B model trên 1 GPU 48GB!
"""

from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
import torch

def setup_qlora_model(model_name: str = "meta-llama/Llama-3.1-8B"):
    """Setup model cho QLoRA fine-tuning"""
    
    # 4-bit quantization config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16
    )
    
    # Load quantized model
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto"
    )
    
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.pad_token = tokenizer.eos_token
    
    # Prepare for training
    model = prepare_model_for_kbit_training(model)
    
    # LoRA configuration
    lora_config = LoraConfig(
        r=16,                    # Rank
        lora_alpha=32,           # Alpha (usually 2*r)
        target_modules=[         # Layers to adapt
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj"
        ],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )
    
    # Apply LoRA
    model = get_peft_model(model, lora_config)
    
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"Trainable params: {trainable:,} ({100*trainable/total:.2f}%)")
    # Typical: 0.1-1% of total params!
    
    return model, tokenizer

def train_qlora(model, tokenizer, dataset, output_dir: str = "./finetuned"):
    from transformers import TrainingArguments, Trainer
    from trl import SFTTrainer
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        logging_steps=10,
        save_strategy="epoch",
        fp16=True,
        optim="paged_adamw_32bit",
        report_to="wandb"  # Track với Weights & Biases
    )
    
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        args=training_args,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=2048,
    )
    
    trainer.train()
    
    # Save LoRA adapter (nhỏ hơn nhiều so với full model)
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"Model saved to {output_dir}")
```

---

## 12.4 Data Preparation

```python
"""
Data quality > Data quantity

RULES:
- 100 high-quality examples > 1000 noisy examples
- Diversity quan trọng hơn volume
- Test set phải representative
- Remove duplicates
- Balance classes
"""

import json
from pathlib import Path

class DatasetBuilder:
    """Build fine-tuning dataset từ nhiều sources"""
    
    def __init__(self, system_prompt: str):
        self.system_prompt = system_prompt
        self.examples = []
    
    def add_example(self, user: str, assistant: str):
        self.examples.append({
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user},
                {"role": "assistant", "content": assistant}
            ]
        })
    
    def add_from_csv(self, csv_path: str, user_col: str, assistant_col: str):
        import csv
        with open(csv_path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row[user_col] and row[assistant_col]:
                    self.add_example(row[user_col], row[assistant_col])
    
    def add_from_conversations_db(self, db_path: str, 
                                    min_rating: int = 4):
        """Extract high-rated conversations từ DB"""
        import sqlite3
        conn = sqlite3.connect(db_path)
        
        rows = conn.execute("""
            SELECT user_message, bot_response 
            FROM conversations 
            WHERE rating >= ? AND length(bot_response) > 50
        """, (min_rating,)).fetchall()
        
        for user_msg, bot_resp in rows:
            self.add_example(user_msg, bot_resp)
        
        print(f"Added {len(rows)} examples from DB")
    
    def clean(self):
        """Remove low quality examples"""
        cleaned = []
        seen = set()
        
        for ex in self.examples:
            user = ex["messages"][1]["content"]
            assistant = ex["messages"][2]["content"]
            
            # Deduplication
            key = hash(user + assistant)
            if key in seen:
                continue
            seen.add(key)
            
            # Length filters
            if len(user) < 10 or len(assistant) < 20:
                continue
            
            # Quality: assistant shouldn't be too short for complex questions
            if len(user) > 100 and len(assistant) < 50:
                continue
            
            cleaned.append(ex)
        
        removed = len(self.examples) - len(cleaned)
        self.examples = cleaned
        print(f"Cleaned: removed {removed} examples, kept {len(self.examples)}")
    
    def split(self, train_ratio: float = 0.9) -> tuple:
        import random
        random.shuffle(self.examples)
        
        split_idx = int(len(self.examples) * train_ratio)
        return self.examples[:split_idx], self.examples[split_idx:]
    
    def save(self, train_path: str, val_path: str = None):
        train_data, val_data = self.split()
        
        with open(train_path, "w") as f:
            for ex in train_data:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")
        
        if val_path:
            with open(val_path, "w") as f:
                for ex in val_data:
                    f.write(json.dumps(ex, ensure_ascii=False) + "\n")
        
        print(f"Saved: {len(train_data)} train, {len(val_data)} val examples")
        return train_path, val_path

# Usage
builder = DatasetBuilder(
    system_prompt="Bạn là support agent của công ty ABC. Chuyên nghiệp, thân thiện."
)

builder.add_from_csv("support_tickets.csv", "question", "answer")
builder.add_from_conversations_db("chatbot.db", min_rating=4)
builder.clean()
builder.save("train.jsonl", "val.jsonl")
```

---

## 12.5 Evaluation

```python
class ModelEvaluator:
    """Đánh giá fine-tuned model"""
    
    def __init__(self, baseline_model: str, finetuned_model: str):
        self.baseline = baseline_model
        self.finetuned = finetuned_model
        self.client = OpenAI()
    
    def compare(self, test_cases: list[dict]) -> dict:
        """So sánh baseline vs fine-tuned"""
        
        baseline_scores = []
        finetuned_scores = []
        
        for case in test_cases:
            baseline_response = self._generate(self.baseline, case["user"])
            finetuned_response = self._generate(self.finetuned, case["user"])
            
            # LLM judge
            judge_prompt = f"""
            Task: {case['user']}
            Expected characteristics: {case.get('expected_style', 'helpful, accurate')}
            
            Response A: {baseline_response}
            Response B: {finetuned_response}
            
            Which is better? Consider: accuracy, style, helpfulness.
            Return JSON: {{"winner": "A" or "B", "reason": "...", "A_score": 1-10, "B_score": 1-10}}
            """
            
            judge = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": judge_prompt}]
            )
            
            result = json.loads(judge.choices[0].message.content)
            baseline_scores.append(result["A_score"])
            finetuned_scores.append(result["B_score"])
        
        return {
            "baseline_avg": sum(baseline_scores) / len(baseline_scores),
            "finetuned_avg": sum(finetuned_scores) / len(finetuned_scores),
            "improvement": (sum(finetuned_scores) - sum(baseline_scores)) / len(baseline_scores)
        }
    
    def _generate(self, model: str, user: str) -> str:
        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": user}]
        )
        return response.choices[0].message.content
```

---

## Tóm tắt chương

Fine-tuning:
- **When to fine-tune**: Style/format consistency, cost optimization, specialized domain
- **OpenAI Fine-tuning**: JSONL format, upload → job → deploy
- **LoRA/QLoRA**: Efficient fine-tuning với 1% parameters, 65B model on 1 GPU
- **Data preparation**: Quality > quantity, deduplication, length filters
- **Evaluation**: LLM-as-judge để compare baseline vs fine-tuned

---

*Chương tiếp theo: **Multimodal Applications***
