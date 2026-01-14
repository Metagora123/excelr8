// Simple script to test Cloudflare R2 S3-compatible API credentials
// Run with: npm run test-r2

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const accountId = process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;
const endpoint = process.env.VITE_CLOUDFLARE_R2_ENDPOINT;

console.log('🔍 Testing Cloudflare R2 Connection...\n');
console.log('Configuration:');
console.log('  Account ID:', accountId ? '✅ Set' : '❌ Missing');
console.log('  Access Key ID:', accessKeyId ? '✅ Set' : '❌ Missing');
console.log('  Secret Access Key:', secretAccessKey ? '✅ Set' : '❌ Missing');
console.log('  Bucket Name:', bucketName || '❌ Missing');
console.log('  Endpoint:', endpoint || '❌ Missing');
console.log('');

// Check if all required variables are set
if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
  console.error('❌ Missing required environment variables!');
  console.error('Please check your .env file.');
  process.exit(1);
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

// Test connection by listing objects
async function testConnection() {
  try {
    console.log('📡 Attempting to connect to R2...\n');
    
    // List first 10 objects in the bucket
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 10,
    });
    
    const response = await s3Client.send(command);
    
    console.log('✅ Connection successful!\n');
    console.log('📦 Bucket:', bucketName);
    console.log('📊 Objects found:', response.KeyCount || 0);
    console.log('');
    
    if (response.Contents && response.Contents.length > 0) {
      console.log('📄 Sample objects:');
      response.Contents.forEach((object, index) => {
        console.log(`  ${index + 1}. ${object.Key} (${(object.Size / 1024).toFixed(2)} KB)`);
      });
    } else {
      console.log('ℹ️  Bucket is empty or no objects found.');
    }
    
    // Check for date folders
    console.log('\n📅 Looking for date folders (YYYY-MM-DD/)...');
    const dateFolders = new Set();
    
    if (response.Contents) {
      response.Contents.forEach((object) => {
        const match = object.Key.match(/^(\d{4}-\d{2}-\d{2})\//);
        if (match) {
          dateFolders.add(match[1]);
        }
      });
    }
    
    if (dateFolders.size > 0) {
      console.log('✅ Date folders found:');
      Array.from(dateFolders).sort().forEach(date => {
        console.log(`  - ${date}/`);
      });
    } else {
      console.log('ℹ️  No date folders found in first 10 objects.');
      console.log('   (Try listing more objects if you have many files)');
    }
    
    console.log('\n✅ All credentials are correct!');
    
  } catch (error) {
    console.error('\n❌ Connection failed!\n');
    console.error('Error:', error.message);
    
    if (error.name === 'InvalidAccessKeyId') {
      console.error('\n💡 Check your Access Key ID');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.error('\n💡 Check your Secret Access Key');
    } else if (error.name === 'NoSuchBucket') {
      console.error('\n💡 Check your Bucket Name');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Check your Endpoint URL');
    }
    
    process.exit(1);
  }
}

testConnection();

