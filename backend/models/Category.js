const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
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
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    ordering: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
CategorySchema.index({ ordering: 1 });
CategorySchema.index({ department: 1, isActive: 1 });

module.exports = mongoose.model('Category', CategorySchema);