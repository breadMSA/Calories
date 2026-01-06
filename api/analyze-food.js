// Vercel Serverless Function - AI Food Analysis API (Gemini Reverse API)
import { getGeminiCookies, saveGeminiCookies, initializeCookiesFromEnv } from './gemini-cookies.js';

// Gemini Web API endpoint
const GEMINI_API_URL = 'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate';

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

        // Get cookies from Redis or environment
        let cookies = await initializeCookiesFromEnv();

        if (!cookies || !cookies.Secure_1PSID) {
            console.error('No Gemini cookies configured');
            return res.status(500).json({ error: 'AI 服務未設定，請聯繫管理員' });
        }

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

        // Call Gemini Web API
        const result = await callGeminiWebAPI(prompt, image, cookies);

        if (result.error) {
            if (result.needsRefresh) {
                return res.status(401).json({ error: 'Cookie 已過期，請更新' });
            }
            return res.status(500).json({ error: result.error });
        }

        // Parse JSON from response
        let nutritionData;
        try {
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                nutritionData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Parse error:', parseError, 'Response:', result.text);
            nutritionData = {
                name: '未知食物',
                calories: 0,
                protein: 0,
                sodium: 0,
                water: 0
            };
        }

        // Sanitize data
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
        return res.status(500).json({ error: '分析失敗，請稍後再試' });
    }
}

/**
 * Call Gemini Web API with image
 */
async function callGeminiWebAPI(prompt, imageBase64, cookies) {
    try {
        // Build cookie string
        const cookieString = [
            `__Secure-1PSID=${cookies.Secure_1PSID}`,
            cookies.Secure_1PSIDTS ? `__Secure-1PSIDTS=${cookies.Secure_1PSIDTS}` : ''
        ].filter(Boolean).join('; ');

        // First, get the SNlM0e token (required for Gemini API)
        const tokenResponse = await fetch('https://gemini.google.com/', {
            headers: {
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!tokenResponse.ok) {
            return { error: 'Failed to connect to Gemini', needsRefresh: tokenResponse.status === 401 };
        }

        const html = await tokenResponse.text();

        // Extract SNlM0e token
        const tokenMatch = html.match(/"SNlM0e":"([^"]+)"/);
        if (!tokenMatch) {
            console.error('Could not find SNlM0e token');
            return { error: 'Cookie 可能已過期', needsRefresh: true };
        }
        const snToken = tokenMatch[1];

        // Prepare the request payload
        // Gemini uses a complex protobuf-like format, we'll use a simplified version
        const imageData = {
            data: imageBase64,
            mime_type: 'image/jpeg'
        };

        // Build the multipart form data
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

        // The actual request format used by Gemini Web
        const requestData = [
            [prompt],  // prompt
            null,      // conversation_id
            null,      // response_id
            null,      // choice_id
            null,      // unknown
            null,      // unknown
            [[[imageBase64, 1]]]  // image data
        ];

        const formBody = `f.req=${encodeURIComponent(JSON.stringify([[JSON.stringify(requestData)]]))}&at=${encodeURIComponent(snToken)}`;

        // Make the API request
        const response = await fetch(`${GEMINI_API_URL}?bl=boq_assistant-bard-web-server_20231127.08_p0&_reqid=${Math.floor(Math.random() * 900000) + 100000}&rt=c`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://gemini.google.com',
                'Referer': 'https://gemini.google.com/'
            },
            body: formBody
        });

        if (!response.ok) {
            console.error('Gemini API error:', response.status);
            return { error: 'AI 服務暫時無法使用', needsRefresh: response.status === 401 };
        }

        const responseText = await response.text();

        // Parse the response (Gemini returns a special format)
        // The response is multiple lines, we need to find the JSON data
        const lines = responseText.split('\n');
        let responseData = null;

        for (const line of lines) {
            if (line.startsWith('[')) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed && parsed[0] && parsed[0][2]) {
                        const innerData = JSON.parse(parsed[0][2]);
                        if (innerData && innerData[4]) {
                            responseData = innerData[4][0][1][0];
                            break;
                        }
                    }
                } catch (e) {
                    // Continue to next line
                }
            }
        }

        if (!responseData) {
            // Try alternative parsing
            const jsonMatch = responseText.match(/\[\[.*?"([^"]*\{[^}]+\}[^"]*)"/);
            if (jsonMatch) {
                return { text: jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') };
            }
            return { error: '無法解析 AI 回應' };
        }

        return { text: responseData };

    } catch (error) {
        console.error('Gemini API call error:', error);
        return { error: '連接 AI 服務失敗' };
    }
}
