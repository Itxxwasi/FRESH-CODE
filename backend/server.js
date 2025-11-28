const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const departmentRoutes = require('./routes/departments');
const categoryRoutes = require('./routes/categories');
const subcategoryRoutes = require('./routes/subcategories');
const productRoutes = require('./routes/products');
const sliderRoutes = require('./routes/sliders');
const bannerRoutes = require('./routes/banners');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const mediaRoutes = require('./routes/media');
const mediaPublicRoutes = require('./routes/media-public');
const homepageSectionsRoutes = require('./routes/homepage-sections');
const reportsRoutes = require('./routes/reports');
const brandsRoutes = require('./routes/brands');
const videoBannersRoutes = require('./routes/video-banners');
const departmentsPublicRoutes = require('./routes/departments-public');
const categoriesPublicRoutes = require('./routes/categories-public');
const subcategoriesPublicRoutes = require('./routes/subcategories-public');
const productsPublicRoutes = require('./routes/products-public');
const contactRoutes = require('./routes/contact');
const footerRoutes = require('./routes/footer');

// Initialize Express app
const app = express();

// Compression middleware for faster responses
const compression = require('compression');

// Middleware
app.use(compression()); // Compress all responses
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Global middleware to disable caching for ALL API routes in development
const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment) {
    app.use('/api', (req, res, next) => {
        // Disable all caching for API routes in development
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString(),
            'ETag': '' // Remove ETag to prevent conditional requests
        });
        next();
    });
    
    // Also disable caching for HTML files in development
    app.use((req, res, next) => {
        if (req.path.endsWith('.html') || !req.path.includes('.')) {
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
        }
        next();
    });
}

// Serve static files with aggressive caching (like Shopify CDN)
// In development, disable caching for easier development
// Note: isDevelopment is already defined above

// Add timestamp for cache busting in development
const devTimestamp = isDevelopment ? `?t=${Date.now()}` : '';

app.use(express.static(path.join(__dirname, '../frontend'), {
    maxAge: isDevelopment ? 0 : '1y', // No cache in development, 1 year in production
    etag: false, // Disable etag in development to prevent caching
    lastModified: false, // Disable lastModified in development
    setHeaders: (res, filePath) => {
        // Always disable caching in development
        if (isDevelopment) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Last-Modified', new Date().toUTCString());
            // Add random query param to force reload
            res.setHeader('X-Content-Version', Date.now().toString());
        } else {
            // Cache CSS/JS/images aggressively in production
            if (filePath.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
            // Cache HTML less aggressively
            if (filePath.match(/\.html$/)) {
                res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
            }
        }
    }
}));
app.use('/uploads', express.static(path.join(__dirname, './uploads'), {
    maxAge: '1y',
    etag: true,
    lastModified: true
}));

// Database connection - Connect to ONLY the database specified in MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is required in .env file');
    console.error('   Please set MONGODB_URI in your .env file');
    process.exit(1);
}

console.log('📡 Connecting to database from MONGODB_URI...');

// Connect to database (single connection only)
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(async () => {
    console.log('✅ Database connected successfully');
    console.log(`   Using database from MONGODB_URI`);
    
    // Load models (no auto-sync hooks - single database only)
    require('./models/index');
    
    // Ensure admin user exists
    const User = require('./models/User');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@dwatson.pk';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    try {
        const adminUser = await User.findOne({ email: adminEmail.toLowerCase().trim() });
        if (!adminUser) {
            console.log('📝 Creating admin user...');
            const newAdmin = await User.create({
                name: 'Admin',
                email: adminEmail.toLowerCase().trim(),
                password: adminPassword,
                role: 'admin',
                isActive: true
            });
            console.log(`✅ Admin user created: ${adminEmail}`);
            console.log(`   Password: ${adminPassword}`);
            // Auto-sync will happen via post-save hook
        } else {
            console.log(`✅ Admin user already exists: ${adminEmail}`);
        }
    } catch (error) {
        console.error('❌ Error ensuring admin user:', error.message);
        console.error('   Stack:', error.stack);
    }
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('   Make sure MONGODB_URI is set correctly');
    console.error('   Error details:', err);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStates = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
            state: dbStates[dbState] || 'unknown',
            readyState: dbState
        },
        environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            hasMongoUri: !!process.env.MONGODB_URI,
            hasJwtSecret: !!process.env.JWT_SECRET,
            hasAdminEmail: !!process.env.ADMIN_EMAIL
        }
    });
});

// Helper function to send HTML with cache-busting in development
function sendHTMLWithCacheBusting(req, res, filePath) {
    if (isDevelopment) {
        // In development, read file and inject cache-busting query params
        try {
            let html = fs.readFileSync(filePath, 'utf8');
            const timestamp = Date.now();
            
            // Add cache-busting to CSS and JS files
            html = html.replace(
                /(href|src)=["']([^"']*\.(css|js))(\?v=\d+)?["']/gi,
                (match, attr, url, ext, existingVersion) => {
                    // Remove existing version if present, add new one
                    const cleanUrl = url.replace(/\?v=\d+/, '');
                    return `${attr}="${cleanUrl}?v=${timestamp}"`;
                }
            );
            
            res.set({
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.send(html);
        } catch (error) {
            console.error('Error reading HTML file:', error);
            res.sendFile(filePath);
        }
    } else {
        // In production, send file normally
        res.sendFile(filePath);
    }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sliders', sliderRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/media', mediaRoutes);
app.use('/api/media', mediaPublicRoutes);
// LEGACY SECTIONS - NO LONGER USED
// app.use('/api/admin/sections', adminSectionRoutes);
// app.use('/api/sections', publicSectionsRoutes);
app.use('/api/homepage-sections', homepageSectionsRoutes);
app.use('/api/admin/reports', reportsRoutes);
app.use('/api/admin/brands', brandsRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/admin/video-banners', videoBannersRoutes);
app.use('/api/video-banners', videoBannersRoutes);
app.use('/api/public/departments', departmentsPublicRoutes);
app.use('/api/public/categories', categoriesPublicRoutes);
app.use('/api/public/subcategories', subcategoriesPublicRoutes);
app.use('/api/public/products', productsPublicRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/footer', footerRoutes);
app.use('/api/admin/footer', footerRoutes);

// Admin dashboard route
app.get('/admin', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/admin.html'));
});

// Cart page route
app.get('/cart', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/cart.html'));
});

app.get('/cart.html', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/cart.html'));
});

// Department page route (must be after static files but before catch-all)
app.get('/department/:id', (req, res) => {
    const id = req.params.id;
    // Only serve HTML if it looks like an ID (ObjectId format or simple string without file extension)
    // Reject if it contains a dot (likely a file request like .js, .css, etc.)
    if (id.includes('.') || id.includes('/')) {
        return res.status(404).send('Not found');
    }
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/department.html'));
});

// Category page route
app.get('/category/:id', (req, res) => {
    const id = req.params.id;
    if (id.includes('.') || id.includes('/')) {
        return res.status(404).send('Not found');
    }
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/category.html'));
});

// Subcategory page route
app.get('/subcategory/:id', (req, res) => {
    const id = req.params.id;
    if (id.includes('.') || id.includes('/')) {
        return res.status(404).send('Not found');
    }
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/subcategory.html'));
});

// Products page route
app.get('/products', (req, res) => {
    if (req.path.includes('.')) {
        return res.status(404).send('Not found');
    }
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/products.html'));
});

// Product detail page route
app.get('/product/:id', (req, res) => {
    const id = req.params.id;
    if (id.includes('.') || id.includes('/')) {
        return res.status(404).send('Not found');
    }
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/product.html'));
});

// About Us page route
app.get('/about', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/about.html'));
});

app.get('/about.html', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/about.html'));
});

// Contact page route
app.get('/contact', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/contact.html'));
});

app.get('/contact.html', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/contact.html'));
});

// Login page route
app.get('/login', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/login.html'));
});

app.get('/login.html', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/login.html'));
});

// Register page route
app.get('/register', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/register.html'));
});

app.get('/register.html', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/register.html'));
});

// Catch-all handler to serve the frontend for any non-API routes
app.use('/', (req, res) => {
    sendHTMLWithCacheBusting(req, res, path.join(__dirname, '../frontend/index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));