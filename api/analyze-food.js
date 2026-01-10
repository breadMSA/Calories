// Vercel Serverless Function - AI Food Analysis API
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configure longer timeout for Vercel
export const config = {
    maxDuration: 60 // 60 seconds timeout
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Image data required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY not configured');
            return res.status(500).json({ error: 'API configuration error' });
        }

        // Initialize Gemini with gemini-2.5-flash model (fast and smart)
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 2048,  // Large enough for complete response
                temperature: 0.3
            }
        });

        // Improved prompt: MUST estimate, never return all zeros
        const prompt = `你是一位專業營養師。請分析這張食物照片並估算營養成分。

【最重要規則】
- 你必須根據食物的種類、份量、烹調方式來估算營養數值
- 絕對禁止回傳全部為 0 的數值！
- 即使沒有營養標示，也要根據你的營養學知識進行合理估算

【估算指引】
- 一碗白飯約 250kcal、5g 蛋白質
- 一份雞腿便當約 700-900kcal、30-40g 蛋白質
- 一杯手搖飲約 300-500kcal、0g 蛋白質、500ml 水分
- 一份泡麵約 400-500kcal、8-10g 蛋白質、1000-2000mg 鈉

【如果看到營養標示】
請精確讀取數值，保留小數點（如 2.8g 不要變成 2g）

【回覆格式】
只回傳 JSON，不要任何其他文字：
{"name": "食物名稱", "calories": 數字, "protein": 數字, "sodium": 數字, "water": 數字}

單位：calories=kcal, protein=g, sodium=mg, water=ml
非飲料的 water 填 0`;

        // Call Gemini Vision API
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: image
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // Parse JSON from response
        let nutritionData;
        try {
            // Extract JSON from response (might be wrapped in markdown code blocks)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                nutritionData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Parse error:', parseError, 'Response:', text);
            nutritionData = {
                name: '未知食物',
                calories: 0,
                protein: 0,
                sodium: 0,
                water: 0
            };
        }

        // Ensure all fields are present and valid (keep decimals with 1 decimal place)
        const sanitizedData = {
            name: String(nutritionData.name || '未知食物'),
            calories: Math.max(0, Math.round(parseFloat(nutritionData.calories) * 10) / 10 || 0),
            protein: Math.max(0, Math.round(parseFloat(nutritionData.protein) * 10) / 10 || 0),
            sodium: Math.max(0, Math.round(parseFloat(nutritionData.sodium) * 10) / 10 || 0),
            water: Math.max(0, Math.round(parseFloat(nutritionData.water) * 10) / 10 || 0)
        };

        return res.status(200).json(sanitizedData);

    } catch (error) {
        console.error('Analyze food error:', error);

        if (error.message?.includes('quota') || error.message?.includes('rate')) {
            return res.status(429).json({ error: 'API 配額已達上限，請稍後再試' });
        }

        return res.status(500).json({ error: '分析失敗，請稍後再試' });
    }
}
