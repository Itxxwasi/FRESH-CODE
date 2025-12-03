/**
 * Homepage Sections Renderer
 * Renders dynamic homepage sections based on database configuration
 * Matches D.Watson Cosmetics style
 * Optimized for fast loading with parallel rendering and caching
 * Mobile-first performance optimizations with lazy loading
 */

// ============ Mobile Detection & Configuration ============
/**
 * Detect if current device is mobile
 * @returns {boolean} True if mobile device
 */
function isMobile() {
    // Check window width (most reliable for performance optimization)
    if (window.innerWidth <= 768) {
        return true;
    }
    // Fallback to user agent detection
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
}

/**
 * Mobile-specific configuration
 */
const MOBILE_CONFIG = {
    // Product limits - reduced for mobile
    productCarouselLimit: 6,      // Desktop: 10
    productTabsLimit: 4,          // Desktop: 8
    newArrivalsLimit: 6,          // Desktop: 10
    topSellingLimit: 6,           // Desktop: 10
    
    // Intersection Observer settings
    rootMargin: '200px',          // Start loading 200px before viewport
    threshold: 0.01,              // Trigger when 1% visible
    
    // Parallel loading batch size
    maxConcurrentRequests: 3,      // Limit concurrent API calls on mobile
    
    // Critical sections that load immediately (above-the-fold)
    criticalSectionTypes: ['heroSlider', 'scrollingText']
};

/**
 * Get product limit based on device type
 * @param {string} sectionType - Type of section
 * @param {number} defaultLimit - Default limit for desktop
 * @returns {number} Adjusted limit for current device
 */
function getProductLimit(sectionType, defaultLimit) {
    if (!isMobile()) {
        return defaultLimit;
    }
    
    switch(sectionType) {
        case 'productCarousel':
            return MOBILE_CONFIG.productCarouselLimit;
        case 'productTabs':
            return MOBILE_CONFIG.productTabsLimit;
        case 'newArrivals':
            return MOBILE_CONFIG.newArrivalsLimit;
        case 'topSelling':
            return MOBILE_CONFIG.topSellingLimit;
        default:
            // Reduce by 40% for mobile
            return Math.max(4, Math.floor(defaultLimit * 0.6));
    }
}

// Request cache for API calls (5 minute TTL)
const requestCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============ Skeleton Loaders ============
/**
 * Render skeleton loader for product sections
 * @param {string} sectionType - Type of section
 * @param {number} count - Number of skeleton items
 * @returns {string} HTML for skeleton loader
 */
function renderSectionSkeleton(sectionType, count = 4) {
    const skeletonCount = isMobile() ? Math.min(count, 4) : count;
    
    if (sectionType === 'productCarousel' || sectionType === 'productTabs' || sectionType === 'newArrivals' || sectionType === 'topSelling') {
        return `
            <div class="skeleton-loader product-skeleton">
                <div class="row g-4">
                    ${Array.from({ length: skeletonCount }).map(() => `
                        <div class="col-6 col-md-3">
                            <div class="skeleton-product-card">
                                <div class="skeleton-image"></div>
                                <div class="skeleton-content">
                                    <div class="skeleton-line skeleton-title"></div>
                                    <div class="skeleton-line skeleton-price"></div>
                                    <div class="skeleton-line skeleton-button"></div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="skeleton-loader">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
        </div>
    `;
}

// ============ Intersection Observer for Lazy Loading ============
let intersectionObserver = null;

/**
 * Initialize Intersection Observer for lazy loading sections
 * @returns {IntersectionObserver} Observer instance
 */
function initIntersectionObserver() {
    if (intersectionObserver) {
        return intersectionObserver;
    }
    
    if (!('IntersectionObserver' in window)) {
        // Fallback for browsers without IntersectionObserver
        console.warn('IntersectionObserver not supported, loading all sections immediately');
        return null;
    }
    
    intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionElement = entry.target;
                const loadFunction = sectionElement.dataset.loadFunction;
                
                if (loadFunction && typeof window[loadFunction] === 'function') {
                    // Unobserve to prevent multiple calls
                    intersectionObserver.unobserve(sectionElement);
                    
                    // Load the section
                    window[loadFunction]().catch(err => {
                        console.error('Error loading lazy section:', err);
                    });
                }
            }
        });
    }, {
        rootMargin: MOBILE_CONFIG.rootMargin,
        threshold: MOBILE_CONFIG.threshold
    });
    
    return intersectionObserver;
}

/**
 * Check if section is critical (should load immediately)
 * @param {Object} section - Section object
 * @returns {boolean} True if critical section
 */
function isCriticalSection(section) {
    // Critical sections load immediately (above-the-fold)
    if (MOBILE_CONFIG.criticalSectionTypes.includes(section.type)) {
        return true;
    }
    
    // First banner section is also critical
    if (section.type === 'bannerFullWidth' && section.ordering <= 2) {
        return true;
    }
    
    return false;
}

// Helper function to clear cache for a specific URL pattern
function clearCacheForUrl(urlPattern) {
    const keysToDelete = [];
    requestCache.forEach((value, key) => {
        if (key.includes(urlPattern)) {
            keysToDelete.push(key);
        }
    });
    keysToDelete.forEach(key => requestCache.delete(key));
}

// Helper function to get cached response or fetch new
async function cachedFetch(url, options = {}) {
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // If URL has cache-busting parameter (_t), skip cache
    if (url.includes('_t=')) {
        console.log('Fetching (no cache):', url);
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error (${response.status}):`, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        console.log('API Response:', data);
        return data;
    }
    
    const cached = requestCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log('Using cached data for:', url);
        return cached.data;
    }
    
    console.log('Fetching:', url);
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    
    requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
    
    return data;
}

const HOMEPAGE_SECTION_RENDERERS = {
    heroSlider: renderHeroSlider,
    scrollingText: renderScrollingText,
    categoryFeatured: renderCategoryFeatured,
    categoryGrid: renderCategoryGrid,
    categoryCircles: renderCategoryCircles,
    departmentGrid: renderDepartmentGrid,
    productTabs: renderProductTabs,
    productCarousel: renderProductCarousel,
    newArrivals: renderNewArrivals,
    topSelling: renderTopSelling,
    featuredCollections: renderFeaturedCollections,
    subcategoryGrid: renderSubcategoryGrid,
    bannerFullWidth: renderBannerFullWidth,
    videoBanner: renderVideoBanner,
    collectionLinks: renderCollectionLinks,
    newsletterSocial: renderNewsletterSocial,
    brandMarquee: renderBrandMarquee,
    brandGrid: renderBrandGrid,
    customHTML: renderCustomHTML
};

// Export renderers immediately so they're available
if (typeof window !== 'undefined') {
    window.HOMEPAGE_SECTION_RENDERERS = HOMEPAGE_SECTION_RENDERERS;
    console.log('HOMEPAGE_SECTION_RENDERERS exported to window');
}

// Load and render homepage sections
async function loadAndRenderHomepageSections() {
    const startTime = performance.now();
    console.log('loadAndRenderHomepageSections function called');
    
    // Export to window immediately when function is called (backup)
    if (typeof window !== 'undefined' && !window.loadAndRenderHomepageSections) {
        window.loadAndRenderHomepageSections = loadAndRenderHomepageSections;
        console.log('loadAndRenderHomepageSections exported to window (backup)');
    }
    try {
        if (typeof window.Logger !== 'undefined') {
            window.Logger.info('Loading homepage sections...');
        } else {
            console.log('Loading homepage sections...');
        }
        
        // Fetch homepage sections.
        // Use cache during a single session, but bypass browser HTTP cache with a timestamp
        // so that changes from the admin dashboard (add/remove sections) appear immediately.
        let sections;
        try {
            const url = `/api/homepage-sections/public?_t=${Date.now()}`;
            console.log('Fetching sections from:', url);
            sections = await cachedFetch(url);
            console.log('Sections received:', sections);
            if (!Array.isArray(sections)) {
                console.error('Invalid sections response format:', sections);
                throw new Error('Invalid sections response format');
            }
        } catch (error) {
            const errorMsg = `Failed to load homepage sections: ${error.message}`;
            console.error(errorMsg, error);
            // Hide fallback even on error to prevent showing hardcoded content
            const oldSectionsFallback = document.getElementById('old-sections-fallback');
            if (oldSectionsFallback) {
                oldSectionsFallback.style.display = 'none';
                console.log('Hidden old-sections-fallback due to error');
            }
            if (typeof window.Logger !== 'undefined') {
                window.Logger.error(errorMsg, error, {});
            } else {
                console.warn(errorMsg);
            }
            return;
        }
        if (!Array.isArray(sections) || sections.length === 0) {
            const msg = 'No homepage sections found. Make sure sections are both Active AND Published in the admin panel.';
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn(msg);
            } else {
                console.warn(msg);
            }
            // Hide fallback even when no sections found to prevent showing hardcoded content
            const oldSectionsFallback = document.getElementById('old-sections-fallback');
            if (oldSectionsFallback) {
                oldSectionsFallback.style.display = 'none';
                console.log('Hidden old-sections-fallback - no sections found');
            }
            // Show user-friendly message
            const mainContainer = document.querySelector('main');
            if (mainContainer) {
                const noSectionsMsg = document.createElement('div');
                noSectionsMsg.className = 'alert alert-info text-center m-4';
                noSectionsMsg.innerHTML = '<p><strong>No sections available</strong></p><p>Please check that sections are both <strong>Active</strong> and <strong>Published</strong> in the admin panel.</p>';
                mainContainer.appendChild(noSectionsMsg);
            }
            return;
        }
        
        // Log sections being loaded for debugging
        console.log(`Found ${sections.length} homepage sections:`, sections.map((s, i) => ({ 
            index: i, 
            name: s.name, 
            type: s.type, 
            ordering: s.ordering, 
            isActive: s.isActive, 
            isPublished: s.isPublished,
            hasItems: s.type === 'scrollingText' ? (s.config?.items?.length > 0) : 'N/A'
        })));
        
        // Sort by ordering
        sections.sort((a, b) => (a.ordering || 0) - (b.ordering || 0));
        
        // Separate banner sections from other sections
        const bannerSections = sections.filter(s => s.type === 'bannerFullWidth');
        const otherSections = sections.filter(s => s.type !== 'bannerFullWidth');
        
        console.log(`Sections breakdown: ${otherSections.length} regular sections, ${bannerSections.length} banner sections`);
        
        if (typeof window.Logger !== 'undefined') {
            window.Logger.info(`Found ${sections.length} homepage sections`, { count: sections.length, banners: bannerSections.length });
        }
        
        // Render each section
        const mainContainer = document.querySelector('main');
        if (!mainContainer) {
            console.error('Main container not found');
            return;
        }
        console.log('Main container found');
        
        // Use existing container or create it
        let homepageSectionsContainer = document.getElementById('homepage-sections-container');
        if (!homepageSectionsContainer) {
            console.log('Creating homepage-sections-container');
            homepageSectionsContainer = document.createElement('div');
            homepageSectionsContainer.id = 'homepage-sections-container';
            homepageSectionsContainer.className = 'homepage-sections-container';
            
            // Insert at the beginning of main
            if (mainContainer.firstChild) {
                mainContainer.insertBefore(homepageSectionsContainer, mainContainer.firstChild);
            } else {
                mainContainer.appendChild(homepageSectionsContainer);
            }
        } else {
            console.log('homepage-sections-container already exists');
        }
        
        // Clear container before rendering new sections
        homepageSectionsContainer.innerHTML = '';
        console.log('Container cleared, ready to render sections');
        
        // Hide old sections fallback if we have new sections (or always hide it to prevent showing hardcoded content)
        const oldSectionsFallback = document.getElementById('old-sections-fallback');
        if (oldSectionsFallback) {
            oldSectionsFallback.style.display = 'none';
            console.log('Hidden old-sections-fallback to prevent showing hardcoded content');
        }
        
        // STEP 1: Separate critical (above-the-fold) from non-critical sections
        const criticalSections = [];
        const nonCriticalSections = [];
        
        otherSections.forEach((section, i) => {
            if (isCriticalSection(section)) {
                criticalSections.push({ section, index: i });
            } else {
                nonCriticalSections.push({ section, index: i });
            }
        });
        
        console.log(`Section prioritization: ${criticalSections.length} critical, ${nonCriticalSections.length} non-critical`);
        
        // Performance mark: Start critical sections
        performance.mark('critical-sections-start');
        
        // STEP 2: Render critical sections immediately (above-the-fold)
        let renderedCount = 0;
        const renderedSectionIds = new Map(); // Track rendered sections by ID for banner positioning
        
        for (const { section, index } of criticalSections) {
            console.log(`[CRITICAL] Rendering section ${index}: "${section.name}" (type: ${section.type})`);
            const result = await renderSection(section, index, otherSections, homepageSectionsContainer);
            if (result && !result.skip && result.rendered !== false) {
                renderedCount++;
                console.log(`✓ [CRITICAL] Section ${index} "${section.name}" rendered successfully`);
                
                // Track rendered section for banner positioning
                const renderedElement = homepageSectionsContainer.querySelector(`[data-section-id="${section._id}"]`);
                if (renderedElement) {
                    renderedSectionIds.set(section._id, renderedElement);
                }
            } else if (result && result.skip) {
                console.log(`⊘ [CRITICAL] Section ${index} "${section.name}" skipped`);
            } else {
                console.warn(`⚠ [CRITICAL] Section ${index} "${section.name}" did not render`);
            }
        }
        
        performance.mark('critical-sections-end');
        performance.measure('critical-sections', 'critical-sections-start', 'critical-sections-end');
        
        // STEP 3: Render non-critical sections with lazy loading (Intersection Observer)
        performance.mark('non-critical-sections-start');
        
        const observer = initIntersectionObserver();
        const lazyLoadPromises = [];
        
        for (const { section, index } of nonCriticalSections) {
            // Create placeholder element with skeleton loader for product sections
            const needsSkeleton = ['productCarousel', 'productTabs', 'newArrivals', 'topSelling'].includes(section.type);
            const placeholderHtml = needsSkeleton 
                ? renderSectionSkeleton(section.type, section.config?.limit || 8)
                : '<div class="section-placeholder" style="min-height: 200px;"></div>';
            
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = `homepage-section lazy-section`;
            placeholderDiv.setAttribute('data-section-id', section._id);
            placeholderDiv.setAttribute('data-section-type', section.type);
            placeholderDiv.innerHTML = placeholderHtml;
            
            // Create a unique function name for lazy loading
            const loadFunctionName = `loadSection_${section._id}_${Date.now()}`;
            
            // Store section data and create load function
            window[loadFunctionName] = async () => {
                console.log(`[LAZY] Loading section ${index}: "${section.name}" (type: ${section.type})`);
                const loadStartTime = performance.now();
                
                try {
                    const result = await renderSection(section, index, otherSections, homepageSectionsContainer);
                    const loadDuration = performance.now() - loadStartTime;
                    
                    if (result && !result.skip && result.rendered !== false) {
                        renderedCount++;
                        console.log(`✓ [LAZY] Section ${index} "${section.name}" loaded in ${loadDuration.toFixed(2)}ms`);
                        
                        // Track rendered section for banner positioning
                        const renderedElement = homepageSectionsContainer.querySelector(`[data-section-id="${section._id}"]`);
                        if (renderedElement) {
                            renderedSectionIds.set(section._id, renderedElement);
                        }
                    }
                    
                    // Replace placeholder with actual content
                    if (placeholderDiv.parentNode) {
                        placeholderDiv.remove();
                    }
                } catch (error) {
                    console.error(`[LAZY] Error loading section ${index}:`, error);
                    placeholderDiv.innerHTML = '<div class="alert alert-warning">Failed to load section. Please refresh.</div>';
                }
            };
            
            placeholderDiv.setAttribute('data-load-function', loadFunctionName);
            homepageSectionsContainer.appendChild(placeholderDiv);
            
            // Observe the placeholder for lazy loading
            if (observer) {
                observer.observe(placeholderDiv);
            } else {
                // Fallback: Load immediately if IntersectionObserver not supported
                lazyLoadPromises.push(window[loadFunctionName]());
            }
        }
        
        // If IntersectionObserver is not supported, load all sections in parallel batches
        if (!observer && lazyLoadPromises.length > 0) {
            const batchSize = MOBILE_CONFIG.maxConcurrentRequests;
            for (let i = 0; i < lazyLoadPromises.length; i += batchSize) {
                const batch = lazyLoadPromises.slice(i, i + batchSize);
                await Promise.all(batch);
            }
        }
        
        performance.mark('non-critical-sections-end');
        performance.measure('non-critical-sections', 'non-critical-sections-start', 'non-critical-sections-end');
        
        // Update renderedSectionIds map with all currently rendered sections
        const allRenderedSections = homepageSectionsContainer.querySelectorAll('[data-section-id]');
        allRenderedSections.forEach(element => {
            const sectionId = element.getAttribute('data-section-id');
            if (sectionId) {
                renderedSectionIds.set(sectionId, element);
            }
        });
        console.log(`Tracked ${renderedSectionIds.size} sections for banner positioning`);
        
        // STEP 4: Render banner sections based on their location config
        // Separate critical banners (first 2) from non-critical
        const criticalBanners = bannerSections.filter(b => b.ordering <= 2);
        const nonCriticalBanners = bannerSections.filter(b => b.ordering > 2);
        
        console.log(`\n=== Rendering ${bannerSections.length} banner sections: ${criticalBanners.length} critical, ${nonCriticalBanners.length} lazy ===`);
        
        // Render critical banners immediately
        for (let i = 0; i < criticalBanners.length; i++) {
            const bannerSection = criticalBanners[i];
            const location = bannerSection.config?.location || 'bottom';
            console.log(`[CRITICAL BANNER] "${bannerSection.name}": location="${location}"`);
            
            const result = await renderBannerSectionWithLocation(bannerSection, location, renderedSectionIds, homepageSectionsContainer);
            if (result && result.rendered !== false) {
                renderedCount++;
                console.log(`✓ [CRITICAL BANNER] "${bannerSection.name}" rendered successfully`);
            }
        }
        
        // Render non-critical banners with lazy loading
        for (let i = 0; i < nonCriticalBanners.length; i++) {
            const bannerSection = nonCriticalBanners[i];
            const location = bannerSection.config?.location || 'bottom';
            
            // Create placeholder for lazy banner
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = 'homepage-section lazy-section lazy-banner';
            placeholderDiv.setAttribute('data-section-id', bannerSection._id);
            placeholderDiv.setAttribute('data-section-type', 'bannerFullWidth');
            placeholderDiv.style.minHeight = '200px';
            placeholderDiv.innerHTML = '<div class="skeleton-loader banner-skeleton"><div class="skeleton-image"></div></div>';
            
            // Insert placeholder at appropriate location
            const targetElement = findBannerTargetElement(location, renderedSectionIds, homepageSectionsContainer);
            if (targetElement) {
                if (location.startsWith('after-')) {
                    targetElement.insertAdjacentElement('afterend', placeholderDiv);
                } else if (location.startsWith('before-')) {
                    targetElement.insertAdjacentElement('beforebegin', placeholderDiv);
                } else {
                    homepageSectionsContainer.appendChild(placeholderDiv);
                }
            } else {
                homepageSectionsContainer.appendChild(placeholderDiv);
            }
            
            // Create lazy load function
            const loadFunctionName = `loadBanner_${bannerSection._id}_${Date.now()}`;
            window[loadFunctionName] = async () => {
                console.log(`[LAZY BANNER] Loading "${bannerSection.name}" at location "${location}"`);
                const loadStartTime = performance.now();
                
                try {
                    const result = await renderBannerSectionWithLocation(bannerSection, location, renderedSectionIds, homepageSectionsContainer);
                    const loadDuration = performance.now() - loadStartTime;
                    
                    if (result && result.rendered !== false) {
                        renderedCount++;
                        console.log(`✓ [LAZY BANNER] "${bannerSection.name}" loaded in ${loadDuration.toFixed(2)}ms`);
                    }
                    
                    // Remove placeholder
                    if (placeholderDiv.parentNode) {
                        placeholderDiv.remove();
                    }
                } catch (error) {
                    console.error(`[LAZY BANNER] Error loading "${bannerSection.name}":`, error);
                    placeholderDiv.innerHTML = '<div class="alert alert-warning">Failed to load banner.</div>';
                }
            };
            
            placeholderDiv.setAttribute('data-load-function', loadFunctionName);
            
            // Observe for lazy loading
            if (observer) {
                observer.observe(placeholderDiv);
            } else {
                // Fallback: Load immediately
                window[loadFunctionName]();
            }
        }
        
        // Performance monitoring and summary
        const loadDuration = performance.now() - startTime;
        const criticalMeasure = performance.getEntriesByName('critical-sections')[0];
        const nonCriticalMeasure = performance.getEntriesByName('non-critical-sections')[0];
        
        const summaryMsg = `Homepage sections loaded: ${renderedCount}/${sections.length} sections rendered in ${loadDuration.toFixed(2)}ms`;
        const performanceDetails = {
            total: sections.length,
            rendered: renderedCount,
            critical: criticalSections.length,
            nonCritical: nonCriticalSections.length,
            totalDuration: loadDuration.toFixed(2) + 'ms',
            deviceType: isMobile() ? 'mobile' : 'desktop',
            criticalDuration: criticalMeasure ? criticalMeasure.duration.toFixed(2) + 'ms' : 'N/A',
            nonCriticalDuration: nonCriticalMeasure ? nonCriticalMeasure.duration.toFixed(2) + 'ms' : 'N/A'
        };
        
        console.log(summaryMsg);
        console.log('Performance details:', performanceDetails);
        
        if (typeof window.Logger !== 'undefined') {
            window.Logger.info(summaryMsg, performanceDetails);
        }
        
        // Store performance metrics for analytics
        if (typeof window !== 'undefined') {
            window.homepageLoadPerformance = performanceDetails;
        }
        
        // Initialize carousels and interactive elements after rendering
        initializeHomepageInteractions();
        
    } catch (error) {
        const errorMsg = 'Error loading homepage sections';
        if (typeof window.Logger !== 'undefined') {
            window.Logger.error(errorMsg, error, {});
        } else {
            console.error(errorMsg, error);
        }
    }
}

// Helper function to find target element for banner placement
function findBannerTargetElement(location, renderedSectionIds, container) {
    if (location === 'top' || location === 'bottom') {
        return null; // These are handled separately
    }
    
    // Handle "after-section-{id}" or "before-section-{id}"
    if (location.startsWith('after-section-') || location.startsWith('before-section-')) {
        const sectionId = location.split('-').slice(2).join('-');
        return renderedSectionIds.get(sectionId) || container.querySelector(`[data-section-id="${sectionId}"]`);
    }
    
    // Handle "after-hero" or "before-{sectionName}"
    if (location.startsWith('after-') || location.startsWith('before-')) {
        const targetName = location.split('-').slice(1).join('-');
        // Try to find by section type or name
        const candidates = container.querySelectorAll('[data-section-type], [data-section-id]');
        for (const candidate of candidates) {
            const sectionType = candidate.getAttribute('data-section-type');
            if (sectionType === targetName || sectionType === 'heroSlider') {
                return candidate;
            }
        }
    }
    
    return null;
}

// Helper function to render banner section based on location config
async function renderBannerSectionWithLocation(bannerSection, location, renderedSectionIds, container) {
    const renderer = HOMEPAGE_SECTION_RENDERERS[bannerSection.type];
    if (!renderer) {
        console.error(`No renderer found for banner section type: "${bannerSection.type}"`);
        return { rendered: false, reason: `No renderer for type: ${bannerSection.type}` };
    }
    
    try {
        console.log(`Rendering banner "${bannerSection.name}" at location: "${location}"`);
        const bannerElement = await renderer(bannerSection, -1); // Use -1 as index since it's not in the main array
        
        if (!bannerElement) {
            console.warn(`Banner "${bannerSection.name}" renderer returned null`);
            return { rendered: false, reason: 'Renderer returned null' };
        }
        
        // Convert string to element if needed
        let elementToInsert = bannerElement;
        if (typeof bannerElement === 'string') {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = bannerElement;
            elementToInsert = wrapper.firstElementChild;
        }
        
        if (!elementToInsert) {
            console.warn(`Banner "${bannerSection.name}" element is null after conversion`);
            return { rendered: false, reason: 'Element is null' };
        }
        
        // Handle different location values
        if (location === 'top') {
            // Insert at the beginning of container
            if (container.firstChild) {
                container.insertBefore(elementToInsert, container.firstChild);
            } else {
                container.appendChild(elementToInsert);
            }
            console.log(`✓ Banner "${bannerSection.name}" inserted at top`);
            return { rendered: true };
        } else if (location === 'bottom') {
            // Append at the end
            container.appendChild(elementToInsert);
            console.log(`✓ Banner "${bannerSection.name}" appended at bottom`);
            return { rendered: true };
        } else if (location.startsWith('after-')) {
            // Location format: "after-{sectionId}" or "after-hero", "after-slider", etc.
            const targetIdentifier = location.replace('after-', '');
            console.log(`Looking for section: "${targetIdentifier}" to insert banner after it`);
            
            let targetElement = null;
            
            // First try to find by section ID (MongoDB ObjectId format)
            if (targetIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
                // Looks like a MongoDB ObjectId
                targetElement = renderedSectionIds.get(targetIdentifier) || 
                               container.querySelector(`[data-section-id="${targetIdentifier}"]`);
            }
            
            // If not found by ID, try to find by section type or name
            if (!targetElement) {
                // Try common section types
                if (targetIdentifier.toLowerCase() === 'hero' || targetIdentifier.toLowerCase() === 'slider') {
                    targetElement = container.querySelector('[data-section-type="heroSlider"]');
                } else if (targetIdentifier.toLowerCase() === 'categories') {
                    targetElement = container.querySelector('[data-section-type="categoryFeatured"], [data-section-type="categoryGrid"], [data-section-type="categoryCircles"]');
                } else {
                    // Try to find by section name (case-insensitive partial match)
                    const allSections = container.querySelectorAll('[data-section-id]');
                    for (const section of allSections) {
                        const sectionName = section.getAttribute('data-section-name') || 
                                          section.querySelector('h2, h3')?.textContent || '';
                        if (sectionName.toLowerCase().includes(targetIdentifier.toLowerCase())) {
                            targetElement = section;
                            break;
                        }
                    }
                }
            }
            
            // If still not found, try direct query by section ID attribute
            if (!targetElement) {
                targetElement = container.querySelector(`[data-section-id="${targetIdentifier}"]`);
            }
            
            if (targetElement) {
                // Insert after the target section
                if (targetElement.nextSibling) {
                    container.insertBefore(elementToInsert, targetElement.nextSibling);
                } else {
                    container.appendChild(elementToInsert);
                }
                console.log(`✓ Banner "${bannerSection.name}" inserted after "${targetIdentifier}"`);
                return { rendered: true };
            } else {
                // Target section not found, append at bottom as fallback
                console.warn(`Target section "${targetIdentifier}" not found, appending banner at bottom`);
                container.appendChild(elementToInsert);
                return { rendered: true };
            }
        } else {
            // Unknown location, append at bottom as fallback
            console.warn(`Unknown location "${location}", appending banner at bottom`);
            container.appendChild(elementToInsert);
            return { rendered: true };
        }
    } catch (error) {
        console.error(`Error rendering banner section "${bannerSection.name}":`, error);
        return { rendered: false, reason: error.message };
    }
}

// Helper function to render a single section
async function renderSection(section, index, allSections, container) {
    const nextSection = allSections[index + 1];
    const prevSection = allSections[index - 1];
    
    // Check if current and next are both banners after a product section
    const isBannerSection = section.type === 'bannerFullWidth';
    const nextIsBanner = nextSection && nextSection.type === 'bannerFullWidth';
    
    // If we have two consecutive banners, stack them
    if (isBannerSection && nextIsBanner) {
        const renderer = HOMEPAGE_SECTION_RENDERERS[section.type];
        const nextRenderer = HOMEPAGE_SECTION_RENDERERS[nextSection.type];
        
        if (renderer && nextRenderer) {
            try {
                // Render both banners in parallel
                const [banner1, banner2] = await Promise.all([
                    renderer(section, index),
                    nextRenderer(nextSection, index + 1)
                ]);
                
                if (banner1 && banner2) {
                    // Create stacked container
                    const stackContainer = document.createElement('div');
                    stackContainer.className = 'banner-stack-container';
                    
                    // Wrap both banners in the stack
                    const bannerWrapper1 = document.createElement('div');
                    bannerWrapper1.className = 'banner-stack-item banner-stack-item--top';
                    bannerWrapper1.appendChild(banner1);
                    
                    const bannerWrapper2 = document.createElement('div');
                    bannerWrapper2.className = 'banner-stack-item banner-stack-item--bottom';
                    bannerWrapper2.appendChild(banner2);
                    
                    stackContainer.appendChild(bannerWrapper1);
                    stackContainer.appendChild(bannerWrapper2);
                    
                    container.appendChild(stackContainer);
                    return { skipNext: true };
                }
            } catch (error) {
                console.error('Error rendering stacked banners:', error);
            }
        }
    }
    
    // Special handling for scrolling text - only the FIRST one (lowest ordering) goes at top before header
    // Other scrolling text sections should render in their normal position in the container
    if (section.type === 'scrollingText') {
        console.log(`[renderSection] Processing scrolling text section "${section.name}" at index ${index}, ordering: ${section.ordering}`);
        const renderer = HOMEPAGE_SECTION_RENDERERS[section.type];
        if (renderer) {
            try {
                // Check if this is the first scrolling text section (lowest ordering)
                // Find all scrolling text sections and get the one with the lowest ordering
                const scrollingTextSections = allSections.filter(s => s.type === 'scrollingText');
                const firstScrollingText = scrollingTextSections.reduce((prev, curr) => 
                    (prev.ordering || 0) <= (curr.ordering || 0) ? prev : curr
                );
                const isFirstScrollingText = section._id === firstScrollingText._id || 
                                           (section.ordering || 0) === (firstScrollingText.ordering || 0);
                console.log(`[renderSection] First scrolling text: "${firstScrollingText.name}" (ordering: ${firstScrollingText.ordering}), current: "${section.name}" (ordering: ${section.ordering}), isFirst: ${isFirstScrollingText}`);
                
                const sectionElement = await renderer(section, index);
                
                if (!sectionElement) {
                    console.error(`❌ Scrolling text section "${section.name}" (index ${index}) returned null - check if items are configured in admin panel!`);
                    console.error(`   Section data:`, { name: section.name, config: section.config, _id: section._id });
                    // Don't skip - let it fall through, but log the issue
                    return null;
                }
                
                console.log(`[renderSection] Section element created for "${section.name}":`, sectionElement);
                
                if (isFirstScrollingText) {
                    // Insert first scrolling text before header
                    const header = document.getElementById('header');
                    if (header && header.parentNode) {
                        header.parentNode.insertBefore(sectionElement, header);
                        console.log(`✓ First scrolling text "${section.name}" inserted before header`);
                        return { skip: true };
                    }
                } else {
                    // Render subsequent scrolling text sections in their normal position in the container
                    if (sectionElement instanceof Node) {
                        container.appendChild(sectionElement);
                        console.log(`✓ Scrolling text section "${section.name}" (index ${index}) rendered in container after slider`);
                        return { rendered: true };
                    } else if (typeof sectionElement === 'string') {
                        const wrapper = document.createElement('div');
                        wrapper.innerHTML = sectionElement;
                        const firstChild = wrapper.firstElementChild;
                        if (firstChild) {
                            container.appendChild(firstChild);
                            console.log(`✓ Scrolling text section "${section.name}" (index ${index}) rendered in container after slider`);
                            return { rendered: true };
                        }
                    }
                }
            } catch (error) {
                console.error(`Error rendering scrolling text section "${section.name}":`, error);
            }
        } else {
            console.error(`No renderer found for scrolling text section "${section.name}"`);
        }
        // If we get here, something went wrong - don't skip, let normal rendering try
        return null;
    }
    
    const renderer = HOMEPAGE_SECTION_RENDERERS[section.type];
    if (!renderer) {
        console.error(`No renderer found for section type: "${section.type}" (section name: "${section.name}")`);
        console.error('Available renderers:', Object.keys(HOMEPAGE_SECTION_RENDERERS));
        return { rendered: false, reason: `No renderer for type: ${section.type}` };
    }
    
    try {
        const sectionStartTime = performance.now();
        console.log(`Calling renderer for section "${section.name}" (type: ${section.type})`);
        const sectionElement = await renderer(section, index);
        const sectionDuration = performance.now() - sectionStartTime;
        
        if (sectionElement) {
            // Create wrapper element if needed
            if (typeof sectionElement === 'string') {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = sectionElement;
                const firstChild = wrapper.firstElementChild;
                if (firstChild) {
                    container.appendChild(firstChild);
                    console.log(`Section "${section.name}" appended to container (string)`);
                }
            } else if (sectionElement instanceof Node) {
                container.appendChild(sectionElement);
                console.log(`Section "${section.name}" appended to container (Node)`, {
                    elementType: sectionElement.tagName,
                    classes: sectionElement.className,
                    parent: container.id || container.className
                });
                
                // Track this section's element for banner positioning (if not a banner)
                if (section.type !== 'bannerFullWidth' && section._id) {
                    const trackedElement = sectionElement.querySelector(`[data-section-id="${section._id}"]`) || sectionElement;
                    if (trackedElement && trackedElement.hasAttribute('data-section-id')) {
                        // This will be used by renderBannerSectionWithLocation
                        console.log(`Tracked section "${section.name}" (ID: ${section._id}) for banner positioning`);
                    }
                }
                
                // For banner sections, verify image is present
                if (section.type === 'bannerFullWidth') {
                    const img = sectionElement.querySelector('img');
                    if (img) {
                        console.log('Banner image found:', {
                            src: img.src,
                            width: img.width,
                            height: img.height,
                            naturalWidth: img.naturalWidth,
                            naturalHeight: img.naturalHeight
                        });
                        
                        // Add error handler for image loading
                        img.onerror = function() {
                            console.error('Banner image failed to load:', img.src);
                            // Don't hide, show error placeholder instead
                            this.style.backgroundColor = '#f0f0f0';
                            this.alt = 'Image failed to load';
                        };
                        
                        img.onload = function() {
                            console.log('Banner image loaded successfully:', {
                                src: img.src,
                                naturalWidth: img.naturalWidth,
                                naturalHeight: img.naturalHeight
                            });
                            // Add loaded class for fade-in effect if needed
                            this.classList.add('loaded');
                            // Ensure image is visible
                            this.style.opacity = '1';
                            this.style.visibility = 'visible';
                        };
                        
                        // If image is already loaded (cached), trigger onload
                        if (img.complete && img.naturalHeight !== 0) {
                            img.onload();
                        }
                    } else {
                        console.warn('Banner section has no image element!');
                    }
                }
            }
            
            if (typeof window.Logger !== 'undefined') {
                window.Logger.debug(`Section render time: ${sectionDuration.toFixed(2)}ms`, {
                    sectionName: section.name,
                    duration: sectionDuration
                });
            }
            return { rendered: true };
        }
        return { rendered: false, reason: 'No element returned' };
    } catch (error) {
        const errorMsg = `Error rendering section ${section.name} (${section.type})`;
        if (typeof window.Logger !== 'undefined') {
            window.Logger.error(errorMsg, error, {
                sectionName: section.name,
                sectionType: section.type,
                sectionId: section._id
            });
        } else {
            console.error(errorMsg, error);
            console.error('Section data:', section);
        }
        // Show error in UI for debugging
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger m-3';
        errorDiv.innerHTML = `<strong>Error rendering section:</strong> ${section.name} (${section.type})<br><small>${error.message || error.toString()}</small>`;
        container.appendChild(errorDiv);
        return { rendered: false, reason: error.message || error.toString() };
    }
}

// Render Hero Slider
async function renderHeroSlider(section, index) {
    if (!section.config?.sliderIds || section.config.sliderIds.length === 0) {
        if (typeof window.Logger !== 'undefined') {
            window.Logger.warn('Hero slider section has no slider IDs', { sectionId: section._id });
        }
        return null;
    }
    
    try {
        if (typeof window.Logger !== 'undefined') {
            window.Logger.debug('Fetching sliders for hero section', { 
                sliderIds: section.config.sliderIds,
                sectionId: section._id 
            });
        }
        
        const slidersResponse = await fetch('/api/sliders');
        if (!slidersResponse.ok) {
            throw new Error(`Failed to fetch sliders: ${slidersResponse.statusText}`);
        }
        
        const allSliders = await slidersResponse.json();
        const sliders = allSliders.filter(s => 
            section.config.sliderIds.includes(s._id) && s.isActive
        ).sort((a, b) => (a.order || 0) - (b.order || 0));
        
        if (sliders.length === 0) {
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn('No active sliders found for hero section', { 
                    requestedIds: section.config.sliderIds,
                    availableSliders: allSliders.length 
                });
            }
            return null;
        }
        
        if (typeof window.Logger !== 'undefined') {
            window.Logger.debug(`Found ${sliders.length} active sliders`, { 
                sliderCount: sliders.length,
                sliderTitles: sliders.map(s => s.title) 
            });
        }
        
        const autoplay = section.config.autoplay !== false;
        const autoplaySpeed = section.config.autoplaySpeed || 3000;
        const showArrows = section.config.showArrows !== false;
        const showDots = section.config.showDots !== false;
        
        const sectionHtml = `
            <section class="hero-carousel position-relative homepage-section" data-section-type="heroSlider" data-section-id="${section._id}">
                <div class="hero-overlay"></div>
                <div class="hero-carousel__viewport">
                    <div class="hero-carousel__track" id="heroSlides_${index}">
                        ${sliders.map((slider, idx) => {
                            const imageUrl = slider.imageUpload?.url || slider.image || getGlobalFallbackImage();
                            const mobileImageUrl = slider.imageMobileUpload?.url || slider.imageMobile || imageUrl;
                            
                            // Check if slider has a video URL
                            const hasVideo = slider.videoUrl && slider.videoType;
                            const videoType = slider.videoType || (slider.videoUrl ? detectVideoTypeFromUrl(slider.videoUrl) : null);
                            const isYouTube = videoType === 'youtube';
                            const isVimeo = videoType === 'vimeo';
                            
                            let mediaContent = '';
                            
                            if (hasVideo && isYouTube) {
                                const youtubeId = extractYouTubeId(slider.videoUrl);
                                if (youtubeId) {
                                    const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&rel=0&modestbranding=1&playsinline=1`;
                                    mediaContent = `
                                        <div class="hero-slide-video-wrapper" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;">
                                            <iframe src="${htmlEscape(embedUrl)}" 
                                                    style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); min-width: 100%; min-height: 100%; width: 100vw; height: 56.25vw; border: none;" 
                                                    frameborder="0" 
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                                    allowfullscreen>
                                            </iframe>
                                        </div>
                                    `;
                                } else {
                                    // Fallback to image if YouTube ID extraction fails
                                    mediaContent = `
                                        <picture>
                                            <source media="(max-width: 767px)" srcset="${htmlEscape(mobileImageUrl)}">
                                            <img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(slider.imageAlt || slider.title)}" loading="${idx === 0 ? 'eager' : 'lazy'}">
                                        </picture>
                                    `;
                                }
                            } else if (hasVideo && isVimeo) {
                                const vimeoId = extractVimeoId(slider.videoUrl);
                                if (vimeoId) {
                                    const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&background=1`;
                                    mediaContent = `
                                        <div class="hero-slide-video-wrapper" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;">
                                            <iframe src="${htmlEscape(embedUrl)}" 
                                                    style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); min-width: 100%; min-height: 100%; width: 100vw; height: 56.25vw; border: none;" 
                                                    frameborder="0" 
                                                    allow="autoplay; fullscreen; picture-in-picture" 
                                                    allowfullscreen>
                                            </iframe>
                                        </div>
                                    `;
                                } else {
                                    mediaContent = `
                                        <picture>
                                            <source media="(max-width: 767px)" srcset="${htmlEscape(mobileImageUrl)}">
                                            <img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(slider.imageAlt || slider.title)}" loading="${idx === 0 ? 'eager' : 'lazy'}">
                                        </picture>
                                    `;
                                }
                            } else if (hasVideo && (slider.videoUrl.includes('/video/upload') || slider.videoUrl.match(/\.(mp4|webm|ogg|mov|avi|wmv|m4v|flv)$/i))) {
                                // Direct video file
                                mediaContent = `
                                    <video autoplay muted loop playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
                                        <source src="${htmlEscape(slider.videoUrl)}" type="video/mp4">
                                    </video>
                                `;
                            } else {
                                // Regular image
                                mediaContent = `
                                    <picture>
                                        <source media="(max-width: 767px)" srcset="${htmlEscape(mobileImageUrl)}">
                                        <img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(slider.imageAlt || slider.title)}" loading="${idx === 0 ? 'eager' : 'lazy'}">
                                    </picture>
                                `;
                            }
                            
                            return `
                                <div class="hero-carousel__slide ${idx === 0 ? 'active' : ''}" data-slide-index="${idx}">
                                    ${mediaContent}
                                    <div class="hero-carousel__content">
                                        ${slider.title ? `<h1 class="hero-slide-title">${htmlEscape(slider.title)}</h1>` : ''}
                                        ${slider.description ? `<p class="hero-slide-description">${htmlEscape(slider.description)}</p>` : ''}
                                        ${slider.buttonText && slider.buttonLink ? `
                                            <a href="${htmlEscape(slider.buttonLink || slider.link)}" class="btn btn-primary btn-lg hero-slide-button">
                                                ${htmlEscape(slider.buttonText)}
                                            </a>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${showDots ? `<div class="hero-carousel__dots" id="heroDots_${index}">
                        ${sliders.map((_, idx) => `<button class="dot ${idx === 0 ? 'active' : ''}" data-slide="${idx}" aria-label="Go to slide ${idx + 1}"></button>`).join('')}
                    </div>` : ''}
                    ${showArrows ? `
                        <button class="hero-carousel__nav hero-carousel__nav--prev" type="button" aria-label="Previous slide">
                            <span>&lsaquo;</span>
                        </button>
                        <button class="hero-carousel__nav hero-carousel__nav--next" type="button" aria-label="Next slide">
                            <span>&rsaquo;</span>
                        </button>
                    ` : ''}
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        const sectionElement = tempDiv.firstElementChild;
        
        // Initialize carousel
        if (sectionElement) {
            initHeroCarousel(sectionElement, { autoplay, autoplaySpeed, showArrows, showDots });
        }
        
        return sectionElement;
    } catch (error) {
        if (typeof window.Logger !== 'undefined') {
            window.Logger.error('Error rendering hero slider', error, {
                sectionId: section._id,
                sliderIds: section.config?.sliderIds
            });
        } else {
            console.error('Error rendering hero slider:', error);
        }
        return null;
    }
}

// Render Scrolling Text
function renderScrollingText(section, index) {
    console.log(`[renderScrollingText] Rendering section "${section.name}" (index ${index})`);
    console.log(`[renderScrollingText] Section config:`, section.config);
    
    const items = section.config?.items || [];
    console.log(`[renderScrollingText] Items found:`, items.length, items);
    
    if (items.length === 0) {
        console.error(`❌ Scrolling text section "${section.name}" has no items configured! Config:`, section.config);
        return null;
    }
    
    const scrollSpeed = section.config?.scrollSpeed || 20;
    // Use background color from config, default to white for first announcement bar at top
    const bgColor = section.config?.backgroundColor || '#ffffff';
    // Use text color from config, default to red
    const textColor = section.config?.textColor || '#d93939';
    
    console.log(`[renderScrollingText] Creating HTML for "${section.name}" with ${items.length} items`);
    
    // Create the content items with heart icons
    const contentItems = items.map((item, idx) => `
        <span class="scrolling-text__item">${htmlEscape(item)}</span>
        <i class="la la-heart scrolling-text__icon" aria-hidden="true"></i>
    `).join('');
    
    // Duplicate content multiple times for seamless infinite scroll (more copies = smoother)
    const duplicatedContent = contentItems + contentItems + contentItems + contentItems;
    
    // For "Announcement Bar-2", force red background
    const isAnnouncementBar2 = (section.name || '').toLowerCase().includes('announcement bar-2') || 
                               (section.name || '').toLowerCase().includes('announcement bar 2');
    const finalBgColor = isAnnouncementBar2 ? '#c42525' : bgColor;
    
    const sectionHtml = `
        <section class="scrolling-text homepage-section" 
                 data-section-type="scrollingText" 
                 data-section-id="${section._id}"
                 data-section-name="${htmlEscape(section.name || '')}"
                 style="background-color: ${finalBgColor}; color: ${textColor}; height: 50px; padding: 12px 0; overflow: hidden;"
                 data-bg-color="${finalBgColor}"
                 data-text-color="${textColor}">
            <div class="scrolling-text__wrapper">
                <div class="scrolling-text__inner" style="--scroll-speed: ${scrollSpeed}s;">
                    <div class="scrolling-text__content">
                        ${duplicatedContent}
                    </div>
                </div>
            </div>
        </section>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sectionHtml;
    const element = tempDiv.firstElementChild;
    
    if (element) {
        console.log(`✓ [renderScrollingText] Successfully created element for "${section.name}"`);
    } else {
        console.error(`❌ [renderScrollingText] Failed to create element for "${section.name}"`);
    }
    
    return element;
}

// Render Category Featured Grid
async function renderCategoryFeatured(section, index) {
    const categoryIds = section.config?.categoryIds || [];
    if (categoryIds.length === 0) {
        // Load featured categories if no specific IDs
        return await renderCategoryFeaturedFallback(section, index);
    }
    
    try {
        // Check if section has a banner to render first
        let sectionBanner = null;
        if (section.config?.sectionBannerId) {
            sectionBanner = await getSectionBanner(section.config.sectionBannerId);
        }
        
        const categoriesResponse = await fetch('/api/categories');
        const allCategories = await categoriesResponse.json();
        const categories = allCategories.filter(cat => 
            categoryIds.includes(cat._id) && cat.isActive
        );
        
        if (categories.length === 0) return null;
        
        const gridColumns = section.config?.gridColumns || 4;
        const showTitle = section.config?.showTitle !== false;
        
        const sectionHtml = `
            <section class="category-featured homepage-section" data-section-type="categoryFeatured" data-section-id="${section._id}">
                ${sectionBanner ? `
                    <div class="container-fluid px-0 mb-4">
                        <a href="${htmlEscape(sectionBanner.link || '#')}" class="banner-full-width__link">
                            <img src="${htmlEscape(sectionBanner.imageUpload?.url || sectionBanner.image || getGlobalFallbackImage())}" 
                                 alt="${htmlEscape(sectionBanner.imageAlt || sectionBanner.title || 'Banner')}" 
                                 class="banner-full-width__image"
                                 loading="lazy">
                        </a>
                    </div>
                ` : ''}
                <div class="container py-5">
                    ${section.title ? `
                        <div class="section-header mb-4">
                            <h2>${htmlEscape(section.title)}</h2>
                            ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    <div class="row g-4" style="--grid-cols: ${gridColumns};">
                        ${categories.map(cat => {
                            const imageUrl = cat.imageUpload?.url || cat.image || getGlobalFallbackImage();
                            return `
                                <div class="col-lg-${12 / gridColumns} col-md-6 col-sm-6">
                                    <a href="/category/${cat._id}" class="cat-grid-item hover-zoom">
                                        <div class="cat_grid_item__image-wrapper">
                                            <img src="${htmlEscape(imageUrl)}" 
                                                 alt="${htmlEscape(cat.imageAlt || cat.name)}" 
                                                 class="cat-grid-img"
                                                 loading="lazy">
                                        </div>
                                        ${showTitle ? `<h4 class="cat-grid-title mt-3">${htmlEscape(cat.name)}</h4>` : ''}
                                    </a>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        return tempDiv.firstElementChild;
    } catch (error) {
        console.error('Error rendering category featured:', error);
        return null;
    }
}

async function renderCategoryFeaturedFallback(section, index) {
    try {
        const categoriesResponse = await fetch('/api/categories');
        const allCategories = await categoriesResponse.json();
        const categories = allCategories.filter(cat => cat.isFeatured && cat.isActive);
        
        if (!categories || categories.length === 0) return null;
        
        const gridColumns = section.config?.gridColumns || 4;
        
        const sectionHtml = `
            <section class="category-featured homepage-section" data-section-type="categoryFeatured" data-section-id="${section._id}">
                <div class="container py-5">
                    ${section.title ? `
                        <div class="section-header mb-4">
                            <h2>${htmlEscape(section.title)}</h2>
                        </div>
                    ` : ''}
                    <div class="row g-4">
                        ${categories.slice(0, gridColumns * 2).map(cat => {
                            const imageUrl = cat.imageUpload?.url || cat.image || getGlobalFallbackImage();
                            return `
                                <div class="col-lg-${12 / gridColumns} col-md-6 col-sm-6">
                                    <a href="/category/${cat._id}" class="cat-grid-item hover-zoom">
                                        <div class="cat_grid_item__image-wrapper">
                                            <img src="${htmlEscape(imageUrl)}" 
                                                 alt="${htmlEscape(cat.name)}" 
                                                 class="cat-grid-img"
                                                 loading="lazy">
                                        </div>
                                        <h4 class="cat-grid-title mt-3">${htmlEscape(cat.name)}</h4>
                                    </a>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        return tempDiv.firstElementChild;
    } catch (error) {
        console.error('Error rendering category featured fallback:', error);
        return null;
    }
}

// Render Category Grid
function renderCategoryGrid(section, index) {
    // Similar to categoryFeatured but with different styling
    return renderCategoryFeatured(section, index);
}

// Render Category Circles
async function renderCategoryCircles(section, index) {
    const categoryIds = section.config?.categoryIds || [];
    
    try {
        const categoriesResponse = await fetch('/api/categories');
        const allCategories = await categoriesResponse.json();
        const categories = categoryIds.length > 0
            ? allCategories.filter(cat => categoryIds.includes(cat._id) && cat.isActive)
            : allCategories.filter(cat => (cat.isFeatured || cat.isActive) && cat.isActive).slice(0, 8);
        
        if (categories.length === 0) return null;
        
        const sectionHtml = `
            <section class="category-circles homepage-section" data-section-type="categoryCircles" data-section-id="${section._id}">
                <div class="container py-5">
                    ${section.title || section.subtitle ? `
                        <div class="section-header text-center">
                            ${section.title ? `<h2>${htmlEscape(section.title)}</h2>` : ''}
                            ${section.subtitle ? `<p>${htmlEscape(section.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    <div class="category-circles__grid">
                        ${categories.map(cat => {
                            const imageUrl = cat.imageUpload?.url || cat.image || getGlobalFallbackImage();
                            return `
                                <a href="/category/${cat._id}" class="category-circle-item">
                                    <div class="category-circle__image">
                                        <img src="${htmlEscape(imageUrl)}" 
                                             alt="${htmlEscape(cat.name)}" 
                                             loading="lazy">
                                    </div>
                                    <span class="category-circle__name">${htmlEscape(cat.name)}</span>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        return tempDiv.firstElementChild;
    } catch (error) {
        console.error('Error rendering category circles:', error);
        return null;
    }
}

// Render Department Grid
async function renderDepartmentGrid(section, index) {
    const departmentIds = section.config?.departmentIds || [];
    const gridColumns = section.config?.gridColumns || 4;
    const showTitles = section.config?.showTitles !== false; // Default to true
    
    try {
        const departmentsResponse = await fetch('/api/departments');
        const allDepartments = await departmentsResponse.json();
        const departments = departmentIds.length > 0
            ? allDepartments.filter(dept => departmentIds.includes(dept._id) && dept.isActive)
            : allDepartments.filter(dept => dept.isActive).slice(0, 12);
        
        if (departments.length === 0) return null;
        
        // Calculate Bootstrap grid classes based on columns
        const colClass = gridColumns === 2 ? 'col-md-6' : 
                        gridColumns === 3 ? 'col-md-4' : 
                        gridColumns === 4 ? 'col-md-3' : 
                        gridColumns === 6 ? 'col-md-2' : 'col-md-3';
        
        const sectionHtml = `
            <section class="department-grid homepage-section" data-section-type="departmentGrid" data-section-id="${section._id}">
                <div class="container py-5">
                    ${section.title ? `
                        <div class="section-header text-center mb-4">
                            <h2>${htmlEscape(section.title)}</h2>
                            ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    <div class="row g-4">
                        ${departments.map(dept => {
                            const imageUrl = dept.imageUpload?.url || dept.image || getGlobalFallbackImage();
                            return `
                                <div class="${colClass} col-sm-6">
                                    <a href="/department/${dept._id}" class="department-grid-item text-decoration-none">
                                        <div class="card h-100 shadow-sm department-card">
                                            <div class="department-media">
                                                <img src="${htmlEscape(imageUrl)}" 
                                                     alt="${htmlEscape(dept.name)}" 
                                                     class="card-img-top"
                                                     loading="lazy">
                                            </div>
                                            ${showTitles ? `
                                                <div class="card-body text-center">
                                                    <h5 class="card-title mb-0">${htmlEscape(dept.name)}</h5>
                                                    ${dept.description ? `<p class="card-text text-muted small mt-2">${htmlEscape(dept.description.substring(0, 80))}${dept.description.length > 80 ? '...' : ''}</p>` : ''}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </a>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        return tempDiv.firstElementChild;
    } catch (error) {
        console.error('Error rendering department grid:', error);
        return null;
    }
}

// Render Product Tabs
async function renderProductTabs(section, index) {
    const tabs = section.config?.tabs || [];
    if (tabs.length === 0) return null;
    
    try {
        // Check if section has a banner to render first
        const sectionBanner = section.config?.sectionBannerId ? await getSectionBanner(section.config.sectionBannerId) : null;
        const hasMultipleTabs = tabs.length > 1;
        
        const sectionHtml = `
            <section class="product-tabs homepage-section" data-section-type="productTabs" data-section-id="${section._id}">
                ${sectionBanner ? `
                    <div class="container-fluid px-0 mb-4">
                        <a href="${htmlEscape(sectionBanner.link || '#')}" class="banner-full-width__link">
                            <img src="${htmlEscape(sectionBanner.imageUpload?.url || sectionBanner.image || getGlobalFallbackImage())}" 
                                 alt="${htmlEscape(sectionBanner.imageAlt || sectionBanner.title || 'Banner')}" 
                                 class="banner-full-width__image"
                                 loading="lazy">
                        </a>
                    </div>
                ` : ''}
                <div class="container py-5">
                    ${section.title ? `
                        <div class="section-header mb-4">
                            <h2>${htmlEscape(section.title)}</h2>
                        </div>
                    ` : ''}
                    <div class="product-tabs__wrapper">
                        ${hasMultipleTabs ? `
                            <ul class="product-tabs__nav nav nav-tabs" role="tablist">
                                ${tabs.map((tab, idx) => `
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link ${idx === 0 ? 'active' : ''}" 
                                                data-bs-toggle="tab" 
                                                data-bs-target="#tab_${index}_${idx}" 
                                                type="button">
                                            ${htmlEscape(tab.label || `Tab ${idx + 1}`)}
                                        </button>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : ''}
                        <div class="tab-content">
                            ${tabs.map((tab, idx) => `
                                <div class="tab-pane fade ${idx === 0 ? 'show active' : ''}" 
                                     id="tab_${index}_${idx}" 
                                     role="tabpanel">
                                    <div class="row g-4" id="tabProducts_${index}_${idx}">
                                        <!-- Products will be loaded here -->
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        const sectionElement = tempDiv.firstElementChild;
        
        // Load products for each tab in parallel (faster loading)
        const tabPromises = tabs.map((tab, idx) => loadTabProducts(section, tab, index, idx));
        Promise.all(tabPromises).catch(err => console.warn('Tab products loading error:', err));
        
        return sectionElement;
    } catch (error) {
        console.error('Error rendering product tabs:', error);
        return null;
    }
}

async function loadTabProducts(section, tab, sectionIndex, tabIndex) {
    try {
        const categoryId = section.config?.categoryId || tab.categoryId || '';
        const filter = tab.filter || '';
        const defaultLimit = tab.limit || 8;
        const limit = getProductLimit('productTabs', defaultLimit);
        
        let url = '/api/products?limit=' + limit;
        if (categoryId) url += '&categoryId=' + categoryId;

        // If this tab represents a logical section (e.g. New Arrivals, Best Sellers, On Sale),
        // use the section parameter instead of legacy filter flags so that each product
        // appears only in its assigned section.
        let sectionFromFilter = null;
        if (typeof filter === 'string') {
            const f = filter.toLowerCase();
            if (f === 'new' || f === 'new-arrival' || f === 'newarrival') {
                sectionFromFilter = 'New Arrivals';
            } else if (f === 'best-selling' || f === 'bestseller' || f === 'best-seller') {
                sectionFromFilter = 'Best Sellers';
            } else if (f === 'discounted' || f === 'onsale' || f === 'on-sale') {
                sectionFromFilter = 'On Sale';
            }
        }
        
        // Section has highest priority
        const effectiveSection = tab.section || section.config?.section || sectionFromFilter || null;
        if (effectiveSection) {
            url += '&section=' + encodeURIComponent(effectiveSection);
        } else if (filter) {
            // Only fall back to filter flags when no section mapping is available
            if (typeof filter === 'string') {
                url += '&filter=' + filter;
            } else if (typeof filter === 'object') {
                if (filter.isFeatured) url += '&filter=featured';
                if (filter.isNewArrival) url += '&filter=new';
                if (filter.isTrending) url += '&filter=trending';
                if (filter.isDiscounted) url += '&filter=discounted';
                if (filter.isBestSelling) url += '&filter=best-selling';
                if (filter.isTopSelling) url += '&filter=top-selling';
            }
        }
        
        // Backward compatibility: also support collection filter
        if (tab.collection || section.config?.collection) {
            url += '&collection=' + encodeURIComponent(tab.collection || section.config.collection);
        }
        
        // Support minDiscount for sale events (e.g., 10.10 sale)
        if (tab.minDiscount || section.config?.minDiscount) {
            url += '&minDiscount=' + (tab.minDiscount || section.config.minDiscount);
        }
        
        // Use cached fetch for product data
        let data;
        try {
            data = await cachedFetch(url);
        } catch (error) {
            const errorMsg = `Failed to load products for tab ${tab.label || tabIndex}: ${error.message}`;
            if (typeof window.Logger !== 'undefined') {
                window.Logger.error(errorMsg, error, { sectionIndex, tabIndex, url });
            } else {
                console.error(errorMsg);
            }
            
            const container = document.getElementById(`tabProducts_${sectionIndex}_${tabIndex}`);
            if (container) {
                container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No products available</p></div>';
            }
            return;
        }
        
        const products = Array.isArray(data) ? data : (data.products || []);
        
        const container = document.getElementById(`tabProducts_${sectionIndex}_${tabIndex}`);
        if (!container) {
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn(`Container not found for tab ${tabIndex}`, { sectionIndex, tabIndex });
            }
            return;
        }
        
        if (products.length === 0) {
            container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No products available for this tab</p></div>';
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn(`No products found for tab ${tab.label || tabIndex}`, { sectionIndex, tabIndex, url });
            }
            return;
        }
        
        container.innerHTML = products.map(product => renderProductCard(product)).join('');
        
        if (typeof window.Logger !== 'undefined') {
            window.Logger.debug(`Loaded ${products.length} products for tab ${tab.label || tabIndex}`, {
                sectionIndex,
                tabIndex,
                productCount: products.length
            });
        }
    } catch (error) {
        const errorMsg = `Error loading tab products: ${error.message}`;
        if (typeof window.Logger !== 'undefined') {
            window.Logger.error(errorMsg, error, { sectionIndex, tabIndex });
        } else {
            console.error(errorMsg, error);
        }
        
        const container = document.getElementById(`tabProducts_${sectionIndex}_${tabIndex}`);
        if (container) {
            container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-danger">Error loading products. Please refresh the page.</p></div>';
        }
    }
}

// Render Product Carousel
async function renderProductCarousel(section, index) {
    try {
        const categoryId = section.config?.categoryId || '';
        const defaultLimit = section.config?.limit || 10;
        const limit = getProductLimit('productCarousel', defaultLimit);
        const autoplay = section.config?.autoplay !== false;

        // Derive section filter (product "section" name) from config or section title/name
        let sectionFilter = section.config?.section;
        if (!sectionFilter) {
            const rawName = (section.config?.title || section.title || section.name || '').toLowerCase();
            if (rawName.includes('lingerie')) {
                sectionFilter = 'Lingerie Collection';
            } else if (rawName.includes('top selling')) {
                sectionFilter = 'Top Selling Product';
            } else if (rawName.includes('new arrivals')) {
                sectionFilter = 'New Arrivals';
            } else if (rawName.includes('best sellers')) {
                sectionFilter = 'Best Sellers';
            } else if (rawName.includes('on sale')) {
                sectionFilter = 'On Sale';
            } else if (rawName.includes('mega sale') || rawName.includes('10.10')) {
                sectionFilter = '10.10 Mega Sale';
            }
        }
        
        let url = '/api/products?limit=' + limit;
        if (categoryId) url += '&categoryId=' + categoryId;
        
        // Filter by section if provided (MUST be applied for correct filtering)
        // When section is specified, ONLY use section filter - ignore other filters
        if (sectionFilter) {
            url += '&section=' + encodeURIComponent(sectionFilter);
            console.log(`🏠 Homepage - Loading products for section: "${sectionFilter}" (section filter only)`);
        } else {
            // Only apply other filters if section is NOT specified
            // Check filter from config (supports string filter or boolean flags)
            if (section.config?.filter) {
                const filter = section.config.filter;
                if (typeof filter === 'string') {
                    url += '&filter=' + filter;
                } else if (filter === 'trending' || filter === 'new' || filter === 'discounted' || filter === 'featured' || filter === 'best-selling' || filter === 'top-selling') {
                    url += '&filter=' + filter;
                }
            }
            if (section.config?.isFeatured) url += '&filter=featured';
            if (section.config?.isNewArrival) url += '&filter=new';
            if (section.config?.isTrending) url += '&filter=trending';
            if (section.config?.isBestSelling) url += '&filter=best-selling';
            if (section.config?.isTopSelling) url += '&filter=top-selling';
        }
        // Backward compatibility: also support collection filter
        if (section.config?.collection && !sectionFilter) {
            url += '&collection=' + encodeURIComponent(section.config.collection);
            console.log(`🏠 Homepage - Using collection filter (legacy): "${section.config.collection}"`);
        }
        
        // Support minDiscount for sale events (e.g., 10.10 sale)
        if (section.config?.minDiscount) {
            url += '&minDiscount=' + section.config.minDiscount;
        }
        
        // Add cache-busting for section-based queries to ensure fresh data
        if (sectionFilter) {
            url += '&_t=' + Date.now();
        }
        
        console.log(`🏠 Homepage - Product carousel URL: ${url}`);
        
        // For section-based queries, don't use cache to ensure we get the correct products
        let data;
        try {
            if (sectionFilter) {
                // Fetch directly without cache for section-based queries
                const response = await fetch(url);
                data = await response.json();
                console.log(`🏠 Homepage - Direct fetch (no cache) for section: "${section.config.section}"`);
            } else {
                // Use cached fetch for non-section queries
                data = await cachedFetch(url);
            }
        } catch (error) {
            const errorMsg = `Failed to load products for carousel: ${error.message}`;
            if (typeof window.Logger !== 'undefined') {
                window.Logger.error(errorMsg, error, { 
                    sectionId: section._id, 
                    sectionName: section.name,
                    url
                });
            }
            return null;
        }
        
        const products = Array.isArray(data) ? data : (data.products || []);
        
        // CRITICAL: If section filter is applied, verify all products have that section
        if (sectionFilter && products.length > 0) {
            const requiredSection = sectionFilter;
            const filteredProducts = products.filter(product => {
                const productSections = product.sections || [];
                const hasSection = Array.isArray(productSections) 
                    ? productSections.includes(requiredSection)
                    : false;
                // Log as debug/info instead of warning to avoid confusing the console
                if (!hasSection) {
                    console.debug(`Product "${product.name}" does not have section "${requiredSection}". Sections:`, productSections);
                }
                return hasSection;
            });
            
            if (filteredProducts.length !== products.length) {
                console.debug(`Filtered out ${products.length - filteredProducts.length} products that don't match section "${requiredSection}"`);
            }
            
            // Use only products that match the section
            const finalProducts = filteredProducts;
            console.log(`🏠 Homepage - Loaded ${finalProducts.length} products (after section filter) for section: "${requiredSection}"`);
            
            if (finalProducts.length === 0) {
                if (typeof window.Logger !== 'undefined') {
                    window.Logger.warn(`No products found for carousel section: ${section.name}`, {
                        sectionId: section._id,
                        url
                    });
                }
                return null;
            }
            
            // Replace products array with filtered one
            const originalProducts = products;
            products.length = 0;
            products.push(...finalProducts);
        } else {
            console.log(`🏠 Homepage - Loaded ${products.length} products for section: "${section.config?.section || section.title || 'Unknown'}"`);
        }
        
        if (products.length === 0) {
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn(`No products found for carousel section: ${section.name}`, {
                    sectionId: section._id,
                    url
                });
            }
            return null;
        }
        
        // Check if this is a section-based product carousel
        const sectionName = sectionFilter || section.title || '';
        const isLingerieSection = sectionName.toLowerCase().includes('lingerie');
        
        const sectionHtml = `
            <section class="product-carousel homepage-section" 
                     data-section-type="productCarousel" 
                     data-section-id="${section._id}"
                     ${sectionName ? `data-section="${htmlEscape(sectionName)}"` : ''}
                     ${isLingerieSection ? `data-collection="Lingerie Collection"` : ''}
                     ${section.name ? `data-section-name="${htmlEscape(section.name)}"` : ''}>
                <div class="container py-5">
                    ${section.title ? `
                        <div class="section-header mb-4">
                            <h2 class="section-title" style="font-size: 28px; font-weight: 600; margin-bottom: 20px;">${htmlEscape(section.title)}</h2>
                            ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    <div class="product-carousel__wrapper">
                        <div class="product-carousel__track" id="productCarousel_${index}" data-autoplay="${autoplay}">
                            ${products.map(product => {
                                // Set context for renderProductCard
                                window.currentRenderContext = 'carousel';
                                const card = renderProductCard(product);
                                window.currentRenderContext = null;
                                return `<div class="product-carousel__slide">${card}</div>`;
                            }).join('')}
                        </div>
                        <button class="product-carousel__nav product-carousel__nav--prev" aria-label="Previous">
                            <span>&lsaquo;</span>
                        </button>
                        <button class="product-carousel__nav product-carousel__nav--next" aria-label="Next">
                            <span>&rsaquo;</span>
                        </button>
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        const sectionElement = tempDiv.firstElementChild;
        
        // Initialize carousel
        if (sectionElement) {
            initProductCarousel(sectionElement, { autoplay });
        }
        
        return sectionElement;
    } catch (error) {
        console.error('Error rendering product carousel:', error);
        return null;
    }
}

// Render New Arrivals Section with Category Tabs
async function renderNewArrivals(section, index) {
    try {
        // Fetch all new arrival products FIRST (use public route)
        let url = '/api/homepage-sections/' + section._id + '/data/public';
        let data;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 403) {
                    console.warn('New Arrivals section is not published or active');
                } else {
                    console.error(`HTTP error! status: ${response.status}`);
                }
                return null;
            }
            data = await response.json();
        } catch (error) {
            console.error('Error fetching new arrivals:', error);
            return null;
        }
        
        const allProducts = Array.isArray(data.products) ? data.products : [];
        console.log(`New Arrivals: Received ${allProducts.length} products from API`);
        
        if (allProducts.length === 0) {
            console.warn('New Arrivals: No products found');
            return null;
        }
        
        // Group products by category
        const productsByCategory = {};
        allProducts.forEach(product => {
            const catId = product.category?._id || product.category;
            if (catId) {
                const catIdStr = catId.toString();
                if (!productsByCategory[catIdStr]) {
                    productsByCategory[catIdStr] = [];
                }
                productsByCategory[catIdStr].push(product);
            }
        });
        
        console.log(`New Arrivals: Products grouped into ${Object.keys(productsByCategory).length} categories`);
        
        // Fetch categories for tabs - get ALL active categories that have products
        const categoriesResponse = await fetch('/api/categories');
        const allCategories = await categoriesResponse.json();
        
        // Get all categories that have new arrival products (not limited to 9)
        const categoriesWithProducts = new Set(Object.keys(productsByCategory));
        
        // Filter to only show categories that have products, and are active
        const activeCategories = allCategories.filter(cat => 
            cat.isActive && categoriesWithProducts.has(cat._id.toString())
        );
        
        console.log(`New Arrivals: Found ${allProducts.length} products across ${activeCategories.length} categories`);
        console.log(`New Arrivals: Categories with products:`, activeCategories.map(c => c.name));
        
        // Add "All" category with all products
        const allCategoryProducts = allProducts;
        
        const sectionHtml = `
            <section class="new-arrivals homepage-section" 
                     data-section-type="newArrivals" 
                     data-section-id="${section._id}">
                <div class="container py-8">
                    ${section.title ? `
                        <div class="section-header mb-4 text-center">
                            <h2 class="section-title" style="font-size: 28px; font-weight: 600; margin-bottom: 20px;">${htmlEscape(section.title)}</h2>
                            ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    ${activeCategories.length > 0 ? `
                        <div class="category-tabs-nav mb-4">
                            <ul class="nav nav-pills justify-content-center" role="tablist" id="newArrivalsTabs_${index}">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" 
                                            data-bs-toggle="pill" 
                                            data-bs-target="#newArrivalsAll_${index}" 
                                            type="button"
                                            data-category-id="all">
                                        All
                                    </button>
                                </li>
                                ${activeCategories.map(cat => `
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link" 
                                                data-bs-toggle="pill" 
                                                data-bs-target="#newArrivalsCat_${index}_${cat._id}" 
                                                type="button"
                                                data-category-id="${cat._id}">
                                            ${htmlEscape(cat.name)}
                                        </button>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    <div class="tab-content">
                        <div class="tab-pane fade show active" id="newArrivalsAll_${index}" role="tabpanel">
                            <div class="product-carousel__wrapper">
                                <div class="product-carousel__track" id="newArrivalsCarousel_${index}_all" data-autoplay="true" data-autoplay-speed="3000">
                                    ${allCategoryProducts.length > 0 ? allCategoryProducts.map(product => {
                                        window.currentRenderContext = 'carousel';
                                        const card = renderProductCard(product);
                                        window.currentRenderContext = null;
                                        return `<div class="product-carousel__slide">${card}</div>`;
                                    }).join('') : '<p class="text-center text-muted">No products found</p>'}
                                </div>
                                <button class="product-carousel__nav product-carousel__nav--prev" aria-label="Previous">
                                    <span>&lsaquo;</span>
                                </button>
                                <button class="product-carousel__nav product-carousel__nav--next" aria-label="Next">
                                    <span>&rsaquo;</span>
                                </button>
                            </div>
                        </div>
                        ${activeCategories.map(cat => {
                            const catIdStr = cat._id.toString();
                            const catProducts = productsByCategory[catIdStr] || [];
                            console.log(`New Arrivals: Category "${cat.name}" has ${catProducts.length} products`);
                            return `
                                <div class="tab-pane fade" id="newArrivalsCat_${index}_${cat._id}" role="tabpanel">
                                    <div class="product-carousel__wrapper">
                                        <div class="product-carousel__track" id="newArrivalsCarousel_${index}_${cat._id}" data-autoplay="true" data-autoplay-speed="3000">
                                            ${catProducts.length > 0 ? catProducts.map(product => {
                                                window.currentRenderContext = 'carousel';
                                                const card = renderProductCard(product);
                                                window.currentRenderContext = null;
                                                return `<div class="product-carousel__slide">${card}</div>`;
                                            }).join('') : '<p class="text-center text-muted">No products in this category</p>'}
                                        </div>
                                        <button class="product-carousel__nav product-carousel__nav--prev" aria-label="Previous">
                                            <span>&lsaquo;</span>
                                        </button>
                                        <button class="product-carousel__nav product-carousel__nav--next" aria-label="Next">
                                            <span>&rsaquo;</span>
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        const sectionElement = tempDiv.firstElementChild;
        
        // Initialize carousels after DOM insertion
        if (sectionElement) {
            setTimeout(() => {
                // Initialize "All" carousel
                const allTabPane = sectionElement.querySelector(`#newArrivalsAll_${index}`);
                if (allTabPane) {
                    initProductCarousel(allTabPane, { autoplay: true, autoplaySpeed: 3000 });
                }
                // Initialize category carousels
                activeCategories.forEach(cat => {
                    const catTabPane = sectionElement.querySelector(`#newArrivalsCat_${index}_${cat._id}`);
                    if (catTabPane) {
                        initProductCarousel(catTabPane, { autoplay: true, autoplaySpeed: 3000 });
                    }
                });
                
                // Re-initialize carousel when tab is switched
                const tabButtons = sectionElement.querySelectorAll(`#newArrivalsTabs_${index} .nav-link`);
                tabButtons.forEach(button => {
                    button.addEventListener('shown.bs.tab', (e) => {
                        const targetId = e.target.getAttribute('data-bs-target');
                        const targetPane = sectionElement.querySelector(targetId);
                        if (targetPane) {
                            // Small delay to ensure tab is visible
                            setTimeout(() => {
                                initProductCarousel(targetPane, { autoplay: true, autoplaySpeed: 3000 });
                            }, 50);
                        }
                    });
                });
            }, 100);
        }
        
        return sectionElement;
    } catch (error) {
        console.error('Error rendering new arrivals:', error);
        return null;
    }
}

// Render Top Selling Products Section
async function renderTopSelling(section, index) {
    try {
        let url = '/api/homepage-sections/' + section._id + '/data/public';
        
        // Fetch products for top selling
        let data;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 403) {
                    console.warn('Top Selling section is not published or active');
                } else {
                    console.error(`HTTP error! status: ${response.status}`);
                }
                return null;
            }
            data = await response.json();
        } catch (error) {
            console.error('Error fetching top selling products:', error);
            return null;
        }
        
        const products = Array.isArray(data.products) ? data.products : [];
        
        if (products.length === 0) {
            return null;
        }
        
        const sectionHtml = `
            <section class="top-selling homepage-section" 
                     data-section-type="topSelling" 
                     data-section-id="${section._id}">
                <div class="container py-5">
                    ${section.title ? `
                        <div class="section-header mb-4">
                            <h2 class="section-title" style="font-size: 28px; font-weight: 600; margin-bottom: 20px;">${htmlEscape(section.title)}</h2>
                            ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    <div class="product-carousel__wrapper">
                        <div class="product-carousel__track" id="topSelling_${index}" data-autoplay="true" data-autoplay-speed="3000">
                            ${products.map(product => {
                                window.currentRenderContext = 'carousel';
                                const card = renderProductCard(product);
                                window.currentRenderContext = null;
                                return `<div class="product-carousel__slide">${card}</div>`;
                            }).join('')}
                        </div>
                        <button class="product-carousel__nav product-carousel__nav--prev" aria-label="Previous">
                            <span>&lsaquo;</span>
                        </button>
                        <button class="product-carousel__nav product-carousel__nav--next" aria-label="Next">
                            <span>&rsaquo;</span>
                        </button>
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        const sectionElement = tempDiv.firstElementChild;
        
        // Initialize carousel after DOM insertion
        if (sectionElement) {
            setTimeout(() => {
                initProductCarousel(sectionElement, { autoplay: true, autoplaySpeed: 3000 });
            }, 100);
        }
        
        return sectionElement;
    } catch (error) {
        console.error('Error rendering top selling products:', error);
        return null;
    }
}

// Render Featured Collections (Subcategories in Circles with Auto-Sliding Rows)
async function renderFeaturedCollections(section, index) {
    try {
        let url = '/api/homepage-sections/' + section._id + '/data/public';
        
        // Fetch subcategories
        let data;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 403) {
                    console.warn('Featured Collections section is not published or active');
                } else {
                    console.error(`HTTP error! status: ${response.status}`);
                }
                return null;
            }
            data = await response.json();
        } catch (error) {
            console.error('Error fetching featured collections:', error);
            return null;
        }
        
        const subcategories = Array.isArray(data.subcategories) ? data.subcategories : [];
        
        if (subcategories.length === 0) {
            console.warn('Featured Collections: No subcategories found');
            return null;
        }
        
        console.log(`Featured Collections: Found ${subcategories.length} subcategories to display:`, subcategories.map(s => s.name));
        
        // Show 8 subcategories per slide in a single row with horizontal auto-sliding
        const subcategoriesPerSlide = 8;
        
        // IMPORTANT: Use ALL subcategories, not just a subset
        // Duplicate all subcategories for seamless infinite loop (so auto-slide can cycle through all items)
        const duplicatedSubcategories = [...subcategories, ...subcategories, ...subcategories];
        
        console.log(`Featured Collections: Total items in carousel: ${duplicatedSubcategories.length} (${subcategories.length} unique subcategories × 3 for infinite loop)`);
        console.log(`Featured Collections: Will show ${Math.ceil(subcategories.length / subcategoriesPerSlide)} slides with ${subcategoriesPerSlide} items per slide`);
        
        const sectionHtml = `
            <section class="featured-collections homepage-section" 
                     data-section-type="featuredCollections" 
                     data-section-id="${section._id}">
                <div class="container-fluid py-5 px-4">
                    ${section.title ? `
                        <div class="section-header text-center mb-4">
                            <h2>${htmlEscape(section.title)}</h2>
                            ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    <div class="featured-collections__wrapper">
                        <div class="featured-collections__container" id="featuredCollections_${index}">
                            <div class="featured-collections__track">
                                ${duplicatedSubcategories.map(subcat => {
                                    const imageUrl = subcat.imageUpload?.url || subcat.image || getGlobalFallbackImage();
                                    const subcatId = subcat._id || subcat.id;
                                    return `
                                        <a href="/subcategory/${subcatId}" class="featured-collection-item">
                                            <div class="featured-collection__image">
                                                <img src="${htmlEscape(imageUrl)}" 
                                                     alt="${htmlEscape(subcat.name)}" 
                                                     loading="lazy">
                                            </div>
                                            <span class="featured-collection__name">${htmlEscape(subcat.name)}</span>
                                        </a>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        const sectionElement = tempDiv.firstElementChild;
        
        // Initialize auto-sliding after DOM insertion
        if (sectionElement) {
            setTimeout(() => {
                // Pass total subcategories count, not just visible ones, so auto-slide works with all items
                initFeaturedCollectionsCarousel(`#featuredCollections_${index}`, subcategories.length);
            }, 100);
        }
        
        return sectionElement;
    } catch (error) {
        console.error('Error rendering featured collections:', error);
        return null;
    }
}

// Initialize Featured Collections Carousel (horizontal sliding)
function initFeaturedCollectionsCarousel(containerSelector, totalItems) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    const track = container.querySelector('.featured-collections__track');
    const items = container.querySelectorAll('.featured-collection-item');
    
    if (!track || items.length === 0) return;
    
    // Wait for layout to calculate item width
    setTimeout(() => {
        let currentIndex = 0;
        const visibleItems = 8; // Show 8 items at a time
        const firstItem = items[0];
        const itemWidth = firstItem ? (firstItem.offsetWidth + 15) : 150; // Include gap (15px gap between items)
        
        // Calculate total slides based on unique subcategories (not duplicated ones)
        const totalSlides = Math.ceil(totalItems / visibleItems);
        console.log(`Featured Collections Carousel: ${totalItems} total subcategories, ${visibleItems} per slide, ${totalSlides} total slides`);
        
        function updateCarousel() {
            const translateX = -currentIndex * (itemWidth * visibleItems);
            track.style.transition = 'transform 0.8s ease-in-out';
            track.style.transform = `translateX(${translateX}px)`;
            console.log(`Featured Collections: Sliding to slide ${currentIndex + 1} of ${totalSlides} (showing items ${currentIndex * visibleItems} to ${(currentIndex * visibleItems) + visibleItems - 1})`);
        }
        
        // Auto-slide every 3 seconds - slide by 8 items at a time
        let autoplayInterval = setInterval(() => {
            currentIndex++;
            // If we've shown all slides, loop back to start seamlessly
            if (currentIndex >= totalSlides) {
                console.log(`Featured Collections: Reached end, looping back to start`);
                currentIndex = 0;
                // Reset without transition for seamless loop
                track.style.transition = 'none';
                track.style.transform = 'translateX(0px)';
                setTimeout(() => {
                    track.style.transition = 'transform 0.8s ease-in-out';
                }, 50);
            } else {
                updateCarousel();
            }
        }, 3000);
        
        // Pause on hover
        container.addEventListener('mouseenter', () => {
            clearInterval(autoplayInterval);
        });
        
        // Resume on mouse leave
        let resumeTimeout;
        container.addEventListener('mouseleave', () => {
            clearTimeout(resumeTimeout);
            resumeTimeout = setTimeout(() => {
                autoplayInterval = setInterval(() => {
                    currentIndex++;
                    if (currentIndex >= totalSlides) {
                        console.log(`Featured Collections: Reached end, looping back to start`);
                        currentIndex = 0;
                        track.style.transition = 'none';
                        track.style.transform = 'translateX(0px)';
                        setTimeout(() => {
                            track.style.transition = 'transform 0.8s ease-in-out';
                        }, 50);
                    } else {
                        updateCarousel();
                    }
                }, 3000);
            }, 500);
        });
        
        // Initial position - start at slide 0
        updateCarousel();
        console.log(`Featured Collections: Carousel initialized, starting at slide 1 of ${totalSlides}`);
    }, 200);
}

// Render Banner Full Width
async function renderBannerFullWidth(section, index) {
    console.log('renderBannerFullWidth called:', { 
        sectionId: section._id, 
        sectionName: section.name, 
        ordering: section.ordering,
        config: section.config 
    });
    
    const config = section.config || {};
    const bannerId = config.bannerId;
    const imageUrl = config.imageUrl;
    
    console.log('Banner config:', { bannerId, imageUrl, hasConfig: !!config });
    
    // Support both new approach (direct image URL) and legacy approach (banner ID)
    if (!bannerId && !imageUrl) {
        const errorMsg = `Banner section "${section.name}" (ID: ${section._id}) has no banner ID or image URL. Config: ${JSON.stringify(config)}`;
        if (typeof window.Logger !== 'undefined') {
            window.Logger.warn('Banner section has no banner ID or image URL', { sectionId: section._id, config });
        } else {
            console.warn(errorMsg);
        }
        return null;
    }
    
    // NEW APPROACH: Direct image URL from config (preferred)
    if (imageUrl) {
        console.log('Using direct image URL approach for banner:', imageUrl);
        const result = renderBannerFromConfig(section, config, imageUrl);
        console.log('Banner rendered from config:', result ? 'Success' : 'Failed');
        return result;
    }
    
    // LEGACY APPROACH: Fetch banner by ID (only if no imageUrl)
    console.log('Using legacy banner ID approach:', bannerId);
    
    // LEGACY APPROACH: Fetch banner by ID
    try {
        // Use cache-busting to ensure we get fresh data after banner deletions
        const bannerResponse = await fetch(`/api/banners/detail/${bannerId}?_t=${Date.now()}`);
        
        if (!bannerResponse.ok) {
            // Handle 404 (banner not found) or 401 (unauthorized) gracefully - try fallback
            if (bannerResponse.status === 404 || bannerResponse.status === 401) {
                // If we have imageUrl as fallback, use it
                if (imageUrl) {
                    console.log('Banner ID not found, using imageUrl from config instead');
                    return renderBannerFromConfig(section, config, imageUrl);
                }
                
                if (typeof window.Logger !== 'undefined') {
                    window.Logger.warn(`Banner not found or unauthorized (${bannerResponse.status}), trying fallback`, { bannerId, sectionId: section._id });
                } else {
                    console.warn(`Banner ${bannerId} not found (${bannerResponse.status}), trying fallback...`);
                }
                // Try fallback - use banner image from all banners endpoint (with cache-busting)
                try {
                    const allBannersResponse = await fetch(`/api/banners?_t=${Date.now()}`);
                    if (allBannersResponse.ok) {
                        const allBanners = await allBannersResponse.json();
                        const banner = allBanners.find(b => b._id === bannerId);
                        if (banner && banner.isActive) {
                            // Found banner in fallback, use it
                            return renderBannerHTML(banner, section);
                        }
                    }
                } catch (fallbackError) {
                    if (typeof window.Logger !== 'undefined') {
                        window.Logger.warn('Fallback banner fetch failed', fallbackError, { bannerId });
                    } else {
                        console.warn('Fallback banner fetch failed:', fallbackError);
                    }
                }
                // Banner not found even in fallback, return null silently
                return null;
            } else {
                // Other errors (500, etc.)
                if (typeof window.Logger !== 'undefined') {
                    window.Logger.error('Banner fetch failed', new Error(`HTTP ${bannerResponse.status}`), { bannerId, sectionId: section._id, status: bannerResponse.status });
                } else {
                    console.error('Banner fetch failed:', bannerResponse.status, bannerId);
                }
                return null;
            }
        }
        
        const banner = await bannerResponse.json();
        
        if (!banner || !banner.isActive) {
            // If banner is inactive but we have imageUrl, use it
            if (imageUrl) {
                console.log('Banner is inactive, using imageUrl from config instead');
                return renderBannerFromConfig(section, config, imageUrl);
            }
            
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn('Banner is inactive or not found', { bannerId, sectionId: section._id, bannerActive: banner?.isActive });
            }
            return null;
        }
        
        return renderBannerHTML(banner, section);
    } catch (error) {
        // If error occurs but we have imageUrl, use it as fallback
        if (imageUrl) {
            console.log('Error fetching banner, using imageUrl from config instead:', error);
            return renderBannerFromConfig(section, config, imageUrl);
        }
        
        if (typeof window.Logger !== 'undefined') {
            window.Logger.error('Error rendering banner', error, { bannerId, sectionId: section._id });
        } else {
            console.error('Error rendering banner:', error);
        }
        return null;
    }
}

// New function to render banner directly from config (without fetching banner object)
function renderBannerFromConfig(section, config, imageUrl) {
    console.log('Rendering banner from config:', { sectionId: section._id, sectionName: section.name, imageUrl, config });
    
    if (!imageUrl || !imageUrl.trim()) {
        console.error('Banner section has no image URL:', section._id);
        return null;
    }
    
    const bannerTitle = section.title || config.title || '';
    const bannerDescription = section.description || config.description || '';
    const bannerLink = config.link || '#';
    const hasTitle = bannerTitle && bannerTitle.trim().length > 0;
    
    // Get dimensions from config
    const width = config.width || 'full';
    const height = config.height || 'auto';
    const customWidth = config.customWidth;
    const customHeight = config.customHeight;
    const mobileHeight = config.mobileHeight;
    const tabletHeight = config.tabletHeight;
    const desktopHeight = config.desktopHeight;
    
    // Build CSS classes for responsive banner
    let bannerClasses = 'homepage-banner-section';
    if (width === 'full') {
        bannerClasses += ' homepage-banner-section--full-width';
    } else if (width === 'container') {
        bannerClasses += ' homepage-banner-section--container-width';
    } else if (width === 'custom') {
        bannerClasses += ' homepage-banner-section--custom-width';
    }
    
    if (height === 'auto') {
        bannerClasses += ' homepage-banner-section--height-auto';
    } else if (height === 'small') {
        bannerClasses += ' homepage-banner-section--height-small';
    } else if (height === 'medium') {
        bannerClasses += ' homepage-banner-section--height-medium';
    } else if (height === 'large') {
        bannerClasses += ' homepage-banner-section--height-large';
    }
    
    // Build inline styles for custom dimensions
    let containerStyle = '';
    let imageStyle = '';
    
    if (width === 'custom' && customWidth) {
        containerStyle += `max-width: ${customWidth}px;`;
    }
    
    if (height === 'custom' && customHeight) {
        imageStyle += `height: ${customHeight}px; min-height: ${customHeight}px; max-height: ${customHeight}px;`;
    }
    
    // Add responsive height data attributes
    let dataAttrs = '';
    if (mobileHeight) dataAttrs += ` data-mobile-height="${mobileHeight}"`;
    if (tabletHeight) dataAttrs += ` data-tablet-height="${tabletHeight}"`;
    if (desktopHeight) dataAttrs += ` data-desktop-height="${desktopHeight}"`;
    
    // Build responsive height CSS variables
    let responsiveStyles = '';
    if (mobileHeight) responsiveStyles += `--mobile-height: ${mobileHeight}px;`;
    if (tabletHeight) responsiveStyles += `--tablet-height: ${tabletHeight}px;`;
    if (desktopHeight) responsiveStyles += `--desktop-height: ${desktopHeight}px;`;
    
    const imageAlt = section.name || bannerTitle || 'Banner';
    // Don't escape image URL - URLs can contain special characters that are valid
    // Only escape the alt text and other text content
    const mediaContent = `<img src="${imageUrl}" alt="${htmlEscape(imageAlt)}" class="homepage-banner-section__image" loading="lazy" style="${imageStyle}">`;
    
    const sectionHtml = `
        <section class="${bannerClasses} homepage-section" data-section-type="bannerFullWidth" data-section-id="${section._id}"${dataAttrs} style="${responsiveStyles}">
            ${hasTitle ? `
                <div class="container">
                    <div class="banner-full-width__header">
                        <h2 class="banner-full-width__title">${htmlEscape(bannerTitle)}</h2>
                        ${bannerDescription ? `<p class="banner-full-width__description">${htmlEscape(bannerDescription)}</p>` : ''}
                    </div>
                </div>
            ` : ''}
            <div class="homepage-banner-section__container" style="${containerStyle}">
                <a href="${bannerLink}" class="homepage-banner-section__link">
                    ${mediaContent}
                </a>
            </div>
        </section>
    `;
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = sectionHtml.trim();
    const bannerElement = wrapper.firstElementChild;
    
    if (bannerElement) {
        console.log('Banner element created successfully:', {
            classes: bannerElement.className,
            hasImage: !!bannerElement.querySelector('img'),
            imageSrc: bannerElement.querySelector('img')?.src
        });
    } else {
        console.error('Failed to create banner element from HTML');
    }
    
    return bannerElement;
}

function renderBannerHTML(banner, section) {
    const imageUrl = banner.imageUpload?.url || banner.image || getGlobalFallbackImage();
    // Trim and check for non-empty title
    const bannerTitle = (banner.title && String(banner.title).trim()) || '';
    const bannerDescription = (banner.description && String(banner.description).trim()) || '';
    const hasTitle = bannerTitle.length > 0;
    
    // Check if banner is a YouTube/Vimeo video
    const isVideo = banner.banner_type === 'video';
    const videoType = banner.video_type || (isVideo ? detectVideoTypeFromUrl(imageUrl) : null);
    const isYouTube = videoType === 'youtube';
    const isVimeo = videoType === 'vimeo';
    
    let mediaContent = '';
    
    if (isYouTube) {
        const youtubeId = extractYouTubeId(imageUrl);
        if (youtubeId) {
            const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=1`;
            mediaContent = `
                <div class="banner-video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
                    <iframe src="${htmlEscape(embedUrl)}" 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen
                            loading="lazy">
                    </iframe>
                </div>
            `;
        } else {
            // Fallback to image if YouTube ID extraction fails
            mediaContent = `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(banner.imageAlt || banner.title || 'Banner')}" class="banner-full-width__image" loading="lazy">`;
        }
    } else if (isVimeo) {
        const vimeoId = extractVimeoId(imageUrl);
        if (vimeoId) {
            const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&controls=1`;
            mediaContent = `
                <div class="banner-video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
                    <iframe src="${htmlEscape(embedUrl)}" 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            frameborder="0" 
                            allow="autoplay; fullscreen; picture-in-picture" 
                            allowfullscreen
                            loading="lazy">
                    </iframe>
                </div>
            `;
        } else {
            mediaContent = `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(banner.imageAlt || banner.title || 'Banner')}" class="banner-full-width__image" loading="lazy">`;
        }
    } else if (isVideo && (imageUrl.includes('/video/upload') || imageUrl.match(/\.(mp4|webm|ogg|mov|avi|wmv|m4v|flv)$/i))) {
        // Direct video file (Cloudinary or direct URL)
        mediaContent = `
            <video src="${htmlEscape(imageUrl)}" 
                   controls 
                   autoplay 
                   muted 
                   loop 
                   style="width: 100%; height: auto; display: block;"
                   class="banner-full-width__video"
                   loading="lazy">
            </video>
        `;
    } else {
        // Regular image
        mediaContent = `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(banner.imageAlt || banner.title || 'Banner')}" class="banner-full-width__image" loading="lazy">`;
    }
    
    const sectionHtml = `
        <section class="banner-full-width homepage-section" data-section-type="bannerFullWidth" data-section-id="${section._id}" data-banner-id="${banner._id}">
            ${hasTitle ? `
                <div class="container">
                    <div class="banner-full-width__header">
                        <h2 class="banner-full-width__title">${htmlEscape(bannerTitle)}</h2>
                        ${bannerDescription ? `<p class="banner-full-width__description">${htmlEscape(bannerDescription)}</p>` : ''}
                    </div>
                </div>
            ` : ''}
            <div class="container-fluid px-0">
                ${banner.link && banner.link !== '#' ? `<a href="${htmlEscape(banner.link)}" class="banner-full-width__link">` : ''}
                    ${mediaContent}
                ${banner.link && banner.link !== '#' ? `</a>` : ''}
            </div>
        </section>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sectionHtml;
    return tempDiv.firstElementChild;
}

// Helper to detect video type from URL
function detectVideoTypeFromUrl(url) {
    if (!url) return null;
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/embed')) {
        return 'youtube';
    }
    if (url.includes('vimeo.com/')) {
        return 'vimeo';
    }
    if (url.match(/\.(mp4|webm|ogg|mov|avi|wmv|m4v|flv)$/i)) {
        return 'direct';
    }
    if (url.includes('/video/upload') || url.includes('resource_type=video')) {
        return 'file';
    }
    return null;
}

// Helper to extract YouTube video ID
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Helper to extract Vimeo video ID
function extractVimeoId(url) {
    const match = url.match(/vimeo.com\/(\d+)/);
    return match ? match[1] : null;
}

// Helper: Get section banner (for banners before sections)
async function getSectionBanner(bannerId) {
    try {
        // Use cache-busting to ensure fresh data
        const response = await fetch(`/api/banners/detail/${bannerId}?_t=${Date.now()}`);
        if (!response.ok) {
            // Try fallback - fetch from all banners (with cache-busting)
            const allBannersResponse = await fetch(`/api/banners?_t=${Date.now()}`);
            if (allBannersResponse.ok) {
                const allBanners = await allBannersResponse.json();
                return allBanners.find(b => b._id === bannerId && b.isActive) || null;
            }
            return null;
        }
        const banner = await response.json();
        return banner && banner.isActive ? banner : null;
    } catch (error) {
        if (typeof window.Logger !== 'undefined') {
            window.Logger.warn('Error fetching section banner', { bannerId, error: error.message });
        }
        return null;
    }
}

// Render Video Banner
async function renderVideoBanner(section, index) {
    try {
        // Fetch video banner from API
        let videoBanner = null;
        
        try {
            const response = await fetch(`/api/video-banners/public`);
            if (response.ok) {
                const responseData = await response.json();
                console.log('Video banners API response:', responseData);
                
                // Handle different response formats
                const banners = Array.isArray(responseData) ? responseData : (responseData.videoBanners || responseData.data || []);
                
                if (!Array.isArray(banners)) {
                    console.error('Invalid video banners response format:', responseData);
                    return null;
                }
                
                // Try to get video banner ID from config
                const videoBannerId = section.config?.videoBannerId;
                if (videoBannerId) {
                    videoBanner = banners.find(b => b._id === videoBannerId);
                    if (!videoBanner && banners.length > 0) {
                        // Use first active video banner if ID not found
                        console.warn(`Video banner with ID ${videoBannerId} not found, using first active banner`);
                        videoBanner = banners[0];
                    }
                } else {
                    // Use first active video banner
                    if (banners.length > 0) {
                        videoBanner = banners[0];
                        console.log('Using first active video banner:', videoBanner.title || videoBanner._id);
                    }
                }
            } else {
                console.error('Failed to fetch video banners:', response.status, response.statusText);
            }
        } catch (fetchError) {
            console.error('Error fetching video banners:', fetchError);
        }
        
        if (!videoBanner || !videoBanner.videoUrl) {
            console.warn('No video banner found or no video URL available');
            return null;
        }
        
        let videoEmbedUrl = '';
        const videoType = videoBanner.videoType || 'youtube';
        const videoUrl = videoBanner.videoUrl;
        
        // Generate embed URL based on video type
        if (videoType === 'youtube') {
            // Extract YouTube video ID
            const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
            const match = videoUrl.match(youtubeRegex);
            if (match && match[1]) {
                const videoId = match[1];
                // Add high quality parameters: hd=1 for HD, rel=0 to hide related videos, modestbranding=1
                videoEmbedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${videoBanner.autoplay ? 1 : 0}&loop=${videoBanner.loop ? 1 : 0}&mute=${videoBanner.muted ? 1 : 0}&controls=${videoBanner.controls ? 1 : 0}&playlist=${videoId}&hd=1&vq=hd1080&rel=0&modestbranding=1&playsinline=1`;
            } else {
                videoEmbedUrl = videoUrl; // Fallback to original URL
            }
        } else if (videoType === 'vimeo') {
            // Extract Vimeo video ID
            const vimeoRegex = /vimeo\.com\/(\d+)/;
            const match = videoUrl.match(vimeoRegex);
            if (match && match[1]) {
                // Add quality parameter for Vimeo
                videoEmbedUrl = `https://player.vimeo.com/video/${match[1]}?autoplay=${videoBanner.autoplay ? 1 : 0}&loop=${videoBanner.loop ? 1 : 0}&muted=${videoBanner.muted ? 1 : 0}&quality=1080p&background=1`;
            } else {
                videoEmbedUrl = videoUrl; // Fallback to original URL
            }
        } else {
            // Direct video URL (MP4, WebM, etc.)
            videoEmbedUrl = videoUrl;
        }
        
        // Helper function to resolve image URL
        function resolveImageUrl(item) {
            if (!item) return null;
            if (item.posterImageUpload && item.posterImageUpload.url) {
                return item.posterImageUpload.url;
            }
            if (item.imageUpload && item.imageUpload.url) {
                return item.imageUpload.url;
            }
            if (item.posterImage) {
                return item.posterImage;
            }
            if (item.image) {
                return item.image;
            }
            return null;
        }
        
        const posterUrl = resolveImageUrl(videoBanner) || '';
        const overlayText = videoBanner.title || section.config?.overlayText || '';
        const description = videoBanner.description || '';
        const ctaText = videoBanner.buttonText || section.config?.ctaText || '';
        const ctaLink = videoBanner.buttonLink || videoBanner.link || section.config?.ctaLink || '#';
        
        let videoElement = '';
        if (videoType === 'youtube' || videoType === 'vimeo') {
            // Use iframe for YouTube/Vimeo with full coverage (CSS handles positioning)
            videoElement = `<iframe src="${htmlEscape(videoEmbedUrl)}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        } else {
            // Use video tag for direct URLs
            videoElement = `
                <video class="video-banner__video" autoplay="${videoBanner.autoplay}" loop="${videoBanner.loop}" muted="${videoBanner.muted}" controls="${videoBanner.controls}" playsinline ${posterUrl ? `poster="${htmlEscape(posterUrl)}"` : ''}>
                    <source src="${htmlEscape(videoEmbedUrl)}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        }
    
    const sectionHtml = `
        <section class="video-banner homepage-section" data-section-type="videoBanner" data-section-id="${section._id}">
                ${ctaLink && ctaLink !== '#' ? `<a href="${htmlEscape(ctaLink)}" class="video-banner__link">` : ''}
            <div class="video-banner__wrapper">
                    ${videoElement}
                    ${(overlayText || description || ctaText) ? `
                <div class="video-banner__overlay">
                            ${overlayText ? `<h2 class="video-banner__title">${htmlEscape(overlayText)}</h2>` : ''}
                            ${description ? `<p class="video-banner__description">${htmlEscape(description)}</p>` : ''}
                            ${ctaText ? `<span class="btn btn-primary btn-lg">${htmlEscape(ctaText)}</span>` : ''}
                </div>
                    ` : ''}
            </div>
                ${ctaLink && ctaLink !== '#' ? `</a>` : ''}
        </section>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sectionHtml;
    return tempDiv.firstElementChild;
    } catch (error) {
        console.error('Error rendering video banner:', error);
        return null;
    }
}

// Render Collection Links
async function renderCollectionLinks(section, index) {
    try {
        const categoriesResponse = await fetch('/api/categories');
        const allCategories = await categoriesResponse.json();
        const categories = allCategories.filter(cat => cat.isFeatured && cat.isActive);
        
        if (!categories || categories.length === 0) return null;
        
        const sectionHtml = `
            <section class="collection-links homepage-section" data-section-type="collectionLinks" data-section-id="${section._id}">
                <div class="container py-4">
                    <div class="collection-links__grid">
                        ${categories.slice(0, 10).map(cat => `
                            <a href="/category/${cat._id}" class="collection-link-item">
                                ${htmlEscape(cat.name)}
                            </a>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        return tempDiv.firstElementChild;
    } catch (error) {
        console.error('Error rendering collection links:', error);
        return null;
    }
}

// Render Newsletter & Social
function renderNewsletterSocial(section, index) {
    const socialTitle = section.config?.socialTitle || 'LET\'S CONNECT ON SOCIAL MEDIA';
    const socialDesc = section.config?.socialDesc || 'Follow us to stay updated on latest looks.';
    const newsletterTitle = section.config?.newsletterTitle || 'SIGN UP FOR EXCLUSIVE OFFERS & DISCOUNTS';
    const newsletterDesc = section.config?.newsletterDesc || 'Stay updated on new deals and news.';
    const socialLinks = section.config?.socialLinks || {};
    
    // Get Facebook and Instagram URLs
    const facebookUrl = socialLinks.facebook || socialLinks.Facebook || '#';
    const instagramUrl = socialLinks.instagram || socialLinks.Instagram || '#';
    
    const sectionHtml = `
        <section class="newsletter-social homepage-section" data-section-type="newsletterSocial" data-section-id="${section._id}">
            <div class="newsletter-social__container">
                <div class="newsletter-social__wrapper">
                    <div class="newsletter-social__left">
                        <h3 class="newsletter-social__heading">${htmlEscape(socialTitle)}</h3>
                        <div class="newsletter-social__icons">
                            ${facebookUrl !== '#' ? `
                                <a href="${htmlEscape(facebookUrl)}" target="_blank" rel="noopener" class="newsletter-social__icon">
                                    <i class="fab fa-facebook-f"></i>
                                </a>
                            ` : ''}
                            ${instagramUrl !== '#' ? `
                                <a href="${htmlEscape(instagramUrl)}" target="_blank" rel="noopener" class="newsletter-social__icon">
                                    <i class="fab fa-instagram"></i>
                                </a>
                            ` : ''}
                        </div>
                        <p class="newsletter-social__text">${htmlEscape(socialDesc)}</p>
                    </div>
                    <div class="newsletter-social__right">
                        <h3 class="newsletter-social__heading">${htmlEscape(newsletterTitle)}</h3>
                        <form class="newsletter-social__form" id="newsletterForm_${index}">
                            <div class="newsletter-social__input-group">
                                <input type="email" class="newsletter-social__input" placeholder="Enter your email address" required>
                                <button class="newsletter-social__submit" type="submit">Submit</button>
                            </div>
                        </form>
                        <p class="newsletter-social__text">${htmlEscape(newsletterDesc)}</p>
                    </div>
                </div>
            </div>
        </section>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sectionHtml;
    const sectionElement = tempDiv.firstElementChild;
    
    // Attach newsletter form handler
    if (sectionElement) {
        const form = sectionElement.querySelector(`#newsletterForm_${index}`);
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = form.querySelector('input[type="email"]').value;
                // Handle newsletter subscription
                console.log('Newsletter subscription:', email);
                alert('Thank you for subscribing!');
                form.reset();
            });
        }
    }
    
    return sectionElement;
}

// Render Brand Marquee
// Render Brand Marquee with Sliding Carousel (Top Brands - Like Reference)
async function renderBrandMarquee(section, index) {
    try {
        console.log('Rendering brand marquee section:', section.name || section._id);
        console.log('Section config:', JSON.stringify(section.config, null, 2));
        
        // Check if uploaded images are available in config (priority - ALWAYS use these if they exist)
        let brands = [];
        
        // First priority: Check for uploaded brandImages in config
        if (section.config && section.config.brandImages && Array.isArray(section.config.brandImages) && section.config.brandImages.length > 0) {
            console.log('✅ Found uploaded brand images in config:', section.config.brandImages.length);
            console.log('Brand images data:', section.config.brandImages);
            
            // Use uploaded images from config (with brand info)
            brands = section.config.brandImages.map((img, idx) => {
                // Ensure URL is valid - check multiple possible fields
                const imageUrl = img.url || img.image || '';
                
                console.log(`Processing brand image ${idx + 1}:`, {
                    brandName: img.brandName || img.name,
                    url: imageUrl,
                    brandId: img.brandId,
                    hasUrl: !!imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined'
                });
                
                if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') {
                    console.error(`❌ Invalid image URL in brandImages[${idx}]:`, img);
                    return null;
                }
                
                const brandData = {
                    image: imageUrl,
                    logo: imageUrl,
                    name: img.brandName || img.name || img.alt || 'Brand',
                    alt: img.brandName || img.name || img.alt || 'Brand',
                    link: img.link || (img.brandId ? `/brand/${img.brandId}` : '#'),
                    _id: img.brandId || img._id || 'uploaded-' + Date.now()
                };
                
                console.log(`✅ Brand ${idx + 1} processed:`, brandData);
                return brandData;
            }).filter(brand => brand !== null); // Remove any null entries
            
            console.log(`✅ Using ${brands.length} uploaded brand images from config`);
            console.log('Final brands array:', brands.map(b => ({ name: b.name, image: b.image })));
        } else {
            console.log('No uploaded brandImages found in config, checking for legacy logos...');
            
            // Second priority: Check for legacy logos in config
            if (section.config && section.config.logos && Array.isArray(section.config.logos) && section.config.logos.length > 0) {
                console.log('Found legacy logos in config:', section.config.logos.length);
                brands = section.config.logos.map((logo) => {
                    const imageUrl = logo.image || logo.url || '';
                    if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
                        return null;
                    }
                    return {
                        image: imageUrl,
                        logo: imageUrl,
                        name: logo.name || logo.alt || 'Brand',
                        alt: logo.alt || logo.name || 'Brand',
                        link: logo.link || '#',
                        _id: logo._id || 'legacy-' + Date.now()
                    };
                }).filter(brand => brand !== null);
                console.log(`Using ${brands.length} legacy logos from config`);
            } else {
                console.log('No logos in config, fetching from API as fallback...');
                
                // Last resort: Fetch active brands from API (only if no config images)
                try {
                    const response = await fetch('/api/brands/public');
                    if (response.ok) {
                        const apiBrands = await response.json();
                        brands = Array.isArray(apiBrands) ? apiBrands : (apiBrands.brands || apiBrands.data || []);
                        console.log(`Fetched ${brands.length} brands from API for brand marquee (fallback)`);
                    } else {
                        console.warn('Failed to fetch brands from API:', response.status, response.statusText);
                    }
                } catch (fetchError) {
                    console.error('Error fetching brands from API:', fetchError);
                }
            }
        }
        
        // Filter out brands without valid images
        brands = brands.filter(brand => {
            const imageUrl = brand.image || brand.logo || '';
            const hasImage = imageUrl && 
                           imageUrl !== 'null' && 
                           imageUrl !== 'undefined' && 
                           imageUrl.trim() !== '';
            if (!hasImage) {
                console.warn('Skipping brand without valid image URL:', brand.name || brand, 'Image URL:', imageUrl);
            }
            return hasImage;
        });
        
        // If still no brands, return null
        if (!brands || brands.length === 0) {
            console.error('No brands with valid images found to display in brand marquee');
            console.error('Section config:', section.config);
            console.error('Section ID:', section._id);
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn('Brand marquee section not rendered: No brands with images available', {
                    sectionType: 'brandMarquee',
                    sectionId: section._id,
                    config: section.config
                });
            }
            return null;
        }
        
        console.log(`Final brands array for rendering:`, brands.map(b => ({ name: b.name, image: b.image })));
        
        // Limit to config limit or default 12
        const limit = section.config?.limit || 12;
        brands = brands.slice(0, limit);
        
        console.log(`Rendering ${brands.length} brands in sliding brand marquee carousel`);
        console.log('Brands data:', brands.map(b => ({ name: b.name, image: b.image, link: b.link })));
    
    const sectionHtml = `
        <section class="brand-marquee-carousel homepage-section" data-section-type="brandMarquee" data-section-id="${section._id}">
            <div class="container py-4 py-md-5">
                ${section.title ? `
                    <div class="section-header text-center mb-3 mb-md-4">
                        <h2 class="section-title">${htmlEscape(section.title)}</h2>
                        ${section.subtitle ? `<p class="text-muted mt-2">${htmlEscape(section.subtitle)}</p>` : ''}
                    </div>
                ` : ''}
                <div class="brand-marquee-carousel__wrapper">
                    <div class="brand-marquee-carousel__track" id="brandMarqueeCarousel_${index}">
                    ${brands.map((brand, idx) => {
                        const logoUrl = brand.image || brand.logo || '';
                        const brandName = brand.name || brand.alt || 'Brand';
                        const brandAlt = brand.alt || brandName;
                        const brandId = brand._id || brand.id || '';
                        const brandLink = brand.link || (brandId && brandId !== 'uploaded' ? `/brand/${brandId}` : '#');
                        
                        if (!logoUrl || logoUrl === 'null' || logoUrl === 'undefined' || logoUrl.trim() === '') {
                            console.warn(`Skipping brand ${idx}: Invalid URL -`, logoUrl);
                            return '';
                        }
                        
                        console.log(`Rendering brand ${idx}:`, { name: brandName, url: logoUrl, link: brandLink });
                        
                        return `
                            <div class="brand-marquee-carousel__slide">
                                <div class="brand-marquee-carousel__item">
                                    <a href="${htmlEscape(brandLink)}" class="brand-marquee-carousel__link">
                                        <img src="${htmlEscape(logoUrl)}" 
                                             alt="${htmlEscape(brandAlt)}" 
                                             class="brand-marquee-carousel__logo" 
                                             loading="lazy"
                                             data-brand-name="${htmlEscape(brandName)}"
                                             data-brand-url="${htmlEscape(logoUrl)}">
                                    </a>
                                </div>
                            </div>
                        `;
                        }).filter(html => html !== '').join('')}
                    </div>
                    <button class="brand-marquee-carousel__nav brand-marquee-carousel__nav--prev" aria-label="Previous brands">
                        <span>&lsaquo;</span>
                    </button>
                    <button class="brand-marquee-carousel__nav brand-marquee-carousel__nav--next" aria-label="Next brands">
                        <span>&rsaquo;</span>
                    </button>
                </div>
            </div>
        </section>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sectionHtml;
    const sectionElement = tempDiv.firstElementChild;
    
        // Initialize carousel after DOM insertion
    if (sectionElement) {
            setTimeout(() => {
                initBrandMarqueeCarousel(sectionElement, index);
            }, 100);
            
            // Add image error handlers
            const brandImages = sectionElement.querySelectorAll('.brand-marquee-carousel__logo');
        brandImages.forEach(img => {
            const brandName = img.getAttribute('data-brand-name') || 'Brand';
            const brandUrl = img.getAttribute('data-brand-url') || '';
            
            img.addEventListener('error', function() {
                    console.error('Failed to load brand image:', brandUrl, 'for brand:', brandName);
                    const parent = this.closest('.brand-marquee-carousel__slide');
                if (parent && parent.parentNode) {
                        parent.style.display = 'none';
                }
            });
        });
    }
    
    return sectionElement;
    } catch (error) {
        console.error('Error rendering brand marquee:', error);
        return null;
    }
}

// Initialize Brand Marquee Carousel - Matches Product Carousel behavior
function initBrandMarqueeCarousel(container, index) {
    const wrapper = container.querySelector('.brand-marquee-carousel__wrapper');
    const track = container.querySelector('.brand-marquee-carousel__track');
    const slides = container.querySelectorAll('.brand-marquee-carousel__slide');
    const prevBtn = container.querySelector('.brand-marquee-carousel__nav--prev');
    const nextBtn = container.querySelector('.brand-marquee-carousel__nav--next');
    
    if (!track || slides.length === 0) return;
    
    // Match product carousel: Mobile < 992px, Desktop >= 992px
    const isMobile = window.innerWidth < 992;
    let currentIndex = 0;
    // Desktop: Show 3 slides (matching user requirement), Mobile: Show 2 slides
    const visibleSlides = isMobile ? 2 : 3;
    let autoSlideInterval = null;
    
    // Mobile: Use native horizontal scrolling (same as product carousel)
    if (isMobile && wrapper) {
        // Prevent vertical scrolling when touching carousel
        let touchStartX = 0;
        let touchStartY = 0;
        let isHorizontalScroll = false;
        let initialScrollLeft = 0;
        let initialScrollTop = 0;
        
        wrapper.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            initialScrollLeft = wrapper.scrollLeft;
            initialScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            isHorizontalScroll = false;
            stopAutoSlide();
        }, { passive: true });
        
        wrapper.addEventListener('touchmove', (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touchCurrentX = e.touches[0].clientX;
            const touchCurrentY = e.touches[0].clientY;
            
            const diffX = Math.abs(touchCurrentX - touchStartX);
            const diffY = Math.abs(touchCurrentY - touchStartY);
            
            if (!isHorizontalScroll && (diffX > 10 || diffY > 10)) {
                isHorizontalScroll = diffX > diffY;
                
                if (isHorizontalScroll) {
                    const currentBodyScroll = document.documentElement.scrollTop || document.body.scrollTop;
                    document.body.style.position = 'fixed';
                    document.body.style.top = `-${currentBodyScroll}px`;
                    document.body.style.width = '100%';
                    document.body.style.overflow = 'hidden';
                }
            }
            
            if (isHorizontalScroll && diffX > 5) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
        
        const restoreBodyScroll = () => {
            if (isHorizontalScroll) {
                const scrollTop = parseInt(document.body.style.top || '0') * -1;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                if (scrollTop) {
                    document.documentElement.scrollTop = scrollTop;
                    document.body.scrollTop = scrollTop;
                }
            }
            touchStartX = 0;
            touchStartY = 0;
            isHorizontalScroll = false;
        };
        
        wrapper.addEventListener('touchend', restoreBodyScroll, { passive: true });
        wrapper.addEventListener('touchcancel', restoreBodyScroll, { passive: true });
        
        wrapper.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                wrapper.scrollLeft += e.deltaX;
            }
        }, { passive: false });
        
        // Mobile uses native scrolling, no transform needed
        return;
    }
    
    // Desktop: Use transform-based scrolling (same as product carousel)
    function updateCarousel() {
        if (!isMobile) {
            const offset = -currentIndex * (100 / visibleSlides);
            track.style.transform = `translateX(${offset}%)`;
        }
    }
    
    function nextSlide() {
        // Always advance, loop continuously
        if (currentIndex >= slides.length - visibleSlides) {
            currentIndex = 0; // Loop back to start
        } else {
            currentIndex++;
        }
        updateCarousel();
    }
    
    function prevSlide() {
        // Always go back, loop continuously
        if (currentIndex <= 0) {
            currentIndex = Math.max(0, slides.length - visibleSlides); // Loop to end
        } else {
            currentIndex--;
        }
        updateCarousel();
    }
    
    // Auto-slide every 3 seconds - runs continuously
    function startAutoSlide() {
        stopAutoSlide();
        if (slides.length > visibleSlides) {
            autoSlideInterval = setInterval(() => {
                nextSlide();
            }, 3000);
        }
    }
    
    function stopAutoSlide() {
        if (autoSlideInterval) {
            clearInterval(autoSlideInterval);
            autoSlideInterval = null;
        }
    }
    
    // Pause auto-slide on hover
    if (wrapper) {
        wrapper.addEventListener('mouseenter', stopAutoSlide);
        wrapper.addEventListener('mouseleave', startAutoSlide);
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            stopAutoSlide();
            prevSlide();
            startAutoSlide();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            stopAutoSlide();
            nextSlide();
            startAutoSlide();
        });
    }
    
    // Handle window resize
    let resizeTimer;
    const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const wasAutoSliding = autoSlideInterval !== null;
            stopAutoSlide();
            
            const newIsMobile = window.innerWidth < 992;
            const newVisibleSlides = newIsMobile ? 2 : 3;
            
            // Recalculate if needed
            if (currentIndex > slides.length - newVisibleSlides) {
                currentIndex = Math.max(0, slides.length - newVisibleSlides);
            }
            
            updateCarousel();
            
            if (wasAutoSliding && !newIsMobile) {
                startAutoSlide();
            }
        }, 250);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Initialize
    updateCarousel();
    
    // Start auto-slide immediately (desktop only)
    if (!isMobile) {
        startAutoSlide();
    }
}

// Render Brand Grid with Sale Banners
async function renderBrandGrid(section, index) {
    try {
        console.log('Rendering brand grid section:', section.name || section._id);
        
        // Fetch active brands from API
        let brands = [];
        try {
            const response = await fetch('/api/brands/public');
            if (response.ok) {
                const apiBrands = await response.json();
                brands = Array.isArray(apiBrands) ? apiBrands : (apiBrands.brands || apiBrands.data || []);
                console.log(`Fetched ${brands.length} brands from API for brand grid`);
            } else {
                console.warn('Failed to fetch brands from API:', response.status, response.statusText);
            }
        } catch (fetchError) {
            console.error('Error fetching brands from API:', fetchError);
        }
        
        // Filter out brands without images
        brands = brands.filter(brand => {
            const hasImage = brand.image || brand.logo;
            if (!hasImage) {
                console.warn('Skipping brand without image:', brand.name || brand);
            }
            return hasImage;
        });
        
        // If no brands, return null
        if (!brands || brands.length === 0) {
            console.log('No brands with images found to display in brand grid');
            return null;
        }
        
        // Limit to config limit or default 10
        const limit = section.config?.limit || 10;
        brands = brands.slice(0, limit);
        
        console.log(`Rendering ${brands.length} brands in brand grid`);
        
        // Helper function to get discount text
        function getDiscountText(brand) {
            if (brand.discountText) {
                return brand.discountText;
            }
            if (brand.discount && brand.discount > 0) {
                return `Flat ${Math.round(brand.discount)}% OFF`;
            }
            return '';
        }
        
        const sectionHtml = `
        <section class="brand-grid homepage-section" data-section-type="brandGrid" data-section-id="${section._id}">
            <div class="container py-5">
                ${section.title ? `
                    <div class="section-header text-center mb-4">
                        <h2>${htmlEscape(section.title)}</h2>
                        ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                    </div>
                ` : ''}
                <div class="row g-4">
                    ${brands.map(brand => {
                        const logoUrl = brand.image || brand.logo || '';
                        const brandName = brand.name || brand.alt || 'Brand';
                        const brandAlt = brand.alt || brandName;
                        const brandId = brand._id || brand.id || '';
                        const discountText = getDiscountText(brand);
                        const hasDiscount = discountText !== '';
                        
                        if (!logoUrl || logoUrl === 'null' || logoUrl === 'undefined') {
                            return '';
                        }
                        
                        const brandLink = brand.link || (brandId ? `/brand/${brandId}` : '#');
                        
                        return `
                        <div class="col-lg-2 col-md-3 col-sm-4 col-3">
                            <div class="brand-grid-item position-relative">
                                <a href="${htmlEscape(brandLink)}" class="brand-grid-link">
                                    <div class="brand-grid-logo-wrapper">
                                        <img src="${htmlEscape(logoUrl)}" alt="${htmlEscape(brandAlt)}" 
                                             class="brand-grid-logo" loading="lazy">
                                    </div>
                                    ${hasDiscount ? `
                                    <div class="brand-grid-sale-banner">
                                        <span class="brand-sale-text">${htmlEscape(discountText)}</span>
                                    </div>
                                    ` : ''}
                                </a>
                            </div>
                        </div>
                        `;
                    }).filter(html => html !== '').join('')}
                </div>
            </div>
        </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        const sectionElement = tempDiv.firstElementChild;
        
        return sectionElement;
    } catch (error) {
        console.error('Error rendering brand grid:', error);
        return null;
    }
}

// Render Custom HTML
function renderCustomHTML(section, index) {
    const html = section.config?.html || '';
    if (!html) return null;
    
    const sectionHtml = `
        <section class="custom-html homepage-section" data-section-type="customHTML" data-section-id="${section._id}">
            ${html}
        </section>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sectionHtml;
    return tempDiv.firstElementChild;
}

// Helper: Render Product Card
function renderProductCard(product, isAboveFold = false) {
    const imageUrl = product.imageUpload?.url || product.image || getGlobalFallbackImage();
    const finalPrice = product.price * (1 - (product.discount || 0) / 100);
    const hasDiscount = product.discount > 0;
    const isSoldOut = product.stockQuantity === 0 || product.isOutOfStock || false;
    const productId = product._id || product.id;
    
    // Remove column wrapper for carousel slides (they handle their own sizing)
    // But keep it for grid layouts
    const isInCarousel = document.querySelector('.product-carousel__track')?.contains(document.activeElement) || 
                         window.currentRenderContext === 'carousel';
    
    const cardHtml = `
        <div class="product-card">
            <div class="product-card__image">
                <a href="/product/${productId}" class="product-card__link">
                    <img src="${htmlEscape(imageUrl)}" 
                         alt="${htmlEscape(product.imageAlt || product.name)}" 
                         loading="${isAboveFold ? 'eager' : 'lazy'}"
                         ${isAboveFold ? 'fetchpriority="high"' : ''}
                         style="width: 100%; height: 100%; object-fit: cover;">
                </a>
                ${hasDiscount ? `<span class="product-card__badge product-card__badge--discount">-${product.discount}%</span>` : ''}
                ${isSoldOut ? `<span class="product-card__badge product-card__badge--soldout">Sold Out</span>` : ''}
                <button class="product-card__wishlist" 
                        data-product-id="${productId}"
                        title="Add to Wishlist"
                        aria-label="Add to Wishlist">
                    <i class="icon-heart"></i>
                </button>
            </div>
            <div class="product-card__body">
                <a href="/product/${productId}" class="product-card__link">
                    <h5 class="product-card__title">${htmlEscape(product.name)}</h5>
                    <div class="product-card__price">
                        ${hasDiscount ? `<span class="product-card__price--old">Rs. ${product.price.toFixed(2)}</span>` : ''}
                        <span class="product-card__price--current">Rs. ${finalPrice.toFixed(2)}</span>
                    </div>
                </a>
                <div class="product-card__actions">
                    <button type="button" class="btn btn-primary btn-sm add-to-cart" data-id="${productId}" data-product-id="${productId}">
                        <i class="fas fa-shopping-cart"></i> Add to Cart
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Return with or without column wrapper based on context
    return isInCarousel ? cardHtml : `<div class="col-lg-3 col-md-4 col-sm-6">${cardHtml}</div>`;
}

// Helper: Initialize Hero Carousel
function initHeroCarousel(container, options) {
    const track = container.querySelector('.hero-carousel__track');
    const slides = container.querySelectorAll('.hero-carousel__slide');
    const dots = container.querySelectorAll('.dot');
    const prevBtn = container.querySelector('.hero-carousel__nav--prev');
    const nextBtn = container.querySelector('.hero-carousel__nav--next');
    
    if (!track || slides.length === 0) return;
    
    let currentIndex = 0;
    let autoplayTimer = null;
    
    function showSlide(index) {
        slides.forEach((slide, idx) => {
            slide.classList.toggle('active', idx === index);
        });
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === index);
        });
        track.style.transform = `translateX(-${index * 100}%)`;
        currentIndex = index;
    }
    
    function nextSlide() {
        const next = (currentIndex + 1) % slides.length;
        showSlide(next);
    }
    
    function prevSlide() {
        const prev = (currentIndex - 1 + slides.length) % slides.length;
        showSlide(prev);
    }
    
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    
    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => showSlide(idx));
    });
    
    if (options.autoplay) {
        function startAutoplay() {
            autoplayTimer = setInterval(nextSlide, options.autoplaySpeed || 3000);
        }
        function stopAutoplay() {
            if (autoplayTimer) {
                clearInterval(autoplayTimer);
                autoplayTimer = null;
            }
        }
        
        startAutoplay();
        container.addEventListener('mouseenter', stopAutoplay);
        container.addEventListener('mouseleave', startAutoplay);
    }
}

// Helper: Initialize Product Carousel
function initProductCarousel(container, options) {
    const wrapper = container.querySelector('.product-carousel__wrapper');
    const track = container.querySelector('.product-carousel__track');
    const slides = container.querySelectorAll('.product-carousel__slide');
    const prevBtn = container.querySelector('.product-carousel__nav--prev');
    const nextBtn = container.querySelector('.product-carousel__nav--next');
    
    if (!track || slides.length === 0) return;
    
    // Check if mobile device (screen width < 992px)
    const isMobile = window.innerWidth < 992;
    let currentIndex = 0;
    const visibleSlides = isMobile ? 2 : 4; // Show 2 on mobile, 4 on desktop
    
    // Mobile: Use native horizontal scrolling, prevent vertical scroll
    if (isMobile && wrapper) {
        // Prevent vertical scrolling when touching carousel
        let touchStartX = 0;
        let touchStartY = 0;
        let isHorizontalScroll = false;
        let initialScrollLeft = 0;
        let initialScrollTop = 0;
        
        wrapper.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            initialScrollLeft = wrapper.scrollLeft;
            initialScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            isHorizontalScroll = false;
        }, { passive: true });
        
        wrapper.addEventListener('touchmove', (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touchCurrentX = e.touches[0].clientX;
            const touchCurrentY = e.touches[0].clientY;
            
            const diffX = Math.abs(touchCurrentX - touchStartX);
            const diffY = Math.abs(touchCurrentY - touchStartY);
            
            // Determine scroll direction early (within first 10px of movement)
            if (!isHorizontalScroll && (diffX > 10 || diffY > 10)) {
                isHorizontalScroll = diffX > diffY;
                
                // If horizontal scroll detected, lock body scroll
                if (isHorizontalScroll) {
                    // Store current scroll position
                    const currentBodyScroll = document.documentElement.scrollTop || document.body.scrollTop;
                    document.body.style.position = 'fixed';
                    document.body.style.top = `-${currentBodyScroll}px`;
                    document.body.style.width = '100%';
                    document.body.style.overflow = 'hidden';
                }
            }
            
            // If we detected horizontal scroll, prevent vertical page scroll
            if (isHorizontalScroll && diffX > 5) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
        
        const restoreBodyScroll = () => {
            if (isHorizontalScroll) {
                const scrollTop = parseInt(document.body.style.top || '0') * -1;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                if (scrollTop) {
                    document.documentElement.scrollTop = scrollTop;
                    document.body.scrollTop = scrollTop;
                }
            }
            touchStartX = 0;
            touchStartY = 0;
            isHorizontalScroll = false;
        };
        
        wrapper.addEventListener('touchend', restoreBodyScroll, { passive: true });
        wrapper.addEventListener('touchcancel', restoreBodyScroll, { passive: true });
        
        // Also handle mouse events for testing
        wrapper.addEventListener('wheel', (e) => {
            // Allow only horizontal scrolling with wheel
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                wrapper.scrollLeft += e.deltaX;
            }
        }, { passive: false });
        
        return; // Mobile uses native scrolling, no transform needed
    }
    
    // Desktop: Use transform-based scrolling
    function updateCarousel() {
        if (!isMobile) {
            const offset = -currentIndex * (100 / visibleSlides);
            track.style.transform = `translateX(${offset}%)`;
        }
    }
    
    function nextSlide() {
        if (currentIndex < slides.length - visibleSlides) {
            currentIndex++;
            updateCarousel();
        }
    }
    
    function prevSlide() {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarousel();
        }
    }
    
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    
    if (options.autoplay && !isMobile) {
        const autoplaySpeed = options.autoplaySpeed || 3000;
        setInterval(() => {
            if (currentIndex >= slides.length - visibleSlides) {
                currentIndex = 0;
            } else {
                currentIndex++;
            }
            updateCarousel();
        }, autoplaySpeed);
    }
    
    updateCarousel();
}

// Helper: Initialize Homepage Interactions
function initializeHomepageInteractions() {
    // Attach add to cart handlers
    document.addEventListener('click', (e) => {
        if (e.target.closest('.add-to-cart-btn') || e.target.closest('.add-to-cart')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.closest('.add-to-cart-btn') || e.target.closest('.add-to-cart');
            const productId = btn.dataset.productId || btn.dataset.id;
            
            if (!productId) {
                console.error('Product ID not found');
                return;
            }
            
            // Use existing add to cart function from main.js (available after main.js loads)
            if (typeof window.handleAddToCart === 'function') {
                window.handleAddToCart(productId);
            } else if (typeof window.addToGuestCart === 'function') {
                // Fallback: Add to guest cart
                const productPrice = parseFloat(btn.dataset.productPrice || 0);
                const productDiscount = parseFloat(btn.dataset.productDiscount || 0);
                window.addToGuestCart(productId, 1, productPrice, productDiscount);
                if (typeof window.loadCartCount === 'function') {
                    window.loadCartCount();
                } else {
                    // Update cart count manually
                    const guestCart = JSON.parse(localStorage.getItem('guestCart') || '{"items":[]}');
                    const cartCount = guestCart.items.reduce((sum, item) => sum + item.quantity, 0);
                    $('.cart-count').text(cartCount);
                }
                alert('Product added to cart! Sign in to save your cart.');
            } else {
                console.warn('Add to cart functions not available yet');
                alert('Please wait for the page to fully load.');
            }
        }
        
        // Attach wishlist handlers
        if (e.target.closest('.product-card__wishlist')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.closest('.product-card__wishlist');
            const productId = btn.dataset.productId;
            
            // Toggle wishlist icon (filled vs outline)
            const heartIcon = btn.querySelector('.icon-heart');
            if (heartIcon) {
                heartIcon.classList.toggle('las');
                heartIcon.classList.toggle('lar');
                heartIcon.classList.toggle('icon-heart');
            }
            
            // TODO: Add wishlist functionality (add/remove from wishlist)
            if (typeof window.Logger !== 'undefined') {
                window.Logger.info('Wishlist clicked', { productId });
            } else {
                console.log('Wishlist clicked for product:', productId);
            }
        }
    });
}

// Helper: HTML Escape (standalone implementation to avoid recursion)
function htmlEscape(text) {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') {
        text = String(text);
    }
    // Use direct string replacement to avoid recursion
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper: Get global fallback image (will be available after main.js loads)
function getGlobalFallbackImage() {
    if (typeof window !== 'undefined' && window.globalFallbackImage) {
        return window.globalFallbackImage;
    }
    return 'https://images.unsplash.com/photo-1505577081107-4a4167cd81d0?auto=format&fit=crop&w=800&q=85';
}

// Load and render banners by position
async function loadAndRenderBanners() {
    try {
        // Use cache-busting timestamp to ensure fresh data after banner deletions
        const banners = await cachedFetch(`/api/banners?_t=${Date.now()}`);
        console.log('Banners loaded:', banners);
        if (!Array.isArray(banners) || banners.length === 0) {
            console.warn('No banners found or invalid response');
            return;
        }
        
        // Get the homepage sections container
        const homepageSectionsContainer = document.getElementById('homepage-sections-container');
        if (!homepageSectionsContainer) {
            console.warn('Homepage sections container not found');
            return;
        }
        
        // Get all banners that are already rendered through homepage sections
        // This prevents duplicate rendering of the same banner
        const renderedBannerIds = new Set();
        const existingBannerSections = homepageSectionsContainer.querySelectorAll('[data-banner-id]');
        existingBannerSections.forEach(section => {
            const bannerId = section.getAttribute('data-banner-id');
            if (bannerId) {
                renderedBannerIds.add(bannerId);
            }
        });
        
        // Group banners by position, excluding already rendered banners
        // Also handle dynamic positions (after-section-{sectionId})
        const bannersByPosition = {
            'top': banners.filter(b => b.position === 'top' && b.isActive && !renderedBannerIds.has(b._id)),
            'after-hero': banners.filter(b => b.position === 'after-hero' && b.isActive && !renderedBannerIds.has(b._id)),
            'after-categories': banners.filter(b => b.position === 'after-categories' && b.isActive && !renderedBannerIds.has(b._id)),
            'middle': banners.filter(b => b.position === 'middle' && b.isActive && !renderedBannerIds.has(b._id)),
            'after-trending': banners.filter(b => b.position === 'after-trending' && b.isActive && !renderedBannerIds.has(b._id)),
            'after-discounted': banners.filter(b => b.position === 'after-discounted' && b.isActive && !renderedBannerIds.has(b._id)),
            'after-new-arrival': banners.filter(b => b.position === 'after-new-arrival' && b.isActive && !renderedBannerIds.has(b._id)),
            'after-top-selling': banners.filter(b => b.position === 'after-top-selling' && b.isActive && !renderedBannerIds.has(b._id)),
            'after-lingerie-collection': banners.filter(b => b.position === 'after-lingerie-collection' && b.isActive && !renderedBannerIds.has(b._id)),
            'after-product-feature-collection': banners.filter(b => b.position === 'after-product-feature-collection' && b.isActive && !renderedBannerIds.has(b._id)),
            'before-footer': banners.filter(b => b.position === 'before-footer' && b.isActive && !renderedBannerIds.has(b._id)),
            'bottom': banners.filter(b => b.position === 'bottom' && b.isActive && !renderedBannerIds.has(b._id)),
            'dynamic': banners.filter(b => b.position && b.position.startsWith('after-section-') && b.isActive && !renderedBannerIds.has(b._id))
        };
        
        // Helper function to get current sections
        const getSections = () => Array.from(homepageSectionsContainer.children);
        
        // Helper function to find section by type
        const findSectionByType = (types) => {
            const sections = getSections();
            for (let i = 0; i < sections.length; i++) {
                const sectionType = sections[i].getAttribute('data-section-type');
                if (types.includes(sectionType)) {
                    return i;
                }
            }
            return -1;
        };
        
        // Helper function to insert banner after section index
        const insertBannerAfterSection = (bannerElement, sectionIndex) => {
            const sections = getSections();
            if (sectionIndex >= 0 && sectionIndex < sections.length) {
                const nextSibling = sections[sectionIndex].nextSibling;
                if (nextSibling) {
                    homepageSectionsContainer.insertBefore(bannerElement, nextSibling);
                } else {
                    homepageSectionsContainer.appendChild(bannerElement);
                }
                return true;
            }
            return false;
        };
        
        // Helper function to find section by name (for specific collection sections)
        const findSectionByName = (sectionName) => {
            const sections = getSections();
            for (let i = 0; i < sections.length; i++) {
                const nameAttr = sections[i].getAttribute('data-section-name');
                if (nameAttr && nameAttr.toLowerCase().includes(sectionName.toLowerCase())) {
                    return i;
                }
            }
            return -1;
        };
        
        // Render banners by position in order
        const positionOrder = [
            'top',
            'after-hero',
            'after-categories',
            'middle',
            'after-trending',
            'after-discounted',
            'after-new-arrival',
            'after-top-selling',
            'after-lingerie-collection',
            'after-product-feature-collection',
            'before-footer',
            'bottom'
        ];
        
        // First render standard position banners
        for (const position of positionOrder) {
            const positionBanners = bannersByPosition[position];
            if (positionBanners.length > 0) {
                const banner = positionBanners[0]; // Use first banner for each position
                console.log(`Rendering banner for position "${position}":`, banner);
                const bannerElement = renderBannerByPosition(banner, position);
                
                if (!bannerElement) {
                    console.warn(`Failed to render banner for position "${position}"`);
                    continue;
                }
                
                const sections = getSections();
                
                switch (position) {
                    case 'top':
                        // Insert at the beginning
                        if (sections.length > 0) {
                            homepageSectionsContainer.insertBefore(bannerElement, sections[0]);
                        } else {
                            homepageSectionsContainer.appendChild(bannerElement);
                        }
                        break;
                        
                    case 'after-hero':
                        // After hero slider
                        const heroIndex = findSectionByType(['heroSlider']);
                        if (!insertBannerAfterSection(bannerElement, heroIndex) && sections.length > 0) {
                            homepageSectionsContainer.insertBefore(bannerElement, sections[0].nextSibling || sections[0]);
                        }
                        break;
                        
                    case 'after-categories':
                        // After category sections
                        const categoryIndex = findSectionByType(['categoryFeatured', 'categoryGrid', 'categoryCircles']);
                        if (!insertBannerAfterSection(bannerElement, categoryIndex) && sections.length > 0) {
                            homepageSectionsContainer.insertBefore(bannerElement, sections[0].nextSibling || sections[0]);
                        }
                        break;
                        
                    case 'middle':
                        // Between product sections
                        const productIndex = findSectionByType(['productTabs', 'productCarousel']);
                        if (!insertBannerAfterSection(bannerElement, productIndex) && sections.length > 0) {
                            const firstSection = sections[0];
                            if (firstSection.nextSibling) {
                                homepageSectionsContainer.insertBefore(bannerElement, firstSection.nextSibling);
                            } else {
                                homepageSectionsContainer.appendChild(bannerElement);
                            }
                        }
                        break;
                        
                    case 'after-trending':
                        // After trending products (look for productCarousel with trending filter)
                        const trendingIndex = findSectionByType(['productCarousel', 'productTabs']);
                        if (!insertBannerAfterSection(bannerElement, trendingIndex)) {
                            homepageSectionsContainer.appendChild(bannerElement);
                        }
                        break;
                        
                    case 'after-discounted':
                        // After discounted products
                        const discountedIndex = findSectionByType(['productCarousel', 'productTabs']);
                        if (!insertBannerAfterSection(bannerElement, discountedIndex)) {
                            homepageSectionsContainer.appendChild(bannerElement);
                        }
                        break;
                        
                    case 'after-new-arrival':
                        // After new arrival products
                        const newArrivalIndex = findSectionByType(['productCarousel', 'productTabs']);
                        if (!insertBannerAfterSection(bannerElement, newArrivalIndex)) {
                            homepageSectionsContainer.appendChild(bannerElement);
                        }
                        break;
                        
                    case 'after-top-selling':
                        // After Top Selling Products section
                        // Search for "Top Selling Product" (exact name in database)
                        const topSellingIndex = findSectionByName('Top Selling Product');
                        if (topSellingIndex === -1) {
                            // Also try "top selling" as fallback
                            const topSellingIndex2 = findSectionByName('top selling');
                            if (!insertBannerAfterSection(bannerElement, topSellingIndex2)) {
                                // Fallback to after any product carousel
                                const fallbackIndex = findSectionByType(['productCarousel', 'productTabs']);
                                if (!insertBannerAfterSection(bannerElement, fallbackIndex)) {
                                    homepageSectionsContainer.appendChild(bannerElement);
                                }
                            }
                        } else {
                            insertBannerAfterSection(bannerElement, topSellingIndex);
                        }
                        break;
                        
                    case 'after-lingerie-collection':
                        // After Lingerie Collection section
                        // Search for "Lingerie Collection" (exact name in database)
                        const lingerieIndex = findSectionByName('Lingerie Collection');
                        if (lingerieIndex === -1) {
                            // Also try "lingerie" as fallback
                            const lingerieIndex2 = findSectionByName('lingerie');
                            if (!insertBannerAfterSection(bannerElement, lingerieIndex2)) {
                                // Fallback to after any product carousel
                                const fallbackIndex = findSectionByType(['productCarousel', 'productTabs']);
                                if (!insertBannerAfterSection(bannerElement, fallbackIndex)) {
                                    homepageSectionsContainer.appendChild(bannerElement);
                                }
                            }
                        } else {
                            insertBannerAfterSection(bannerElement, lingerieIndex);
                        }
                        break;
                        
                    case 'after-product-feature-collection':
                        // After Product Feature Collection section
                        // Search for "Product Feature Collection" (exact name in database)
                        const productFeatureIndex = findSectionByName('Product Feature Collection');
                        if (productFeatureIndex === -1) {
                            // Also try "product feature" as fallback
                            const productFeatureIndex2 = findSectionByName('product feature');
                            if (!insertBannerAfterSection(bannerElement, productFeatureIndex2)) {
                                // Fallback to after any product carousel
                                const fallbackIndex = findSectionByType(['productCarousel', 'productTabs']);
                                if (!insertBannerAfterSection(bannerElement, fallbackIndex)) {
                                    homepageSectionsContainer.appendChild(bannerElement);
                                }
                            }
                        } else {
                            insertBannerAfterSection(bannerElement, productFeatureIndex);
                        }
                        break;
                        
                    case 'before-footer':
                        // Before footer - insert at end but before any footer elements
                        homepageSectionsContainer.appendChild(bannerElement);
                        break;
                        
                    case 'bottom':
                        // At the very end
                        homepageSectionsContainer.appendChild(bannerElement);
                        break;
                        
                    default:
                        // Handle dynamic positions (format: "after-section-{sectionId}")
                        if (position && position.startsWith('after-section-')) {
                            const sectionId = position.replace('after-section-', '');
                            // Find section by ID
                            const sectionIndex = Array.from(sections).findIndex(section => {
                                return section.getAttribute('data-section-id') === sectionId;
                            });
                            if (sectionIndex !== -1 && sections[sectionIndex]) {
                                insertBannerAfterSection(bannerElement, sectionIndex);
                            } else {
                                // Fallback: append at end
                                homepageSectionsContainer.appendChild(bannerElement);
                            }
                        } else {
                            // Unknown position - append at end
                            homepageSectionsContainer.appendChild(bannerElement);
                        }
                        break;
                }
            }
        }
        
        // Render dynamic position banners (after-section-{sectionId})
        const dynamicBanners = bannersByPosition['dynamic'] || [];
        for (const banner of dynamicBanners) {
            const bannerElement = renderBannerByPosition(banner, banner.position);
            if (!bannerElement) continue;
            
            const sections = getSections();
            const sectionId = banner.position.replace('after-section-', '');
            // Find section by ID
            const sectionIndex = Array.from(sections).findIndex(section => {
                return section.getAttribute('data-section-id') === sectionId;
            });
            if (sectionIndex !== -1 && sections[sectionIndex]) {
                insertBannerAfterSection(bannerElement, sectionIndex);
            } else {
                // Fallback: append at end
                homepageSectionsContainer.appendChild(bannerElement);
            }
        }
        
    } catch (error) {
        console.error('Error loading banners:', error);
        if (typeof window.Logger !== 'undefined') {
            window.Logger.error('Failed to load banners', error);
        }
    }
}

// Render a banner by position with title
function renderBannerByPosition(banner, position) {
    try {
        if (!banner) {
            console.warn('renderBannerByPosition: No banner provided');
            return null;
        }
        if (!banner.isActive) {
            console.warn('renderBannerByPosition: Banner is not active', banner._id);
            return null;
        }
        
        const imageUrl = banner.imageUpload?.url || banner.image || getGlobalFallbackImage();
        const link = banner.link || '#';
        const title = banner.title || '';
        const description = banner.description || '';
        const size = banner.size || 'medium';
        
        // Get custom dimensions if size is custom
        const customWidth = banner.customWidth;
        const customHeight = banner.customHeight;
        const hasCustomDimensions = size === 'custom' && customWidth && customHeight;
        
        // Check if banner is a YouTube/Vimeo video
        const isVideo = banner.banner_type === 'video';
        const videoType = banner.video_type || (isVideo ? detectVideoTypeFromUrl(imageUrl) : null);
        const isYouTube = videoType === 'youtube';
        const isVimeo = videoType === 'vimeo';
    
    let mediaContent = '';
    
    if (isYouTube) {
        const youtubeId = extractYouTubeId(imageUrl);
        if (youtubeId) {
            const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=1`;
            mediaContent = `
                <div class="banner-video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
                    <iframe src="${htmlEscape(embedUrl)}" 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen
                            loading="lazy">
                    </iframe>
                </div>
            `;
        } else {
            mediaContent = `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(banner.imageAlt || title || 'Banner')}" class="banner-promo__image" loading="lazy">`;
        }
    } else if (isVimeo) {
        const vimeoId = extractVimeoId(imageUrl);
        if (vimeoId) {
            const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&controls=1`;
            mediaContent = `
                <div class="banner-video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
                    <iframe src="${htmlEscape(embedUrl)}" 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            frameborder="0" 
                            allow="autoplay; fullscreen; picture-in-picture" 
                            allowfullscreen
                            loading="lazy">
                    </iframe>
                </div>
            `;
        } else {
            mediaContent = `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(banner.imageAlt || title || 'Banner')}" class="banner-promo__image" loading="lazy">`;
        }
    } else if (isVideo && (imageUrl.includes('/video/upload') || imageUrl.match(/\.(mp4|webm|ogg|mov|avi|wmv|m4v|flv)$/i))) {
        // Direct video file
        mediaContent = `
            <video src="${htmlEscape(imageUrl)}" 
                   controls 
                   autoplay 
                   muted 
                   loop 
                   style="width: 100%; height: auto; display: block;"
                   class="banner-promo__video"
                   loading="lazy">
            </video>
        `;
    } else {
        // Regular image
        mediaContent = `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(banner.imageAlt || title || 'Banner')}" class="banner-promo__image" loading="lazy">`;
    }
    
    const bannerSection = document.createElement('section');
    bannerSection.className = `banner-section banner-section--${position} banner-section--${size} homepage-section`;
    bannerSection.setAttribute('data-banner-id', banner._id);
    bannerSection.setAttribute('data-banner-position', position);
    bannerSection.setAttribute('data-banner-size', size);
    
    // Apply custom dimensions if available
    let customStyle = '';
    let bannerPromoStyle = '';
    if (hasCustomDimensions) {
        customStyle = `style="max-width: ${customWidth}px; width: 100%;"`;
        bannerPromoStyle = `style="max-width: ${customWidth}px; width: 100%;"`;
        bannerSection.setAttribute('data-custom-width', customWidth);
        bannerSection.setAttribute('data-custom-height', customHeight);
    }
    
    // Use container-fluid for full-width, container for others
    const containerClass = size === 'full-width' ? 'container-fluid px-0' : 'container';
    
    // Determine media container height based on size
    let mediaHeight = '';
    if (hasCustomDimensions) {
        // For custom banners, use exact height with !important to override any CSS
        mediaHeight = `height: ${customHeight}px !important; min-height: ${customHeight}px !important; max-height: ${customHeight}px !important;`;
    } else {
        switch(size) {
            case 'small':
                mediaHeight = 'height: 300px; min-height: 300px;';
                break;
            case 'medium':
                mediaHeight = 'height: 400px; min-height: 400px;';
                break;
            case 'large':
                mediaHeight = 'height: 500px; min-height: 500px;';
                break;
            case 'full-width':
                mediaHeight = 'height: 600px; min-height: 600px;';
                break;
            default:
                mediaHeight = 'height: 400px; min-height: 400px;';
        }
    }
    
    bannerSection.innerHTML = `
        <div class="${containerClass}" ${customStyle}>
            <div class="banner-promo banner-promo--${size}" ${bannerPromoStyle}>
                ${title ? `
                    <div class="banner-promo__header">
                        <h2 class="banner-promo__title">${htmlEscape(title)}</h2>
                        ${description ? `<p class="banner-promo__description">${htmlEscape(description)}</p>` : ''}
                    </div>
                ` : ''}
                ${link && link !== '#' ? `<a href="${htmlEscape(link)}" class="banner-promo__link" style="display: block; width: 100%; height: 100%;">` : ''}
                    <div class="banner-promo__media banner-promo__media--${size}${hasCustomDimensions ? ' banner-promo__media--custom' : ''}" style="${mediaHeight} width: 100%; overflow: hidden; position: relative; ${hasCustomDimensions ? `max-width: ${customWidth}px;` : ''}">
                        ${hasCustomDimensions && !isVideo ? `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(banner.imageAlt || title || 'Banner')}" style="width: 100% !important; height: 100% !important; min-height: unset !important; max-height: ${customHeight}px !important; object-fit: cover !important; object-position: center center !important; display: block !important; position: absolute !important; top: 0 !important; left: 0 !important;" class="banner-promo__image banner-promo__image--custom" loading="lazy">` : (isVideo ? mediaContent : `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(banner.imageAlt || title || 'Banner')}" style="width: 100%; height: 100%; object-fit: cover; object-position: center center; display: block;" class="banner-promo__image" loading="lazy">`)}
                    </div>
                ${link && link !== '#' ? `</a>` : ''}
            </div>
        </div>
    `;
    
    return bannerSection;
    } catch (error) {
        console.error('Error rendering banner:', error, banner);
        return null;
    }
}

// Render Subcategory Grid Section (6 big boxes with auto-sliding buttons)
async function renderSubcategoryGrid(section, index) {
    try {
        // Fetch subcategory data (use public route)
        let url = '/api/homepage-sections/' + section._id + '/data/public';
        let data;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 403) {
                    console.warn('Subcategory Grid section is not published or active');
                } else {
                    console.error(`HTTP error! status: ${response.status}`);
                }
                return null;
            }
            data = await response.json();
        } catch (error) {
            console.error('Error fetching subcategory grid data:', error);
            return null;
        }
        
        const gridSubcategories = Array.isArray(data.gridSubcategories) ? data.gridSubcategories : [];
        const buttonSubcategories = Array.isArray(data.buttonSubcategories) ? data.buttonSubcategories : [];
        
        if (gridSubcategories.length === 0) {
            console.warn('Subcategory Grid: No subcategories found');
            return null;
        }
        
        // Limit to 6 boxes
        const displaySubcategories = gridSubcategories.slice(0, 6);
        
        // Gradient colors for each box (matching reference image)
        const gradients = [
            'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)', // Pink
            'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)', // Purple
            'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)', // Orange-brown
            'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)', // Beige
            'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)', // Gold
            'linear-gradient(135deg, #d63031 0%, #b71c1c 100%)'  // Maroon-pink
        ];
        
        const sectionHtml = `
            <section class="subcategory-grid-section homepage-section" 
                     data-section-type="subcategoryGrid" 
                     data-section-id="${section._id}">
                <div class="container py-5">
                    ${section.title ? `
                        <div class="section-header text-center mb-4">
                            <h2 class="section-title">${htmlEscape(section.title)}</h2>
                            ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    <div class="subcategory-grid-container">
                        <div class="subcategory-grid">
                            ${displaySubcategories.map((subcat, idx) => {
                                const imageUrl = subcat.imageUpload?.url || subcat.image || getGlobalFallbackImage();
                                const subcatId = subcat._id || subcat.id;
                                
                                return `
                                    <a href="/subcategory/${subcatId}" class="subcategory-grid-item">
                                        <div class="subcategory-grid-item__image">
                                            <img src="${htmlEscape(imageUrl)}" 
                                                 alt="${htmlEscape(subcat.name)}" 
                                                 loading="lazy">
                                        </div>
                                        <div class="subcategory-grid-item__name">
                                            ${htmlEscape(subcat.name)}
                                        </div>
                                    </a>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ${buttonSubcategories.length > 0 ? `
                        <div class="subcategory-buttons-wrapper">
                            <div class="subcategory-buttons-container" id="subcategoryButtons_${index}">
                                <div class="subcategory-buttons-track">
                                    ${buttonSubcategories.map(subcat => {
                                        const subcatId = subcat._id || subcat.id;
                                        return `
                                            <a href="/subcategory/${subcatId}" class="subcategory-button">
                                                <span>${htmlEscape(subcat.name)}</span>
                                                <span class="subcategory-button__arrow">→</span>
                                            </a>
                                        `;
                                    }).join('')}
                                    ${buttonSubcategories.map(subcat => {
                                        const subcatId = subcat._id || subcat.id;
                                        return `
                                            <a href="/subcategory/${subcatId}" class="subcategory-button">
                                                <span>${htmlEscape(subcat.name)}</span>
                                                <span class="subcategory-button__arrow">→</span>
                                            </a>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </section>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHtml;
        const sectionElement = tempDiv.firstElementChild;
        
        // Initialize auto-sliding buttons after DOM insertion
        if (sectionElement && buttonSubcategories.length > 0) {
            setTimeout(() => {
                initSubcategoryButtonsCarousel(`#subcategoryButtons_${index}`, buttonSubcategories.length);
            }, 100);
        }
        
        return sectionElement;
    } catch (error) {
        console.error('Error rendering subcategory grid:', error);
        return null;
    }
}

// Initialize Subcategory Buttons Auto-Slide Carousel
function initSubcategoryButtonsCarousel(containerSelector, totalItems) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    const track = container.querySelector('.subcategory-buttons-track');
    if (!track) return;
    
    let currentPosition = 0;
    const buttonWidth = 180; // Approximate button width with padding
    const visibleButtons = Math.floor(container.offsetWidth / buttonWidth);
    
    function updateCarousel() {
        track.style.transition = 'transform 0.6s ease-in-out';
        track.style.transform = `translateX(-${currentPosition}px)`;
    }
    
    // Auto-slide every 3 seconds
    let autoplayInterval = setInterval(() => {
        currentPosition += buttonWidth;
        
        // Reset to start when we've scrolled through all items
        const maxScroll = totalItems * buttonWidth;
        if (currentPosition >= maxScroll) {
            currentPosition = 0;
            track.style.transition = 'none';
            track.style.transform = 'translateX(0px)';
            setTimeout(() => {
                track.style.transition = 'transform 0.6s ease-in-out';
            }, 50);
        } else {
            updateCarousel();
        }
    }, 3000);
    
    // Store interval for cleanup
    container.dataset.autoplayInterval = autoplayInterval;
}

// Export for use in main.js - Export immediately when script loads
// This runs when the script is parsed, ensuring functions are available
(function() {
    if (typeof window !== 'undefined') {
        // Export functions immediately so they're available when main.js loads
        window.loadAndRenderHomepageSections = loadAndRenderHomepageSections;
        window.loadAndRenderBanners = loadAndRenderBanners;
        window.HOMEPAGE_SECTION_RENDERERS = HOMEPAGE_SECTION_RENDERERS;
        console.log('homepage-sections.js loaded - functions exported to window');
        console.log('Available functions:', {
            loadAndRenderHomepageSections: typeof window.loadAndRenderHomepageSections,
            loadAndRenderBanners: typeof window.loadAndRenderBanners,
            HOMEPAGE_SECTION_RENDERERS: typeof window.HOMEPAGE_SECTION_RENDERERS
        });
    } else {
        console.error('window object not available - cannot export functions');
    }
})();


