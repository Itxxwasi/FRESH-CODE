const { cloudinary, isConfigured } = require('../config/cloudinary');
const { prepareSignedUploadParams } = require('../utils/cloudinarySignature');
const fs = require('fs');
const path = require('path');

// Helper function to check if Cloudinary is configured
const checkCloudinaryConfig = () => {
    if (!isConfigured || !cloudinary) {
        throw new Error(
            'Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file. ' +
            'Get your credentials from https://cloudinary.com/console'
        );
    }
};

/**
 * Upload image to Cloudinary
 * @param {String} filePath - Path to the file to upload
 * @param {Object} options - Upload options (folder, transformation, etc.)
 * @returns {Promise<Object>} - Cloudinary upload result with secure URL
 */
const uploadToCloudinary = async (filePath, options = {}) => {
    try {
        // Check if Cloudinary is configured
        checkCloudinaryConfig();

        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        const baseOptions = {
            folder: options.folder || 'products',
            resource_type: options.resource_type || 'auto',
            ...options
        };

        // Remove problematic options that can cause signature issues
        delete baseOptions.overwrite;
        delete baseOptions.invalidate;

        // If upload preset is configured, use unsigned upload
        if (process.env.CLOUDINARY_UPLOAD_PRESET) {
            baseOptions.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
            console.log('Using unsigned upload with preset for file upload');
        } else if (apiKey && apiSecret) {
            // Use signed upload with manual signature
            const signedParams = prepareSignedUploadParams(baseOptions, apiKey, apiSecret);
            Object.assign(baseOptions, signedParams);
        }

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(filePath, baseOptions);

        // Return the secure URL and public ID
        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            assetId: result.asset_id
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
    }
};

/**
 * Delete image from Cloudinary
 * @param {String} publicId - Cloudinary public ID of the image
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFromCloudinary = async (publicId) => {
    try {
        // Check if Cloudinary is configured
        checkCloudinaryConfig();

        const result = await cloudinary.uploader.destroy(publicId);
        return {
            success: result.result === 'ok',
            result: result.result
        };
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw new Error(`Failed to delete image from Cloudinary: ${error.message}`);
    }
};

/**
 * Upload image from buffer (for direct upload without saving to disk first)
 * @param {Buffer} buffer - File buffer
 * @param {String} filename - Original filename
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadBufferToCloudinary = async (buffer, filename, options = {}) => {
    return new Promise((resolve, reject) => {
        try {
            // Check if Cloudinary is configured
            checkCloudinaryConfig();
        } catch (error) {
            reject(error);
            return;
        }

        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        const baseOptions = {
            folder: options.folder || 'products',
            resource_type: options.resource_type || 'auto',
            ...options
        };

        // If upload preset is configured, use unsigned upload
        if (process.env.CLOUDINARY_UPLOAD_PRESET) {
            baseOptions.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
            console.log('Using unsigned upload with preset for buffer upload');
        } else if (apiKey && apiSecret) {
            // Use signed upload with manual signature
            // Note: public_id needs to be included in signature if provided
            const signedParams = prepareSignedUploadParams(baseOptions, apiKey, apiSecret);
            Object.assign(baseOptions, signedParams);
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            baseOptions,
            (error, result) => {
                if (error) {
                    reject(new Error(`Failed to upload image to Cloudinary: ${error.message}`));
                } else {
                    resolve({
                        success: true,
                        url: result.secure_url,
                        publicId: result.public_id,
                        width: result.width,
                        height: result.height,
                        format: result.format,
                        bytes: result.bytes,
                        assetId: result.asset_id
                    });
                }
            }
        );

        uploadStream.end(buffer);
    });
};

module.exports = {
    uploadToCloudinary,
    deleteFromCloudinary,
    uploadBufferToCloudinary
};

