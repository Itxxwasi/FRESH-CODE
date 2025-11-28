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
        
        console.log('Found section:', {
            name: section.name,
            type: section.type,
            ordering: section.ordering,
            currentItems: section.config?.items || []
        });
        
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
            await section.save();
            
            console.log('✅ Updated "Announcement Bar-2" with default items:', section.config.items);
        } else {
            console.log('ℹ️  Section already has items:', section.config.items);
        }
        
        // Verify the update
        const updated = await HomepageSection.findById(section._id);
        console.log('✅ Verification - Updated config:', {
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

