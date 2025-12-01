/**
 * Performance Optimizations
 */

(function() {
    'use strict';
    
    // Enable caching for API responses
    const cache = new Map();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    // Override fetch with caching
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // Only cache GET requests
        if (options.method && options.method !== 'GET') {
            return originalFetch.apply(this, arguments);
        }
        
        const cacheKey = `${url}_${JSON.stringify(options)}`;
        const cached = cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            return Promise.resolve(new Response(JSON.stringify(cached.data), {
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        
        return originalFetch.apply(this, arguments).then(response => {
            if (response.ok) {
                response.clone().json().then(data => {
                    cache.set(cacheKey, {
                        data: data,
                        timestamp: Date.now()
                    });
                }).catch(() => {});
            }
            return response;
        });
    };
    
    // Debounce resize events
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            // Trigger custom resize event
            window.dispatchEvent(new Event('optimizedResize'));
        }, 250);
    });
    
    // Lazy load images with Intersection Observer
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });
        
        // Observe all images with data-src
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
    
    // Reduce animation on mobile for better performance
    if (window.innerWidth <= 768) {
        const style = document.createElement('style');
        style.textContent = `
            *, *::before, *::after {
                animation-duration: 0.3s !important;
                transition-duration: 0.3s !important;
            }
        `;
        document.head.appendChild(style);
    }
})();

