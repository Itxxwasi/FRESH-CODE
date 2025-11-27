const mongoose = require('mongoose');

const FooterSchema = new mongoose.Schema({
    // Logo
    logo: {
        type: String,
        trim: true,
        default: '/images/logo-white.png'
    },
    
    // Contact Information
    address: {
        type: String,
        trim: true,
        default: 'multiple branches in islamabad'
    },
    phone: {
        type: String,
        trim: true,
        default: '+92 300 1234567'
    },
    email: {
        type: String,
        trim: true,
        default: 'dwatsonconsultation@gmail.com'
    },
    
    // Section Titles
    quickLinksTitle: {
        type: String,
        trim: true,
        default: 'Quick Links'
    },
    contactInfoTitle: {
        type: String,
        trim: true,
        default: 'Contact Info'
    },
    
    // Quick Links
    quickLinks: [{
        title: {
            type: String,
            trim: true,
            required: true
        },
        url: {
            type: String,
            trim: true,
            required: true
        }
    }],
    
    // Social Media Links
    socialMedia: {
        facebook: {
            type: String,
            trim: true,
            default: ''
        },
        twitter: {
            type: String,
            trim: true,
            default: ''
        },
        instagram: {
            type: String,
            trim: true,
            default: ''
        },
        linkedin: {
            type: String,
            trim: true,
            default: ''
        },
        youtube: {
            type: String,
            trim: true,
            default: ''
        },
        whatsapp: {
            type: String,
            trim: true,
            default: ''
        }
    },
    
    // About Section (optional)
    aboutText: {
        type: String,
        trim: true,
        default: 'D. Watson Group is the supplier of home medical and health related products designed with the needs of the user in mind. D. Watson Group was founded by its chairman, Mr. Zafar Bakhtawari in 1975. We provide a wide variety of local and imported allopathic and homeopathic medicines, drugs, cosmetics, herbal products, optical products, surgical supplies and toiletries.'
    },
    
    // Payment Methods Image
    paymentMethodsImage: {
        type: String,
        trim: true,
        default: '/images/payment-methods.png'
    },
    
    // Copyright text
    copyrightText: {
        type: String,
        trim: true,
        default: '© 2025 D.Watson Pharmacy. All Rights Reserved. Website built and designed by Bilal Shah. All rights reserved by D.Watson.'
    },
    
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Ensure only one footer document exists
FooterSchema.statics.getFooter = async function() {
    let footer = await this.findOne({ isActive: true });
    if (!footer) {
        // Create empty footer - all fields will be empty/null
        footer = await this.create({
            logo: '',
            address: '',
            phone: '',
            email: '',
            quickLinksTitle: '',
            contactInfoTitle: '',
            quickLinks: [],
            socialMedia: {
                facebook: '',
                twitter: '',
                instagram: '',
                linkedin: '',
                youtube: '',
                whatsapp: ''
            },
            aboutText: '',
            paymentMethodsImage: '',
            copyrightText: ''
        });
    }
    return footer;
};

module.exports = mongoose.model('Footer', FooterSchema);

