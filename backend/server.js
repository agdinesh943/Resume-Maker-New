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

        // Inject CSS content with higher specificity to override template styles
        const enhancedCSS = `
        <style>
        /* Main CSS with higher specificity */
        ${cssContent}
        
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Times New Roman', Times, serif;
    background-color: #f5f5f5;
    padding: 0;
    font-size: 16px;
    /* Increased base font size */
    text-align: justify;
}

/* Download Button */
.download-container {
    text-align: center;
    margin-bottom: 50px;
    margin-top: 20px;
}

.download-btn {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
}

.download-btn:hover {
    background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.download-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.resume-container {
    width: 210mm;
    /* A4 width */
    min-height: 297mm;
    /* A4 height - use min-height to allow content to expand */
    margin: 0 auto;
    margin-top: 0;
    margin-bottom: 0;
    background: white;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
    padding: 0 6mm;
    position: relative;
    overflow: visible;
    box-sizing: border-box;
}

/* Ensure proper centering for PDF generation */
body {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
}

/* Header Section */
.header {
    /* background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); */
    color: white;
    /* padding: 8px 10px; */
    margin: -6mm -6mm 0 -6mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.header .logo,
.logo-au {
    width: 700px;
    height: 100px;
    padding-left: 5px;
    object-fit: contain;
    margin-top: 5px;
}

.header-container {
    display: flex;
    align-items: center;
    margin-top: 1mm;
    position: relative;
    z-index: 10;
}

.logo-container {
    margin-left: 60px;
    height: 80px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 15px;
}

.hackerrank-logo,
.leetcode-logo {
    width: 120px;
    height: 60px;
    object-fit: contain;
    vertical-align: middle;
    margin-bottom: 20px;
}

.header p {
    font-size: 14px;
    opacity: 0.9;
    margin: 0;
    text-align: right;
}

/* Profile Section */
.profile-section {
    display: flex;
    margin-bottom: 8px;
    padding-bottom: 6px;
}

.profile-left {
    flex: 1;
    width: 50%;
    display: flex;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding-right: 12px;
}


.profile-photo-bg {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    overflow: hidden;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    display: block;
    flex-shrink: 0;
}

.profile-photo {
    width: 140px;
    height: 140px;
    /* aspect-ratio intentionally omitted for reliable PDF rendering */
    border-radius: 50%;
    /* border: 4px solid rgb(15, 78, 78); */
    object-fit: cover;
    object-position: center;
    display: block;
    flex-shrink: 0;
}

/* Ensure profile image is not squashed in print/PDF */
@media print {
    .profile-photo-bg {
        width: 140px !important;
        height: 140px !important;
        border-radius: 50% !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    .profile-photo {
        width: 140px !important;
        height: 140px !important;
        border-radius: 50% !important;
        object-fit: cover !important;
        object-position: center !important;
    }
}

.student-name {
    font-size: 20px;
    /* Increased from 18px */
    font-weight: bold;
    color: rgb(0, 67, 95);
    text-transform: uppercase;
    letter-spacing: 1px;
    line-height: 1.2;
}

.profile-right {
    flex: 1;
    width: 50%;
    padding-left: 12px;
}



.contact-info {
    display: flex;
    flex-direction: column;
}

.contact-item {
    display: flex;
    align-items: center;
    font-size: 15px;
    /* Increased from 14px */
    margin-bottom: 3px;
}

.contact-item a {
    text-decoration: none;
    color: inherit;
    margin-left: 8px;
}


.email-container {
    margin-left: 8px;
}

.email-item {
    display: flex;
    align-items: center;
    margin-bottom: 2px;
}

.email-item:last-child {
    margin-bottom: 0;
}

.email-label {
    font-weight: bold;
    color: black;
    min-width: 10px;
}

.contact-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    flex-shrink: 0;
}

/* Main Content */
.main-content {
    display: flex;
    gap: 12px;
    margin-bottom: 15mm;
}

.left-column {
    flex: 1;
}

.right-column {
    flex: 1;
}

/* Section Styling */
.section {
    margin-bottom: 10px;
}

.section-title {
    font-size: 18px;
    /* Increased from 16px */
    font-weight: bold;
    color: rgb(0, 67, 95);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding-bottom: 2px;
}

.section-content {
    font-size: 14px;
    line-height: 1.3;
    color: black;
}

/* Education */
.education-item {
    margin-bottom: 2px;
    padding-bottom: 1px;
}

.education-item:last-child {
    border-bottom: none;
}

.degree,
.degree-12 {
    font-weight: bold;
    color: black;
    font-size: 16px;
    /* Increased from 15px */
    margin-bottom: 2px;
}

.degree-12 {
    flex-shrink: 0;
    /* Prevent left column from shrinking */
    white-space: nowrap;
    /* Keep it in one line */
}

.university {
    color: black;
    font-size: 14px;
    /* Increased from 13px */
    margin: 0;
    flex: 1;
    /* Take remaining space */
    word-wrap: break-word;
    /* Wrap long text */
}

.college-city {
    font-size: 11px;
    color: #888;
    margin-top: 1px;
    font-style: italic;
}

.education-details {
    font-size: 14px;
    text-align: justify;
    width: 98%;
    color: black;
    margin-top: 2px;
    line-height: 1.4;
}

/* Inline headers for education and projects */
.edu-header {
    display: block;
    align-items: baseline;
    gap: 8px;
}

.project-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
}

/* Keep degree + specialization on one line and allow wrap cleanly */
.degree-line {
    display: flex;
    flex-wrap: wrap;
    column-gap: 6px;
    row-gap: 2px;
    align-items: baseline;
}

.specialization {
    font-weight: 600;
    color: black;
    font-size: 14px;
}

.project-sep {
    margin: 0 6px;
    color: black;
}

.year-gpa {
    white-space: nowrap;
    font-size: 14px;
    width: 100%;
    /* Increased from 12px */
    color: black;
}

/* PDF-focused fixes */
@media print {
    .resume-container {
        width: 210mm;
        min-height: 297mm;
        box-shadow: none;
        margin: 0 auto;
        padding: 0 6mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        position: relative;
    }

    /* Ensure body centers the content properly */
    body {
        display: flex !important;
        justify-content: center !important;
        align-items: flex-start !important;
        width: 100% !important;
    }

    /* Position top logos at top of page with no gap */
    .header-container {
        margin-top: 0mm !important;
        padding-top: 0 !important;
        position: relative;
        z-index: 10;
    }

    /* Position footer at bottom of page with small gap */
    .footer {
        position: absolute !important;
        bottom: 1mm !important;
        left: 6mm !important;
        right: 6mm !important;
        margin: 0 !important;
        padding: 6px 0 0 0 !important;
        /* Added top padding for gap between border and content */
        z-index: 10;
    }

    /* Ensure main content doesn't overlap with footer */
    .main-content {
        margin-bottom: 15mm !important;
        padding-bottom: 0 !important;
    }

    /* Remove top gaps from profile section */
    .profile-section {
        margin-top: 0 !important;
        padding-top: 0 !important;
    }

    /* Logo styling for PDF */
    .logo-au {
        width: 500px !important;
        height: 100px !important;
        object-fit: contain !important;
    }

    .logo-container {
        height: 80px !important;
        display: flex !important;
        align-items: center !important;
        gap: 15px !important;
    }

    .hackerrank-logo,
    .leetcode-logo {
        width: 120px !important;
        height: 60px !important;
        object-fit: contain !important;
        vertical-align: middle !important;
        margin-bottom: 20px !important;
    }

    /* Ensure proper spacing */
    html,
    body {
        margin: 0 !important;
        padding: 0 !important;
    }
}

/* Skills */
.skills-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 95%;

}

.skill-item {
    font-size: 14px;
    /* Increased from 13px */
    line-height: 1.3;
    color: black;
    margin-bottom: 1px;
    width: 95%;
}

/* Projects */
.project-item {
    margin-bottom: 8px;
}

.project-item:last-child {
    border-bottom: none;
}

.project-title {
    font-weight: bold;
    color: black;
    font-size: 15px;
    /* Increased from 14px */
    margin-bottom: 1px;
}

.project-tech {
    color: black;
    font-size: 14px;
    /* Increased from 14px */
    margin: 0;
}

.project-description {
    font-size: 14px;
    /* Increased from 13px */
    color: black;
    margin-top: 0;
    text-align: justify;
    width: 95%;
}

/* Experience */
.experience-item {
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
}

.experience-item:last-child {
    border-bottom: none;
}

.job-title {
    font-weight: bold;
    color: black;
    font-size: 15px;
    /* Increased from 14px */
}

.company {
    color: black;
    font-size: 14px;
    /* Increased from 13px */
    margin: 1px 0;
    display: flex;
    justify-content: space-between;
}

.duration {
    color: black;
    font-size: 13px;
    /* Increased from 12px */
    font-weight: 500;
}

.job-description {
    font-size: 14px;
    /* Increased from 13px */
    color: black;
    margin-top: 2px;
    text-align: justify;
    width: 98%;
}

/* Certifications */
.cert-item {
    margin-bottom: 5px;
    padding-bottom: 3px;
    /* Removed border-bottom line */
}

.cert-combined {
    font-weight: normal;
    /* Changed from bold to normal */
    color: black;
    font-size: 14px;
    /* Using the larger font size */
    line-height: 1.3;
    text-align: justify;
}

.cert-link {
    color: rgb(0, 67, 95);
    cursor: pointer;
    text-decoration: underline;
    font-weight: normal;
}

.cert-link:hover {
    text-decoration: none;
}

.achievement-link {
    color: rgb(0, 67, 95);
    cursor: pointer;
    text-decoration: underline;
    font-weight: normal;
}

.achievement-link:hover {
    text-decoration: none;
}

/* Achievements */
.achievements-list {
    list-style: none;
    padding: 0;
}

.achievements-list li {
    margin-bottom: 4px;
    /* padding-left: 15px; */
    position: relative;
    font-size: 14px;
    /* Increased from 13px */
    color: black;
    text-align: justify;
}

.achievements-list li:before {
    /* content: "•"; */
    color: rgb(0, 67, 95);
    font-weight: bold;
    position: absolute;
    left: 0;
}

.qr {
    width: 120px;
    height: 120px;
}

.achievements-img {
    display: flex;
    justify-content: space-evenly;
}

.duration-list {
    display: flex;
    justify-content: space-evenly;
}

/* Footer */
.footer {
    position: absolute;
    bottom: 1mm;
    left: 6mm;
    right: 6mm;
    text-align: center;
    padding-top: 8px;
    /* Increased from 4px to create more gap between border and content */
    /* border-top: 2px solid rgb(0, 67, 95); */
    z-index: 10;
}

.footer-bold {
    font-weight: 800 !important;
}

.footer-content {
    font-size: 14px;
    color: black;
    line-height: 1.2;
}
        </style>`;

        templateHtml = templateHtml.replace('<!-- CSS will be injected by server -->', enhancedCSS);

        // Fix image paths to use absolute URLs for proper loading
        let processedHtml = html;

        // Determine the correct base URL based on environment
        const baseUrl = process.env.NODE_ENV === 'production'
            ? 'https://resume-maker-new.onrender.com'
            : 'http://localhost:3000';

        // Replace various image path patterns
        processedHtml = processedHtml.replace(/src="\.\/images\//g, `src="${baseUrl}/images/`);
        processedHtml = processedHtml.replace(/src="images\//g, `src="${baseUrl}/images/`);
        processedHtml = processedHtml.replace(/src="\.\/favicon\//g, `src="${baseUrl}/favicon/`);
        processedHtml = processedHtml.replace(/src="favicon\//g, `src="${baseUrl}/favicon/`);

        // Handle logo paths specifically - all logo files are in images directory
        processedHtml = processedHtml.replace(/src="\.\/logo\./g, `src="${baseUrl}/images/logo.`);
        processedHtml = processedHtml.replace(/src="logo\./g, `src="${baseUrl}/images/logo.`);

        // Handle specific logo files that might be referenced directly
        const logoFiles = [
            'logo.png', 'jm-logo.jpg', 'hackerrank-logo.png', 'leetcode-logo.png',
            'nptel.png', 'Coursera.png', 'oracle.png', 'linkedin-logo.png',
            'hackerrank.png', 'leetcode.png', 'linkedin.png', 'github.png',
            'email.png', 'phone.png', 'qr.png', 'stopstalk.png'
        ];

        logoFiles.forEach(logoFile => {
            // Handle patterns like src="./logo.png" or src="logo.png"
            processedHtml = processedHtml.replace(
                new RegExp(`src="\\.?/?${logoFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
                `src="${baseUrl}/images/${logoFile}"`
            );
        });

        // Additional comprehensive pattern to catch any remaining image references
        processedHtml = processedHtml.replace(/src="\.\/([^"]*\.(png|jpg|jpeg|gif|svg|webp))"/g, `src="${baseUrl}/images/$1"`);
        processedHtml = processedHtml.replace(/src="([^"]*\.(png|jpg|jpeg|gif|svg|webp))"/g, (match, filename) => {
            // Only replace if it's not already an absolute URL
            if (!filename.startsWith('http')) {
                return `src="${baseUrl}/images/${filename}"`;
            }
            return match;
        });

        console.log('Image path replacements applied. Base URL:', baseUrl);
        console.log('Sample processed HTML after image replacement:', processedHtml.substring(0, 1000));

        // Replace the placeholder with actual resume content
        templateHtml = templateHtml.replace('<!-- Resume content will be injected here -->', processedHtml);

        // Replace Handlebars placeholders
        templateHtml = templateHtml.replace(/\{\{username\}\}/g, username);

        // Debug: Log the HTML length to ensure content is being injected
        console.log('HTML content length:', html.length);
        console.log('Processed HTML length:', processedHtml.length);
        console.log('Template HTML length:', templateHtml.length);
        console.log('Base URL for images:', baseUrl);
        console.log('CSS content length:', cssContent.length);

        // Log sample of processed HTML to debug
        console.log('Sample processed HTML (first 500 chars):', processedHtml.substring(0, 500));

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
            preferCSSPageSize: false, // Use explicit dimensions instead
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
                '--disable-javascript=false',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-features=VizDisplayCompositor',
                '--run-all-compositor-stages-before-draw',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-pings',
                '--disable-logging',
                '--disable-permissions-api',
                '--disable-popup-blocking',
                '--disable-prompt-on-repost',
                '--disable-domain-reliability',
                '--disable-client-side-phishing-detection',
                '--disable-component-extensions-with-background-pages',
                '--disable-ipc-flooding-protection'
            ]
        };

        let pdfBuffer;
        try {
            pdfBuffer = await htmlPdf.generatePdf({
                content: templateHtml,
                context: { username: username }
            }, options);
        } catch (error) {
            console.error('PDF generation failed with primary options:', error.message);

            // Fallback with simpler options
            const fallbackOptions = {
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0mm',
                    right: '0mm',
                    bottom: '0mm',
                    left: '0mm'
                },
                preferCSSPageSize: false,
                displayHeaderFooter: false,
                scale: 1,
                width: '210mm',
                height: '297mm',
                waitUntil: 'domcontentloaded', // Less strict than networkidle0
                timeout: 15000, // Shorter timeout
                quality: 100,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images=false',
                    '--disable-javascript=false'
                ]
            };

            console.log('Trying fallback PDF generation...');
            pdfBuffer = await htmlPdf.generatePdf({
                content: templateHtml,
                context: { username: username }
            }, fallbackOptions);
        }

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

// Helper function to find file with multiple possible paths
const findStaticFile = (filename) => {
    const possiblePaths = [
        path.join(__dirname, '..', 'frontend', filename),
        path.join(__dirname, '..', '..', 'frontend', filename),
        path.join(process.cwd(), 'frontend', filename),
        path.join(process.cwd(), 'src', 'frontend', filename),
        path.join(process.cwd(), 'backend', '..', 'frontend', filename),
        path.join(__dirname, 'frontend', filename)
    ];

    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
};

// Serve the main landing page at /landing
app.get('/landing-page', (req, res) => {
    const filePath = findStaticFile('index.html');
    if (filePath) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Landing page not found');
    }
});

app.get('/', (req, res) => {
    const filePath = findStaticFile('index.html');
    if (filePath) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Home page not found');
    }
});

// Resume form endpoint
app.get('/resume-form', (req, res) => {
    const filePath = findStaticFile('resume-form.html');
    if (filePath) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Resume form not found');
    }
});

// Resume preview endpoint
app.get('/preview', (req, res) => {
    const filePath = findStaticFile('preview.html');
    if (filePath) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Preview page not found');
    }
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
