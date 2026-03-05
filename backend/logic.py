import json
import os
from typing import List, Dict, Any
from rapidfuzz import process, fuzz
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# --- Load Health Data ---
HEALTH_DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'health.json')

health_data = []
try:
    with open(HEALTH_DATA_PATH, 'r', encoding='utf-8') as f:
        health_data = json.load(f)
    print(f"Loaded {len(health_data)} health records.")
except Exception as e:
    print(f"Error loading health.json: {e}")
    health_data = []

def search_health_data(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search for relevant diseases using fuzzy matching (rapidfuzz).
    """
    if not health_data:
        return []
    
    # Create a list of strings to search against (combining disease name and symptoms)
    choices = [f"{item['disease_name']} {item['symptoms']}" for item in health_data]
    
    # Fuzzy search
    results = process.extract(query, choices, scorer=fuzz.WRatio, limit=limit)
    
    # Map back to original items
    relevant_items = []
    for _, score, index in results:
        if score > 50: # Threshold
            relevant_items.append(health_data[index])
            
    return relevant_items

# --- LangChain Setup ---
def get_llm():
    api_key = os.getenv("GOOGLE_GENAI_API_KEY")
    if not api_key:
        # Fallback to check if user put it in VITE_... by mistake or just GOOGLE_API_KEY
        api_key = os.getenv("VITE_GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
    
    if not api_key:
        raise ValueError("GOOGLE_GENAI_API_KEY is not set in environment variables.")
    
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", # Trying alternate model for quota reasons
        temperature=0.7,
        google_api_key=api_key
    )

async def process_chat_request(message: str, history: List[Dict[str, str]], current_symptoms: List[str]) -> Dict[str, Any]:
    
    # 1. Search for relevant health data (RAG context)
    search_query = f"{message} {' '.join(current_symptoms)}"
    relevant_docs = search_health_data(search_query)
    
    context_text = "\n\n".join([f"Disease: {d['disease_name']}\nSymptoms: {d['symptoms']}" for d in relevant_docs])

    # 2. Construct System Prompt
    system_prompt = f"""
    You are Dr.G, an AI medical assistant using real medical data to help users identify potential conditions.
    You are interacting with a user to understand their symptoms.

    **Context (Differential Diagnosis Candidates):**
    {context_text}

    **Current Known Symptoms:**
    {', '.join(current_symptoms) if current_symptoms else 'None'}

    **Task:**
    1. ANALYZE the user's latest message and extract any NEW symptoms mentioned.
    2. COMPARE the user's symptoms against the Context diseases.
    3. FORMULATE the next best question to ask the user to differentiate between the potential causes (Context). The question should be specific and relevant to narrowing down the possibilities.
    4. SUGGEST predictive answers (short phrases) the user might say in response (e.g., "Yes", "No", "High fever").

    **Output JSON Format (strict):**
    {{
      "extractedSymptoms": ["symptom1", "symptom2"],
      "nextQuestion": "Your question here...",
      "predictiveChips": ["Yes", "No", "Maybe"]
    }}
    """

    # 3. Convert History to LangChain format
    messages = [SystemMessage(content=system_prompt)]
    for turn in history:
        if turn['role'] == 'user':
            messages.append(HumanMessage(content=turn['content']))
        elif turn['role'] == 'model' or turn['role'] == 'assistant': # Handle both conventions
            messages.append(AIMessage(content=turn['content']))
    
    messages.append(HumanMessage(content=message))

    # 4. Generate Response
    try:
        llm = get_llm()
        response = llm.invoke(messages)
        content = response.content
        
        # Parse JSON
        # Remove markdown code blocks if present
        clean_text = content.replace("```json", "").replace("```", "").strip()
        result_json = json.loads(clean_text)
        
        return result_json

    except Exception as e:
        print(f"Error in LLM generation: {e}")
        # Fallback response in case of error
        return {
            "extractedSymptoms": [],
            "nextQuestion": "I'm having trouble connecting to my medical knowledge right now. Could you describe your symptoms again?",
            "predictiveChips": ["Retry"]
        }

async def categorize_symptoms_logic(history: List[Dict[str, str]]) -> Dict[str, Any]:
    prompt = """
    Based on our conversation, please summarize all the symptoms we've discussed. Categorize them into 'prominent', 'medium', and 'low' groups. For each symptom, provide a name, severity (1-5), duration, and notes. 
    
    Respond with ONLY valid JSON matching this structure:
    {
      "prominent": [{"name": "...", "severity": 5, "duration": "...", "notes": "..."}],
      "medium": [{"name": "...", "severity": 3, "duration": "...", "notes": "..."}],
      "low": [{"name": "...", "severity": 1, "duration": "...", "notes": "..."}]
    }
    """
    
    # Adapt history
    messages = [SystemMessage(content="You are Dr.G, an AI health companion.")]
    for turn in history:
        if turn['role'] == 'user':
            messages.append(HumanMessage(content=turn['content']))
        elif turn['role'] == 'model' or turn['role'] == 'assistant':
            messages.append(AIMessage(content=turn['content']))
            
    messages.append(HumanMessage(content=prompt))
    
    try:
        llm = get_llm()
        response = llm.invoke(messages)
        content = response.content
        clean_text = content.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Error in categorize_symptoms: {e}")
        raise e

async def generate_report_logic(history: List[Dict[str, str]], symptoms: Dict[str, Any]) -> Dict[str, Any]:
    from datetime import datetime
    today = datetime.now().strftime("%B %d, %Y")
    
    prompt = f"""
    Based on our conversation and the following confirmed list of symptoms, please generate the final reports.

    Confirmed Symptoms:
    {json.dumps(symptoms, indent=2)}

    Now, generate the following as a JSON object:
    1.  **userSummary**: A brief, easy-to-understand summary for the user in markdown format.
    2.  **clinicianReport**: A structured report for a clinician in markdown format.
    3.  **professionalReportHtml**: A complete HTML file. Populate placeholders like {{report_date}} (use {today}), {{overview_text}}, etc.

    Respond ONLY with valid JSON in this format:
    {{
      "userSummary": "...",
      "clinicianReport": "...",
      "professionalReportHtml": "..."
    }}
    """
    
    # Adapt history
    messages = [SystemMessage(content="You are Dr.G, an AI health companion.")]
    for turn in history:
        if turn['role'] == 'user':
            messages.append(HumanMessage(content=turn['content']))
        elif turn['role'] == 'model' or turn['role'] == 'assistant':
            messages.append(AIMessage(content=turn['content']))
            
    messages.append(HumanMessage(content=prompt))
    
    try:
        llm = get_llm()
        response = llm.invoke(messages)
        content = response.content
        clean_text = content.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Error in generate_report: {e}")
        raise e
