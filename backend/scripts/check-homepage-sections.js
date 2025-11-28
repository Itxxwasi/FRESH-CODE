const mongoose = require('mongoose');
const HomepageSection = require('../models/HomepageSection');
require('dotenv').config();

async function checkHomepageSections() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
        console.log('Connected to MongoDB');
        
        // Get all sections
        const allSections = await HomepageSection.find({})
            .sort({ ordering: 1, createdAt: 1 })
            .lean();
        
        console.log('\n=== ALL HOMEPAGE SECTIONS ===');
        console.log(`Total sections in database: ${allSections.length}\n`);
        
        allSections.forEach((section, index) => {
            console.log(`${index + 1}. ${section.name || 'Unnamed'}`);
            console.log(`   Type: ${section.type}`);
            console.log(`   Active: ${section.isActive ? '✅' : '❌'}`);
            console.log(`   Published: ${section.isPublished ? '✅' : '❌'}`);
            console.log(`   Ordering: ${section.ordering || 0}`);
            console.log(`   ID: ${section._id}`);
            console.log('');
        });
        
        // Get sections that will show on homepage
        const publicSections = await HomepageSection.find({
            isActive: true,
            isPublished: true
        })
        .sort({ ordering: 1, createdAt: 1 })
        .lean();
        
        console.log('\n=== SECTIONS VISIBLE ON HOMEPAGE ===');
        console.log(`Total visible sections: ${publicSections.length}\n`);
        
        if (publicSections.length === 0) {
            console.log('⚠️  WARNING: No sections are visible on the homepage!');
            console.log('   Sections must be BOTH Active AND Published to appear.\n');
            
            const inactive = allSections.filter(s => !s.isActive);
            const unpublished = allSections.filter(s => !s.isPublished);
            
            if (inactive.length > 0) {
                console.log(`   Inactive sections (${inactive.length}):`);
                inactive.forEach(s => console.log(`     - ${s.name || 'Unnamed'} (${s.type})`));
            }
            
            if (unpublished.length > 0) {
                console.log(`   Unpublished sections (${unpublished.length}):`);
                unpublished.forEach(s => console.log(`     - ${s.name || 'Unnamed'} (${s.type})`));
            }
        } else {
            publicSections.forEach((section, index) => {
                console.log(`${index + 1}. ${section.name || 'Unnamed'} (${section.type})`);
            });
        }
        
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkHomepageSections();

