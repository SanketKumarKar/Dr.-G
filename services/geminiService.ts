import { GoogleGenAI, Chat, Type, GenerateContentResponse } from "@google/genai";
import { CategorizedSymptoms, Report } from '../types';

// Lazy client (avoid throwing on import so UI can recover / prompt for key)
let ai: GoogleGenAI | null = null;

const DEFAULT_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string) || 'gemini-2.5-flash';
const FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-pro',
];

export const configureApiKey = (key?: string): boolean => {
    const resolved = key || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined);
    const cleaned = resolved?.trim().replace(/^['"]|['"]$/g, '');
    console.log('Attempting to configure Gemini with key:', cleaned ? `${cleaned.substring(0, 10)}...` : 'undefined');
    if (!cleaned) return false;
    try {
        ai = new GoogleGenAI({ apiKey: cleaned });
        console.log('Gemini client configured successfully');
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
            description: "Critical, severe, red-flag, or high-signal symptoms central to the complaint. (Display as 'Critical')"
        },
        medium: {
            type: Type.ARRAY,
            items: symptomSchema,
            description: "Moderate, moderately specific or commonly associated symptoms. (Display as 'Moderate')"
        },
        low: {
            type: Type.ARRAY,
            items: symptomSchema,
            description: "Light, vague, non-specific, or low-confidence symptoms. (Display as 'Light')"
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
    if (!ai) throw new Error('Missing API key. Provide VITE_GEMINI_API_KEY in environment variables.');
    const candidates = [DEFAULT_MODEL, ...FALLBACK_MODELS.filter(m => m !== DEFAULT_MODEL)];
    let lastError: unknown;
    for (const model of candidates) {
        try {
            // systemInstruction is not supported in v1 API, use 'systemInstruction' as the first message instead
            return ai.chats.create({
                model,
                history: [{ role: 'user', parts: [{ text: DR_G_SYSTEM_PROMPT }] }],
            });
        } catch (err) {
            lastError = err;
            const msg = String((err as any)?.message || err);
            if (!/not found|unsupported|model|field/i.test(msg)) {
                throw err;
            }
        }
    }
    throw lastError || new Error('Unable to initialize chat session with available models.');
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
  <title>Dr.G Health Report</title>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand-primary: #4f46e5; /* Indigo 600 */
      --brand-secondary: #818cf8; /* Indigo 400 */
      --text-dark: #0f172a; /* Slate 900 */
      --text-medium: #334155; /* Slate 700 */
      --text-light: #64748b; /* Slate 500 */
      --bg-paper: #ffffff;
      --bg-subtle: #f8fafc; /* Slate 50 */
      --border-light: #e2e8f0; /* Slate 200 */
      --accent-critical: #ef4444;
      --accent-moderate: #f59e0b;
      --accent-light: #3b82f6;
    }
    body { 
      font-family: 'Inter', sans-serif; 
      color: var(--text-medium);
      background-color: #f1f5f9; 
      font-size: 10pt; 
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container { 
        max-width: 850px; 
        margin: 0 auto; 
        background: var(--bg-paper);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border-radius: 12px;
        overflow: hidden;
    }
    .header-bg {
        background: linear-gradient(135deg, var(--brand-primary), #4338ca);
        padding: 2.5rem 3rem;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .logo-container {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .logo-img {
        width: 48px;
        height: 48px;
        background: white;
        border-radius: 12px;
        padding: 4px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .report-title {
        font-family: 'Outfit', sans-serif;
        font-size: 28pt;
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.02em;
    }
    .report-subtitle {
        opacity: 0.9;
        font-size: 11pt;
        margin-top: 0.25rem;
        font-weight: 400;
    }
    .meta-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        padding: 1.5rem 3rem;
        background: var(--bg-subtle);
        border-bottom: 1px solid var(--border-light);
    }
    .meta-item {
        display: flex;
        flex-direction: column;
    }
    .meta-label {
        font-size: 8pt;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-light);
        font-weight: 600;
        margin-bottom: 0.25rem;
    }
    .meta-value {
        font-weight: 600;
        color: var(--text-dark);
        font-size: 10pt;
    }
    main {
        padding: 3rem;
    }
    .section { margin-bottom: 3rem; }
    .section-title { 
        font-family: 'Outfit', sans-serif;
        font-size: 16pt; 
        font-weight: 700; 
        color: var(--text-dark); 
        margin-bottom: 1.25rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .section-title::before {
        content: '';
        display: block;
        width: 6px;
        height: 24px;
        background: var(--brand-secondary);
        border-radius: 3px;
    }
    .card { 
        background-color: white; 
        border: 1px solid var(--border-light); 
        border-radius: 8px; 
        padding: 1.5rem; 
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .kv-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.75rem 2rem;
        align-items: baseline;
    }
    .kv-key { font-weight: 600; color: var(--text-light); min-width: 120px; }
    .kv-val { color: var(--text-dark); }
    
    .symptom-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 0.5rem; }
    .symptom-table th { 
        text-align: left; 
        padding: 0.75rem 1rem; 
        font-size: 9pt; 
        font-weight: 600; 
        color: var(--text-light);
        border-bottom: 2px solid var(--border-light);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .symptom-table td { 
        padding: 1rem; 
        border-bottom: 1px solid var(--border-light); 
        vertical-align: top;
    }
    .symptom-table tr:last-child td { border-bottom: none; }
    
    .severity-badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 8pt;
        font-weight: 700;
        text-transform: uppercase;
    }
    .sev-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .sev-moderate { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .sev-light { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

    .category-header {
        margin-top: 2rem;
        margin-bottom: 1rem;
        font-size: 12pt;
        font-weight: 600;
        color: var(--text-dark);
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--border-light);
    }
    
    .disclaimer-box {
        margin-top: 4rem;
        padding: 1.5rem;
        background-color: #fff7ed;
        border: 1px solid #fed7aa;
        border-radius: 8px;
        color: #9a3412;
        font-size: 9pt;
        display: flex;
        gap: 1rem;
        align-items: flex-start;
    }
    .disclaimer-icon { flex-shrink: 0; width: 24px; height: 24px; }

    @media print {
        body { background: white; padding: 0; }
        .page-container { box-shadow: none; max-width: 100%; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <header class="header-bg">
      <div>
        <h1 class="report-title">Dr.G Health Report</h1>
        <div class="report-subtitle">AI-Assisted Symptom Analysis</div>
      </div>
      <div class="logo-container">
        <img src="data:image/png;base64,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" alt="Dr.G Logo" class="logo-img" />
      </div>
    </header>
    
    <div class="meta-grid">
        <div class="meta-item">
            <span class="meta-label">Patient Name</span>
            <span class="meta-value">Provided by User</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Report Date</span>
            <span class="meta-value">{report_date}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Generated By</span>
            <span class="meta-value">Dr.G AI Health Companion</span>
        </div>
    </div>

    <main>
      <section class="section">
        <h2 class="section-title">History of Present Illness</h2>
        <div class="card">
            <p class="mb-4 text-base">{overview_text}</p>
            <div class="kv-grid">
                <span class="kv-key">Chief Complaint</span><span class="kv-val font-bold">{chief_complaint}</span>
                <span class="kv-key">Onset</span><span class="kv-val">{onset}</span>
                <span class="kv-key">Course</span><span class="kv-val">{course}</span>
            </div>
        </div>
        <div class="card mt-4 bg-amber-50 border-amber-200">
             <h3 class="text-amber-800 font-bold mb-2 text-sm uppercase tracking-wide">Triage & Safety Notes</h3>
             <p class="text-amber-900">{triage_notes}</p>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Symptom Review</h2>
        
        <div class="category-header text-red-600 border-red-200">Critical Symptoms</div>
        {prominent_symptoms_table}
        
        <div class="category-header text-amber-600 border-amber-200">Moderate Symptoms</div>
        {medium_symptoms_table}
        
        <div class="category-header text-blue-600 border-blue-200">Light Symptoms</div>
        {low_symptoms_table}
      </section>
      
      <section class="section">
        <h2 class="section-title">AI-Generated Notes for Clinician</h2>
        <div class="card">
            <div class="prose prose-sm max-w-none text-slate-700">
                {recommendations}
            </div>
        </div>
      </section>

      <div class="disclaimer-box">
        <svg xmlns="http://www.w3.org/2000/svg" class="disclaimer-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
            <strong>Important Disclaimer:</strong> This report is generated by an AI assistant based on a user-provided conversation. It does not constitute a medical diagnosis or treatment plan and is intended solely to facilitate discussion with a qualified healthcare professional. All information should be clinically correlated.
        </div>
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
    3.  **professionalReportHtml**: A complete, single HTML file based on the provided template. Populate all placeholders like {report_date}, {overview_text}, {chief_complaint}, {triage_notes}, and the symptom tables. The HTML must be fully formed and ready to render. The date is ${today}. Do NOT use placeholder text like '[Full Name]'. Instead, state something like 'Provided by user'. For the tables, generate full HTML '<table>...</table>' structures with the class 'symptom-table' and appropriate classes for rows based on severity (prominent, medium, low). IMPORTANT: The template has headers for 'Critical', 'Moderate', and 'Light' symptoms. Please ensure you put the 'prominent' symptoms under Critical, 'medium' under Moderate, and 'low' under Light. Ensure the generated HTML is valid and self-contained.

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