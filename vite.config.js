import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function netlifyFunctionsPlugin() {
  return {
    name: 'netlify-functions-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url.startsWith('/.netlify/functions/')) {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const functionName = url.pathname.replace('/.netlify/functions/', '');
          const functionPath = path.resolve(__dirname, `netlify/functions/${functionName}.js`);
          
          if (!fs.existsSync(functionPath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Function ${functionName} not found.` }));
            return;
          }
          
          try {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            
            req.on('end', async () => {
              try {
                let handler;
                try {
                  const content = fs.readFileSync(functionPath, 'utf8');
                  const exportsObj = {};
                  const moduleObj = { exports: exportsObj };
                  const requireFunc = createRequire(import.meta.url);
                  const runFn = new Function('exports', 'module', 'require', '__filename', '__dirname', content);
                  runFn(exportsObj, moduleObj, requireFunc, functionPath, path.dirname(functionPath));
                  handler = moduleObj.exports.handler || exportsObj.handler;
                } catch (e) {
                  const fileUrl = pathToFileURL(functionPath).href;
                  const mod = await import(`${fileUrl}?t=${Date.now()}`);
                  handler = mod.handler || mod.default?.handler;
                }
                
                if (!handler) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: `Handler not exported in ${functionName}.js` }));
                  return;
                }
                
                const event = {
                  httpMethod: req.method,
                  headers: req.headers,
                  body: body,
                  queryStringParameters: Object.fromEntries(url.searchParams)
                };
                
                const response = await handler(event, {});
                
                res.statusCode = response.statusCode || 200;
                if (response.headers) {
                  for (const [key, val] of Object.entries(response.headers)) {
                    res.setHeader(key, val);
                  }
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(response.body);
              } catch (err) {
                console.error(`Error executing serverless function ${functionName}:`, err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          } catch (err) {
            console.error(`Error reading body for serverless function ${functionName}:`, err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB
      },
      manifest: {
        name: 'Campus Twin',
        short_name: 'Campus Twin',
        description: 'Digital College Management System',
        theme_color: '#4f6ef7',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    netlifyFunctionsPlugin()
  ],
  server: {
    port: 3001,
    strictPort: false
  }
})
