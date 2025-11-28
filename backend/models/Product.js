const mongoose = require('mongoose');
const Category = require('./Category');

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
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
    images: [{
        type: String
    }],
    imageUploads: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    }],
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    subcategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subcategory'
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    isTrending: {
        type: Boolean,
        default: false
    },
    isNewArrival: {
        type: Boolean,
        default: false
    },
    isBestSelling: {
        type: Boolean,
        default: false
    },
    isTopSelling: {
        type: Boolean,
        default: false
    },
    sections: {
        type: [String],
        default: [],
        enum: [
            'Top Selling Product',
            'Lingerie Collection',
            'Product Feature Collection',
            '10.10 Mega Sale',
            'New Arrivals',
            'Best Sellers',
            'On Sale'
        ]
    },
    // Keep collectionName for backward compatibility but deprecated
    collectionName: {
        type: String,
        trim: true,
        default: ''
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

// Pre-save hook: Auto-sync department from category
// This ensures Department > Category > Product hierarchy is always maintained
ProductSchema.pre('save', async function(next) {
    // Only run if category is modified or department is not set
    if (this.isModified('category') || !this.department) {
        try {
            // Populate category if it's just an ID
            let category;
            if (this.category && typeof this.category === 'object' && this.category.department) {
                // Already populated
                category = this.category;
            } else {
                // Need to fetch category
                category = await Category.findById(this.category);
            }
            
            if (!category) {
                return next(new Error('Invalid category: Category not found'));
            }
            
            if (!category.department) {
                return next(new Error('Invalid category: Category does not have an associated department'));
            }
            
            // Auto-set department from category's department
            this.department = category.department;
            console.log(`✅ Auto-synced department from category for product: ${this.name}`);
        } catch (error) {
            return next(error);
        }
    } else if (this.isModified('department') && this.category) {
        // Validate that department matches category's department
        try {
            let category;
            if (this.category && typeof this.category === 'object' && this.category.department) {
                category = this.category;
            } else {
                category = await Category.findById(this.category);
            }
            
            if (category && category.department) {
                const categoryDeptId = category.department.toString();
                const productDeptId = this.department.toString();
                
                if (categoryDeptId !== productDeptId) {
                    // Auto-correct: use category's department
                    console.warn(`⚠️  Department mismatch detected for product "${this.name}". Auto-correcting to match category's department.`);
                    this.department = category.department;
                }
            }
        } catch (error) {
            // Log but don't fail - let validation handle it
            console.warn('Warning: Could not validate department-category relationship:', error.message);
        }
    }
    
    next();
});

// Index for faster queries
ProductSchema.index({ department: 1, category: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ department: 1 });

module.exports = mongoose.model('Product', ProductSchema);