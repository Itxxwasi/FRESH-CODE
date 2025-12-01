const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Department = require('../models/Department');
const Subcategory = require('../models/Subcategory');

// Global search endpoint - searches across products, categories, departments, and subcategories
router.get('/', async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.json({
                products: [],
                categories: [],
                departments: [],
                subcategories: []
            });
        }

        const searchTerm = q.trim();
        const searchRegex = { $regex: searchTerm, $options: 'i' };
        const maxResults = Math.min(parseInt(limit), 20); // Max 20 results per type

        console.log('🔍 Search query:', searchTerm);
        console.log('🔍 Search limit:', maxResults);

        // Search products - make sure to handle both active and inactive products
        // But prioritize active ones
        const products = await Product.find({
            $or: [
                { name: searchRegex },
                { description: searchRegex }
            ]
        })
        .select('name description price discount image imageUpload category department _id isActive')
        .populate('category', 'name _id')
        .populate('department', 'name _id')
        .populate('imageUpload', 'url')
        .sort({ isActive: -1, name: 1 }) // Sort by active first, then by name
        .limit(maxResults * 2) // Get more results to filter
        .lean();

        // Filter to show active products first, but also include inactive if no active found
        // Treat undefined/null isActive as true (default in schema)
        const activeProducts = products.filter(p => p.isActive !== false);
        const finalProducts = activeProducts.length > 0 ? activeProducts.slice(0, maxResults) : products.slice(0, maxResults);

        console.log('🔍 Found products:', finalProducts.length);
        if (finalProducts.length > 0) {
            console.log('🔍 Sample product:', finalProducts[0].name);
        }

        // Search categories
        const categories = await Category.find({
            isActive: true,
            name: searchRegex
        })
        .select('name description image imageUpload department _id')
        .populate('department', 'name _id')
        .populate('imageUpload', 'url')
        .limit(maxResults)
        .lean();

        // Search departments
        const departments = await Department.find({
            isActive: true,
            name: searchRegex
        })
        .select('name description image imageUpload _id')
        .populate('imageUpload', 'url')
        .limit(maxResults)
        .lean();

        // Search subcategories
        const subcategories = await Subcategory.find({
            isActive: true,
            name: searchRegex
        })
        .select('name description image imageUpload category _id')
        .populate('category', 'name _id')
        .populate('imageUpload', 'url')
        .limit(maxResults)
        .lean();

        // Format results with type and URL
        const formattedProducts = finalProducts.map(product => ({
            id: product._id,
            name: product.name,
            type: 'product',
            url: `/product/${product._id}`,
            image: product.imageUpload?.url || product.image || null,
            price: product.price || 0,
            discount: product.discount || 0,
            category: product.category?.name || null,
            department: product.department?.name || null
        }));

        console.log('🔍 Formatted products:', formattedProducts.length);

        const formattedCategories = categories.map(category => ({
            id: category._id,
            name: category.name,
            type: 'category',
            url: `/category/${category._id}`,
            image: category.imageUpload?.url || category.image || null,
            department: category.department?.name || null
        }));

        const formattedDepartments = departments.map(department => ({
            id: department._id,
            name: department.name,
            type: 'department',
            url: `/department/${department._id}`,
            image: department.imageUpload?.url || department.image || null
        }));

        const formattedSubcategories = subcategories.map(subcategory => ({
            id: subcategory._id,
            name: subcategory.name,
            type: 'subcategory',
            url: `/subcategory/${subcategory._id}`,
            image: subcategory.imageUpload?.url || subcategory.image || null,
            category: subcategory.category?.name || null
        }));

        const response = {
            products: formattedProducts,
            categories: formattedCategories,
            departments: formattedDepartments,
            subcategories: formattedSubcategories,
            total: formattedProducts.length + formattedCategories.length + formattedDepartments.length + formattedSubcategories.length
        };

        console.log('🔍 Search response total:', response.total);
        console.log('🔍 Products in response:', response.products.length);

        res.json(response);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

