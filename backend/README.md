1. Environment Configuration (backend/.env)
   Create a .env file from env-template.txt
   Set NODE_ENV=production

2. Server Configuration (backend/server.js)
   Line 104: Change hardcoded localhost URL:

Lines 90-101: Uncomment and configure CORS for production:
