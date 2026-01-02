// Vercel Serverless Function - Daily Records API
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { date, id } = req.query;

        if (req.method === 'GET') {
            // Get records for a specific date
            if (!date) {
                return res.status(400).json({ error: 'Date parameter required' });
            }

            const record = await kv.get(`records:${date}`);

            if (!record) {
                return res.status(200).json({
                    date,
                    entries: [],
                    totals: { calories: 0, protein: 0, sodium: 0, water: 0 }
                });
            }

            return res.status(200).json(record);
        }

        if (req.method === 'POST') {
            // Add a new food entry
            const entry = req.body;

            if (!entry || !entry.date || !entry.id) {
                return res.status(400).json({ error: 'Invalid entry data' });
            }

            const recordKey = `records:${entry.date}`;
            let record = await kv.get(recordKey);

            if (!record) {
                record = {
                    date: entry.date,
                    entries: [],
                    totals: { calories: 0, protein: 0, sodium: 0, water: 0 }
                };
            }

            // Add entry
            record.entries.push({
                id: entry.id,
                time: entry.time,
                name: entry.name,
                calories: entry.calories || 0,
                protein: entry.protein || 0,
                sodium: entry.sodium || 0,
                water: entry.water || 0,
                source: entry.source || 'manual'
            });

            // Recalculate totals
            record.totals = record.entries.reduce((acc, e) => ({
                calories: acc.calories + (e.calories || 0),
                protein: acc.protein + (e.protein || 0),
                sodium: acc.sodium + (e.sodium || 0),
                water: acc.water + (e.water || 0)
            }), { calories: 0, protein: 0, sodium: 0, water: 0 });

            await kv.set(recordKey, record);

            // Update index
            const index = await kv.get('records:index') || [];
            if (!index.includes(entry.date)) {
                index.unshift(entry.date);
                // Keep only last 365 days
                if (index.length > 365) index.pop();
                await kv.set('records:index', index);
            }

            return res.status(200).json(record);
        }

        if (req.method === 'PUT') {
            // Update an existing food entry
            const entry = req.body;

            if (!entry || !entry.date || !entry.id) {
                return res.status(400).json({ error: 'Invalid entry data' });
            }

            const recordKey = `records:${entry.date}`;
            let record = await kv.get(recordKey);

            if (!record) {
                return res.status(404).json({ error: 'Record not found' });
            }

            // Find and update the entry
            const entryIndex = record.entries.findIndex(e => e.id === entry.id);
            if (entryIndex === -1) {
                return res.status(404).json({ error: 'Entry not found' });
            }

            record.entries[entryIndex] = {
                id: entry.id,
                time: entry.time,
                name: entry.name,
                calories: entry.calories || 0,
                protein: entry.protein || 0,
                sodium: entry.sodium || 0,
                water: entry.water || 0,
                source: entry.source || 'manual'
            };

            // Recalculate totals
            record.totals = record.entries.reduce((acc, e) => ({
                calories: acc.calories + (e.calories || 0),
                protein: acc.protein + (e.protein || 0),
                sodium: acc.sodium + (e.sodium || 0),
                water: acc.water + (e.water || 0)
            }), { calories: 0, protein: 0, sodium: 0, water: 0 });

            await kv.set(recordKey, record);

            return res.status(200).json(record);
        }

        if (req.method === 'DELETE') {
            // Delete a food entry
            if (!date || !id) {
                return res.status(400).json({ error: 'Date and ID parameters required' });
            }

            const recordKey = `records:${date}`;
            const record = await kv.get(recordKey);

            if (!record) {
                return res.status(404).json({ error: 'Record not found' });
            }

            // Filter out the entry
            record.entries = record.entries.filter(e => e.id !== id);

            // Recalculate totals
            record.totals = record.entries.reduce((acc, e) => ({
                calories: acc.calories + (e.calories || 0),
                protein: acc.protein + (e.protein || 0),
                sodium: acc.sodium + (e.sodium || 0),
                water: acc.water + (e.water || 0)
            }), { calories: 0, protein: 0, sodium: 0, water: 0 });

            await kv.set(recordKey, record);

            return res.status(200).json(record);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Records API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
