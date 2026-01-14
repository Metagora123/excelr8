// Simple test endpoint to verify Vercel serverless functions are working
export default async function handler(req, res) {
  return res.status(200).json({
    message: '✅ Vercel serverless functions are working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    env: {
      hasR2AccountId: !!process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID,
      hasR2AccessKey: !!process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID,
      hasR2Secret: !!process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      hasR2Bucket: !!process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME,
      hasR2Endpoint: !!process.env.VITE_CLOUDFLARE_R2_ENDPOINT,
    },
  });
}

