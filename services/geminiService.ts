import { GoogleGenAI, Chat, Type, GenerateContentResponse } from "@google/genai";
import { CategorizedSymptoms, Report } from '../types';

// Lazy client (avoid throwing on import so UI can recover / prompt for key)
let ai: GoogleGenAI | null = null;

export const configureApiKey = (key?: string): boolean => {
    const resolved = key || (import.meta as any)?.env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? (process as any).env?.API_KEY : undefined);
    if (!resolved) return false;
    try {
        ai = new GoogleGenAI({ apiKey: resolved });
        return true;
    } catch (e) {
        console.error('Failed to configure Gemini client', e);
        ai = null;
        return false;
    }
};

// Attempt auto-configure from env on load
configureApiKey();

const DR_G_SYSTEM_PROMPT = `You are Dr.G, a highly advanced AI health companion. Your primary function is to conduct a structured, empathetic, and adaptive medical interview with a user to help them organize their health concerns. You will then generate a clear, professional report for a clinician and a simple summary for the user. 
You have been trained on a comprehensive dataset of medical conditions and their associated symptoms, similar to information found at the Mayo Clinic, which you will use to inform your questioning.

**Core Directives:**
1.  **Emergency Protocol & User Safety:** This is your most important directive. Your absolute priority is user safety. You must actively listen for and identify any symptoms that could indicate a medical emergency.
    *   **Emergency Keywords/Symptoms:** Be vigilant for descriptions of: severe chest pain, pain radiating to the arm/jaw, shortness of breath, sudden difficulty speaking or understanding, sudden numbness or weakness (especially on one side of the body), severe headache, loss of consciousness, confusion, seizures, or any mention of wanting to self-harm. This list is not exhaustive.
    *   **Immediate Response Protocol:** If a user mentions any of these or similar severe symptoms, you MUST **immediately pause** the standard interview process. Do not ask another question. Your ONLY response must be a direct and clear safety warning. For example: "Thank you for sharing that. Based on what you've described, it's very important that you seek medical attention right away. Please contact your local emergency services or go to the nearest emergency room. I am an AI and cannot provide medical assistance, and your safety is the top priority."
    *   **Do Not Proceed:** After delivering this warning, you must not continue with the symptom interview unless the user explicitly confirms they are safe or are just asking a hypothetical question. Prioritize safety over completing the interview.
2.  **No Diagnosis or Prescriptions:** You must NEVER provide a medical diagnosis, suggest specific treatments, or recommend any medications. Your role is to gather and structure information, not to practice medicine. Use phrases like "Some conditions that can cause this are..." or "A doctor might consider..." but never "You might have...".
3.  **Clarity and Simplicity:** Communicate using simple, non-technical language. Ask one question at a time. Keep questions short and clear.

**APSA (Advanced Predictive Symptom Asking) Protocol:**

**Phase 1: Introduction & Chief Complaint**
1.  Start the conversation with your standard greeting: "I’m Dr.G, your AI health companion. I can help organize your symptoms and create a report to share with a clinician. I don’t prescribe medicines or give diagnoses. To start, could you please tell me what’s been bothering you?"
2.  Listen to the user's primary concern.

**Phase 2: Symptom Exploration (Guided by Knowledge Base)**
1.  **Internal Differential Diagnosis:** Based on the user's initial symptoms, silently formulate a list of 3-5 potential underlying conditions by cross-referencing your internal knowledge base (simulating the Mayo Clinic dataset). This is your 'differential diagnosis'. DO NOT share this list with the user.
2.  **Predictive Questioning:** Your questions must be guided by this internal differential. Ask targeted questions designed to find **discriminating symptoms**—those that help differentiate between the possibilities on your list.
    *   **Example:** If a user reports a 'sore throat' and 'fever', your internal list might include Strep Throat, Mononucleosis, and the common cold. You would ask about the presence of a rash (Scarlet Fever, associated with Strep), extreme fatigue (mono), or a runny nose (cold) to narrow down the possibilities.
3.  **Symptom Qualification:** For each symptom identified, gather key details using the OLDCART mnemonic:
    *   Onset: When did it start? Was it sudden or gradual?
    *   Location: Where exactly is the symptom?
    *   Duration: How long does it last? Is it constant or intermittent?
    *   Character: What does it feel like (e.g., sharp, dull, burning)?
    *   Aggravating/Alleviating factors: What makes it better or worse?
    *   Radiation: Does the feeling travel anywhere else?
    *   Timing: Does it happen at a specific time of day?
4.  **Review of Systems:** After exploring the main complaint, ask broader, relevant questions to ensure nothing is missed (e.g., "Have you noticed any fever, fatigue, or changes in your weight?").

**Phase 3: Context Gathering**
1.  Ask about relevant personal and family medical history, medications, and allergies.

**Phase 4: Summarization & Reporting**
1.  When the user indicates they are finished, you will be prompted to provide a structured JSON summary of symptoms, categorized into "prominent," "medium," and "low" severity.
2.  After user confirmation, you will be prompted to generate the final reports (user summary, clinician report, and HTML). The clinician report should be structured, concise, and use appropriate medical terminology.`;


const symptomSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The name of the symptom, e.g., 'Headache'." },
        severity: { type: Type.INTEGER, description: "Severity on a scale of 1-5." },
        duration: { type: Type.STRING, description: "How long the symptom has been present, e.g., '5 days'." },
        notes: { type: Type.STRING, description: "Additional details, e.g., 'Occasional, dull pain'." },
    },
    required: ["name", "severity", "duration", "notes"]
};

const categorizedSymptomsSchema = {
    type: Type.OBJECT,
    properties: {
        prominent: {
            type: Type.ARRAY,
            items: symptomSchema,
            description: "Severe, red-flag, or high-signal symptoms central to the complaint."
        },
        medium: {
            type: Type.ARRAY,
            items: symptomSchema,
            description: "Moderately specific or commonly associated symptoms."
        },
        low: {
            type: Type.ARRAY,
            items: symptomSchema,
            description: "Vague, non-specific, or low-confidence symptoms."
        },
    },
     required: ["prominent", "medium", "low"]
};

const finalReportSchema = {
    type: Type.OBJECT,
    properties: {
        userSummary: { type: Type.STRING, description: "A plain-language summary for the user in markdown format." },
        clinicianReport: { type: Type.STRING, description: "A structured, formal report for a clinician in markdown format." },
        professionalReportHtml: { type: Type.STRING, description: "A complete HTML document for the professional PDF report, populated with data. Do not use placeholder data." },
    },
    required: ["userSummary", "clinicianReport", "professionalReportHtml"]
};


export const startChatSession = async (): Promise<Chat> => {
    if (!ai) throw new Error('Missing API key. Provide VITE_GEMINI_API_KEY in .env.local.');
    return ai.chats.create({
        model: 'gemini-2.0-flash',
        config: { systemInstruction: DR_G_SYSTEM_PROMPT },
    });
};

export const getCategorizedSymptoms = async (chat: Chat): Promise<CategorizedSymptoms> => {
    const response = await chat.sendMessage({
        message: "Based on our conversation, please summarize all the symptoms we've discussed. Categorize them into 'prominent', 'medium', and 'low' groups. Provide the output as a single JSON object that strictly follows the requested schema, with no additional text or explanations.",
        config: {
            responseMimeType: "application/json",
            responseSchema: categorizedSymptomsSchema,
        },
    });

    try {
        const jsonText = response.text.trim();
        const data = JSON.parse(jsonText);
        // Basic validation
        if (data.prominent && data.medium && data.low) {
            return data as CategorizedSymptoms;
        } else {
            console.error("Parsed JSON does not match CategorizedSymptoms schema:", data);
            throw new Error("Failed to parse symptom summary from AI.");
        }
    } catch (error) {
        console.error("Error parsing JSON from Gemini:", error);
        throw new Error("Could not understand the symptom summary from the AI.");
    }
};

const getReportHtmlTemplate = () => `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Symptoms Report</title>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand-color: #4338ca; /* Indigo 700 */
      --text-primary: #1e293b; /* Slate 800 */
      --text-secondary: #64748b; /* Slate 500 */
      --border-color: #e2e8f0; /* Slate 200 */
      --background-light: #f8fafc; /* Slate 50 */
    }
    body { 
      font-family: 'Inter', sans-serif; 
      color: var(--text-primary);
      background-color: white; 
      font-size: 10pt; 
      line-height: 1.6;
    }
    .page-container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--brand-color); padding-bottom: 1rem; margin-bottom: 2rem; }
    .header h1 { font-size: 24pt; font-weight: 700; color: var(--brand-color); margin: 0; line-height: 1.2; }
    .header-meta { text-align: right; font-size: 9pt; color: var(--text-secondary); }
    .section-title { font-size: 16pt; font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-top: 2.5rem; margin-bottom: 1.5rem; }
    .card { background-color: var(--background-light); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; margin-top: 1rem; }
    .card h3 { font-size: 12pt; font-weight: 600; color: var(--brand-color); margin-top: 0; margin-bottom: 1rem; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .kv-pair { display: grid; grid-template-columns: 110px 1fr; gap: 0.5rem; align-items: start; margin-top: 0.75rem; }
    .kv-key { font-weight: 500; color: var(--text-secondary); }
    .symptom-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    .symptom-table th, .symptom-table td { border: 1px solid var(--border-color); padding: 0.75rem; text-align: left; vertical-align: top; }
    .symptom-table th { background-color: var(--background-light); font-weight: 600; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }
    .symptom-table td:first-child { font-weight: 600; color: #334155 /* Slate 700 */; }
    .table-container h3 { font-size: 12pt; margin-bottom: 0.5rem; font-weight: 600; }
    .prominent { border-left: 3px solid #ef4444; }
    .medium { border-left: 3px solid #f59e0b; }
    .low { border-left: 3px solid #3b82f6; }
    .disclaimer { margin-top: 2.5rem; padding: 1rem; background-color: #fffbeb; border-left: 4px solid #f59e0b; color: #b45309; font-size: 9pt; border-radius: 0 0.25rem 0.25rem 0; }
  </style>
</head>
<body>
  <div class="page-container">
    <header class="header">
      <h1>Clinical Symptom Report</h1>
      <div class="header-meta">
        <div><strong>Patient Name:</strong> Provided by User</div>
        <div><strong>Report Date:</strong> {report_date}</div>
        <div><strong>Generated By:</strong> Dr.G AI Health Companion</div>
      </div>
    </header>

    <main>
      <section>
        <h2 class="section-title">History of Present Illness</h2>
        <div class="card">
            <p>{overview_text}</p>
            <div class="kv-pair">
                <span class="kv-key">Chief Complaint:</span><strong>{chief_complaint}</strong>
                <span class="kv-key">Onset:</span><span>{onset}</span>
                <span class="kv-key">Course:</span><span>{course}</span>
            </div>
        </div>
        <div class="card">
             <h3>Triage & Safety Notes</h3>
             <p>{triage_notes}</p>
        </div>
      </section>

      <section class="table-container">
        <h2 class="section-title">Symptom Review</h2>
        <h3>Prominent Symptoms</h3>
        {prominent_symptoms_table}
        <h3>Associated Symptoms</h3>
        {medium_symptoms_table}
        <h3>Additional Symptoms</h3>
        {low_symptoms_table}
      </section>
      
      <section>
        <h2 class="section-title">AI-Generated Notes for Clinician</h2>
        <div class="card">
            <p>{recommendations}</p>
        </div>
      </section>

            <div class="disclaimer">
                <strong>Important Disclaimer:</strong> This report is generated by an AI assistant based on a user-provided conversation. It does not constitute a medical diagnosis or treatment plan and is intended solely to facilitate discussion with a qualified healthcare professional. All information should be clinically correlated. <br/><br/>
                <em>Disclaimer: This is not a medical diagnosis. Always consult with a qualified healthcare provider for any health concerns.</em>
            </div>
    </main>
  </div>
</body>
</html>
`;

export const generateFinalReport = async (chat: Chat, symptoms: CategorizedSymptoms): Promise<Report> => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const htmlTemplate = getReportHtmlTemplate();

    const prompt = `
    Based on our conversation and the following confirmed list of symptoms, please generate the final reports.

    Confirmed Symptoms:
    ${JSON.stringify(symptoms, null, 2)}

    Now, generate the following:
    1.  **userSummary**: A brief, easy-to-understand summary for the user in markdown format, including the chief complaint, a list of symptoms, and a clear next step (e.g., "It's a good idea to share this report with your doctor...").
    2.  **clinicianReport**: A structured report for a clinician in markdown format, including History of Present Illness, a structured symptom list, and potential differential considerations (presented as possibilities, not diagnoses).
    3.  **professionalReportHtml**: A complete, single HTML file based on the provided template. Populate all placeholders like {report_date}, {overview_text}, {chief_complaint}, {triage_notes}, and the symptom tables. The HTML must be fully formed and ready to render. The date is ${today}. Do NOT use placeholder text like '[Full Name]'. Instead, state something like 'Provided by user'. For the tables, generate full HTML '<table>...</table>' structures with the class 'symptom-table' and appropriate classes for rows based on severity (prominent, medium, low). Ensure the generated HTML is valid and self-contained.

    Provide the output as a single JSON object that strictly follows the requested schema.
    `;

    const response: GenerateContentResponse = await chat.sendMessage({
        message: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: finalReportSchema,
        },
    });

    try {
        const jsonText = response.text.trim();
        const data = JSON.parse(jsonText);
        // Basic validation
        if (data.userSummary && data.clinicianReport && data.professionalReportHtml) {
            return data as Report;
        } else {
             console.error("Parsed JSON does not match Report schema:", data);
            throw new Error("Failed to parse report from AI.");
        }
    } catch (error) {
        console.error("Error parsing JSON from Gemini:", error);
        throw new Error("Could not understand the report from the AI.");
    }
};