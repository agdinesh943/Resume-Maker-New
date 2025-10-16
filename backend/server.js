const express = require('express');
const htmlPdf = require('html-pdf-node');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 3000;
// Azure-specific configuration
const isAzure = process.env.WEBSITE_SITE_NAME !== undefined;
const baseUrl = isAzure
    ? `https://${process.env.WEBSITE_SITE_NAME}.azurewebsites.net`
    : `http://localhost:${PORT}`;

app.use(cors({
    origin: [
        'https://au-resume-maker.netlify.app',  // Your Netlify frontend URL
        'https://resume-maker-new.onrender.com',
        'https://resume-backend-app.azurewebsites.net',  // Your Azure App Service URL
        'https://resume-backend-07-dkawbthjh0b5hdeb.centralindia-01.azurewebsites.net'    // Your old backend URL (for compatibility)
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));
// app.use(cors({
//     origin: true, // Allow all origins temporarily
//     credentials: true
// }));

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

// Serve static files from parent directory (only for local development)
// app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.post('/generate-pdf', async (req, res) => {
    // Add CORS headers manually as backup
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    console.log('PDF generation request received from origin:', req.headers.origin);

    try {
        const { html, username = 'Resume' } = req.body;
        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        // Read the template and inject the HTML content
        const templatePath = path.join(__dirname, 'templates', 'resume.html');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }
        let templateHtml = fs.readFileSync(templatePath, 'utf8');

        // Read the CSS file and inject it directly
        const cssPath = path.join(__dirname, 'css', 'index.css');
        console.log('Looking for CSS file at:', cssPath);

        if (!fs.existsSync(cssPath)) {
            console.error('CSS file not found at:', cssPath);
            throw new Error(`CSS file not found: ${cssPath}`);
        }
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        // Inject CSS content before the existing style tag with important overrides for PDF
        const pdfCssOverrides = `
            /* PDF-specific overrides to match preview exactly */
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            /* Ensure images load and display properly in PDF */
            img {
                max-width: 100% !important;
                height: auto !important;
                display: block !important;
                image-rendering: -webkit-optimize-contrast !important;
                image-rendering: crisp-edges !important;
                page-break-inside: avoid !important;
            }
            
            /* Ensure proper page sizing for PDF */
            .resume-container {
                width: 210mm !important;
                min-height: 297mm !important;
                margin: 0 auto !important;
                padding: 0 6mm !important;
                background: white !important;
                box-shadow: none !important;
                page-break-inside: avoid !important;
            }
            
            body {
                font-family: 'Times New Roman', Times, serif !important;
                background-color: white !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                min-height: 297mm !important;
            }
            
            /* Ensure all elements render properly in PDF */
            * {
                box-sizing: border-box !important;
            }
            
            /* Fix any layout issues in PDF */
            .resume-container * {
                position: relative !important;
            }
        `;

        templateHtml = templateHtml.replace('<!-- CSS will be injected by server -->', `<style>${cssContent}${pdfCssOverrides}</style>`);

        // Fix image paths to use absolute URLs for proper loading
        let processedHtml = html;
        processedHtml = processedHtml.replace(/src="\.\/images\//g, 'src="https://resume-maker-new.onrender.com/images/');

        // Fix any other relative image paths
        processedHtml = processedHtml.replace(/src="images\//g, 'src="https://resume-maker-new.onrender.com/images/');

        // Ensure images have proper attributes for PDF generation
        processedHtml = processedHtml.replace(/<img([^>]*?)src="([^"]*?)"([^>]*?)>/g, '<img$1src="$2"$3 style="max-width: 100%; height: auto; display: block;">');

        // Replace the placeholder with actual resume content
        templateHtml = templateHtml.replace('<!-- Resume content will be injected here -->', processedHtml);

        // Replace Handlebars placeholders
        templateHtml = templateHtml.replace(/\{\{username\}\}/g, username);

        console.log('HTML content length:', html.length);
        console.log('Processed HTML length:', processedHtml.length);
        console.log('Template HTML length:', templateHtml.length);

        // Use html-pdf-node for more reliable PDF generation
        const options = {
            format: 'A4',
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            },
            printBackground: true,
            displayHeaderFooter: false,
            preferCSSPageSize: true,
            waitUntil: 'networkidle0', // Wait for all images to load
            timeout: 30000, // 30 second timeout
            quality: 100, // High quality PDF
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--enable-local-file-access',
                '--allow-running-insecure-content',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--force-device-scale-factor=1',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images=false',
                '--disable-javascript=false'
            ]
        };

        // html-pdf-node will automatically find Chrome/Chromium

        // Generate PDF using html-pdf-node
        const pdfBuffer = await htmlPdf.generatePdf({ content: templateHtml }, options);
        console.log('PDF generated successfully using html-pdf-node');

        // Set response headers
        const filename = `resume_${username.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send PDF
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF generation error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Failed to generate PDF',
            details: error.message,
            stack: error.stack
        });
    }
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API-only backend - frontend is served by Netlify
app.get('/', (req, res) => {
    res.json({
        message: "Resume Maker Backend API",
        version: "1.0.0",
        endpoints: {
            health: "/health",
            generatePdf: "/generate-pdf",
            test: "/api/test"
        }
    });
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
