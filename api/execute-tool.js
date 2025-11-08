// File: api/execute-tool.js (Updated)
import { callSearchTool } from '../_lib/search-tool.js';
import { callPdfTool } from '../_lib/pdf-tool.js';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const db = admin.firestore();

export default async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }
    
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Only POST method is allowed' });
    }

    try {
        const { toolName, toolInput, userId, sessionId } = request.body;

        if (!toolName || !toolInput) {
            return response.status(400).json({ error: 'Request body must contain "toolName" and "toolInput"' });
        }
        
        let toolResult;

        switch (toolName) {
            case 'web_search':
                console.log(`[Tool Backend] Executing tool: ${toolName}`);
                toolResult = await callSearchTool(toolInput);
                break;
            
            case 'pdf_generator':
                if (!userId || !sessionId) {
                    return response.status(400).json({ error: 'For "pdf_generator", "userId" and "sessionId" are required.' });
                }
                console.log(`[Tool Backend] Executing tool: ${toolName}`);
                toolResult = await callPdfTool(toolInput, db, userId, sessionId); 
                break;

            default:
                console.error(`[Tool Backend] Unknown tool requested: ${toolName}`);
                return response.status(400).json({ error: `Unknown tool: "${toolName}"` });
        }

        console.log("[Tool Backend] Execution complete. Sending result back directly.");
        return response.status(200).json(toolResult);

    } catch (error) {
        console.error(`[execute-tool] FATAL Error:`, error.message);
        return response.status(500).json({ success: false, error: error.message });
    }
};
