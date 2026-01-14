// Vercel Serverless Function for R2 file content
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const fileKey = req.query.key;

    if (!fileKey) {
      return res.status(400).json({ error: 'File key parameter is required' });
    }

    // Get R2 credentials from environment variables
    const accountId = process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;
    const endpoint = process.env.VITE_CLOUDFLARE_R2_ENDPOINT;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
      return res.status(500).json({ error: 'Missing R2 configuration' });
    }

    // Create S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    // Get file content
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

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', contentType);

    return res.status(200).send(content);
  } catch (error) {
    console.error('[R2 API] Error fetching file content:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
}

