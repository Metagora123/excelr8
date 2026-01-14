// Production server for R2 API endpoints
// This server handles R2 API calls that the Vite dev server plugin handles in development
import express from 'express';
import cors from 'cors';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to get R2 client
function getR2Client() {
  const accountId = process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;
  const endpoint = process.env.VITE_CLOUDFLARE_R2_ENDPOINT;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
    const missing = [];
    if (!accountId) missing.push('VITE_CLOUDFLARE_R2_ACCOUNT_ID');
    if (!accessKeyId) missing.push('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    if (!bucketName) missing.push('VITE_CLOUDFLARE_R2_BUCKET_NAME');
    if (!endpoint) missing.push('VITE_CLOUDFLARE_R2_ENDPOINT');
    
    throw new Error(`Missing R2 configuration: ${missing.join(', ')}`);
  }

  return {
    s3Client: new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    }),
    bucketName,
  };
}

// API endpoint to get date folders
app.get('/api/r2/date-folders', async (req, res) => {
  try {
    const { s3Client, bucketName } = getR2Client();

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

    res.json({ dateFolders: sortedDates });
  } catch (error) {
    console.error('Error fetching date folders:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get files in a date folder
app.get('/api/r2/files', async (req, res) => {
  try {
    const folder = req.query.folder;

    if (!folder) {
      return res.status(400).json({ error: 'Folder parameter is required' });
    }

    const { s3Client, bucketName } = getR2Client();

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

    res.json({ files: files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get file content from R2
app.get('/api/r2/file-content', async (req, res) => {
  try {
    const fileKey = req.query.key;

    if (!fileKey) {
      return res.status(400).json({ error: 'File key parameter is required' });
    }

    const { s3Client, bucketName } = getR2Client();

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

    res.setHeader('Content-Type', contentType);
    res.send(content);
  } catch (error) {
    console.error('Error fetching file content:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from dist folder (if it exists) - MUST be after API routes
// This allows the server to serve both the frontend and API
import fs from 'fs';
const distPath = join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Fallback to index.html for client-side routing (SPA)
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(join(distPath, 'index.html'));
  });
  console.log('📦 Serving static files from dist/');
}

app.listen(PORT, () => {
  console.log(`🚀 R2 API Server running on port ${PORT}`);
  console.log(`📡 Endpoints available:`);
  console.log(`   - GET /api/r2/date-folders`);
  console.log(`   - GET /api/r2/files?folder=<date>`);
  console.log(`   - GET /api/r2/file-content?key=<fileKey>`);
  console.log(`   - GET /health`);
});

