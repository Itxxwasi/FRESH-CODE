const mongoose = require('mongoose');
const HomepageSection = require('../models/HomepageSection');
require('dotenv').config();

async function fixAnnouncementBar2() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
        console.log('✅ Connected to MongoDB');
        
        // Find the "Announcement Bar-2" section
        const section = await HomepageSection.findOne({ name: 'Announcement Bar-2' });
        
        if (!section) {
            console.log('❌ "Announcement Bar-2" section not found');
            await mongoose.disconnect();
            return;
        }
        
        const oldOrdering = section.ordering;
        console.log('Found section:', {
            name: section.name,
            type: section.type,
            ordering: oldOrdering,
            isActive: section.isActive,
            isPublished: section.isPublished,
            currentItems: section.config?.items || []
        });
        
        // Ensure section is active and published so it shows on homepage
        if (!section.isActive || !section.isPublished) {
            console.log('⚠️  Section is not active/published. Enabling it...');
            section.isActive = true;
            section.isPublished = true;
        }
        
        // Fix ordering: Find Hero Slider and set Announcement Bar-2 to appear after it
        const heroSlider = await HomepageSection.findOne({ 
            type: 'heroSlider',
            isActive: true,
            isPublished: true
        });
        
        if (heroSlider) {
            const newOrdering = heroSlider.ordering + 1; // Place right after Hero Slider
            console.log(`📋 Hero Slider found with ordering: ${heroSlider.ordering}`);
            console.log(`📋 Setting Announcement Bar-2 ordering to: ${newOrdering} (after Hero Slider)`);
            
            // Check if any other sections have this ordering and need to be shifted
            const sectionsToShift = await HomepageSection.find({
                ordering: { $gte: newOrdering },
                _id: { $ne: section._id }
            });
            
            if (sectionsToShift.length > 0) {
                console.log(`📋 Shifting ${sectionsToShift.length} sections forward by 1...`);
                for (const sec of sectionsToShift) {
                    sec.ordering += 1;
                    await sec.save();
                }
            }
            
            section.ordering = newOrdering;
            console.log(`✅ Updated ordering from ${oldOrdering} to ${newOrdering}`);
        } else {
            console.log('⚠️  Hero Slider not found, setting ordering to 3 (default after slider)');
            section.ordering = 3;
        }
        
        // Add default items if items array is empty or doesn't exist
        if (!section.config) {
            section.config = {};
        }
        
        if (!section.config.items || section.config.items.length === 0) {
            // Set default items
            section.config.items = [
                'Get Upto 50% OFF',
                '11.11 Sale is Live'
            ];
            section.config.scrollSpeed = section.config.scrollSpeed || 20;
            section.config.backgroundColor = section.config.backgroundColor || '#ffffff';
            section.config.textColor = section.config.textColor || '#d93939';
            
            section.markModified('config');
        } else {
            console.log('ℹ️  Section already has items:', section.config.items);
        }
        
        // Save all changes
        section.markModified('config');
        await section.save();
        
        console.log('✅ Updated "Announcement Bar-2" with correct ordering and items');
        
        // Verify the update
        const updated = await HomepageSection.findById(section._id);
        console.log('✅ Verification - Updated section:', {
            name: updated.name,
            ordering: updated.ordering,
            items: updated.config.items,
            itemsCount: updated.config.items?.length || 0
        });
        
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixAnnouncementBar2();

