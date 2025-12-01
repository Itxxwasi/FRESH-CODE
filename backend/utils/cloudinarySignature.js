const crypto = require('crypto');

/**
 * Generate Cloudinary signature for uploads
 * Cloudinary signature format:
 * 1. Sort all parameters alphabetically by key
 * 2. Format as "key=value" pairs
 * 3. Join with "&"
 * 4. Append API_SECRET
 * 5. Hash using SHA-1
 * 
 * @param {Object} params - Upload parameters
 * @param {string} apiSecret - Cloudinary API secret
 * @returns {string} - SHA-1 hash signature
 */
function generateCloudinarySignature(params, apiSecret) {
    // Sort parameters alphabetically by key
    const sortedKeys = Object.keys(params).sort();
    
    // Create string to sign: "key1=value1&key2=value2&..."
    const stringToSign = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join('&');
    
    // Append API secret
    const stringWithSecret = stringToSign + apiSecret;
    
    // Generate SHA-1 hash
    const signature = crypto
        .createHash('sha1')
        .update(stringWithSecret)
        .digest('hex');
    
    return signature;
}

/**
 * Generate timestamp for Cloudinary upload
 * @returns {number} - Unix timestamp in seconds
 */
function generateTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * Prepare upload parameters with signature
 * Cloudinary signature requirements:
 * 1. Sort all parameters alphabetically (excluding signature itself)
 * 2. Format as "key=value" pairs
 * 3. Join with "&"
 * 4. Append API_SECRET
 * 5. SHA-1 hash
 * 
 * @param {Object} options - Upload options (folder, resource_type, etc.)
 * @param {string} apiKey - Cloudinary API key
 * @param {string} apiSecret - Cloudinary API secret
 * @returns {Object} - Parameters with timestamp, api_key, and signature
 */
function prepareSignedUploadParams(options, apiKey, apiSecret) {
    // Generate timestamp (Unix timestamp in seconds)
    const timestamp = generateTimestamp();
    
    // Build parameters object for signing
    // Note: Only include parameters that should be signed
    // Exclude: signature, file, resource_type (handled separately by SDK)
    // IMPORTANT: Cloudinary expects boolean values as lowercase string "true", not "1"
    const paramsForSigning = {
        folder: options.folder || '',
        timestamp: timestamp
    };
    
    // Add public_id if provided (needs to be in signature)
    if (options.public_id) {
        paramsForSigning.public_id = options.public_id;
    }
    
    // Add boolean parameters as lowercase string "true" (Cloudinary's expected format)
    if (options.unique_filename) {
        paramsForSigning.unique_filename = 'true';
    }
    if (options.use_filename) {
        paramsForSigning.use_filename = 'true';
    }
    
    // Generate signature from parameters
    const signature = generateCloudinarySignature(paramsForSigning, apiSecret);
    
    // Build final upload parameters
    // Include all original options plus signature-related params
    const uploadParams = {
        ...options,
        timestamp: timestamp,
        api_key: apiKey,
        signature: signature
    };
    
    // Convert boolean values to lowercase string "true" for Cloudinary
    if (uploadParams.unique_filename === true) {
        uploadParams.unique_filename = 'true';
    }
    if (uploadParams.use_filename === true) {
        uploadParams.use_filename = 'true';
    }
    
    // Remove undefined values from final params
    Object.keys(uploadParams).forEach(key => {
        if (uploadParams[key] === undefined || uploadParams[key] === null) {
            delete uploadParams[key];
        }
    });
    
    return uploadParams;
}

module.exports = {
    generateCloudinarySignature,
    generateTimestamp,
    prepareSignedUploadParams
};

