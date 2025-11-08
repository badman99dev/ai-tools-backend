// File: _lib/pdf-tool.js (Updated)
import fetch from 'node-fetch';
import { put } from '@vercel/blob';

// ... (यहाँ आपका पूरा masterPrompt कोड आएगा, जैसा आपने दिया था)
const masterPrompt = `You are an expert technical document developer... (यहाँ पूरा प्रॉम्प्ट पेस्ट करें)`;

export const callPdfTool = async (toolInput, db, userId, sessionId) => {
    if (!db || !userId || !sessionId) {
        throw new Error("Database connection, userId, and sessionId are required for pdf-tool.");
    }

    const sessionRef = db.collection('users').doc(userId).collection('history').doc(sessionId);
    const userRequestText = toolInput.prompt || toolInput.content_to_convert || "your document";
    
    try {
        console.log("[लॉग] Calling Gemini API...");
        const geminiPayload = {
            systemInstruction: { parts: [{ text: masterPrompt }] },
            contents: [{ parts: [{ text: `User's Request: "${userRequestText}"` }] }]
        };
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });
        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.json();
            throw new Error(`Gemini API Error: ${geminiResponse.status} ${JSON.stringify(errorBody)}`);
        }
        const geminiData = await geminiResponse.json();
        const generatedHtml = geminiData.candidates[0].content.parts[0].text.replace(/^```html\s*|```$/g, '').trim();

        console.log("[लॉग] Calling PDFShift API...");
        const pdfShiftResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
            method: 'POST',
            headers: { 'X-API-Key': process.env.PDFSHIFT_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ "source": generatedHtml, "sandbox": true })
        });
        if (!pdfShiftResponse.ok) {
            throw new Error(`PDFShift API Error: ${pdfShiftResponse.status} ${await pdfShiftResponse.text()}`);
        }
        const pdfBuffer = await pdfShiftResponse.buffer();

        console.log("[लॉग] Calling Vercel Blob to upload the PDF...");
        const blob = await put(`pdfs/${sessionId}-${Date.now()}.pdf`, pdfBuffer, { access: 'public' });
        const pdfUrl = blob.url;

        const successResult = {
            tool_name: 'pdf_generator',
            tool_input: toolInput,
            tool_output: `✅ PDF Created. Download link: ${pdfUrl}`,
            download_url: pdfUrl
        };

        await sessionRef.set({ tool_result: successResult }, { merge: true });
        
        return successResult;

    } catch (error) {
        console.error(`[PDF Tool] FATAL Error for session ${sessionId}:`, error);
        const errorResult = {
            tool_name: 'pdf_generator',
            tool_input: toolInput,
            tool_output: `❌ Error creating PDF: ${error.message}`
        };
        await sessionRef.set({ tool_result: errorResult }, { merge: true });
        throw new Error(errorResult.tool_output); 
    }
};
