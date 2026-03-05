
import handler from '../api/apsa.ts';
import * as dotenv from 'dotenv';
dotenv.config();

const req = {
    method: 'POST',
    body: {
        action: 'chat',
        message: 'I have a headache',
        history: []
    }
};

const res = {
    status: (code: number) => ({
        json: (data: any) => {
            console.log(`Response Status: ${code}`);
            console.log('Response Data:', JSON.stringify(data, null, 2));
            return res; // chainable
        },
        end: () => console.log(`Response Status: ${code} (End)`)
    }),
    setHeader: () => { },
};

console.log('Testing handler...');
(async () => {
    try {
        await handler(req as any, res as any);
    } catch (e) {
        console.error('Test script caught error:', e);
    }
})();
