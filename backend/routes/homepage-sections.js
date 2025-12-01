const express = require('express');
const crypto = require('crypto');
const adminAuth = require('../middleware/adminAuth');
const HomepageSection = require('../models/HomepageSection');
const Slider = require('../models/Slider');
const Banner = require('../models/Banner');
const Category = require('../models/Category');
const Department = require('../models/Department');
const Subcategory = require('../models/Subcategory');
const Product = require('../models/Product');

const router = express.Router();

// Public route - Get all active published sections for homepage
router.get('/public', async (req, res) => {
    try {
        console.log('Fetching public homepage sections...');
        const sections = await HomepageSection.find({
            isActive: true,
            isPublished: true
        })
        .sort({ ordering: 1, createdAt: 1 })
        .select('-createdBy -updatedBy') // Exclude unnecessary fields for faster response
        .lean(); // Use lean() for faster queries (returns plain JS objects)
        
        console.log(`Found ${sections.length} active and published sections:`, sections.map(s => ({ 
            id: s._id, 
            name: s.name, 
            type: s.type, 
            ordering: s.ordering,
            isActive: s.isActive,
            isPublished: s.isPublished 
        })));
        
        // For now, keep this response fresh so changes in admin appear immediately
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.json(sections);
    } catch (error) {
        console.error('Error fetching public homepage sections:', error);
        res.status(500).json({ message: error.message });
    }
});

// Admin routes - Get all sections
router.get('/', adminAuth, async (req, res) => {
    try {
        const { type, active, published } = req.query;
        const filters = {};
        
        if (type) filters.type = type;
        if (active !== undefined) filters.isActive = active === 'true' || active === true;
        if (published !== undefined) filters.isPublished = published === 'true' || published === true;
        
        const sections = await HomepageSection.find(filters)
            .sort({ ordering: 1, createdAt: 1 })
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');
        
        res.json(sections);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin route - Get section by ID
router.get('/:id', adminAuth, async (req, res) => {
    try {
        const section = await HomepageSection.findById(req.params.id)
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');
        
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }
        
        res.json(section);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin route - Create section
router.post('/', adminAuth, async (req, res) => {
    try {
        const payload = {
            name: req.body.name,
            type: req.body.type,
            title: req.body.title,
            subtitle: req.body.subtitle,
            description: req.body.description,
            config: req.body.config || {},
            ordering: req.body.ordering,
            isActive: req.body.isActive !== undefined ? req.body.isActive : true,
            isPublished: req.body.isPublished !== undefined ? req.body.isPublished : false,
            displayOn: req.body.displayOn || {
                desktop: true,
                tablet: true,
                mobile: true
            },
            createdBy: req.user?.id,
            updatedBy: req.user?.id
        };
        
        // Auto-generate ordering if not provided
        if (payload.ordering === undefined || payload.ordering === null) {
            const lastSection = await HomepageSection.findOne().sort({ ordering: -1 });
            payload.ordering = lastSection ? lastSection.ordering + 1 : 0;
        }
        
        // Validate required fields
        if (!payload.name || !payload.type) {
            return res.status(400).json({ 
                message: 'Name and type are required fields',
                details: { name: payload.name, type: payload.type }
            });
        }
        
        // Validate type enum
        const validTypes = ['heroSlider', 'scrollingText', 'categoryFeatured', 'categoryGrid', 'categoryCircles', 'departmentGrid', 'productTabs', 'productCarousel', 'newArrivals', 'topSelling', 'featuredCollections', 'subcategoryGrid', 'bannerFullWidth', 'videoBanner', 'collectionLinks', 'newsletterSocial', 'brandMarquee', 'brandGrid', 'customHTML'];
        if (!validTypes.includes(payload.type)) {
            return res.status(400).json({ 
                message: `Invalid section type: ${payload.type}. Valid types are: ${validTypes.join(', ')}`,
                receivedType: payload.type
            });
        }
        
        console.log('Creating homepage section with payload:', JSON.stringify(payload, null, 2));
        
        const section = new HomepageSection(payload);
        await section.save();
        
        res.status(201).json(section);
    } catch (error) {
        console.error('Error creating homepage section:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            Object.keys(error.errors).forEach(key => {
                validationErrors[key] = error.errors[key].message;
            });
            return res.status(400).json({ 
                message: 'Validation error',
                errors: validationErrors,
                details: error.message
            });
        }
        
        // Handle duplicate key error (unique constraint)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ 
                message: `A section with this ${field} already exists`,
                field: field,
                value: error.keyValue[field]
            });
        }
        
        res.status(400).json({ 
            message: error.message || 'Error creating homepage section',
            error: error.name,
            details: error.toString()
        });
    }
});

// Admin route - Update section
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const payload = {
            name: req.body.name,
            type: req.body.type,
            title: req.body.title,
            subtitle: req.body.subtitle,
            description: req.body.description,
            config: req.body.config,
            ordering: req.body.ordering,
            isActive: req.body.isActive,
            isPublished: req.body.isPublished,
            displayOn: req.body.displayOn,
            updatedBy: req.user?.id
        };
        
        // Validate type enum if type is being updated
        if (payload.type !== undefined) {
            const validTypes = ['heroSlider', 'scrollingText', 'categoryFeatured', 'categoryGrid', 'categoryCircles', 'departmentGrid', 'productTabs', 'productCarousel', 'newArrivals', 'topSelling', 'featuredCollections', 'subcategoryGrid', 'bannerFullWidth', 'videoBanner', 'collectionLinks', 'newsletterSocial', 'brandMarquee', 'brandGrid', 'customHTML'];
            if (!validTypes.includes(payload.type)) {
                return res.status(400).json({ 
                    message: `Invalid section type: ${payload.type}. Valid types are: ${validTypes.join(', ')}`,
                    receivedType: payload.type
                });
            }
        }
        
        // Remove undefined fields
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });
        
        console.log('Updating homepage section with payload:', JSON.stringify(payload, null, 2));
        
        const section = await HomepageSection.findByIdAndUpdate(
            req.params.id,
            payload,
            { new: true, runValidators: true }
        );
        
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }
        
        res.json(section);
    } catch (error) {
        console.error('Error updating homepage section:', error);
        console.error('Error stack:', error.stack);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            Object.keys(error.errors).forEach(key => {
                validationErrors[key] = error.errors[key].message;
            });
            return res.status(400).json({ 
                message: 'Validation error',
                errors: validationErrors,
                details: error.message
            });
        }
        
        // Handle duplicate key error (unique constraint)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ 
                message: `A section with this ${field} already exists`,
                field: field,
                value: error.keyValue[field]
            });
        }
        
        res.status(400).json({ 
            message: error.message || 'Error updating homepage section',
            error: error.name,
            details: error.toString()
        });
    }
});

// Admin route - Reorder sections
router.patch('/reorder', adminAuth, async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) {
            return res.status(400).json({ message: 'Order payload must be an array' });
        }
        
        const updates = order.map(item => {
            if (!item?.id) return null;
            return HomepageSection.findByIdAndUpdate(
                item.id,
                { ordering: item.ordering },
                { new: true }
            );
        }).filter(Boolean);
        
        await Promise.all(updates);
        res.json({ updated: updates.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin route - Delete section
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const section = await HomepageSection.findById(req.params.id);
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }
        
        await section.deleteOne();
        res.json({ message: 'Section deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Public route - Get section data for published sections
router.get('/:id/data/public', async (req, res) => {
    try {
        const section = await HomepageSection.findById(req.params.id);
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }
        
        // Only allow access to published and active sections
        if (!section.isActive || !section.isPublished) {
            return res.status(403).json({ message: 'Section is not published' });
        }
        
        let data = {};
        
        switch (section.type) {
            case 'newArrivals':
                // Get new arrival products from ALL categories (don't filter by categoryId)
                const newArrivalFilters = { isActive: true, isNewArrival: true };
                // Removed categoryId filter to show products from all categories
                // if (section.config?.categoryId) {
                //     newArrivalFilters.category = section.config.categoryId;
                // }
                const newArrivalProducts = await Product.find(newArrivalFilters)
                    .populate('category', 'name _id')
                    .populate('department', 'name _id')
                    .populate('imageUpload')
                    .limit(section.config?.limit || 100) // Increased limit to get products from all categories
                    .sort({ createdAt: -1 });
                console.log(`New Arrivals (Admin): Found ${newArrivalProducts.length} products from all categories`);
                data = { products: newArrivalProducts };
                break;
                
            case 'topSelling':
                // Get top selling products
                const topSellingFilters = { isActive: true, isTopSelling: true };
                if (section.config?.categoryId) {
                    topSellingFilters.category = section.config.categoryId;
                }
                const topSellingProducts = await Product.find(topSellingFilters)
                    .populate('category', 'name')
                    .populate('department', 'name')
                    .populate('imageUpload')
                    .limit(section.config?.limit || 20)
                    .sort({ createdAt: -1 });
                data = { products: topSellingProducts };
                break;
                
            case 'featuredCollections':
                // Get all active subcategories
                const subcategories = await Subcategory.find({ isActive: true })
                    .populate('category', 'name _id')
                    .populate('imageUpload')
                    .sort({ ordering: 1, name: 1 });
                data = { subcategories };
                break;
                
            case 'subcategoryGrid':
                // Get selected subcategories for grid (6 boxes) and button strip
                const gridSubcategoryIds = section.config?.subcategoryIds || [];
                const buttonSubcategoryIds = section.config?.buttonSubcategoryIds || [];
                
                // Fetch grid subcategories (limit to 6)
                const gridSubcategories = gridSubcategoryIds.length > 0
                    ? await Subcategory.find({ 
                        _id: { $in: gridSubcategoryIds },
                        isActive: true 
                    })
                    .populate('category', 'name _id')
                    .populate('imageUpload')
                    .limit(6)
                    .lean()
                    : [];
                
                // Fetch button subcategories (for red strip below)
                const buttonSubcategories = buttonSubcategoryIds.length > 0
                    ? await Subcategory.find({ 
                        _id: { $in: buttonSubcategoryIds },
                        isActive: true 
                    })
                    .populate('category', 'name _id')
                    .sort({ name: 1 })
                    .lean()
                    : await Subcategory.find({ isActive: true })
                    .populate('category', 'name _id')
                    .sort({ name: 1 })
                    .limit(20)
                    .lean();
                
                data = { 
                    gridSubcategories: gridSubcategories.slice(0, 6), // Ensure max 6
                    buttonSubcategories 
                };
                break;
                
            default:
                // For other section types, return empty data
                data = {};
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin route - Get section data (sliders, categories, products, etc.)
router.get('/:id/data', adminAuth, async (req, res) => {
    try {
        const section = await HomepageSection.findById(req.params.id);
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }
        
        let data = {};
        
        switch (section.type) {
            case 'heroSlider':
                // Get active sliders
                const sliders = await Slider.find({ isActive: true }).sort({ order: 1 });
                data = { sliders };
                break;
                
            case 'categoryFeatured':
            case 'categoryGrid':
            case 'categoryCircles':
                // Get featured categories
                const categories = await Category.find({ isActive: true })
                    .populate('department', 'name')
                    .populate('imageUpload')
                    .sort({ name: 1 });
                data = { categories };
                break;
                
            case 'departmentGrid':
                // Get active departments
                const departments = await Department.find({ isActive: true })
                    .populate('imageUpload')
                    .sort({ name: 1 });
                data = { departments };
                break;
                
            case 'productTabs':
            case 'productCarousel':
                // Get products based on filters
                const productFilters = {};
                if (section.config?.categoryId) {
                    productFilters.category = section.config.categoryId;
                }
                // Section filter has highest priority - if section is specified, filter by it
                if (section.config?.section) {
                    productFilters.sections = { $in: [section.config.section] };
                    console.log(`🔍 Homepage Section Data - Filtering by section: "${section.config.section}"`);
                } else if (section.config?.isFeatured) {
                    productFilters.isFeatured = true;
                } else if (section.config?.isNewArrival) {
                    productFilters.isNewArrival = true;
                } else if (section.config?.isTrending) {
                    productFilters.isTrending = true;
                }
                productFilters.isActive = true;
                
                const products = await Product.find(productFilters)
                    .populate('category', 'name')
                    .populate('department', 'name')
                    .populate('imageUpload')
                    .limit(section.config?.limit || 20)
                    .sort({ createdAt: -1 });
                data = { products };
                break;
                
            case 'newArrivals':
                // Get new arrival products from ALL categories (don't filter by categoryId)
                const newArrivalFilters = { isActive: true, isNewArrival: true };
                // Removed categoryId filter to show products from all categories
                // if (section.config?.categoryId) {
                //     newArrivalFilters.category = section.config.categoryId;
                // }
                const newArrivalProducts = await Product.find(newArrivalFilters)
                    .populate('category', 'name _id')
                    .populate('department', 'name _id')
                    .populate('imageUpload')
                    .limit(section.config?.limit || 100) // Increased limit to get products from all categories
                    .sort({ createdAt: -1 });
                console.log(`New Arrivals (Admin): Found ${newArrivalProducts.length} products from all categories`);
                data = { products: newArrivalProducts };
                break;
                
            case 'topSelling':
                // Get top selling products
                const topSellingFilters = { isActive: true, isTopSelling: true };
                if (section.config?.categoryId) {
                    topSellingFilters.category = section.config.categoryId;
                }
                const topSellingProducts = await Product.find(topSellingFilters)
                    .populate('category', 'name')
                    .populate('department', 'name')
                    .populate('imageUpload')
                    .limit(section.config?.limit || 20)
                    .sort({ createdAt: -1 });
                data = { products: topSellingProducts };
                break;
                
            case 'featuredCollections':
                // Get all active subcategories
                const subcategories = await Subcategory.find({ isActive: true })
                    .populate('category', 'name _id')
                    .populate('imageUpload')
                    .sort({ ordering: 1, name: 1 });
                data = { subcategories };
                break;
                
            case 'subcategoryGrid':
                // Get selected subcategories for grid (6 boxes) and button strip
                const gridSubcategoryIds = section.config?.subcategoryIds || [];
                const buttonSubcategoryIds = section.config?.buttonSubcategoryIds || [];
                
                // Fetch grid subcategories (limit to 6)
                const gridSubcategories = gridSubcategoryIds.length > 0
                    ? await Subcategory.find({ 
                        _id: { $in: gridSubcategoryIds },
                        isActive: true 
                    })
                    .populate('category', 'name _id')
                    .populate('imageUpload')
                    .limit(6)
                    .lean()
                    : [];
                
                // Fetch button subcategories (for red strip below)
                const buttonSubcategories = buttonSubcategoryIds.length > 0
                    ? await Subcategory.find({ 
                        _id: { $in: buttonSubcategoryIds },
                        isActive: true 
                    })
                    .populate('category', 'name _id')
                    .sort({ name: 1 })
                    .lean()
                    : await Subcategory.find({ isActive: true })
                    .populate('category', 'name _id')
                    .sort({ name: 1 })
                    .limit(20)
                    .lean();
                
                data = { 
                    gridSubcategories: gridSubcategories.slice(0, 6), // Ensure max 6
                    buttonSubcategories 
                };
                break;
                
            case 'bannerFullWidth':
                // Get active banners
                const banners = await Banner.find({ isActive: true, position: 'middle' })
                    .populate('imageUpload')
                    .sort({ createdAt: -1 });
                data = { banners };
                break;
                
            default:
                data = {};
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

