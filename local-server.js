const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load Vercel Serverless Handlers
const chatHandler = require('./api/chat');
const logHandler = require('./api/log');
const sessionsHandler = require('./api/sessions');
const transcribeHandler = require('./api/transcribe');
const sendEmailHandler = require('./api/send-email');
const loginHandler = require('./api/login');
const benchmarksHandler = require('./api/benchmarks');
const proxyImageHandler = require('./api/proxy-image');

const PORT = process.env.PORT || 3000;

// Helper to set Content-Type based on extension
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // 1. Route API Calls to Vercel Handlers
  if (pathname.startsWith('/api/')) {
    // Collect request body stream
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
    });

    req.on('end', async () => {
      // Mock Vercel req/res structures
      const mockReq = {
        method: req.method,
        headers: req.headers,
        url: req.url,
        query: parsedUrl.query || {},
        body: bodyData ? JSON.parse(bodyData) : {}
      };

      const mockRes = {
        headers: {},
        statusCode: 200,
        setHeader(name, value) {
          this.headers[name] = value;
          res.setHeader(name, value);
        },
        status(code) {
          this.statusCode = code;
          res.statusCode = code;
          return this;
        },
        json(data) {
          this.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        },
        send(data) {
          res.end(data);
        },
        end(data) {
          res.end(data);
        }
      };

      try {
        if (pathname === '/api/chat') {
          await chatHandler(mockReq, mockRes);
        } else if (pathname === '/api/login') {
          await loginHandler(mockReq, mockRes);
        } else if (pathname === '/api/benchmarks') {
          await benchmarksHandler(mockReq, mockRes);
        } else if (pathname === '/api/log') {
          await logHandler(mockReq, mockRes);
        } else if (pathname === '/api/sessions') {
          await sessionsHandler(mockReq, mockRes);
        } else if (pathname === '/api/transcribe') {
          await transcribeHandler(mockReq, mockRes);
        } else if (pathname === '/api/send-email') {
          await sendEmailHandler(mockReq, mockRes);
        } else if (pathname === '/api/proxy-image') {
          await proxyImageHandler(mockReq, mockRes);
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
        }
      } catch (err) {
        console.error('Server error handling API route:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal local server error: ' + err.message }));
      }
    });
    return;
  }

  // 2. Serve Static Content
  // Support clean URLs (e.g. /login routes to /login.html)
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  } else if (!path.extname(pathname)) {
    // If no extension, check if file.html exists
    if (fs.existsSync(path.join(__dirname, pathname + '.html'))) {
      pathname += '.html';
    }
  }

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Page not found
        fs.readFile(path.join(__dirname, 'login.html'), (loginErr, loginContent) => {
          if (loginErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 File Not Found');
          } else {
            // Redirect unrecognized routes to login page
            res.writeHead(302, { 'Location': '/login' });
            res.end();
          }
        });
      } else {
        // Server Error
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      // Success serve static file
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🤖 Multi-Model AI Chatbot Dashboard - Local server`);
  console.log(`📡 Server running at: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
  console.log(`Instructions:`);
  console.log(`1. Open http://localhost:${PORT} in your web browser.`);
  console.log(`2. Log in using any of the authorized user credentials.`);
  console.log(`3. Open Settings (API Keys drawer) and enter your Mistral key.`);
  console.log(`4. Select 'Mistral AI' in the top header and start chatting.`);
  console.log(`------------------------------------------------------\n`);
});
