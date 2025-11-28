/**
 * Homepage Sections Renderer
 * Renders dynamic homepage sections based on database configuration
 * Matches D.Watson Cosmetics style
 * Optimized for fast loading with parallel rendering and caching
 */

// Request cache for API calls (5 minute TTL)
const requestCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
        const response = await fetch(url, options);
        const data = await response.json();
        return data;
    }
    
    const cached = requestCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    
    const response = await fetch(url, options);
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
    bannerFullWidth: renderBannerFullWidth,
    videoBanner: renderVideoBanner,
    collectionLinks: renderCollectionLinks,
    newsletterSocial: renderNewsletterSocial,
    brandMarquee: renderBrandMarquee,
    customHTML: renderCustomHTML
};

// Load and render homepage sections
async function loadAndRenderHomepageSections() {
    const startTime = performance.now();
    try {
        if (typeof window.Logger !== 'undefined') {
            window.Logger.info('Loading homepage sections...');
        }
        
        // Fetch homepage sections.
        // Use cache during a single session, but bypass browser HTTP cache with a timestamp
        // so that changes from the admin dashboard (add/remove sections) appear immediately.
        let sections;
        try {
            const url = `/api/homepage-sections/public?_t=${Date.now()}`;
            sections = await cachedFetch(url);
            if (!Array.isArray(sections)) {
                throw new Error('Invalid sections response format');
            }
        } catch (error) {
            const errorMsg = `Failed to load homepage sections: ${error.message}`;
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
        
        // Remove all categoryCircles sections - they are duplicates of category sections shown earlier
        sections = sections.filter(section => section.type !== 'categoryCircles');
        
        if (typeof window.Logger !== 'undefined') {
            window.Logger.info(`Found ${sections.length} homepage sections`, { count: sections.length });
        }
        
        // Render each section
        const mainContainer = document.querySelector('main');
        if (!mainContainer) {
            console.error('Main container not found');
            return;
        }
        
        // Use existing container or create it
        let homepageSectionsContainer = document.getElementById('homepage-sections-container');
        if (!homepageSectionsContainer) {
            homepageSectionsContainer = document.createElement('div');
            homepageSectionsContainer.id = 'homepage-sections-container';
            homepageSectionsContainer.className = 'homepage-sections-container';
            
            // Insert at the beginning of main
            if (mainContainer.firstChild) {
                mainContainer.insertBefore(homepageSectionsContainer, mainContainer.firstChild);
            } else {
                mainContainer.appendChild(homepageSectionsContainer);
            }
        }
        
        // Clear container before rendering new sections
        homepageSectionsContainer.innerHTML = '';
        
        // Hide old sections fallback if we have new sections
        const oldSectionsFallback = document.getElementById('old-sections-fallback');
        if (oldSectionsFallback && sections.length > 0) {
            oldSectionsFallback.style.display = 'none';
        }
        
        // Render sections in their exact order to maintain proper sequence
        // First scrolling text goes at top before header, others render in normal order
        let renderedCount = 0;
        
        // Render sections sequentially to maintain proper order (especially for announcement bars after slider)
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            console.log(`Rendering section ${i}: "${section.name}" (type: ${section.type}, ordering: ${section.ordering})`);
            const result = await renderSection(section, i, sections, homepageSectionsContainer);
            if (result && !result.skip && result.rendered !== false) {
                renderedCount++;
                console.log(`✓ Section ${i} "${section.name}" rendered successfully`);
            } else if (result && result.skip) {
                console.log(`⊘ Section ${i} "${section.name}" skipped (rendered elsewhere)`);
            } else {
                console.warn(`⚠ Section ${i} "${section.name}" did not render (result:`, result, `)`);
            }
        }
        
        // Log summary
        const loadDuration = performance.now() - startTime;
        const summaryMsg = `Homepage sections loaded: ${renderedCount}/${sections.length} sections rendered in ${loadDuration.toFixed(2)}ms`;
        console.log(summaryMsg);
        if (typeof window.Logger !== 'undefined') {
            window.Logger.info(summaryMsg, { 
                rendered: renderedCount, 
                total: sections.length, 
                duration: loadDuration 
            });
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
        console.log(`[renderSection] Processing scrolling text section "${section.name}" at index ${index}`);
        const renderer = HOMEPAGE_SECTION_RENDERERS[section.type];
        if (renderer) {
            try {
                // Check if this is the first scrolling text section (lowest ordering)
                const firstScrollingTextIndex = allSections.findIndex(s => s.type === 'scrollingText');
                const isFirstScrollingText = index === firstScrollingTextIndex;
                console.log(`[renderSection] First scrolling text index: ${firstScrollingTextIndex}, current index: ${index}, isFirst: ${isFirstScrollingText}`);
                
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
    if (renderer) {
        try {
            const sectionStartTime = performance.now();
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
                    }
                } else if (sectionElement instanceof Node) {
                    container.appendChild(sectionElement);
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
        }
    } else {
        const warnMsg = `No renderer found for section type: ${section.type}`;
        if (typeof window.Logger !== 'undefined') {
            window.Logger.warn(warnMsg, {
                sectionName: section.name,
                sectionType: section.type
            });
        } else {
            console.warn(warnMsg, { section });
        }
        // Show warning in UI
        const warnDiv = document.createElement('div');
        warnDiv.className = 'alert alert-warning m-3';
        warnDiv.innerHTML = `<strong>No renderer:</strong> ${section.name} (${section.type})`;
        container.appendChild(warnDiv);
    }
    
    return { skip: false };
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
                    ${section.title ? `
                        <div class="section-header text-center mb-4">
                            <h2>${htmlEscape(section.title)}</h2>
                            ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
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
        const limit = tab.limit || 8;
        
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
        const limit = section.config?.limit || 10;
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

// Render Banner Full Width
async function renderBannerFullWidth(section, index) {
    const bannerId = section.config?.bannerId;
    if (!bannerId) {
        if (typeof window.Logger !== 'undefined') {
            window.Logger.warn('Banner section has no banner ID', { sectionId: section._id });
        }
        return null;
    }
    
    try {
        // Use cache-busting to ensure we get fresh data after banner deletions
        const bannerResponse = await fetch(`/api/banners/detail/${bannerId}?_t=${Date.now()}`);
        
        if (!bannerResponse.ok) {
            // Handle 404 (banner not found) or 401 (unauthorized) gracefully - try fallback
            if (bannerResponse.status === 404 || bannerResponse.status === 401) {
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
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn('Banner is inactive or not found', { bannerId, sectionId: section._id, bannerActive: banner?.isActive });
            }
            return null;
        }
        
        return renderBannerHTML(banner, section);
    } catch (error) {
        if (typeof window.Logger !== 'undefined') {
            window.Logger.error('Error rendering banner', error, { bannerId, sectionId: section._id });
        } else {
            console.error('Error rendering banner:', error);
        }
        return null;
    }
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
    const newsletterTitle = section.config?.newsletterTitle || section.title || 'Subscribe to our newsletter';
    const newsletterDesc = section.config?.newsletterDesc || section.description || 'Get updates on new products and special offers';
    const socialLinks = section.config?.socialLinks || {};
    
    const sectionHtml = `
        <section class="newsletter-social homepage-section" data-section-type="newsletterSocial" data-section-id="${section._id}">
            <div class="container py-5">
                <div class="row align-items-center">
                    <div class="col-lg-6">
                        <h3>${htmlEscape(newsletterTitle)}</h3>
                        <p>${htmlEscape(newsletterDesc)}</p>
                        <form class="newsletter-form" id="newsletterForm_${index}">
                            <div class="input-group">
                                <input type="email" class="form-control" placeholder="Enter your email" required>
                                <button class="btn btn-primary" type="submit">Subscribe</button>
                            </div>
                        </form>
                    </div>
                    ${Object.keys(socialLinks).length > 0 ? `
                        <div class="col-lg-6 text-end">
                            <div class="social-links">
                                ${Object.entries(socialLinks).map(([platform, url]) => `
                                    <a href="${htmlEscape(url)}" target="_blank" rel="noopener" class="social-link">
                                        <i class="fab fa-${platform}"></i>
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
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
async function renderBrandMarquee(section, index) {
    try {
        console.log('Rendering brand marquee section:', section.name || section._id);
        
        // Fetch active brands from API
        let brands = [];
        try {
            const response = await fetch('/api/brands/public');
            if (response.ok) {
                const apiBrands = await response.json();
                // Ensure it's an array
                brands = Array.isArray(apiBrands) ? apiBrands : (apiBrands.brands || apiBrands.data || []);
                console.log(`Fetched ${brands.length} brands from API for brand marquee`);
            } else {
                console.warn('Failed to fetch brands from API:', response.status, response.statusText);
            }
        } catch (fetchError) {
            console.error('Error fetching brands from API:', fetchError);
        }
        
        // If no brands from API, check config
        if (brands.length === 0) {
    const logos = section.config?.logos || [];
            if (Array.isArray(logos) && logos.length > 0) {
                brands = logos;
                console.log(`Using ${brands.length} brands from section config`);
            }
        }
        
        // Filter out brands without images
        brands = brands.filter(brand => {
            const hasImage = brand.image || brand.logo;
            if (!hasImage) {
                console.warn('Skipping brand without image:', brand.name || brand);
            }
            return hasImage;
        });
        
        // If still no brands, return null (don't render empty section)
        if (!brands || brands.length === 0) {
            console.log('No brands with images found to display in brand marquee');
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn('Brand marquee section not rendered: No brands with images available', {
                    sectionType: 'brandMarquee',
                    sectionId: section._id
                });
            }
            return null;
        }
        
        console.log(`Rendering ${brands.length} brands in brand marquee`);
    
    const sectionHtml = `
        <section class="brand-marquee homepage-section" data-section-type="brandMarquee" data-section-id="${section._id}">
            <div class="container py-5">
                ${section.title ? `
                    <div class="section-header text-center mb-4">
                        <h2>${htmlEscape(section.title)}</h2>
                        ${section.subtitle ? `<p class="text-muted">${htmlEscape(section.subtitle)}</p>` : ''}
                    </div>
                ` : ''}
                <div class="brand-marquee__inner">
                    ${brands.map(brand => {
                        const logoUrl = brand.image || brand.logo || '';
                        const brandName = brand.name || brand.alt || 'Brand';
                        const brandAlt = brand.alt || brandName;
                            const brandLink = brand.link || '';
                            
                            if (!logoUrl || logoUrl === 'null' || logoUrl === 'undefined') {
                                console.warn('Skipping brand without valid image URL:', brandName);
                                return ''; // Skip brands without images
                            }
                            
                            // Wrap in link if provided
                            // Properly escape JavaScript strings for inline handlers using JSON.stringify
                            // JSON.stringify already includes quotes, so we use it directly
                            const escapedLogoUrl = JSON.stringify(String(logoUrl || ''));
                            const escapedBrandName = JSON.stringify(String(brandName || ''));
                            
                            // Use data attributes and event listeners instead of inline handlers to avoid syntax errors
                            const logoHtml = `
                            <div class="brand-marquee__item">
                                    ${brandLink ? `<a href="${htmlEscape(brandLink)}" target="_blank" rel="noopener">` : '<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">'}
                                    <img src="${htmlEscape(logoUrl)}" alt="${htmlEscape(brandAlt)}" loading="lazy" 
                                         data-brand-name="${htmlEscape(brandName)}"
                                         data-brand-url="${htmlEscape(logoUrl)}"
                                         class="brand-logo-image">
                                    ${brandLink ? `</a>` : '</div>'}
                            </div>
                        `;
                            return logoHtml;
                        }).filter(html => html !== '').join('')}
                </div>
            </div>
        </section>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sectionHtml;
    const sectionElement = tempDiv.firstElementChild;
    
    // Add event listeners to brand images after DOM insertion to avoid inline handler syntax errors
    if (sectionElement) {
        const brandImages = sectionElement.querySelectorAll('.brand-logo-image');
        brandImages.forEach(img => {
            const brandName = img.getAttribute('data-brand-name') || 'Brand';
            const brandUrl = img.getAttribute('data-brand-url') || '';
            
            img.addEventListener('error', function() {
                try {
                    console.error('❌ Failed to load brand image:', String(brandUrl), 'for brand:', String(brandName));
                } catch (err) {
                    console.error('❌ Failed to load brand image');
                }
                const parent = this.closest('.brand-marquee__item');
                if (parent && parent.parentNode) {
                    parent.parentNode.removeChild(parent);
                }
            });
            
            img.addEventListener('load', function() {
                try {
                    console.log('✅ Loaded brand image:', String(brandName), 'from:', String(brandUrl));
                } catch (err) {
                    console.log('✅ Loaded brand image successfully');
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
function renderProductCard(product) {
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
                         loading="lazy"
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
        setInterval(() => {
            if (currentIndex >= slides.length - visibleSlides) {
                currentIndex = 0;
            } else {
                currentIndex++;
            }
            updateCarousel();
        }, 4000);
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
        if (!Array.isArray(banners) || banners.length === 0) {
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
            'bottom': banners.filter(b => b.position === 'bottom' && b.isActive && !renderedBannerIds.has(b._id))
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
        
        for (const position of positionOrder) {
            const positionBanners = bannersByPosition[position];
            if (positionBanners.length > 0) {
                const banner = positionBanners[0]; // Use first banner for each position
                const bannerElement = renderBannerByPosition(banner, position);
                
                if (!bannerElement) continue;
                
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
                }
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
    if (!banner || !banner.isActive) return null;
    
    const imageUrl = banner.imageUpload?.url || banner.image || getGlobalFallbackImage();
    const link = banner.link || '#';
    const title = banner.title || '';
    const description = banner.description || '';
    const size = banner.size || 'medium';
    
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
    
    // Use container-fluid for full-width, container for others
    const containerClass = size === 'full-width' ? 'container-fluid px-0' : 'container';
    
    bannerSection.innerHTML = `
        <div class="${containerClass}">
            <div class="banner-promo banner-promo--${size}">
                ${title ? `
                    <div class="banner-promo__header">
                        <h2 class="banner-promo__title">${htmlEscape(title)}</h2>
                        ${description ? `<p class="banner-promo__description">${htmlEscape(description)}</p>` : ''}
                    </div>
                ` : ''}
                ${link && link !== '#' ? `<a href="${htmlEscape(link)}" class="banner-promo__link">` : ''}
                    <div class="banner-promo__media banner-promo__media--${size}">
                        ${mediaContent}
                    </div>
                ${link && link !== '#' ? `</a>` : ''}
            </div>
        </div>
    `;
    
    return bannerSection;
}

// Export for use in main.js
if (typeof window !== 'undefined') {
    window.loadAndRenderHomepageSections = loadAndRenderHomepageSections;
    window.loadAndRenderBanners = loadAndRenderBanners;
    window.HOMEPAGE_SECTION_RENDERERS = HOMEPAGE_SECTION_RENDERERS;
}


