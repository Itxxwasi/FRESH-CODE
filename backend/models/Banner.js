const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
    title: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        trim: true
    },
    imageAlt: {
        type: String,
        trim: true
    },
    banner_type: {
        type: String,
        enum: ['image', 'video'],
        default: 'image'
    },
    // Video type: 'youtube', 'vimeo', 'direct', 'file' (for video banners)
    video_type: {
        type: String,
        enum: ['youtube', 'vimeo', 'direct', 'file'],
        default: null
    },
    imageUpload: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    },
    link: {
        type: String,
        required: true
    },
    position: {
        type: String,
        // Allow dynamic positions based on section IDs (format: "after-section-{sectionId}")
        // Also support legacy positions for backward compatibility
        required: true,
        default: 'middle',
        // Custom validator to accept any string value (no enum restriction)
        validate: {
            validator: function(v) {
                return typeof v === 'string' && v.length > 0;
            },
            message: 'Position must be a non-empty string'
        }
    },
    size: {
        type: String,
        enum: ['small', 'medium', 'large', 'full-width', 'custom'],
        default: 'medium'
    },
    customWidth: {
        type: Number,
        min: 100,
        max: 5000
    },
    customHeight: {
        type: Number,
        min: 50,
        max: 2000
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Banner', BannerSchema);