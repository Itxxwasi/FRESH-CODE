/**
 * Script to fix product hierarchy issues
 * Ensures all products have valid Department > Category > Product relationships
 * 
 * Usage: node backend/scripts/fix-product-hierarchy.js
 */

const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Department = require('../models/Department');

async function fixProductHierarchy() {
    try {
        // Connect to database
        const mongoURI = process.env.MONGODB_URI || process.env.LIVE_MONGODB_URI || 'mongodb://localhost:27017/dwatson_pk';
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to database\n');

        // Get all products
        const products = await Product.find({ isActive: true })
            .populate('category', 'name department')
            .populate('department', 'name')
            .lean();

        console.log(`📦 Found ${products.length} active products\n`);
        console.log('='.repeat(70));
        console.log('FIXING PRODUCT HIERARCHY');
        console.log('='.repeat(70) + '\n');

        let fixedCount = 0;
        let errorCount = 0;
        const issues = [];

        for (const product of products) {
            try {
                let needsFix = false;
                const fixes = [];

                // Check if category exists
                if (!product.category) {
                    issues.push({
                        product: product.name,
                        productId: product._id,
                        issue: 'Missing category',
                        action: 'Product will be deactivated'
                    });
                    // Deactivate product without category
                    await Product.findByIdAndUpdate(product._id, { isActive: false });
                    errorCount++;
                    continue;
                }

                // Get category department
                let categoryDeptId = null;
                if (product.category.department) {
                    categoryDeptId = product.category.department._id?.toString() || product.category.department.toString();
                } else {
                    // Category might not be populated, fetch it
                    const category = await Category.findById(product.category._id || product.category);
                    if (category && category.department) {
                        categoryDeptId = category.department.toString();
                    }
                }

                if (!categoryDeptId) {
                    issues.push({
                        product: product.name,
                        productId: product._id,
                        category: product.category.name || 'Unknown',
                        issue: 'Category has no department',
                        action: 'Product will be deactivated'
                    });
                    await Product.findByIdAndUpdate(product._id, { isActive: false });
                    errorCount++;
                    continue;
                }

                // Check if product department matches category department
                const productDeptId = product.department?._id?.toString() || product.department?.toString();

                if (!productDeptId || productDeptId !== categoryDeptId) {
                    needsFix = true;
                    fixes.push(`Department mismatch: Product has ${product.department?.name || 'none'}, should be from category's department`);
                    
                    // Fix: Set department from category
                    await Product.findByIdAndUpdate(product._id, { 
                        department: categoryDeptId 
                    });
                    fixedCount++;
                }

                // Verify department exists
                const department = await Department.findById(categoryDeptId);
                if (!department) {
                    issues.push({
                        product: product.name,
                        productId: product._id,
                        departmentId: categoryDeptId,
                        issue: 'Department does not exist',
                        action: 'Product will be deactivated'
                    });
                    await Product.findByIdAndUpdate(product._id, { isActive: false });
                    errorCount++;
                    continue;
                }

                if (needsFix) {
                    console.log(`✅ Fixed: ${product.name}`);
                    fixes.forEach(fix => console.log(`   - ${fix}`));
                }
            } catch (err) {
                console.error(`❌ Error processing product ${product.name}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('SUMMARY');
        console.log('='.repeat(70));
        console.log(`✅ Fixed: ${fixedCount} products`);
        console.log(`❌ Errors/Deactivated: ${errorCount} products`);
        console.log(`📊 Total processed: ${products.length} products\n`);

        if (issues.length > 0) {
            console.log('⚠️  ISSUES FOUND:');
            console.log('='.repeat(70));
            issues.forEach((issue, index) => {
                console.log(`\n${index + 1}. Product: ${issue.product}`);
                console.log(`   ID: ${issue.productId}`);
                console.log(`   Issue: ${issue.issue}`);
                console.log(`   Action: ${issue.action}`);
            });
        }

        console.log('\n✅ Product hierarchy fix completed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    fixProductHierarchy();
}

module.exports = fixProductHierarchy;

