// File: _lib/search-tool.js
import fetch from 'node-fetch';

export const callSearchTool = async (toolInput) => {
    const serperApiKey = process.env.SERPER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!serperApiKey || !geminiApiKey) {
        throw new Error('SERPER_API_KEY or GEMINI_API_KEY is not set on the server.');
    }

    const payload = {
        query: toolInput.query,
        research_mode: toolInput.research_mode || 'deep',
        search_type: toolInput.search_type || 'search',
        num_results: toolInput.num_results || 20,
        serper_api_key: serperApiKey,
        gemini_api_key: geminiApiKey,
    };
    
    console.log(`[Search Tool] Calling Hugging Face Space for query: "${payload.query}"`);

    const response = await fetch('https://bk939448-websearch.hf.space/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Search Tool] Hugging Face service error: ${errorText}`);
        throw new Error(`Hugging Face service error! Status: ${response.status}.`);
    }

    const searchData = await response.json();
    console.log("[Search Tool] Search successful. Returning data directly.");
    
    return searchData; 
};
