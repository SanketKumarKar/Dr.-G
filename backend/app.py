from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from logic import process_chat_request

# Load environment variables from the root .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    action: str
    message: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = []
    currentSymptoms: Optional[List[str]] = []

@app.post("/api/apsa")
async def chat_endpoint(request: ChatRequest):
    if request.action != 'chat':
        raise HTTPException(status_code=400, detail="Invalid action")
    
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")

    try:
        response = await process_chat_request(
            message=request.message,
            history=request.history,
            current_symptoms=request.currentSymptoms
        )
        return response
    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/categorize")
async def categorize_endpoint(request: ChatRequest):
    try:
        from logic import categorize_symptoms_logic
        response = await categorize_symptoms_logic(history=request.history)
        return response
    except Exception as e:
        print(f"Error processing categorization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ReportRequest(BaseModel):
    history: List[Dict[str, str]]
    symptoms: Dict[str, Any]

@app.post("/api/report")
async def report_endpoint(request: ReportRequest):
    try:
        from logic import generate_report_logic
        response = await generate_report_logic(history=request.history, symptoms=request.symptoms)
        return response
    except Exception as e:
        print(f"Error processing report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
