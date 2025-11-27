const mongoose = require('mongoose');
const Footer = require('../models/Footer');
require('dotenv').config();

async function seedFooter() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dwatson', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Delete existing footer
        await Footer.deleteMany({});
        console.log('Deleted existing footer documents');

        // Create footer with dummy data
        const footer = new Footer({
            logo: '/images/logo-white.png',
            address: '123 Main Street, Islamabad, Pakistan',
            phone: '+92 300 1234567',
            email: 'info@dwatson.pk',
            quickLinksTitle: 'Quick Links',
            contactInfoTitle: 'Contact Info',
            quickLinks: [
                { title: 'About Us', url: '/about.html' },
                { title: 'Contact Us', url: '/contact.html' },
                { title: 'Terms & Conditions', url: '#' },
                { title: 'Privacy Policy', url: '#' },
                { title: 'Returns & Refunds', url: '#' }
            ],
            socialMedia: {
                facebook: 'https://facebook.com/dwatson',
                twitter: 'https://twitter.com/dwatson',
                instagram: 'https://instagram.com/dwatson',
                linkedin: 'https://linkedin.com/company/dwatson',
                youtube: 'https://youtube.com/dwatson',
                whatsapp: '923001234567'
            },
            aboutText: 'D. Watson Group is the supplier of home medical and health related products designed with the needs of the user in mind. D. Watson Group was founded by its chairman, Mr. Zafar Bakhtawari in 1975. We provide a wide variety of local and imported allopathic and homeopathic medicines, drugs, cosmetics, herbal products, optical products, surgical supplies and toiletries.',
            paymentMethodsImage: '/images/payment-methods.png',
            copyrightText: '© 2025 D.Watson Pharmacy. All Rights Reserved. Website built and designed by Bilal Shah. All rights reserved by D.Watson.'
        });

        await footer.save();
        console.log('Footer with dummy data created successfully!');
        console.log('Footer ID:', footer._id);
        console.log('\nFooter Data:');
        console.log(JSON.stringify(footer, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error seeding footer:', error);
        process.exit(1);
    }
}

seedFooter();

