
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_GENAI_API_KEY") or os.getenv("VITE_GOOGLE_API_KEY")
if not api_key:
    # Try looking in parent dir .env if not found
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    api_key = os.getenv("GOOGLE_GENAI_API_KEY")

print(f"Key found: {api_key[:5]}...{api_key[-5:] if api_key else 'None'}")

if not api_key:
    print("No API Key found")
else:
    genai.configure(api_key=api_key)
    print("Listing models...")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(m.name)
    except Exception as e:
        print(f"Error listing models: {e}")
