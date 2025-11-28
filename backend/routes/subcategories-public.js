const express = require('express');
const router = express.Router();
const Subcategory = require('../models/Subcategory');
const Product = require('../models/Product');

// Get subcategory by ID with products
router.get('/:id', async (req, res) => {
    try {
        const subcategory = await Subcategory.findById(req.params.id)
            .populate('category', 'name _id')
            .populate('imageUpload');
        
        if (!subcategory) {
            return res.status(404).json({ message: 'Subcategory not found' });
        }

        // Get all products for this subcategory
        const products = await Product.find({ 
            subcategory: req.params.id,
            isActive: true 
        })
        .populate('department', 'name _id')
        .populate('category', 'name _id')
        .populate('imageUpload')
        .sort({ name: 1 });

        res.json({
            subcategory,
            products
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

