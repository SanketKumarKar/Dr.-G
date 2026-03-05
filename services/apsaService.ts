
export interface APSAResponse {
    extractedSymptoms: string[];
    nextQuestion: string;
    predictiveChips: string[];
}

export interface ChatMessage {
    role: 'user' | 'model'; // Gemini roles
    content: string;
}

export const sendMessageToAPSA = async (
    message: string,
    history: ChatMessage[],
    currentSymptoms: string[]
): Promise<APSAResponse> => {
    try {
        const response = await fetch('/api/apsa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'chat',
                message,
                history,
                currentSymptoms,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to communicate with APSA backend');
        }

        const data: APSAResponse = await response.json();
        return data;
    } catch (error) {
        console.error('APSA Service Error:', error);
        throw error;
    }
};

export const getCategorizedSymptoms = async (history: ChatMessage[]) => {
    const response = await fetch('/api/categorize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'categorize', // Field not strictly needed by backend but harmless
            history,
        }),
    });
    if (!response.ok) throw new Error('Failed to categorize symptoms');
    return await response.json();
};

export const generateFinalReport = async (history: ChatMessage[], symptoms: any) => {
    const response = await fetch('/api/report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            history,
            symptoms,
        }),
    });
    if (!response.ok) throw new Error('Failed to generate report');
    return await response.json();
};
