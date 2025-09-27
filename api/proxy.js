const axios = require('axios');

module.exports = async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('URL parameter is required');
    }

    try {
        // Randomize User-Agent to avoid detection
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0'
        ];
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': randomUserAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': targetUrl.includes('google.com') ? 'https://www.google.com/' : targetUrl,
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            responseType: 'text',
            timeout: 3000,
            maxRedirects: 10
        });

        // Rewrite HTML for full compatibility
        let content = response.data;
        // Add base tag
        content = content.replace('<head>', `<head><base href="${targetUrl}">`);
        // Rewrite form actions, script URLs, links, and CSS URLs to use proxy
        content = content.replace(/(action|src|href)="\/([^"]+)"/g, `$1="/api/proxy?url=${encodeURIComponent(targetUrl.replace(/\/$/, '') + '/$2')}";`);
        // Rewrite inline JavaScript URLs (e.g., fetch, AJAX, redirects)
        content = content.replace(/fetch\(['"]?\/([^'"]+)['"]?\)/g, `fetch('/api/proxy?url=${encodeURIComponent(targetUrl.replace(/\/$/, '') + '/$1')}')`);
        content = content.replace(/url\(['"]?\/([^'"]+)['"]?\)/g, `url('/api/proxy?url=${encodeURIComponent(targetUrl.replace(/\/$/, '') + '/$1')}')`);
        content = content.replace(/new URL\(['"]?\/([^'"]+)['"]?\)/g, `new URL('/api/proxy?url=${encodeURIComponent(targetUrl.replace(/\/$/, '') + '/$1')}')`);
        content = content.replace(/window\.location\.href=['"]?\/([^'"]+)['"]?/g, `window.location.href="/api/proxy?url=${encodeURIComponent(targetUrl.replace(/\/$/, '') + '/$1')}"`);
        content = content.replace(/XMLHttpRequest\.open\(['"]GET['"],\s*['"]\/([^'"]+)['"]/g, `XMLHttpRequest.open("GET", "/api/proxy?url=${encodeURIComponent(targetUrl.replace(/\/$/, '') + '/$1')}")`);
        // Remove inline CSP and other restrictive meta tags
        content = content.replace(/<meta http-equiv=["']Content-Security-Policy["'][^>]+>/gi, '');
        content = content.replace(/<meta http-equiv=["']X-Frame-Options["'][^>]+>/gi, '');
        // Inject script to handle dynamic redirects within iframe
        content = content.replace('</body>', `<script>
            window.addEventListener('click', (e) => {
                const link = e.target.closest('a');
                if (link && link.href && link.href.startsWith('/')) {
                    e.preventDefault();
                    window.location.href = '/api/proxy?url=' + encodeURIComponent('${targetUrl.replace(/\/$/, '')}' + link.href);
                }
            });
        </script></body>`);

        // Remove restrictive headers
        const excludedHeaders = [
            'x-frame-options',
            'content-security-policy',
            'x-content-security-policy',
            'strict-transport-security',
            'x-content-type-options',
            'x-xss-protection'
        ];
        Object.keys(response.headers).forEach(key => {
            if (!excludedHeaders.includes(key.toLowerCase())) {
                res.setHeader(key, response.headers[key]);
            }
        });
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        res.status(response.status).send(content);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).send(`Error fetching the website: ${error.message}`);
    }
};
