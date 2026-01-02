// Vercel Serverless Function - AI Food Analysis API
import { GoogleGenerativeAI } from '@google/generative-ai';

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

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Prepare prompt
        const prompt = `分析這張食物照片，估算其營養成分。

請以 JSON 格式回覆，包含以下欄位：
- name: 食物名稱（繁體中文）
- calories: 估計熱量（kcal，整數）
- protein: 估計蛋白質（公克，整數）
- sodium: 估計鈉含量（毫克，整數）
- water: 如果是飲料，估計水分含量（毫升，整數），否則為 0

注意事項：
1. 請根據照片中食物的份量估算
2. 如果無法辨識食物，name 回傳「未知食物」，其他數值為 0
3. 只回傳 JSON，不要有其他文字

範例回覆：
{"name": "雞胸肉便當", "calories": 650, "protein": 45, "sodium": 800, "water": 0}`;

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
