const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const Footer = require('../models/Footer');

// Get footer data (public)
router.get('/public', async (req, res) => {
    try {
        const footer = await Footer.getFooter();
        res.json(footer);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get footer data (admin)
router.get('/', adminAuth, async (req, res) => {
    try {
        let footer = await Footer.findOne({ isActive: true });
        
        // If no footer exists, create footer with dummy data
        if (!footer) {
            console.log('No footer found, creating footer with dummy data...');
            footer = new Footer({
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
            console.log('Footer with dummy data created with ID:', footer._id);
        }
        
        res.json(footer);
    } catch (err) {
        console.error('Error getting footer:', err);
        res.status(500).json({ message: err.message });
    }
});

// Update footer data (admin only)
router.put('/', adminAuth, async (req, res) => {
    try {
        console.log('Saving footer data:', req.body);
        
        let footer = await Footer.findOne({ isActive: true });
        
        if (!footer) {
            // Create new footer with provided data
            console.log('Creating new footer...');
            footer = new Footer(req.body);
        } else {
            // Update existing footer with provided data
            console.log('Updating existing footer...');
            
            // Update top-level fields - use provided values or keep existing
            if (req.body.logo !== undefined) footer.logo = req.body.logo;
            if (req.body.address !== undefined) footer.address = req.body.address;
            if (req.body.phone !== undefined) footer.phone = req.body.phone;
            if (req.body.email !== undefined) footer.email = req.body.email;
            if (req.body.quickLinksTitle !== undefined) footer.quickLinksTitle = req.body.quickLinksTitle;
            if (req.body.contactInfoTitle !== undefined) footer.contactInfoTitle = req.body.contactInfoTitle;
            if (req.body.aboutText !== undefined) footer.aboutText = req.body.aboutText;
            if (req.body.paymentMethodsImage !== undefined) footer.paymentMethodsImage = req.body.paymentMethodsImage;
            if (req.body.copyrightText !== undefined) footer.copyrightText = req.body.copyrightText;
            
            // Update quickLinks array - replace entire array
            if (req.body.quickLinks !== undefined && Array.isArray(req.body.quickLinks)) {
                footer.quickLinks = req.body.quickLinks;
            }
            
            // Update socialMedia object properly
            if (req.body.socialMedia) {
                if (!footer.socialMedia) {
                    footer.socialMedia = {};
                }
                if (req.body.socialMedia.facebook !== undefined) footer.socialMedia.facebook = req.body.socialMedia.facebook;
                if (req.body.socialMedia.twitter !== undefined) footer.socialMedia.twitter = req.body.socialMedia.twitter;
                if (req.body.socialMedia.instagram !== undefined) footer.socialMedia.instagram = req.body.socialMedia.instagram;
                if (req.body.socialMedia.linkedin !== undefined) footer.socialMedia.linkedin = req.body.socialMedia.linkedin;
                if (req.body.socialMedia.youtube !== undefined) footer.socialMedia.youtube = req.body.socialMedia.youtube;
                if (req.body.socialMedia.whatsapp !== undefined) footer.socialMedia.whatsapp = req.body.socialMedia.whatsapp;
            }
        }
        
        // Save to database
        await footer.save();
        console.log('Footer saved successfully to database:', footer._id);
        console.log('Footer data:', JSON.stringify(footer, null, 2));
        
        res.json(footer);
    } catch (err) {
        console.error('Error saving footer:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

