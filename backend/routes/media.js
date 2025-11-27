const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const adminAuth = require('../middleware/adminAuth');
const Media = require('../models/Media');
const { uploadToCloudinary, uploadBufferToCloudinary } = require('../services/cloudinaryUpload');
const { isConfigured: isCloudinaryConfigured } = require('../config/cloudinary');

const router = express.Router();

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.wmv']);
const ALLOWED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

const storage = multer.memoryStorage();

// Default max upload size: 50MB for images, 500MB for videos
const MAX_UPLOAD_SIZE = parseInt(process.env.UPLOAD_MAX_SIZE || 500 * 1024 * 1024, 10); // 500MB default
const MAX_IMAGE_SIZE = parseInt(process.env.UPLOAD_MAX_IMAGE_SIZE || 20 * 1024 * 1024, 10); // 20MB for images (increased from 5MB)
const MAX_VIDEO_SIZE = parseInt(process.env.UPLOAD_MAX_VIDEO_SIZE || 500 * 1024 * 1024, 10); // 500MB for videos

const upload = multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_SIZE }, // Use MAX_UPLOAD_SIZE for multer, but we check MAX_IMAGE_SIZE separately
    fileFilter: (req, file, cb) => {
        const isImageMime = file.mimetype && file.mimetype.startsWith('image/');
        const isVideoMime = file.mimetype && file.mimetype.startsWith('video/');
        const ext = path.extname(file.originalname || '').toLowerCase();
        
        if (!isImageMime && !isVideoMime && !ALLOWED_EXTENSIONS.has(ext)) {
            return cb(new Error('Only image and video uploads are allowed'));
        }
        
        // File size checks are done after multer processes the file
        cb(null, true);
    }
});

router.get('/', adminAuth, async (req, res) => {
    try {
        const mediaItems = await Media.find().sort({ createdAt: -1 }).select('-data');
        res.json(mediaItems);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Handle multer errors (file size, file filter, etc.)
router.post('/', adminAuth, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        message: `File size exceeds maximum limit of ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB` 
                    });
                }
                return res.status(400).json({ message: `File upload error: ${err.message}` });
            }
            if (err.message === 'Only image and video uploads are allowed' || err.message.includes('file size exceeds maximum limit')) {
                return res.status(400).json({ message: err.message });
            }
            return res.status(500).json({ message: `Upload error: ${err.message}` });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const isImage = req.file.mimetype && req.file.mimetype.startsWith('image/');
        const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video/');
        const fileType = isImage ? 'image' : (isVideo ? 'video' : 'unknown');
        
        // Check file size based on type
        if (isImage && req.file.size > MAX_IMAGE_SIZE) {
            return res.status(400).json({ 
                message: `Image file size exceeds maximum limit of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB` 
            });
        }
        
        if (isVideo && req.file.size > MAX_VIDEO_SIZE) {
            return res.status(400).json({ 
                message: `Video file size exceeds maximum limit of ${MAX_VIDEO_SIZE / (1024 * 1024)}MB` 
            });
        }
        
        console.log('Media upload request received:', {
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            fileType: fileType,
            size: req.file.size,
            sizeMB: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
            folder: req.body?.folder || 'default',
            userId: req.user?.id
        });

        // For images and videos: Upload to Cloudinary instead of storing in database
        if (isImage || isVideo) {
            // Check if Cloudinary is configured
            if (!isCloudinaryConfigured) {
                return res.status(500).json({ 
                    message: 'Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file. Get credentials from https://cloudinary.com/console'
                });
            }

            try {
                const folder = req.body?.folder || (isVideo ? 'videos' : 'media');
                const resourceType = isVideo ? 'video' : 'image';
                console.log(`Uploading ${resourceType} to Cloudinary...`);
                
                // Upload buffer directly to Cloudinary
                const cloudinaryResult = await uploadBufferToCloudinary(
                    req.file.buffer,
                    req.file.originalname,
                    {
                        folder: folder,
                        public_id: `${resourceType}_${Date.now()}`,
                        resource_type: resourceType
                    }
                );

                console.log(`✅ ${resourceType} uploaded to Cloudinary:`, cloudinaryResult.url);

                // Save only metadata to database (no binary data)
                const mediaItem = new Media({
                    originalName: req.file.originalname,
                    filename: req.file.originalname,
                    mimeType: req.file.mimetype,
                    size: req.file.size,
                    storage: 'cloudinary', // Mark as Cloudinary storage
                    url: cloudinaryResult.url, // Store Cloudinary URL
                    metadata: {
                        folder: folder,
                        cloudinaryPublicId: cloudinaryResult.publicId,
                        cloudinaryAssetId: cloudinaryResult.assetId,
                        resourceType: resourceType,
                        ...(cloudinaryResult.width && { width: cloudinaryResult.width }),
                        ...(cloudinaryResult.height && { height: cloudinaryResult.height }),
                        ...(cloudinaryResult.format && { format: cloudinaryResult.format })
                    },
                    uploadedBy: req.user ? req.user.id : undefined
                    // Note: No 'data' field - not storing binary in database
                });

                await mediaItem.save();
                console.log('Media item metadata saved successfully:', mediaItem._id);

                return res.status(201).json({
                    _id: mediaItem._id,
                    originalName: mediaItem.originalName,
                    mimeType: mediaItem.mimeType,
                    size: mediaItem.size,
                    url: mediaItem.url, // Cloudinary URL
                    storage: mediaItem.storage,
                    metadata: mediaItem.metadata,
                    uploadedBy: mediaItem.uploadedBy,
                    createdAt: mediaItem.createdAt
                });

            } catch (cloudinaryError) {
                console.error('Cloudinary upload error:', cloudinaryError);
                return res.status(500).json({ 
                    message: `Failed to upload ${resourceType} to Cloudinary: ${cloudinaryError.message}` 
                });
            }
        }

        // For other file types: Store in database (fallback)
        const mediaItem = new Media({
            originalName: req.file.originalname,
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            storage: 'database',
            metadata: {
                folder: req.body?.folder || 'default'
            },
            data: req.file.buffer, // Only store binary for non-images
            uploadedBy: req.user ? req.user.id : undefined
        });

        mediaItem.url = `/api/media/${mediaItem._id}`;
        
        console.log('Saving media item to database (non-image file)...');
        await mediaItem.save();
        console.log('Media item saved successfully:', mediaItem._id);

        res.status(201).json({
            _id: mediaItem._id,
            originalName: mediaItem.originalName,
            mimeType: mediaItem.mimeType,
            size: mediaItem.size,
            url: mediaItem.url,
            storage: mediaItem.storage,
            metadata: mediaItem.metadata,
            uploadedBy: mediaItem.uploadedBy,
            createdAt: mediaItem.createdAt
        });
    } catch (error) {
        console.error('Media upload failed:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        let errorMessage = 'Error uploading media file';
        if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const mediaItem = await Media.findById(req.params.id);
        if (!mediaItem) {
            return res.status(404).json({ message: 'Media not found' });
        }

        // If stored in Cloudinary, delete from Cloudinary first
        if (mediaItem.storage === 'cloudinary' && mediaItem.metadata?.cloudinaryPublicId) {
            try {
                const { deleteFromCloudinary } = require('../services/cloudinaryUpload');
                await deleteFromCloudinary(mediaItem.metadata.cloudinaryPublicId);
                console.log('✅ Image deleted from Cloudinary:', mediaItem.metadata.cloudinaryPublicId);
            } catch (cloudinaryError) {
                console.error('⚠️ Failed to delete from Cloudinary (continuing with DB delete):', cloudinaryError.message);
                // Continue with database deletion even if Cloudinary deletion fails
            }
        }

        await mediaItem.deleteOne();

        res.json({ message: 'Media deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
