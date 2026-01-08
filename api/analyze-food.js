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
                maxOutputTokens: 512,  // Enough for JSON with Chinese text
                temperature: 0.3       // Lower temperature for more consistent output
            }
        });

        // Simplified prompt for faster response
        const prompt = `分析這張食物照片的營養成分。

回覆格式（只回傳 JSON）：
{"name": "食物名稱", "calories": 熱量kcal, "protein": 蛋白質g, "sodium": 鈉mg, "water": 水分ml}

注意：
- 根據份量估算數值
- 非飲料 water 填 0
- 無法辨識則 name 填「未知食物」，數值為 0`;

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

        // Ensure all fields are present and valid
        const sanitizedData = {
            name: String(nutritionData.name || '未知食物'),
            calories: Math.max(0, parseInt(nutritionData.calories) || 0),
            protein: Math.max(0, parseInt(nutritionData.protein) || 0),
            sodium: Math.max(0, parseInt(nutritionData.sodium) || 0),
            water: Math.max(0, parseInt(nutritionData.water) || 0)
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
