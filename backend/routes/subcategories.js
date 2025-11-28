const express = require('express');
const router = express.Router();
const Subcategory = require('../models/Subcategory');
const Category = require('../models/Category');
const Media = require('../models/Media');
const adminAuth = require('../middleware/adminAuth');

async function assignImageFields(target, body) {
    try {
        const providedUrl = body.image;
        if (providedUrl !== undefined && providedUrl !== null && providedUrl !== '') {
            target.image = providedUrl.trim();
        }

        const fileId = body.imageFileId;
        if (fileId && fileId !== 'null' && fileId !== 'undefined' && fileId !== '') {
            try {
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
            } catch (mediaError) {
                if (mediaError.statusCode) {
                    throw mediaError;
                }
                const error = new Error('Error finding image file: ' + mediaError.message);
                error.statusCode = 400;
                throw error;
            }
        } else if (fileId === '' || fileId === null || fileId === undefined) {
            if (body.imageFileId === '' || body.imageFileId === null) {
                target.imageUpload = undefined;
            }
        }
    } catch (err) {
        console.error('Error assigning image fields:', err);
        throw err;
    }
}

// Get all subcategories (public - only active)
router.get('/', async (req, res) => {
    try {
        const { categoryId } = req.query;
        const query = { isActive: true };
        
        if (categoryId) {
            query.category = categoryId;
        }
        
        const subcategories = await Subcategory.find(query)
            .populate('category', 'name _id')
            .populate('imageUpload')
            .sort({ ordering: 1, name: 1 });
        
        // Always return an array, even if empty
        res.json(Array.isArray(subcategories) ? subcategories : []);
    } catch (err) {
        console.error('Error fetching subcategories:', err);
        res.status(500).json({ message: err.message });
    }
});

// Admin route - Get all subcategories (including inactive)
router.get('/admin', adminAuth, async (req, res) => {
    try {
        const { categoryId } = req.query;
        const query = {};
        
        if (categoryId) {
            query.category = categoryId;
        }
        
        const subcategories = await Subcategory.find(query)
            .populate('category', 'name _id')
            .populate('imageUpload')
            .sort({ ordering: 1, name: 1 });
        
        // Always return an array, even if empty
        res.json(Array.isArray(subcategories) ? subcategories : []);
    } catch (err) {
        console.error('Error fetching subcategories for admin:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get subcategories by category
router.get('/category/:categoryId', async (req, res) => {
    try {
        const subcategories = await Subcategory.find({
            category: req.params.categoryId,
            isActive: true
        })
            .populate('category', 'name _id')
            .populate('imageUpload')
            .sort({ ordering: 1, name: 1 });
        
        res.json(subcategories);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get subcategory by ID
router.get('/:id', async (req, res) => {
    try {
        const subcategory = await Subcategory.findById(req.params.id)
            .populate('category', 'name _id')
            .populate('imageUpload');
        
        if (!subcategory) {
            return res.status(404).json({ message: 'Subcategory not found' });
        }
        
        res.json(subcategory);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin routes - Create subcategory
router.post('/', adminAuth, async (req, res) => {
    try {
        // Validate category exists
        const category = await Category.findById(req.body.category);
        if (!category) {
            return res.status(400).json({ message: 'Invalid category' });
        }
        
        const subcategory = new Subcategory({
            name: req.body.name,
            description: req.body.description || '',
            category: req.body.category,
            isActive: req.body.isActive !== undefined ? req.body.isActive : true,
            ordering: req.body.ordering || 0
        });
        
        await assignImageFields(subcategory, req.body);
        await subcategory.save();
        
        const populated = await Subcategory.findById(subcategory._id)
            .populate('category', 'name _id')
            .populate('imageUpload');
        
        res.status(201).json(populated);
    } catch (err) {
        console.error('Error creating subcategory:', err);
        res.status(400).json({ message: err.message });
    }
});

// Admin routes - Update subcategory
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const subcategory = await Subcategory.findById(req.params.id);
        if (!subcategory) {
            return res.status(404).json({ message: 'Subcategory not found' });
        }
        
        // Validate category if being changed
        if (req.body.category && req.body.category !== subcategory.category.toString()) {
            const category = await Category.findById(req.body.category);
            if (!category) {
                return res.status(400).json({ message: 'Invalid category' });
            }
        }
        
        subcategory.name = req.body.name || subcategory.name;
        subcategory.description = req.body.description !== undefined ? req.body.description : subcategory.description;
        if (req.body.category) subcategory.category = req.body.category;
        if (req.body.isActive !== undefined) subcategory.isActive = req.body.isActive;
        if (req.body.ordering !== undefined) subcategory.ordering = req.body.ordering;
        
        await assignImageFields(subcategory, req.body);
        await subcategory.save();
        
        const populated = await Subcategory.findById(subcategory._id)
            .populate('category', 'name _id')
            .populate('imageUpload');
        
        res.json(populated);
    } catch (err) {
        console.error('Error updating subcategory:', err);
        res.status(400).json({ message: err.message });
    }
});

// Admin routes - Delete subcategory
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const subcategory = await Subcategory.findById(req.params.id);
        if (!subcategory) {
            return res.status(404).json({ message: 'Subcategory not found' });
        }
        
        await Subcategory.findByIdAndDelete(req.params.id);
        res.json({ message: 'Subcategory deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

