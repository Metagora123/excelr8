// Vercel Serverless Function for R2 files in a date folder
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const folder = req.query.folder;

    if (!folder) {
      return res.status(400).json({ error: 'Folder parameter is required' });
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

    // Get files in the folder
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

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({ files: files });
  } catch (error) {
    console.error('[R2 API] Error fetching files:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
}

