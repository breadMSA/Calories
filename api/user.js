// Vercel Serverless Function - User Profile API
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            // Get user profile
            const profile = await kv.get('user:profile');

            if (!profile) {
                return res.status(404).json({ error: 'Profile not found' });
            }

            return res.status(200).json(profile);
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            // Save user profile
            const { height, weight, age, gender, targets } = req.body;

            // Validation
            if (!height || !weight || !age || !gender || !targets) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const profile = {
                height: parseFloat(height),
                weight: parseFloat(weight),
                age: parseInt(age),
                gender,
                targets: {
                    calories: parseInt(targets.calories),
                    protein: parseInt(targets.protein),
                    sodium: parseInt(targets.sodium),
                    water: parseInt(targets.water)
                },
                updatedAt: new Date().toISOString()
            };

            await kv.set('user:profile', profile);

            return res.status(200).json(profile);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('User API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
