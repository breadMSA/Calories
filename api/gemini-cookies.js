// Gemini Cookie Management - Store and retrieve cookies from Upstash Redis
import { kv } from '@vercel/kv';

const COOKIE_KEY = 'gemini:cookies';

/**
 * Get stored Gemini cookies
 */
export async function getGeminiCookies() {
    try {
        const cookies = await kv.get(COOKIE_KEY);
        if (!cookies) {
            return null;
        }
        return cookies;
    } catch (error) {
        console.error('Failed to get Gemini cookies:', error);
        return null;
    }
}

/**
 * Save Gemini cookies to Redis
 */
export async function saveGeminiCookies(cookies) {
    try {
        await kv.set(COOKIE_KEY, cookies);
        return true;
    } catch (error) {
        console.error('Failed to save Gemini cookies:', error);
        return false;
    }
}

/**
 * Initialize cookies from environment variables if not already stored
 */
export async function initializeCookiesFromEnv() {
    const existingCookies = await getGeminiCookies();

    // If cookies already exist in Redis, use them
    if (existingCookies && existingCookies.Secure_1PSID) {
        return existingCookies;
    }

    // Otherwise, initialize from environment variables
    const envCookies = {
        Secure_1PSID: process.env.GEMINI_1PSID || '',
        Secure_1PSIDTS: process.env.GEMINI_1PSIDTS || ''
    };

    if (envCookies.Secure_1PSID) {
        await saveGeminiCookies(envCookies);
        return envCookies;
    }

    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        // Get current cookies status
        const cookies = await getGeminiCookies();
        return res.status(200).json({
            hasValidCookies: !!(cookies && cookies.Secure_1PSID),
            lastUpdated: cookies?.lastUpdated || null
        });
    }

    if (req.method === 'POST') {
        // Update cookies
        const { Secure_1PSID, Secure_1PSIDTS } = req.body;

        if (!Secure_1PSID) {
            return res.status(400).json({ error: 'Secure_1PSID is required' });
        }

        const cookies = {
            Secure_1PSID,
            Secure_1PSIDTS: Secure_1PSIDTS || '',
            lastUpdated: new Date().toISOString()
        };

        const success = await saveGeminiCookies(cookies);

        if (success) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(500).json({ error: 'Failed to save cookies' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
