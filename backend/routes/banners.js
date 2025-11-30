const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const Media = require('../models/Media');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { uploadBanner, deleteTempFile } = require('../middleware/bannerUpload');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const { prepareSignedUploadParams } = require('../utils/cloudinarySignature');

// Helper to detect video type from URL
function detectVideoType(url) {
    if (!url) return null;
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/embed')) {
        return 'youtube';
    }
    if (url.includes('vimeo.com/')) {
        return 'vimeo';
    }
    if (url.match(/\.(mp4|webm|ogg|mov|avi|wmv|m4v|flv)$/i)) {
        return 'direct';
    }
    if (url.includes('/video/upload') || url.includes('resource_type=video')) {
        return 'file'; // Cloudinary video
    }
    return null;
}

// Helper to extract YouTube video ID
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Upload banner file (image or video) to Cloudinary
router.post('/upload', adminAuth, uploadBanner, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if Cloudinary is configured
    if (!isConfigured || !cloudinary) {
        if (req.file && req.file.path) {
            deleteTempFile(req.file.path);
        }
        return res.status(500).json({ 
            message: 'Cloudinary is not configured. Please check your environment variables.' 
        });
    }

    try {
        // Detect file type from mimetype
        const mimetype = req.file.mimetype;
        const isImage = mimetype.startsWith('image/');
        const isVideo = mimetype.startsWith('video/');
        
        if (!isImage && !isVideo) {
            deleteTempFile(req.file.path);
            return res.status(400).json({ 
                message: 'Invalid file type. Only images and videos are allowed.' 
            });
        }

        const resourceType = isImage ? 'image' : 'video';
        const bannerType = isImage ? 'image' : 'video';

        // Get Cloudinary credentials
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!apiKey || !apiSecret) {
            deleteTempFile(req.file.path);
            return res.status(500).json({ 
                message: 'Cloudinary API credentials are missing. Please check your environment variables.' 
            });
        }

        // Build base upload options
        const baseOptions = {
            folder: 'banners',
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true
        };

        // If upload preset is configured, use unsigned upload (no signature needed)
        if (process.env.CLOUDINARY_UPLOAD_PRESET) {
            baseOptions.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
            console.log('Using unsigned upload with preset:', process.env.CLOUDINARY_UPLOAD_PRESET);
            
            // Use standard upload method with preset (no signature needed)
            const result = await cloudinary.uploader.upload(req.file.path, baseOptions);
            const secureUrl = result.secure_url;

            // Delete temporary file
            deleteTempFile(req.file.path);

            // Save to MongoDB
            const banner = new Banner({
                title: req.body.title || '',
                description: req.body.description || '',
                image: secureUrl,
                banner_type: bannerType,
                link: req.body.link || '#',
                position: req.body.position || 'middle',
                size: req.body.size || 'medium',
                isActive: req.body.isActive !== undefined ? req.body.isActive : true
            });
            
            // Handle custom dimensions
            if (req.body.size === 'custom') {
                if (req.body.customWidth) {
                    banner.customWidth = parseInt(req.body.customWidth, 10);
                }
                if (req.body.customHeight) {
                    banner.customHeight = parseInt(req.body.customHeight, 10);
                }
            }

            await banner.save();

            // Return JSON response
            return res.status(201).json({
                url: secureUrl,
                type: bannerType
            });
        }

        // For signed uploads, generate signature manually
        console.log('Using signed upload - generating signature...');
        
        // Prepare signed parameters
        const signedParams = prepareSignedUploadParams(baseOptions, apiKey, apiSecret);
        
        console.log('Uploading to Cloudinary with signed params:', {
            folder: signedParams.folder,
            resource_type: signedParams.resource_type,
            timestamp: signedParams.timestamp,
            api_key: signedParams.api_key ? '***' : undefined,
            signature: signedParams.signature ? signedParams.signature.substring(0, 8) + '...' : undefined
        });

        // IMPORTANT: When using manual signature, we need to temporarily remove api_secret from config
        // to prevent SDK from auto-generating signature, OR use the upload_stream method
        // The SDK will use our manual signature if we provide it
        
        // Use standard upload method with signed parameters
        // The SDK should use our provided signature instead of generating its own
        const result = await cloudinary.uploader.upload(req.file.path, {
            ...signedParams,
            // Explicitly set resource_type (required for videos)
            resource_type: resourceType
        });
        const secureUrl = result.secure_url;

        // Delete temporary file
        deleteTempFile(req.file.path);

        // Detect video type if it's a video
        const videoType = bannerType === 'video' ? detectVideoType(secureUrl) : null;
        
        // Save to MongoDB
        const banner = new Banner({
            title: req.body.title || '',
            description: req.body.description || '',
            image: secureUrl,
            banner_type: bannerType,
            video_type: videoType,
            link: req.body.link || '#',
            position: req.body.position || 'middle',
            size: req.body.size || 'medium',
            isActive: req.body.isActive !== undefined ? req.body.isActive : true
        });
        
        // Handle custom dimensions
        if (req.body.size === 'custom') {
            if (req.body.customWidth) {
                banner.customWidth = parseInt(req.body.customWidth, 10);
            }
            if (req.body.customHeight) {
                banner.customHeight = parseInt(req.body.customHeight, 10);
            }
        }

        await banner.save();

        // Return JSON response
        res.status(201).json({
            url: secureUrl,
            type: bannerType,
            video_type: videoType
        });
    } catch (error) {
        // Clean up temp file on error
        if (req.file && req.file.path) {
            deleteTempFile(req.file.path);
        }
        
        console.error('Banner upload error:', error);
        console.error('Error details:', {
            message: error.message,
            http_code: error.http_code,
            name: error.name
        });
        
        // Provide more helpful error messages
        let errorMessage = 'Failed to upload banner';
        if (error.message && error.message.includes('Invalid Signature')) {
            errorMessage = 'Cloudinary authentication error. Please check your CLOUDINARY_API_SECRET in environment variables.';
        } else if (error.message) {
            errorMessage = `Failed to upload banner: ${error.message}`;
        }
        
        res.status(500).json({ 
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

async function assignImageFields(target, body) {
    const providedUrl = body.image;
    if (providedUrl !== undefined) {
        target.image = providedUrl;
    }

    const fileId = body.imageFileId;
    if (fileId && fileId !== 'null' && fileId !== 'undefined') {
        const media = await Media.findById(fileId);
        if (!media) {
            const error = new Error('Invalid image file reference');
            error.statusCode = 400;
            throw error;
        }
        target.imageUpload = media._id;
        if (!target.image) {
            target.image = media.url;
        }
    } else if (fileId === '' || fileId === null) {
        target.imageUpload = undefined;
    }
}

// Get all active banners
router.get('/', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true })
            .select('title description image imageUpload link position size customWidth customHeight isActive banner_type video_type')
            .populate('imageUpload', 'url')
            .sort({ createdAt: -1 })
            .lean(); // Faster queries
        
        // Reduced cache time to ensure deleted banners disappear quickly
        // If _t (timestamp) parameter is present, use no-cache to bypass cache
        if (req.query._t) {
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
        } else {
            // Short cache for normal requests
            res.set({
                'Cache-Control': 'public, max-age=60, s-maxage=120', // 1 min browser, 2 min CDN
                'Vary': 'Accept-Encoding'
            });
        }
        res.json(banners);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get banner by ID (public route for homepage sections, also used by admin for editing)
router.get('/detail/:id', async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id)
            .select('title description image imageUpload link position size customWidth customHeight isActive banner_type video_type')
            .populate('imageUpload', 'url')
            .lean();
        if (!banner) {
            return res.status(404).json({ message: 'Banner not found' });
        }
        // For admin editing, return even if inactive
        // For public use, check isActive (but this route is mainly for admin)
        res.json(banner);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get banner by position
router.get('/:position', async (req, res) => {
    try {
        const banner = await Banner.findOne({
            position: req.params.position,
            isActive: true
        }).populate('imageUpload');

        if (!banner) {
            return res.status(404).json({ message: 'Banner not found' });
        }
        res.json(banner);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new banner (admin only)
router.post('/', adminAuth, async (req, res) => {
    // Detect if image URL is a YouTube/Vimeo video
    const imageUrl = req.body.image || '';
    const detectedVideoType = detectVideoType(imageUrl);
    const bannerType = detectedVideoType ? 'video' : (req.body.banner_type || 'image');
    
    const banner = new Banner({
        title: req.body.title || '',
        description: req.body.description || '',
        image: imageUrl,
        banner_type: bannerType,
        video_type: detectedVideoType,
        link: req.body.link,
        position: req.body.position || 'middle',
        size: req.body.size || 'medium',
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });
    
    // Handle custom dimensions
    if (req.body.size === 'custom') {
        if (req.body.customWidth) {
            banner.customWidth = parseInt(req.body.customWidth, 10);
        }
        if (req.body.customHeight) {
            banner.customHeight = parseInt(req.body.customHeight, 10);
        }
    }

    try {
        await assignImageFields(banner, req.body);
        
        // Re-detect video type after image fields are assigned (in case URL changed)
        if (banner.image) {
            const finalVideoType = detectVideoType(banner.image);
            if (finalVideoType) {
                banner.banner_type = 'video';
                banner.video_type = finalVideoType;
            }
        }
        
        const newBanner = await banner.save();
        const populatedBanner = await Banner.findById(newBanner._id).populate('imageUpload');
        res.status(201).json(populatedBanner);
    } catch (err) {
        const status = err.statusCode || 400;
        let errorMessage = err.message;
        
        // Provide more detailed error message for validation errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors || {}).map(e => e.message).join(', ');
            errorMessage = `Validation Error: ${validationErrors || err.message}`;
        } else if (err.name === 'CastError') {
            errorMessage = `Invalid value: ${err.message}`;
        }
        
        console.error('Banner creation error:', err);
        res.status(status).json({ message: errorMessage });
    }
});

// Update a banner (admin only)
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ message: 'Banner not found' });
        }

        console.log('Updating banner with position:', req.body.position);
        
        // Allow empty strings to be saved (don't use || operator which treats empty string as falsy)
        if (req.body.title !== undefined) {
            banner.title = req.body.title || '';
        }
        if (req.body.description !== undefined) {
            banner.description = req.body.description || '';
        }
        banner.link = req.body.link || banner.link;
        banner.position = req.body.position || banner.position;
        banner.size = req.body.size || banner.size || 'medium';
        banner.isActive = req.body.isActive !== undefined ? req.body.isActive : banner.isActive;
        
        // Handle custom dimensions
        if (req.body.size === 'custom') {
            if (req.body.customWidth !== undefined) {
                banner.customWidth = parseInt(req.body.customWidth, 10) || null;
            }
            if (req.body.customHeight !== undefined) {
                banner.customHeight = parseInt(req.body.customHeight, 10) || null;
            }
        } else {
            // Clear custom dimensions if not using custom size
            banner.customWidth = null;
            banner.customHeight = null;
        }

        await assignImageFields(banner, req.body);
        
        // Detect video type from image URL
        if (banner.image) {
            const detectedVideoType = detectVideoType(banner.image);
            if (detectedVideoType) {
                banner.banner_type = 'video';
                banner.video_type = detectedVideoType;
            } else if (req.body.banner_type) {
                banner.banner_type = req.body.banner_type;
                banner.video_type = null;
            }
        } else if (req.body.banner_type) {
            banner.banner_type = req.body.banner_type;
        }

        await banner.save();
        const populatedBanner = await Banner.findById(banner._id).populate('imageUpload');

        // Note: Banner position updates are now handled via HomepageSection model
        // Top banners can be manually added to homepage sections in admin dashboard

        res.json(populatedBanner);
    } catch (err) {
        const status = err.statusCode || 400;
        let errorMessage = err.message;
        
        // Provide more detailed error message for validation errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors || {}).map(e => e.message).join(', ');
            errorMessage = `Validation Error: ${validationErrors || err.message}`;
        } else if (err.name === 'CastError') {
            errorMessage = `Invalid value: ${err.message}`;
        }
        
        console.error('Banner update error:', err);
        res.status(status).json({ message: errorMessage });
    }
});

// Delete a banner (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ message: 'Banner not found' });
        }

        const position = banner.position;
        const image = banner.image;

        // Actually delete the banner from database
        await banner.deleteOne();

        // Note: Banner position updates are now handled via HomepageSection model
        // Top banners can be manually managed in homepage sections in admin dashboard

        res.json({ message: 'Banner deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;