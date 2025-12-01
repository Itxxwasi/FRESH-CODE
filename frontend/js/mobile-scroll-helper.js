/**
 * Mobile Scroll Helper
 * Adds horizontal scrolling classes to product grids for mobile devices
 * Works with global-responsive.css to ensure proper horizontal scrolling
 */

(function() {
    'use strict';
    
    // Check if mobile/tablet
    function isMobile() {
        return window.innerWidth <= 991;
    }
    
    // Add classes to product rows
    function addProductScrollClasses() {
        // Find all rows with product cards
        const productRows = document.querySelectorAll('.row');
        productRows.forEach(row => {
            const hasProductCard = row.querySelector('.product-card') || 
                                  row.querySelector('[class*="product"]') ||
                                  row.id === 'productsGrid' ||
                                  row.querySelector('.category-card') ||
                                  row.querySelector('.department-card');
            
            if (hasProductCard && !row.classList.contains('has-product-cards')) {
                row.classList.add('has-product-cards', 'product-row-scroll');
            }
        });
        
        // Also add to direct product grids
        const productGrids = document.querySelectorAll('#productsGrid, .products-grid');
        productGrids.forEach(grid => {
            if (!grid.classList.contains('product-row-scroll')) {
                grid.classList.add('product-row-scroll');
            }
        });
        
        // Add to product carousel wrappers
        const carouselWrappers = document.querySelectorAll('.product-carousel__wrapper');
        carouselWrappers.forEach(wrapper => {
            if (isMobile() && !wrapper.classList.contains('horizontal-scroll')) {
                wrapper.classList.add('horizontal-scroll');
            } else if (!isMobile() && wrapper.classList.contains('horizontal-scroll')) {
                wrapper.classList.remove('horizontal-scroll');
            }
        });
    }
    
    // Remove horizontal scroll classes on desktop
    function removeDesktopScrollClasses() {
        if (!isMobile()) {
            const scrollElements = document.querySelectorAll('.product-row-scroll, .row.has-product-cards');
            scrollElements.forEach(el => {
                // Only remove if it's not a product carousel wrapper
                if (!el.classList.contains('product-carousel__wrapper')) {
                    // Keep classes but CSS will handle the overflow
                }
            });
        }
    }
    
    // Ensure body doesn't have horizontal scroll
    function preventBodyHorizontalScroll() {
        if (document.body.scrollWidth > window.innerWidth) {
            // Find elements causing overflow
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.scrollWidth > window.innerWidth && 
                    !el.classList.contains('product-carousel__wrapper') &&
                    !el.classList.contains('product-row-scroll') &&
                    !el.classList.contains('row.has-product-cards') &&
                    !el.classList.contains('table-responsive') &&
                    !el.classList.contains('horizontal-scroll')) {
                    // This element might be causing overflow
                    const style = window.getComputedStyle(el);
                    if (parseInt(style.width) > window.innerWidth) {
                        el.style.maxWidth = '100%';
                    }
                }
            });
        }
    }
    
    // Initialize
    function init() {
        addProductScrollClasses();
        removeDesktopScrollClasses();
        preventBodyHorizontalScroll();
    }
    
    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Re-run when content is dynamically loaded
    const observer = new MutationObserver(function(mutations) {
        let shouldUpdate = false;
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                shouldUpdate = true;
            }
        });
        if (shouldUpdate) {
            setTimeout(init, 100);
        }
    });
    
    // Observe changes to main content
    const mainContent = document.querySelector('main') || document.body;
    if (mainContent) {
        observer.observe(mainContent, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    // Re-run on window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            init();
            preventBodyHorizontalScroll();
        }, 250);
    });
    
    // Also check after images load (they might cause overflow)
    window.addEventListener('load', function() {
        setTimeout(init, 100);
        preventBodyHorizontalScroll();
    });
})();

