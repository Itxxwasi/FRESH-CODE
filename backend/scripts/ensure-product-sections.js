/**
 * Script to ensure the 3 main product sections exist in the database
 * Run this script to verify/create: Top Selling Product, Lingerie Collection, Product Feature Collection
 * 
 * Usage: node backend/scripts/ensure-product-sections.js
 */

const mongoose = require('mongoose');
const HomepageSection = require('../models/HomepageSection');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const sectionsToEnsure = [
    {
        name: 'Top Selling Product',
        type: 'productCarousel',
        title: 'Top Selling Product',
        subtitle: '',
        ordering: 10,
        isActive: true,
        isPublished: true,
        config: {
            section: 'Top Selling Product',
            filter: 'trending',
            limit: 8,
            showArrows: true
        }
    },
    {
        name: 'Lingerie Collection',
        type: 'productCarousel',
        title: 'Lingerie Collection',
        subtitle: '',
        ordering: 11,
        isActive: true,
        isPublished: true,
        config: {
            section: 'Lingerie Collection',
            limit: 8,
            showArrows: true
        }
    },
    {
        name: 'Product Feature Collection',
        type: 'productCarousel',
        title: 'Product Feature Collection',
        subtitle: '',
        ordering: 6,
        isActive: true,
        isPublished: true,
        config: {
            section: 'Product Feature Collection',
            filter: 'trending',
            limit: 12,
            showArrows: true
        }
    }
];

async function ensureSections() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const sectionData of sectionsToEnsure) {
            const existingSection = await HomepageSection.findOne({ name: sectionData.name });

            if (existingSection) {
                // Update existing section to ensure config.section is set
                let needsUpdate = false;
                if (!existingSection.config) {
                    existingSection.config = {};
                    needsUpdate = true;
                }
                if (existingSection.config.section !== sectionData.config.section) {
                    existingSection.config.section = sectionData.config.section;
                    existingSection.markModified('config'); // Mark nested object as modified
                    needsUpdate = true;
                }
                
                // Update other important fields
                if (existingSection.type !== sectionData.type) {
                    existingSection.type = sectionData.type;
                    needsUpdate = true;
                }
                
                // Update other config properties if they don't match
                if (sectionData.config.limit && existingSection.config.limit !== sectionData.config.limit) {
                    existingSection.config.limit = sectionData.config.limit;
                    existingSection.markModified('config');
                    needsUpdate = true;
                }
                if (sectionData.config.showArrows !== undefined && existingSection.config.showArrows !== sectionData.config.showArrows) {
                    existingSection.config.showArrows = sectionData.config.showArrows;
                    existingSection.markModified('config');
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    await existingSection.save();
                    console.log(`  ✓ Updated: ${sectionData.name} (Section Filter: ${sectionData.config.section})`);
                    updatedCount++;
                } else {
                    console.log(`  ✓ Already exists: ${sectionData.name} (Section Filter: ${existingSection.config?.section || 'None'})`);
                    skippedCount++;
                }
            } else {
                // Create new section
                const newSection = new HomepageSection(sectionData);
                await newSection.save();
                console.log(`  ✓ Created: ${sectionData.name}`);
                createdCount++;
            }
        }

        console.log('\n✅ Section verification completed!');
        console.log(`   Created: ${createdCount}`);
        console.log(`   Updated: ${updatedCount}`);
        console.log(`   Already exists: ${skippedCount}`);

        // List all product carousel sections (refresh from database)
        console.log('\n📋 All Product Carousel Sections:');
        const allSections = await HomepageSection.find({ type: 'productCarousel' })
            .sort({ ordering: 1 });
        
        allSections.forEach(section => {
            const sectionFilter = section.config && section.config.section ? section.config.section : 'None';
            console.log(`   - ${section.name} (Order: ${section.ordering}, Active: ${section.isActive}, Published: ${section.isPublished}, Section Filter: ${sectionFilter})`);
        });

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run the script
ensureSections();

