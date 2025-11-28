const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
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
    isActive: {
        type: Boolean,
        default: true
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
SubcategorySchema.index({ category: 1, isActive: 1 });
SubcategorySchema.index({ ordering: 1 });

module.exports = mongoose.model('Subcategory', SubcategorySchema);

