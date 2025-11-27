const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Check if Cloudinary credentials are set
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// Verify Cloudinary configuration - check for actual values, not placeholders
const isCloudinaryConfigured = cloudName && apiKey && apiSecret && 
    cloudName.trim() !== '' &&
    apiKey.trim() !== '' &&
    apiSecret.trim() !== '' &&
    cloudName !== 'your_cloudinary_cloud_name' && 
    apiKey !== 'your_cloudinary_api_key' && 
    apiSecret !== 'your_cloudinary_api_secret' &&
    !cloudName.includes('your_') &&
    !apiKey.includes('your_') &&
    !apiSecret.includes('your_');

if (!isCloudinaryConfigured) {
    console.warn('⚠️  Cloudinary credentials not configured or using placeholder values.');
    console.warn('   Please set these in your .env file:');
    console.warn('   - CLOUDINARY_CLOUD_NAME=your_actual_cloud_name');
    console.warn('   - CLOUDINARY_API_KEY=your_actual_api_key');
    console.warn('   - CLOUDINARY_API_SECRET=your_actual_api_secret');
    console.warn('   Get your credentials from: https://cloudinary.com/console');
    console.warn('   Image uploads will fail until Cloudinary is properly configured.');
} else {
    // Only configure if credentials are valid
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true // Use HTTPS
    });
    console.log('✅ Cloudinary configured successfully');
    
    // Optional: Test credentials (async, don't block startup)
    if (process.env.NODE_ENV === 'development') {
        cloudinary.api.ping()
            .then(result => {
                console.log('✅ Cloudinary connection test successful');
            })
            .catch(err => {
                console.error('⚠️  Cloudinary connection test failed:', err.message);
                console.error('   Please verify your API credentials are correct.');
            });
    }
}

// Export configured cloudinary and configuration status
module.exports = {
    cloudinary: isCloudinaryConfigured ? cloudinary : null,
    isConfigured: isCloudinaryConfigured
};

