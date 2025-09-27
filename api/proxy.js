const axios = require('axios');

module.exports = async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('URL parameter is required');
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
            },
            responseType: 'text',
            timeout: 5000
        });

        // Rewrite HTML to handle dynamic content
        let content = response.data;
        // Add base tag
        content = content.replace('<head>', `<head><base href="${targetUrl}">`);
        // Rewrite form actions and script URLs to use proxy
        content = content.replace(/(action|src|href)="\/([^"]+)"/g, `$1="/api/proxy?url=${encodeURIComponent(targetUrl + '/$2')}";`);
        // Remove inline CSP
        content = content.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/gi, '');

        // Remove restrictive headers
        const excludedHeaders = ['X-Frame-Options', 'Content-Security-Policy', 'X-Content-Security-Policy'];
        Object.keys(response.headers).forEach(key => {
            if (!excludedHeaders.includes(key)) {
                res.setHeader(key, response.headers[key]);
            }
        });
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        res.status(response.status).send(content);
    } catch (error) {
        res.status(500).send(`Error fetching the website: ${error.message}`);
    }
};
