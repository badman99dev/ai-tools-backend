// File: _lib/search-tool.js
// Version: Vercel Native - Replicates Python logic in a single JS file

import fetch from 'node-fetch';
import { extract } from '@extractus/article-extractor';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Prompts (Python वाले कोड से सीधे लिए गए) ---
const PROMPT_NORMAL = `
Based on the user's original query, provide a concise summary in shot form of the following text. Focus only on query releted information mention source url and Answer should be in correct order in timeline.
USER'S QUERY: "{query}"
TEXT TO SUMMARIZE:
---
{context_text}
---
`;

const PROMPT_DEEP = `
As a meticulous research analyst, your task is to synthesize the information from the provided web search results into a maximum detailed and comprehensive report.
**Current Date:** {current_date}.
**VERY IMPORTANT:** Your top priority is to provide information relevant to this current date and the future. If the user's query is about a recurring event (like an exam), you MUST focus on the upcoming or current event.
**User's Original Query:** "{query}"
**Instructions:**
1.You are a researcher who does deep research on the query and explains in detail without leaving any topic and adds as much detail in the explanation as possible which is given in the web page.
2.You do not have to give your opinion, you only have to speak according to the source. You also have to tell in your answers from which source you got the information and you have to give that too.
3.  In the result, give only query related details which are completely different from the topic of the query, ignore them and make a summary in the detailed summary in the order of the timeline. .
**Provided Search Results:**
---
{context_text}
---
`;

/**
 * वेब सर्च करता है, कंटेंट निकालता है, और Gemini से सारांश बनाता है।
 * @param {object} toolInput - टूल का इनपुट।
 * @returns {Promise<object>} एक JSON ऑब्जेक्ट जिसमें अंतिम रिपोर्ट है।
 */
export const callSearchTool = async (toolInput) => {
    // एनवायरनमेंट वेरिएबल्स से कीज़ (keys) प्राप्त करें
    const serperApiKey = process.env.SERPER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!serperApiKey || !geminiApiKey) {
        throw new Error('SERPER_API_KEY and GEMINI_API_KEY must be set on the server.');
    }

    const {
        query,
        search_type = 'search',
        num_results = 10,
        research_mode = 'deep',
        gemini_model = 'gemini-2.5-flash-lite'
    } = toolInput;

    try {
        // === स्टेप 1: Serper API से वेब सर्च करें ===
        console.log(`[Search Tool] Searching Serper for query: "${query}"`);
        const endpoint = search_type === 'news' ? 'https://google.serper.dev/news' : 'https://google.serper.dev/search';
        const searchPayload = { q: query, num: Math.max(1, Math.min(20, num_results)) };
        
        const serperResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(searchPayload)
        });

        if (!serperResponse.ok) {
            throw new Error(`Serper API error! Status: ${serperResponse.status}`);
        }
        const searchResults = await serperResponse.json();
        const items = searchResults[search_type === 'news' ? 'news' : 'organic'] || [];

        if (items.length === 0) {
            return { result: `No ${search_type} results found for '${query}'.` };
        }

        // === स्टेप 2: URLs से कंटेंट निकालें ===
        console.log(`[Search Tool] Extracting content from ${items.length} URLs.`);
        const extractionPromises = items.map(item => extract(item.link).catch(err => null)); // एरर होने पर null रिटर्न करें
        const articles = await Promise.all(extractionPromises);

        let contextText = "";
        let successfulExtractions = 0;
        for (let i = 0; i < items.length; i++) {
            const article = articles[i];
            if (article && article.content) {
                successfulExtractions++;
                const item = items[i];
                const domain = new URL(item.link).hostname.replace('www.', '');
                contextText += `## ${article.title || item.title}\n**Domain:** ${domain}\n**URL:** ${item.link}\n\n${article.content.trim()}\n\n---\n\n`;
            }
        }

        if (successfulExtractions === 0) {
            return { result: "Found search results, but could not extract content from any page." };
        }
        console.log(`[Search Tool] Successfully extracted content from ${successfulExtractions}/${items.length} URLs.`);
        
        // === स्टेप 3: Gemini API से सारांश बनाएँ ===
        console.log(`[Search Tool] Summarizing with Gemini using '${research_mode}' mode.`);
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: gemini_model });

        const currentDate = new Date().toISOString().split('T')[0];
        const promptTemplate = research_mode === 'deep' ? PROMPT_DEEP : PROMPT_NORMAL;
        
        // प्रॉम्प्ट में वेरिएबल्स बदलें
        let prompt = promptTemplate.replace('{query}', query)
                                   .replace('{context_text}', contextText)
                                   .replace('{current_date}', currentDate);

        const geminiResult = await model.generateContent(prompt);
        const response = await geminiResult.response;
        const summary = response.text();

        // अंतिम नतीजा JSON फॉर्मेट में भेजें, जैसा Hugging Face करता था
        return { result: summary };

    } catch (error) {
        console.error(`[Search Tool] FATAL Error:`, error);
        // एक उपयोगी एरर मैसेज भेजें
        return { result: `An error occurred: ${error.message}` };
    }
};
