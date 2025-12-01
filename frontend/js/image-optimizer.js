/**
 * Cloudinary Image Optimizer
 * Automatically optimizes images for mobile/desktop
 */

(function() {
    'use strict';
    
    /**
     * Get optimized Cloudinary image URL
     * @param {string} imageUrl - Original image URL
     * @param {Object} options - Transformation options
     * @returns {string} - Optimized URL
     */
    function getOptimizedImageUrl(imageUrl, options = {}) {
        // Return as-is if not Cloudinary URL
        if (!imageUrl || !imageUrl.includes('res.cloudinary.com')) {
            return imageUrl;
        }
        
        // Detect device type
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
        
        // Default transformations based on device
        const defaultWidth = isMobile ? 400 : (isTablet ? 800 : 1200);
        const defaultQuality = isMobile ? 'auto:low' : 'auto:good';
        
        // Extract base URL and path
        const urlParts = imageUrl.split('/upload/');
        if (urlParts.length !== 2) return imageUrl;
        
        const baseUrl = urlParts[0] + '/upload/';
        const path = urlParts[1];
        
        // Build transformation string
        const transformations = [];
        
        // Width
        if (options.width) {
            transformations.push(`w_${options.width}`);
        } else {
            transformations.push(`w_${defaultWidth}`);
        }
        
        // Quality (auto optimization)
        if (options.quality) {
            transformations.push(`q_${options.quality}`);
        } else {
            transformations.push(`q_${defaultQuality}`);
        }
        
        // Format (auto WebP if supported)
        if (!options.skipFormat) {
            transformations.push('f_auto');
        }
        
        // DPR (device pixel ratio) for retina displays
        if (options.dpr !== false) {
            transformations.push('dpr_auto');
        }
        
        // Crop mode
        if (options.crop) {
            transformations.push(`c_${options.crop}`);
        } else {
            transformations.push('c_limit'); // Don't crop, just resize
        }
        
        // Combine transformations
        const transformString = transformations.join(',');
        
        return `${baseUrl}${transformString}/${path}`;
    }
    
    /**
     * Generate responsive srcset for images
     * @param {string} imageUrl - Base image URL
     * @returns {string} - srcset string
     */
    function generateSrcset(imageUrl) {
        if (!imageUrl || !imageUrl.includes('res.cloudinary.com')) {
            return '';
        }
        
        const sizes = [
            { width: 400, descriptor: '400w' },
            { width: 800, descriptor: '800w' },
            { width: 1200, descriptor: '1200w' }
        ];
        
        return sizes.map(size => {
            const optimizedUrl = getOptimizedImageUrl(imageUrl, { width: size.width });
            return `${optimizedUrl} ${size.descriptor}`;
        }).join(', ');
    }
    
    /**
     * Optimize all images on page load
     */
    function optimizeAllImages() {
        const images = document.querySelectorAll('img[data-optimize], img:not([data-no-optimize])');
        
        images.forEach(img => {
            const originalSrc = img.src || img.dataset.src;
            if (originalSrc && originalSrc.includes('res.cloudinary.com')) {
                // Skip if already optimized
                if (img.dataset.optimized) return;
                
                const optimizedUrl = getOptimizedImageUrl(originalSrc);
                
                // Use srcset for better performance
                if (!img.srcset) {
                    img.srcset = generateSrcset(originalSrc);
                    img.sizes = '(max-width: 480px) 100vw, (max-width: 768px) 100vw, 1200px';
                }
                
                // Update src
                if (img.src === originalSrc) {
                    img.src = optimizedUrl;
                }
                if (img.dataset.src === originalSrc) {
                    img.dataset.src = optimizedUrl;
                }
                
                img.dataset.optimized = 'true';
            }
        });
    }
    
    // Export to window
    window.getOptimizedImageUrl = getOptimizedImageUrl;
    window.generateSrcset = generateSrcset;
    window.optimizeAllImages = optimizeAllImages;
    
    // Auto-optimize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', optimizeAllImages);
    } else {
        optimizeAllImages();
    }
    
    // Re-optimize on resize (debounced)
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Remove optimized flag to allow re-optimization
            document.querySelectorAll('img[data-optimized]').forEach(img => {
                delete img.dataset.optimized;
            });
            optimizeAllImages();
        }, 250);
    });
})();

