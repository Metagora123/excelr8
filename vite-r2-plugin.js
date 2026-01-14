// Vite plugin to add R2 API endpoint
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load .env file - get project root directory (go up from plugin file location)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Plugin is in root, so .env should be in same directory
dotenv.config({ path: resolve(__dirname, '.env') });

export function r2ApiPlugin() {
  return {
    name: 'r2-api',
    configureServer(server) {
      server.middlewares.use('/api/r2/date-folders', async (req, res, next) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          // Load env vars - try both process.env and import.meta.env
          const accountId = process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
          const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
          const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
          const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;
          const endpoint = process.env.VITE_CLOUDFLARE_R2_ENDPOINT;

          console.log('🔍 R2 Config check:', {
            accountId: accountId ? 'Set' : 'Missing',
            accessKeyId: accessKeyId ? 'Set' : 'Missing',
            secretAccessKey: secretAccessKey ? 'Set' : 'Missing',
            bucketName: bucketName || 'Missing',
            endpoint: endpoint || 'Missing',
          });

          if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
            const missing = [];
            if (!accountId) missing.push('VITE_CLOUDFLARE_R2_ACCOUNT_ID');
            if (!accessKeyId) missing.push('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID');
            if (!secretAccessKey) missing.push('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY');
            if (!bucketName) missing.push('VITE_CLOUDFLARE_R2_BUCKET_NAME');
            if (!endpoint) missing.push('VITE_CLOUDFLARE_R2_ENDPOINT');
            
            console.error('❌ Missing R2 env vars:', missing);
            res.writeHead(500, { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ 
              error: 'Missing R2 configuration',
              missing: missing,
              hint: 'Make sure .env file exists and restart dev server'
            }));
            return;
          }

          const s3Client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
              accessKeyId: accessKeyId,
              secretAccessKey: secretAccessKey,
            },
          });

          const dateFolders = new Set();
          let continuationToken = null;

          do {
            const command = new ListObjectsV2Command({
              Bucket: bucketName,
              MaxKeys: 1000,
              ContinuationToken: continuationToken,
            });

            const response = await s3Client.send(command);

            if (response.Contents) {
              response.Contents.forEach((object) => {
                const match = object.Key.match(/^(\d{4}-\d{2}-\d{2})\//);
                if (match) {
                  dateFolders.add(match[1]);
                }
              });
            }

            continuationToken = response.NextContinuationToken;
          } while (continuationToken);

          const sortedDates = Array.from(dateFolders).sort().reverse();

          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ dateFolders: sortedDates }));
        } catch (error) {
          console.error('Error fetching date folders:', error);
          res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

      // API endpoint to get files in a date folder
      server.middlewares.use('/api/r2/files', async (req, res, next) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const folder = url.searchParams.get('folder');

          if (!folder) {
            res.writeHead(400, { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'Folder parameter is required' }));
            return;
          }

          // Load env vars
          const accountId = process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
          const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
          const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
          const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;
          const endpoint = process.env.VITE_CLOUDFLARE_R2_ENDPOINT;

          if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
            res.writeHead(500, { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'Missing R2 configuration' }));
            return;
          }

          const s3Client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
              accessKeyId: accessKeyId,
              secretAccessKey: secretAccessKey,
            },
          });

          const files = [];
          let continuationToken = null;
          const prefix = folder.endsWith('/') ? folder : `${folder}/`;

          do {
            const command = new ListObjectsV2Command({
              Bucket: bucketName,
              Prefix: prefix,
              MaxKeys: 1000,
              ContinuationToken: continuationToken,
            });

            const response = await s3Client.send(command);

            if (response.Contents) {
              response.Contents.forEach((object) => {
                // Exclude the folder itself, only include files
                if (!object.Key.endsWith('/')) {
                  files.push({
                    key: object.Key,
                    name: object.Key.split('/').pop(),
                    size: object.Size,
                    lastModified: object.LastModified,
                  });
                }
              });
            }

            continuationToken = response.NextContinuationToken;
          } while (continuationToken);

          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ files: files }));
        } catch (error) {
          console.error('Error fetching files:', error);
          res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

      // API endpoint to get file content from R2
      server.middlewares.use('/api/r2/file-content', async (req, res, next) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const fileKey = url.searchParams.get('key');

          if (!fileKey) {
            res.writeHead(400, { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'File key parameter is required' }));
            return;
          }

          // Load env vars
          const accountId = process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
          const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
          const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
          const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;
          const endpoint = process.env.VITE_CLOUDFLARE_R2_ENDPOINT;

          if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
            res.writeHead(500, { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'Missing R2 configuration' }));
            return;
          }

          const s3Client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
              accessKeyId: accessKeyId,
              secretAccessKey: secretAccessKey,
            },
          });

          const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
          });

          const response = await s3Client.send(command);
          
          // Read the stream
          const chunks = [];
          for await (const chunk of response.Body) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const content = buffer.toString('utf-8');

          // Determine content type based on file extension
          let contentType = 'text/plain';
          if (fileKey.endsWith('.html')) {
            contentType = 'text/html';
          } else if (fileKey.endsWith('.json')) {
            contentType = 'application/json';
          }

          res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          res.end(content);
        } catch (error) {
          console.error('Error fetching file content:', error);
          res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

