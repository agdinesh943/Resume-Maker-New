const express = require('express');
const htmlPdf = require('html-pdf-node');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');


const app = express();
const PORT = process.env.PORT || 3000;





app.use(cors({
    origin: true, // Allow all origins temporarily
    credentials: true
}));

// Additional CORS handling for preflight requests
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files with dynamic path resolution
const staticPaths = [
    path.join(__dirname, '..', 'frontend'),
    path.join(__dirname, '..', '..', 'frontend'),
    path.join(process.cwd(), 'frontend'),
    path.join(process.cwd(), 'src', 'frontend')
];

let staticPath = null;
for (const staticDir of staticPaths) {
    if (fs.existsSync(staticDir)) {
        staticPath = staticDir;
        console.log('Serving static files from:', staticPath);
        break;
    }
}

if (staticPath) {
    app.use(express.static(staticPath));
} else {
    console.warn('No static directory found, static file serving disabled');
}

app.post('/generate-pdf', async (req, res) => {
    // Add CORS headers manually as backup
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    console.log('PDF generation request received from origin:', req.headers.origin);
    console.log('Request headers:', req.headers);

    try {
        const { html, username = 'Resume' } = req.body;

        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        // Dynamic file path resolution for different deployment environments
        console.log('Current working directory:', process.cwd());
        console.log('__dirname:', __dirname);

        // Function to find file with multiple possible paths
        const findFile = (possiblePaths) => {
            for (const filePath of possiblePaths) {
                console.log('Checking path:', filePath);
                if (fs.existsSync(filePath)) {
                    console.log('Found file at:', filePath);
                    return filePath;
                }
            }
            return null;
        };

        // Find template file with multiple possible locations
        const templatePaths = [
            path.join(__dirname, 'templates', 'resume.html'),
            path.join(__dirname, '..', 'templates', 'resume.html'),
            path.join(process.cwd(), 'templates', 'resume.html'),
            path.join(process.cwd(), 'backend', 'templates', 'resume.html'),
            path.join(process.cwd(), 'src', 'backend', 'templates', 'resume.html')
        ];

        const templatePath = findFile(templatePaths);
        if (!templatePath) {
            throw new Error(`Template file not found. Checked paths: ${templatePaths.join(', ')}`);
        }
        let templateHtml = fs.readFileSync(templatePath, 'utf8');

        // Find CSS file with multiple possible locations
        const cssPaths = [
            path.join(__dirname, 'assets', 'index.css'),
            path.join(__dirname, '..', 'frontend', 'index.css'),
            path.join(__dirname, '..', '..', 'frontend', 'index.css'),
            path.join(process.cwd(), 'frontend', 'index.css'),
            path.join(process.cwd(), 'src', 'frontend', 'index.css'),
            path.join(process.cwd(), 'backend', '..', 'frontend', 'index.css'),
            path.join(__dirname, 'frontend', 'index.css')
        ];

        const cssPath = findFile(cssPaths);
        if (!cssPath) {
            throw new Error(`CSS file not found. Checked paths: ${cssPaths.join(', ')}`);
        }
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        // Inject CSS content before the existing style tag
        templateHtml = templateHtml.replace('<!-- CSS will be injected by server -->', `<style>${cssContent}</style>`);

        // Fix image paths to use absolute URLs for proper loading
        let processedHtml = html;
        // Current: 
        // processedHtml = processedHtml.replace(/src="\.\/images\//g, 'src="http://localhost:3000/images/');

        // Change to your production domain:
        processedHtml = processedHtml.replace(/src="\.\/images\//g, 'src="https://resume-maker-new.onrender.com/images/');

        // Replace the placeholder with actual resume content
        templateHtml = templateHtml.replace('<!-- Resume content will be injected here -->', processedHtml);

        // Replace Handlebars placeholders
        templateHtml = templateHtml.replace(/\{\{username\}\}/g, username);

        // Debug: Log the HTML length to ensure content is being injected
        console.log('HTML content length:', html.length);
        console.log('Processed HTML length:', processedHtml.length);
        console.log('Template HTML length:', templateHtml.length);

        // Generate PDF with html-pdf-node - exact same styling as preview
        const options = {
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            },
            preferCSSPageSize: true,
            displayHeaderFooter: false,
            scale: 1,
            width: '210mm',
            height: '297mm',
            waitUntil: 'networkidle0', // Wait for all resources to load
            timeout: 30000, // 30 second timeout
            quality: 100, // High quality
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--font-render-hinting=none',
                '--disable-font-subpixel-positioning',
                '--force-device-scale-factor=1',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images=false',
                '--disable-javascript=false'
            ]
        };

        const pdfBuffer = await htmlPdf.generatePdf({
            content: templateHtml,
            context: { username: username }
        }, options);

        // Set response headers
        const filename = `resume_${username.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send PDF
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({
            error: 'Failed to generate PDF',
            details: error.message
        });
    }
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint to check file structure and paths
app.get('/debug/paths', (req, res) => {
    const debugInfo = {
        currentWorkingDirectory: process.cwd(),
        __dirname: __dirname,
        nodeVersion: process.version,
        platform: process.platform,
        fileStructure: {}
    };

    // Check common directory structures
    const commonPaths = [
        process.cwd(),
        __dirname,
        path.join(__dirname, '..'),
        path.join(__dirname, '..', '..'),
        path.join(process.cwd(), 'src'),
        path.join(process.cwd(), 'backend'),
        path.join(process.cwd(), 'frontend')
    ];

    commonPaths.forEach(dirPath => {
        try {
            if (fs.existsSync(dirPath)) {
                debugInfo.fileStructure[dirPath] = fs.readdirSync(dirPath);
            }
        } catch (error) {
            debugInfo.fileStructure[dirPath] = `Error: ${error.message}`;
        }
    });

    // Check for specific files
    const filesToCheck = [
        'templates/resume.html',
        'frontend/index.css',
        'frontend/index.html',
        'package.json'
    ];

    debugInfo.fileChecks = {};
    filesToCheck.forEach(file => {
        const possiblePaths = [
            path.join(__dirname, file),
            path.join(__dirname, '..', file),
            path.join(process.cwd(), file),
            path.join(process.cwd(), 'src', file),
            path.join(process.cwd(), 'backend', file)
        ];

        debugInfo.fileChecks[file] = possiblePaths.map(p => ({
            path: p,
            exists: fs.existsSync(p)
        }));
    });

    res.json(debugInfo);
});

// Serve the main landing page at /landing
app.get('/landing-page', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});


// Resume form endpoint
app.get('/resume-form', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'resume-form.html'));
});

// Resume preview endpoint
app.get('/preview', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'preview.html'));
});

app.get('/api/test', (req, res) => {
    res.json({ status: "Backend is live!" });
});


app.listen(PORT, () => {
    console.log(`PDF generation server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Root (redirects to login): http://localhost:${PORT}/`);
    // console.log(`Student login: http://localhost:${PORT}/login`);
    console.log(`Landing page: http://localhost:${PORT}/landing`);
    console.log(`Resume form: http://localhost:${PORT}/resume-form`);
    console.log(`Resume preview: http://localhost:${PORT}/preview`);
});
