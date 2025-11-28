/**
 * Models Index
 * Register all models - Single database connection only
 */

// Import all models
const User = require('./User');
const Product = require('./Product');
const Category = require('./Category');
const Department = require('./Department');
const Order = require('./Order');
const Cart = require('./Cart');
const Slider = require('./Slider');
const Banner = require('./Banner');
const Brand = require('./Brand');
const HomepageSection = require('./HomepageSection');
const Media = require('./Media');
const VideoBanner = require('./VideoBanner');
const Footer = require('./Footer');

// Note: Database sync hooks have been removed
// Server now connects to ONLY the database specified in MONGODB_URI from .env file

module.exports = {
    User,
    Product,
    Category,
    Department,
    Order,
    Cart,
    Slider,
    Banner,
    Brand,
    HomepageSection,
    Media,
    VideoBanner,
    Footer
};

