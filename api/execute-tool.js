// File: api/execute-tool.js (Search-Only Version)

// सिर्फ search-tool को इम्पोर्ट करें
import { callSearchTool } from '../_lib/search-tool.js';

export default async (request, response) => {
    // CORS हेडर्स
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }
    
    // सिर्फ POST मेथड को अलाउ करें
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Only POST method is allowed' });
    }

    try {
        const { toolName, toolInput } = request.body;

        if (toolName !== 'web_search') {
             return response.status(400).json({ error: `This endpoint currently only supports the "web_search" tool.` });
        }
        
        if (!toolInput || !toolInput.query) {
            return response.status(400).json({ error: 'Request body must contain "toolInput" with a "query"' });
        }
        
        console.log(`[Tool Backend] Executing tool: ${toolName}`);
        
        // सीधे search tool को कॉल करें
        const toolResult = await callSearchTool(toolInput);
        
        console.log("[Tool Backend] Execution complete. Sending result back directly.");
        return response.status(200).json(toolResult);

    } catch (error) {
        console.error(`[execute-tool] FATAL Error:`, error.message);
        return response.status(500).json({ success: false, error: error.message });
    }
};
