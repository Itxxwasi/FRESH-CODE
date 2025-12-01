const mongoose = require('mongoose');

const SliderSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        trim: true
    },
    imageMobile: {
        type: String,
        trim: true
    },
    imageAlt: {
        type: String,
        trim: true
    },
    imageUpload: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    },
    imageMobileUpload: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    },
    // Optional YouTube video URL (if provided, shows video instead of image)
    videoUrl: {
        type: String,
        trim: true
    },
    // Video type: 'youtube', 'vimeo', 'direct', 'file'
    videoType: {
        type: String,
        enum: ['youtube', 'vimeo', 'direct', 'file'],
        default: null
    },
    buttonText: {
        type: String,
        trim: true
    },
    buttonLink: {
        type: String,
        trim: true
    },
    link: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Slider', SliderSchema);