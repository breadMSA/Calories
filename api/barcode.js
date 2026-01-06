// Vercel Serverless Function - Barcode Lookup API (Open Food Facts)

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: 'Barcode parameter required' });
        }

        // Query Open Food Facts API
        const response = await fetch(
            `https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_zh,nutriments,serving_size,brands`,
            {
                headers: {
                    'User-Agent': 'CalorieTracker/1.0 (https://github.com/user/calorie-tracker)'
                }
            }
        );

        if (!response.ok) {
            return res.status(404).json({
                found: false,
                error: '無法連接到食品資料庫'
            });
        }

        const data = await response.json();

        if (data.status !== 1 || !data.product) {
            return res.status(404).json({
                found: false,
                error: '找不到此條碼對應的產品'
            });
        }

        const product = data.product;
        const nutriments = product.nutriments || {};

        // Get product name (prefer Chinese if available)
        const name = product.product_name_zh ||
            product.product_name ||
            (product.brands ? `${product.brands} 產品` : '未知產品');

        // Extract nutritional values (per 100g or per serving)
        // Open Food Facts stores values per 100g by default
        const servingSize = product.serving_size || '100g';

        // Get values - prefer per serving if available, otherwise use per 100g
        const calories = Math.round(
            nutriments['energy-kcal_serving'] ||
            nutriments['energy-kcal_100g'] ||
            (nutriments['energy_serving'] || nutriments['energy_100g'] || 0) / 4.184
        );

        const protein = Math.round(
            nutriments['proteins_serving'] ||
            nutriments['proteins_100g'] ||
            0
        );

        const sodium = Math.round(
            (nutriments['sodium_serving'] || nutriments['sodium_100g'] || 0) * 1000 // Convert from g to mg
        );

        // Water content is rarely available in packaged foods
        const water = 0;

        return res.status(200).json({
            found: true,
            name,
            calories,
            protein,
            sodium,
            water,
            servingSize,
            barcode: code,
            source: 'openfoodfacts'
        });

    } catch (error) {
        console.error('Barcode API error:', error);
        return res.status(500).json({
            found: false,
            error: '查詢失敗，請稍後再試'
        });
    }
}
