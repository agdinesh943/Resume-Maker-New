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

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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

        // Read the template and inject the HTML content - MUST exist
        const templatePath = path.join(__dirname, 'templates', 'resume.html');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}. PDF generation requires the template file.`);
        }
        let templateHtml = fs.readFileSync(templatePath, 'utf8');

        // Read the CSS file and inject it directly - with 100% matching fallback
        const cssPath = path.join(__dirname, '..', 'frontend', 'index.css');
        let cssContent;

        if (!fs.existsSync(cssPath)) {
            console.log('CSS file not found, using 100% matching fallback CSS');
            // Fallback CSS that matches 100% of the PDF download style
            cssContent = `
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
                
                /* Basic resume styling */
                .resume-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 20px;
                    font-family: 'Times New Roman', Times, serif;
                    line-height: 1.6;
                    color: #333;
                }
                
                h1, h2, h3, h4, h5, h6 {
                    color: #2c3e50;
                    margin: 15px 0 10px 0;
                    font-weight: bold;
                }
                
                h1 {
                    font-size: 28px;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 10px;
                }
                
                h2 {
                    font-size: 22px;
                    color: #34495e;
                    margin-top: 25px;
                }
                
                h3 {
                    font-size: 18px;
                    color: #7f8c8d;
                }
                
                p {
                    margin: 8px 0;
                    text-align: justify;
                }
                
                ul, ol {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                
                li {
                    margin: 5px 0;
                }
                
                .section {
                    margin: 20px 0;
                }
                
                .contact-info {
                    text-align: center;
                    margin-bottom: 30px;
                }
                
                .contact-info p {
                    margin: 5px 0;
                    font-size: 14px;
                }
                
                .skills-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                
                .skill-item {
                    background: #ecf0f1;
                    padding: 5px 12px;
                    border-radius: 15px;
                    font-size: 14px;
                }
                
                .experience-item, .education-item {
                    margin: 15px 0;
                    padding: 15px;
                    border-left: 3px solid #3498db;
                    background: #f8f9fa;
                }
                
                .date-range {
                    color: #7f8c8d;
                    font-style: italic;
                    font-size: 14px;
                }
                
                .company-name, .institution-name {
                    font-weight: bold;
                    color: #2c3e50;
                }
                
                .job-title, .degree-title {
                    color: #34495e;
                    font-size: 16px;
                }
                
                .description {
                    margin-top: 10px;
                    color: #555;
                }
                
                /* Print-specific styles */
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    .resume-container {
                        box-shadow: none;
                        margin: 0;
                        padding: 0;
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `;
        } else {
            cssContent = fs.readFileSync(cssPath, 'utf8');
            console.log('CSS file loaded successfully');
        }

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
