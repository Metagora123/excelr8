// Vercel Serverless Function for R2 date folders
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
  // Add detailed logging for debugging
  console.log('[R2 API] Request received:', {
    method: req.method,
    url: req.url,
    query: req.query,
  });

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get R2 credentials from environment variables
    // Note: In Vercel, env vars are available as-is (no VITE_ prefix needed for serverless functions)
    // But we keep VITE_ prefix for consistency with the rest of the codebase
    const accountId = process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;
    const endpoint = process.env.VITE_CLOUDFLARE_R2_ENDPOINT;

    // Log what we have (but don't log secrets)
    console.log('[R2 API] Config check:', {
      accountId: accountId ? '✅ Set' : '❌ Missing',
      accessKeyId: accessKeyId ? '✅ Set' : '❌ Missing',
      secretAccessKey: secretAccessKey ? '✅ Set' : '❌ Missing',
      bucketName: bucketName || '❌ Missing',
      endpoint: endpoint || '❌ Missing',
    });

    // Validate configuration
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
      const missing = [];
      if (!accountId) missing.push('VITE_CLOUDFLARE_R2_ACCOUNT_ID');
      if (!accessKeyId) missing.push('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID');
      if (!secretAccessKey) missing.push('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY');
      if (!bucketName) missing.push('VITE_CLOUDFLARE_R2_BUCKET_NAME');
      if (!endpoint) missing.push('VITE_CLOUDFLARE_R2_ENDPOINT');

      console.error('[R2 API] ❌ Missing configuration:', missing);
      return res.status(500).json({
        error: 'Missing R2 configuration',
        missing: missing,
        hint: 'Make sure all R2 environment variables are set in Vercel project settings',
      });
    }

    // Validate endpoint format
    if (!endpoint.startsWith('https://')) {
      console.error('[R2 API] ❌ Invalid endpoint format:', endpoint);
      return res.status(500).json({
        error: 'Invalid R2 endpoint format',
        endpoint: endpoint,
        hint: 'Endpoint should start with https:// (e.g., https://your-account-id.r2.cloudflarestorage.com)',
      });
    }

    console.log('[R2 API] Creating S3 client with endpoint:', endpoint);

    // Create S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    console.log('[R2 API] Fetching date folders from bucket:', bucketName);

    // Get all date folders
    const dateFolders = new Set();
    let continuationToken = null;
    let totalObjects = 0;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);
      totalObjects += response.KeyCount || 0;

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

    console.log('[R2 API] ✅ Success! Found', sortedDates.length, 'date folders from', totalObjects, 'total objects');

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({ dateFolders: sortedDates });
  } catch (error) {
    console.error('[R2 API] ❌ Error fetching date folders:', error);
    console.error('[R2 API] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    
    return res.status(500).json({
      error: error.message || 'Internal server error',
      type: error.name,
      hint: 'Check Vercel function logs for more details',
    });
  }
}
