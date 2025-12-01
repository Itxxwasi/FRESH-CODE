const globals = {
    sections: null,
    sectionsLoaded: false,
    sectionsError: null,
    cache: {}
};

const heroCarousel = {
    currentIndex: 0,
    timer: null,
    slides: [],
    delay: 5000
};

const categoryImageFallbacks = {
    'allergy medicine': 'https://images.unsplash.com/photo-1580281780460-92f78080ade9?auto=format&fit=crop&w=800&q=85',
    'heart medicine': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=85',
    'stomach medicine': 'https://images.unsplash.com/photo-1580894908373-fb1d4780d151?auto=format&fit=crop&w=800&q=85',
    'pain relief': 'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=800&q=85',
    'vitamins & supplements': 'https://images.unsplash.com/photo-1598511723374-3ba6bc5d5b47?auto=format&fit=crop&w=800&q=85',
    'skincare': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=85',
    'color cosmetics': 'https://images.unsplash.com/photo-1513483460601-25834dd141f2?auto=format&fit=crop&w=800&q=85'
};

// Global fallback image - make available to window for other scripts
if (typeof window !== 'undefined') {
    window.globalFallbackImage = window.globalFallbackImage || 'https://images.unsplash.com/photo-1505577081107-4a4167cd81d0?auto=format&fit=crop&w=800&q=85';
}
const globalFallbackImage = window.globalFallbackImage;

const messengerSelectors = {
    toggle: '.messenger-toggle',
    window: '.messenger-window',
    close: '.close-messenger',
    messages: '#messengerMessages',
    body: '.messenger-body',
    input: '#messengerInput',
    send: '#sendMessage'
};

// LEGACY SECTIONS - NO LONGER USED
/*
const SECTION_RENDERERS = {
    hero: renderHeroSection,
    promoGrid: renderPromoGrid,
    categorySpotlight: renderCategorySpotlights,
    brandMarquee: renderBrandMarquee,
    storeCta: renderStoreCta,
    productStrip: renderProductStrip,
    blogHighlights: renderBlogHighlights,
    custom: renderCustomSection
};
*/

// Wait for DOM and scripts to be ready (deferred scripts)
(function() {
    const initStartTime = performance.now();
    
    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleInit = (callback) => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(callback, { timeout: 2000 });
        } else {
            setTimeout(callback, 0);
        }
    };
    
    const initialize = async () => {
        try {
            if (typeof window.Logger !== 'undefined') {
                window.Logger.info('Page loaded, initializing...');
            } else {
                console.log('Page loaded, initializing...');
            }
            
            // Wait for homepage-sections.js to load if needed
            let loadSectionsPromise = Promise.resolve();
            if (typeof window.loadAndRenderHomepageSections === 'function') {
                console.log('loadAndRenderHomepageSections function found, calling it...');
                loadSectionsPromise = window.loadAndRenderHomepageSections().catch(err => {
                    console.error('Error loading homepage sections:', err);
                    return Promise.resolve(); // Don't block other initialization
                });
            } else {
                // Wait a bit for homepage-sections.js to load (if scripts are still loading)
                console.warn('loadAndRenderHomepageSections not available yet, waiting...');
                loadSectionsPromise = new Promise((resolve) => {
                    let attempts = 0;
                    const checkFunction = setInterval(() => {
                        attempts++;
                        if (typeof window.loadAndRenderHomepageSections === 'function') {
                            clearInterval(checkFunction);
                            console.log('loadAndRenderHomepageSections now available, loading sections...');
                            window.loadAndRenderHomepageSections().then(resolve).catch(err => {
                                console.error('Error loading homepage sections:', err);
                                resolve(); // Don't block
                            });
                        } else if (attempts > 50) {
                            // Give up after 5 seconds (50 * 100ms)
                            clearInterval(checkFunction);
                            console.error('loadAndRenderHomepageSections not available after waiting. Make sure homepage-sections.js is loaded before main.js.');
                            resolve();
                        }
                    }, 100);
                });
            }
            
            // Load critical content first (above fold) - don't wait for everything
            const criticalLoad = Promise.allSettled([loadSectionsPromise]);
            
            // Load banners after sections (they need sections to position correctly)
            criticalLoad.then(() => {
                if (typeof window.loadAndRenderBanners === 'function') {
                    window.loadAndRenderBanners().catch(err => console.warn('Banner loading failed:', err));
                }
            });
            
            // Load non-critical content in background (don't block page render)
            scheduleInit(() => {
                Promise.all([
                    loadDepartments().catch(err => console.warn('Departments loading failed:', err)),
                    loadCategoriesForNavbar().catch(err => console.warn('Categories loading failed:', err)),
                    loadStaticBrands().catch(err => console.warn('Brands loading failed:', err)),
                    loadCartCount().catch(err => console.warn('Cart count loading failed:', err)),
                    loadFallbackHomepageProducts().catch(err => console.warn('Homepage products loading failed:', err)),
                    loadFooter().catch(err => console.warn('Footer loading failed:', err))
                ]).then(() => {
                    // Initialize UI components after content loads
                    initialiseMessenger();
                    initialiseNewsletter();
                    initialiseGlobalDelegates();
                    initialiseMobileMenu();
                    initialiseCategoryNavLinks();
                    initializeSearch();
                }).catch(err => console.warn('Content loading error:', err));
            });
            
            await criticalLoad;
            
            const initDuration = performance.now() - initStartTime;
            const successMsg = `Initialization complete in ${initDuration.toFixed(2)}ms.`;
            
            if (typeof window.Logger !== 'undefined') {
                window.Logger.info(successMsg, { duration: initDuration });
            } else {
                console.log(successMsg);
            }
        } catch (error) {
            const errorMsg = 'Error initialising homepage';
            if (typeof window.Logger !== 'undefined') {
                window.Logger.error(errorMsg, error, {});
            } else {
                console.error(errorMsg, error);
            }
        }
    };
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM already loaded
        scheduleInit(initialize);
    }
})();

// Also attach event listeners immediately (in case DOMContentLoaded already fired)
if (document.readyState === 'loading') {
    // DOM hasn't finished loading yet, wait for DOMContentLoaded
    if (typeof window.Logger !== 'undefined') {
        window.Logger.debug('Waiting for DOM to load...');
    } else {
    console.log('Waiting for DOM to load...');
    }
} else {
    // DOM is already loaded, attach listeners now
    if (typeof window.Logger !== 'undefined') {
        window.Logger.debug('DOM already loaded, attaching listeners immediately...');
    } else {
    console.log('DOM already loaded, attaching listeners immediately...');
    }
    initialiseGlobalDelegates();
    initialiseMobileMenu();
    initialiseCategoryNavLinks();
    // Load footer immediately if DOM is ready
    if (typeof loadFooter === 'function') {
        loadFooter();
    }
}

// Mobile menu handlers (responsive navbar)
function initialiseMobileMenu() {
    try {
        // Check if jQuery is available
        if (typeof $ === 'undefined' || typeof jQuery === 'undefined') {
            console.warn('jQuery is not loaded. Mobile menu initialization will be skipped.');
            // Retry after a short delay if jQuery might still be loading
            setTimeout(() => {
                if (typeof $ !== 'undefined') {
                    initialiseMobileMenu();
                }
            }, 100);
            return;
        }
        
        const toggle = document.querySelector('.js-mobile-menu');
        const panel = document.getElementById('mobileMenuPanel');
        const closeBtn = panel ? panel.querySelector('.mobile-menu-close') : null;

        if (!toggle || !panel) {
            return;
        }

        // Load menu items immediately to ensure they're available
        loadMobileMenu();

        const openMenu = () => {
            // Ensure menu is loaded before opening
            if (!panel.dataset.loaded) {
                loadMobileMenu();
                panel.dataset.loaded = 'true';
            }
            panel.classList.add('active');
            document.body.classList.add('mobile-menu-open');
        };

        const closeMenu = () => {
            panel.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
        };

        // Remove any existing event listeners by using namespaced events
        // Use event delegation on document to prevent duplicate handlers
        $(document).off('click.mobileMenuToggle').on('click.mobileMenuToggle', '.js-mobile-menu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            if (panel.classList.contains('active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });
        
        if (closeBtn) {
            $(closeBtn).off('click.mobileMenuClose').on('click.mobileMenuClose', function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
            });
        }

        // Close when clicking outside panel (on the overlay)
        $(panel).off('click.mobileMenuOverlay').on('click.mobileMenuOverlay', function(e) {
            if (e.target === this) {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
            }
        });

        // Close menu when a link is clicked (but not dropdown toggles)
        $(panel).off('click.mobileMenuLink').on('click.mobileMenuLink', 'a', function(e) {
            const link = $(this);
            const href = link.attr('href');
            
            // Only close if it's not a dropdown toggle and has a real href
            if (href && href !== '#' && !link.hasClass('dropdown-toggle') && !link.closest('.has-children .dropdown-toggle').length) {
                closeMenu();
            }
        });
        
        // Handle dropdown expansion in mobile menu
        $(panel).off('click.mobileMenuDropdown').on('click.mobileMenuDropdown', '.mobile-menu-list .has-children > .cms-item-title', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const menuItem = $(this).closest('.menu-item.has-children');
            if (menuItem.length) {
                menuItem.toggleClass('expanded');
            }
        });
    } catch (err) {
        console.warn('Failed to initialise mobile menu', err);
    }
}

// Map static navbar category links (Makeup, Skin Care, etc.) to real category pages
async function initialiseCategoryNavLinks() {
    try {
        const links = document.querySelectorAll('.nav-category-link');
        if (!links.length) return;

        // Use cache-busting to ensure fresh data
        const categories = await fetchJSON(`/api/categories?_t=${Date.now()}`);
        if (!Array.isArray(categories) || !categories.length) return;

        const slugify = (name) =>
            (name || '')
                .toString()
                .toLowerCase()
                .replace(/&/g, 'and')
                .replace(/[^a-z0-9]+/g, '')
                .trim();

        links.forEach(link => {
            const key = link.getAttribute('data-category-key');
            if (!key) return;
            const keySlug = slugify(key);

            const match = categories.find(cat => slugify(cat.name) === keySlug);
            if (match && (match._id || match.id)) {
                const id = match._id || match.id;
                link.setAttribute('href', `/category/${id}`);
            } else {
                // Fallback: send to all products filtered view
                link.setAttribute('href', '/products');
            }
        });
    } catch (err) {
        console.warn('Failed to initialise category nav links', err);
    }
}

// Load lightweight homepage products for fallback product sections (trending / discounted / new)
async function loadFallbackHomepageProducts() {
    try {
        const fallback = document.getElementById('old-sections-fallback');
        const sectionsContainer = document.getElementById('homepage-sections-container');

        // Only load fallback products if the legacy sections are visible
        if (!fallback || !sectionsContainer || fallback.style.display === 'none') {
            return;
        }

        const response = await fetch('/api/public/products/home?limit=20');
        if (!response.ok) {
            console.warn('Failed to fetch home products:', response.status);
            return;
        }

        const data = await response.json();
        const products = Array.isArray(data) ? data : (data.products || []);
        if (!products.length) {
            return;
        }

        const sections = [
            { id: 'tradingItems', start: 0, count: 4 },
            { id: 'discountedProducts', start: 4, count: 4 },
            { id: 'newArrivals', start: 8, count: 4 }
        ];

        sections.forEach(({ id, start, count }) => {
            const container = document.getElementById(id);
            if (!container) return;

            const slice = products.slice(start, start + count);
            if (!slice.length) return;

            container.innerHTML = slice.map(renderSimpleProductCard).join('');

            // Apply fade-in
            const cards = container.querySelectorAll('.fade-in');
            requestAnimationFrame(() => {
                cards.forEach(card => card.classList.add('visible'));
            });
        });
    } catch (err) {
        console.warn('Error loading fallback homepage products', err);
    }
}

function renderSimpleProductCard(product) {
    const productId = product._id || product.id;
    const imageUrl = (product.imageUpload && product.imageUpload.url) || product.image || window.globalFallbackImage || '';
    const price = product.price || 0;
    const discount = product.discount || 0;
    const finalPrice = price * (1 - discount / 100);

    return `
        <div class="col-6 col-md-3">
            <div class="card h-100 shadow-sm product-card fade-in">
                <div class="position-relative product-img">
                    <img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(product.name || '')}">
                    ${discount > 0 ? `<span class="discount-badge">-${discount}%</span>` : ''}
                </div>
                <div class="product-info d-flex flex-column">
                    <h6 class="product-title mt-2">${htmlEscape(product.name || '')}</h6>
                    <div class="price mt-auto">
                        <span class="current-price">Rs. ${finalPrice.toFixed(2)}</span>
                        ${discount > 0 ? `<span class="old-price">Rs. ${price.toFixed(2)}</span>` : ''}
                    </div>
                    <div class="product-actions mt-2">
                        <a href="/product/${productId}" class="btn btn-outline-primary btn-sm w-100">View Details</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// LEGACY SECTIONS - NO LONGER USED
/*
async function loadSections() {
    try {
        const sections = await fetchJSON('/api/sections');
        globals.sections = Array.isArray(sections) ? sections : [];
        globals.sectionsLoaded = true;
    } catch (error) {
        globals.sectionsError = error;
        globals.sectionsLoaded = false;
        console.error('Failed to load homepage sections', error);
    }
}
*/

async function loadBanners() {
    try {
        // Get all active banners (with cache-busting to ensure fresh data)
        const banners = await fetchJSON(`/api/banners?_t=${Date.now()}`);
        if (!Array.isArray(banners) || banners.length === 0) {
            return;
        }

        // Load banners by position
        const middleBanner = document.getElementById('middleBanner');
        const topBanner = document.getElementById('topBanner');
        const bottomBanner = document.getElementById('bottomBanner');

        // Find banners by position
        const middleBannerData = banners.find(b => b.position === 'middle' && b.isActive);
        const topBannerData = banners.find(b => b.position === 'top' && b.isActive);
        const bottomBannerData = banners.find(b => b.position === 'bottom' && b.isActive);

        // Render middle banner (existing location)
        if (middleBanner && middleBannerData) {
            const middleSection = document.getElementById('middleBannerSection');
            if (middleSection) middleSection.style.display = 'block';
            renderBanner(middleBanner, middleBannerData);
        }

        // Render top banner if container exists
        if (topBanner && topBannerData) {
            const topSection = document.getElementById('topBannerSection');
            if (topSection) topSection.style.display = 'block';
            renderBanner(topBanner, topBannerData);
        }

        // Render bottom banner if container exists
        if (bottomBanner && bottomBannerData) {
            const bottomSection = document.getElementById('bottomBannerSection');
            if (bottomSection) bottomSection.style.display = 'block';
            renderBanner(bottomBanner, bottomBannerData);
        }

    } catch (error) {
        // Silently fail - banners are optional
        console.warn('Failed to load banners', error);
    }
}

function renderBanner(container, banner) {
    if (!container || !banner) return;
    
    const imageUrl = resolveImageUrl(banner);
    const link = banner.link || '#';
    
    container.innerHTML = `
        <a href="${htmlEscape(link)}" class="promo-banner__link">
            <div class="promo-banner__media" style="background-image: url('${htmlEscape(imageUrl)}');">
                <div class="promo-banner__content">
                    ${banner.title ? `<h3>${htmlEscape(banner.title)}</h3>` : ''}
                    ${banner.description ? `<p>${htmlEscape(banner.description)}</p>` : ''}
                </div>
            </div>
        </a>
    `;
}

// LEGACY SECTIONS - NO LONGER USED
/*
function renderSections() {
    if (!Array.isArray(globals.sections)) return;

    const heroContainer = document.getElementById('heroSlides');
    const heroDots = document.getElementById('heroDots');
    const categoryRibbon = document.getElementById('categoryRibbon');
    const featuredCategories = document.getElementById('featuredCategories');
    const categorySections = document.getElementById('categorySections');
    const tradingItems = document.getElementById('tradingItems');
    const discountedItems = document.getElementById('discountedProducts');
    const newItems = document.getElementById('newArrivals');
    const middleBanner = document.getElementById('middleBanner');

    heroContainer.innerHTML = '';
    heroDots.innerHTML = '';
    categoryRibbon.innerHTML = '';
    featuredCategories.innerHTML = '';
    categorySections.innerHTML = '';
    tradingItems.innerHTML = '';
    discountedItems.innerHTML = '';
    newItems.innerHTML = '';

    const groups = {
        hero: [],
        promoGrid: [],
        categorySpotlight: [],
        brandMarquee: [],
        storeCta: [],
        productStrip: [],
        blogHighlights: [],
        custom: []
    };

    globals.sections.forEach(section => {
        if (!section?.type || !SECTION_RENDERERS[section.type]) return;
        groups[section.type].push(section);
    });

    if (groups.hero.length) {
        renderHeroSection(groups.hero[0]);
    }

    if (groups.promoGrid.length) {
        renderPromoGrid(groups.promoGrid[0]);
    }

    if (groups.categorySpotlight.length) {
        renderCategorySpotlights(groups.categorySpotlight[0]);
    }

    if (groups.brandMarquee.length) {
        renderBrandMarquee(groups.brandMarquee[0]);
    }

    if (groups.storeCta.length) {
        renderStoreCta(groups.storeCta[0]);
    }

    if (groups.productStrip.length) {
        groups.productStrip.forEach(section => renderProductStrip(section));
    }

    if (groups.blogHighlights.length) {
        renderBlogHighlights(groups.blogHighlights[0]);
    }

    if (groups.custom.length) {
        groups.custom.forEach(section => renderCustomSection(section));
    }
}
*/

function renderHeroSection(section) {
    const heroContainer = document.getElementById('heroSlides');
    const heroDots = document.getElementById('heroDots');
    if (!heroContainer || !section?.data?.slides) return;

    // Filter out slides without valid images or empty/null slides
    const validSlides = section.data.slides.filter(slide => {
        // Only keep slides that have an image (required for display)
        return slide && slide.image && slide.image.trim() !== '';
    });

    // If no valid slides, don't render anything
    if (validSlides.length === 0) {
        console.warn('No valid slides found for hero section');
        return;
    }

    heroCarousel.slides = validSlides;
    heroCarousel.currentIndex = 0;

    heroContainer.innerHTML = heroCarousel.slides.map((slide, index) => {
        // Hero slider should always show navigation link, not "Add to Cart"
        // "Add to Cart" buttons should only appear on product cards
        const link = slide.link || '/products';
        const imageUrl = slide.image || globalFallbackImage;
        const isActive = index === 0 ? ' is-active' : '';
        
        return `
        <article class="hero-slide${isActive}" style="background-image: url('${htmlEscape(imageUrl)}');">
            <div class="hero-slide__overlay">
                <span class="hero-tagline">Trusted since 1975</span>
                <h1>${htmlEscape(slide.title || '')}</h1>
                <p>${htmlEscape(slide.description || '')}</p>
                <a href="${htmlEscape(link)}" class="btn btn-primary btn-lg">
                    Explore <i class="fas fa-arrow-right ms-2"></i>
                </a>
            </div>
        </article>
    `;
    }).join('');

    if (heroDots) {
        heroDots.innerHTML = heroCarousel.slides.map((_, index) => `
            <button class="hero-dot${index === 0 ? ' is-active' : ''}" data-index="${index}" aria-label="Go to slide ${index + 1}"></button>
        `).join('');
    }

    bindHeroCarouselEvents();
    
    // Initialize the slider position - ensure track is at 0
    const track = document.querySelector('.hero-carousel__track');
    if (track) {
        track.style.transform = 'translateX(0%)';
    }
    
    moveHeroSlide(0);
    startHeroAutoplay();
}

function renderPromoGrid(section) {
    if (!Array.isArray(section?.data?.items)) return;
    const container = document.querySelector('.promo-grid .row');
    if (!container) return;

    container.innerHTML = section.data.items.map(item => `
        <div class="col-lg-4 col-md-6">
            <a class="promo-card" href="${item.link || '#'}">
                <div class="promo-card__media" style="background-image: url('${htmlEscape(item.image || globalFallbackImage)}');"></div>
                <div class="promo-card__body">
                    <h5>${item.title || ''}</h5>
                    <p>${item.description || ''}</p>
                </div>
            </a>
        </div>
    `).join('');
}

function renderCategorySpotlights(section) {
    const featuredContainer = document.getElementById('featuredCategories');
    const ribbonContainer = document.getElementById('categoryRibbon');
    const sectionsContainer = document.getElementById('categorySections');
    if (!section?.data?.categories || !featuredContainer || !ribbonContainer || !sectionsContainer) return;

    const categories = section.data.categories;

    featuredContainer.innerHTML = categories.slice(0, 4).map(category => {
        const categoryId = category._id || category.id;
        return `
        <div class="col-lg-3 col-sm-6">
            <a class="category-card" href="/category/${categoryId}">
                <div class="category-img">
                    <img src="${htmlEscape(category.image || globalFallbackImage)}" alt="${htmlEscape(category.name)}">
                </div>
                <div class="category-body">
                    <h5>${category.name}</h5>
                    <p>${category.description || ''}</p>
                    <span class="category-link">Browse products <i class="fas fa-arrow-right"></i></span>
                </div>
            </a>
        </div>
    `;
    }).join('');

    ribbonContainer.innerHTML = categories.slice(0, 8).map(category => {
        const categoryId = category._id || category.id;
        return `
        <a class="category-ribbon__item" href="/category/${categoryId}">
            <div class="category-ribbon__icon">
                <img src="${htmlEscape(category.image || globalFallbackImage)}" alt="${htmlEscape(category.name)}">
            </div>
            <span>${category.name}</span>
        </a>
    `;
    }).join('');

    sectionsContainer.innerHTML = categories.map(category => {
        const categoryId = category._id || category.id;
        return `
        <section class="category-section">
            <div class="category-section__banner" style="background-image: url('${htmlEscape(category.image || globalFallbackImage)}')">
                <div class="category-section__heading">
                    <span class="eyebrow">${category.name}</span>
                    <h3>${category.name}</h3>
                    <p>${category.description || ''}</p>
                </div>
            </div>
            <div class="category-section__content">
                <div class="container">
                    <div class="section-header mb-4">
                        <div>
                            <h4 class="mb-0">${htmlEscape(category.name)} Products</h4>
                        </div>
                        <a href="/category/${categoryId}" class="btn btn-outline-primary btn-sm">
                            View all products <i class="fas fa-arrow-right ms-2"></i>
                        </a>
                    </div>
                    <div class="category-products" id="category-products-${categoryId}">
                        ${CategoryProductMarkup(category.products)}
                    </div>
                </div>
            </div>
        </section>
    `;
    }).join('');
}

function CategoryProductMarkup(products = []) {
    if (!Array.isArray(products) || !products.length) {
        return '<p class="text-muted">Products coming soon.</p>';
    }

    return products.map(product => createCategoryProductCard(product)).join('');
}

function renderBrandMarquee(section) {
    if (!Array.isArray(section?.data?.logos)) return;
    const container = document.querySelector('.brand-marquee__inner');
    if (!container) return;

    container.innerHTML = section.data.logos.map(logo => `
        <div class="brand-marquee__item"><img src="${htmlEscape(logo.image || globalFallbackImage)}" alt="${htmlEscape(logo.alt || '')}"></div>
    `).join('');
}

function renderStoreCta(section) {
    const overlay = document.querySelector('.store-cta__overlay');
    const media = document.querySelector('.store-cta__media');
    if (!overlay || !media) return;

    const data = section.data || {};
    const primaryAction = data.primaryAction || {};
    const secondaryAction = data.secondaryAction || {};

    overlay.innerHTML = `
        <span class="eyebrow">${data.eyebrow || ''}</span>
        <h2>${data.title || ''}</h2>
        <p>${data.description || ''}</p>
        <div class="store-cta__actions">
            ${primaryAction.label ? `<a href="${primaryAction.href || '#'}" class="btn btn-primary" ${primaryAction.external ? 'target="_blank" rel="noopener"' : ''}>${primaryAction.label}</a>` : ''}
            ${secondaryAction.label ? `<a href="${secondaryAction.href || '#'}" class="btn btn-outline-primary" ${secondaryAction.external ? 'target="_blank" rel="noopener"' : ''}>${secondaryAction.label}</a>` : ''}
                </div>
            `;
            
    if (data.image) {
        media.style.backgroundImage = `url('${htmlEscape(data.image)}')`;
    }
}

function renderProductStrip(section) {
    const target = (section.config?.mode || '').toLowerCase();
    let containerId = null;
    switch (target) {
        case 'trending':
            containerId = 'tradingItems';
            break;
        case 'discounted':
            containerId = 'discountedProducts';
            break;
        case 'new':
        case 'newarrival':
        case 'new-arrival':
            containerId = 'newArrivals';
            break;
        default:
            return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    const products = section.data?.products || [];
    container.innerHTML = products.map(product => createProductCard(product)).join('');
}

function renderBlogHighlights(section) {
    if (!Array.isArray(section?.data?.articles)) return;
    const container = document.querySelector('.blog-highlights .row');
    if (!container) return;

    container.innerHTML = section.data.articles.map(article => `
        <div class="col-lg-4 col-md-6">
            <article class="blog-card">
                <div class="blog-card__media" style="background-image: url('${htmlEscape(article.image || globalFallbackImage)}');"></div>
                <div class="blog-card__body">
                    ${article.tag ? `<span class="blog-card__tag">${article.tag}</span>` : ''}
                    <h5>${article.title || ''}</h5>
                    <p>${article.description || ''}</p>
                    ${article.link ? `<a href="${article.link}" class="blog-card__link">Read article</a>` : ''}
                            </div>
            </article>
                        </div>
    `).join('');
}

function renderCustomSection(section) {
    console.info('Unhandled custom section rendering', section);
}

async function loadStaticBrands() {
    try {
        console.log('Loading static brands from /api/brands/public...');
        
        // Use fetch instead of fetchJSON if it doesn't exist
        let brands;
        let response;
        
        if (typeof fetchJSON === 'function') {
            console.log('Using fetchJSON function');
            brands = await fetchJSON('/api/brands/public');
        } else {
            console.log('Using native fetch');
            response = await fetch('/api/brands/public', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Fetch response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            brands = await response.json();
        }
        
        console.log('✅ Brands received from API:', brands);
        console.log('   Type:', Array.isArray(brands) ? 'Array' : typeof brands);
        console.log('   Count:', Array.isArray(brands) ? brands.length : 'N/A');
        
        // Handle different response formats
        const brandsArray = Array.isArray(brands) ? brands : (brands.brands || brands.data || []);
        
        if (!Array.isArray(brandsArray) || brandsArray.length === 0) {
            console.log('No brands found, hiding section');
            // Hide the section if no brands are available
            const staticBrandSection = document.getElementById('static-brand-section');
            if (staticBrandSection) {
                staticBrandSection.style.display = 'none';
            }
            return;
        }
        
        const brandContainer = document.getElementById('static-brand-marquee');
        const staticBrandSection = document.getElementById('static-brand-section');
        
        if (!brandContainer) {
            console.warn('Brand marquee container not found');
            return;
        }
        
        if (!staticBrandSection) {
            console.warn('Static brand section not found');
            return;
        }
        
        // Clear existing content
        brandContainer.innerHTML = '';
        
        // Add brands to the container
        brandsArray.forEach(brand => {
            let logoUrl = brand.image || '';
            const brandName = brand.name || brand.alt || 'Brand';
            const brandAlt = brand.alt || brandName;
            const brandLink = brand.link || '';
            
            // Clean up the image URL
            if (logoUrl) {
                logoUrl = String(logoUrl).trim();
                // Remove any invalid values
                if (logoUrl === 'null' || logoUrl === 'undefined' || logoUrl === '') {
                    console.warn('Brand has invalid image URL:', brandName, logoUrl);
                    logoUrl = '';
                }
            }
            
            if (!logoUrl) {
                console.warn('Brand missing image URL:', brandName);
                return; // Skip brands without images
            }
            
            try {
                console.log('Adding brand:', String(brandName || ''), 'with image:', String(logoUrl || ''));
            } catch (err) {
                console.log('Adding brand with image');
            }
            
            const brandItem = document.createElement('div');
            brandItem.className = 'brand-marquee__item';
            
            const img = document.createElement('img');
            img.src = logoUrl;
            img.alt = brandAlt;
            img.loading = 'lazy';
            
            // Add error handler
            img.onerror = function() {
                try {
                    console.error('❌ Failed to load brand image:', String(logoUrl || ''), 'for brand:', String(brandName || ''));
                } catch (err) {
                    console.error('❌ Failed to load brand image');
                }
                // Hide broken image and remove item
                this.style.display = 'none';
                const parent = this.closest('.brand-marquee__item');
                if (parent && parent.parentNode) {
                    try {
                        console.warn('Removing brand item due to image load failure:', String(brandName || ''));
                    } catch (err) {
                        console.warn('Removing brand item due to image load failure');
                    }
                    parent.parentNode.removeChild(parent);
                }
            };
            
            // Add success handler
            img.onload = function() {
                try {
                    console.log('✅ Loaded brand image:', String(brandName || ''), 'from:', String(logoUrl || ''));
                } catch (err) {
                    console.log('✅ Loaded brand image successfully');
                }
            };
            
            if (brandLink) {
                const link = document.createElement('a');
                link.href = brandLink;
                link.target = '_blank';
                link.rel = 'noopener';
                link.appendChild(img);
                brandItem.appendChild(link);
            } else {
                brandItem.appendChild(img);
            }
            
            brandContainer.appendChild(brandItem);
        });
        
        // Show the section if brands were loaded
        if (brandsArray.length > 0) {
            staticBrandSection.style.display = 'block';
            console.log(`Successfully loaded ${brandsArray.length} brand logos`);
        } else {
            staticBrandSection.style.display = 'none';
        }
        
        if (typeof window.Logger !== 'undefined') {
            window.Logger.info(`Loaded ${brandsArray.length} brand logos`);
        }
    } catch (error) {
        console.error('Failed to load brands:', error);
        // Hide the section on error
        const staticBrandSection = document.getElementById('static-brand-section');
        if (staticBrandSection) {
            staticBrandSection.style.display = 'none';
        }
    }
}

async function loadDepartments() {
    try {
        // Use cache-busting to ensure fresh data
        const departments = await fetchJSON(`/api/departments?_t=${Date.now()}`);
        if (!Array.isArray(departments) || departments.length === 0) {
            if (typeof window.Logger !== 'undefined') {
                window.Logger.warn('No departments found');
            } else {
                console.warn('No departments found');
            }
            return;
        }
        
            const menu = document.getElementById('departmentsMenu');
            const showcase = document.getElementById('departmentsShowcase');
        const footerDepartments = document.getElementById('footerDepartments');

        if (menu) {
            // New professional mega menu structure
            menu.innerHTML = `
                <div class="mega-menu-content">
                    ${departments.map(dept => {
                        const deptId = dept._id || dept.id;
                        return `
                        <div class="mega-menu-column">
                            <div class="mega-menu-category">
                                <h3 class="mega-menu-category-title">
                                    <a href="/department/${deptId}">${htmlEscape(dept.name)}</a>
                                </h3>
                                <ul class="mega-menu-subcategories">
                                    <!-- Subcategories will be loaded here if available -->
                                </ul>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
            `;

            const msg = `✓ Loaded ${departments.length} departments into navbar`;
            if (typeof window.Logger !== 'undefined') {
                window.Logger.info(msg, { count: departments.length });
            } else {
                console.log(msg);
            }
        }
        
        // Also load categories for navbar dropdowns
        await loadCategoriesForNavbar();

        if (showcase) {
            showcase.innerHTML = departments.map(dept => {
                const deptId = dept._id || dept.id;
                return `
                <div class="col-lg-3 col-md-4 col-sm-6">
                    <div class="department-card">
                        <div class="department-media">
                            <img src="${htmlEscape(resolveImageUrl(dept))}" alt="${htmlEscape(dept.name)}">
                        </div>
                        <div class="department-body">
                            <h5>${htmlEscape(dept.name)}</h5>
                            <p>${htmlEscape(dept.description || '')}</p>
                            <a href="/department/${deptId}" class="btn btn-outline-primary btn-sm">View Categories</a>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        }

        // Load departments in footer
        if (footerDepartments) {
            footerDepartments.innerHTML = departments.slice(0, 6).map(dept => {
                const deptId = dept._id || dept.id;
                return `
                <li><a href="/department/${deptId}">${htmlEscape(dept.name)}</a></li>
            `;
            }).join('');
        }
    } catch (error) {
        const errorMsg = 'Error loading departments';
        if (typeof window.Logger !== 'undefined') {
            window.Logger.error(errorMsg, error, {});
        } else {
            console.error(errorMsg, error);
        }
    }
}

// Load all categories and display them in the navbar
let categoriesLoading = false; // Prevent duplicate calls
async function loadCategoriesForNavbar() {
    // Prevent multiple simultaneous calls
    if (categoriesLoading) {
        console.log('Categories already loading, skipping...');
        return;
    }
    
    try {
        categoriesLoading = true;
        
        // Use cache-busting to ensure fresh data
        const categories = await fetchJSON(`/api/categories?_t=${Date.now()}`);
        if (!Array.isArray(categories) || categories.length === 0) {
            categoriesLoading = false;
            return;
        }
        
        // Get the main menu container (new professional navbar structure)
        const mainMenu = document.getElementById('menu-main-menu');
        if (!mainMenu) {
            console.warn('Navbar menu container not found');
            categoriesLoading = false;
            return;
        }
        
        // Filter only active categories, exclude "11.11 Sale" to avoid duplicate with static link
        const activeCategories = categories
            .filter(cat => {
                // Must have an ID
                if (!cat._id && !cat.id) {
                    console.warn('Category without ID filtered out:', cat);
                    return false;
                }
                // Must be active
                if (cat.isActive === false) return false;
                // Exclude categories that match the static "11.11 Sale" link
                const catName = (cat.name || '').toLowerCase().trim();
                const isSaleCategory = catName.includes('11.11 sale') || catName.includes('11.11sale') || catName === 'sale';
                if (isSaleCategory) {
                    console.log('Filtered out sale category to avoid duplicate:', catName);
                }
                return !isSaleCategory;
            })
            .sort((a, b) => {
                // Sort by ordering first (lower numbers first), then by name
                const orderingA = a.ordering !== undefined ? a.ordering : 0;
                const orderingB = b.ordering !== undefined ? b.ordering : 0;
                if (orderingA !== orderingB) {
                    return orderingA - orderingB;
                }
                // If ordering is the same, sort by name
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        
        console.log(`Loaded ${activeCategories.length} categories from database (excluding Sale):`, 
            activeCategories.map(c => c.name));
        
        // Clear existing category menu items (keep only static items: Sale)
        // Find and preserve static items before clearing
        const staticItems = [];
        
        // Find Sale link (support both .nav-item and .menu-item structures)
        const saleItem = mainMenu.querySelector('a[href="/products.html?filter=discounted"]')?.closest('.nav-item') || 
                        mainMenu.querySelector('a[href="/products.html?filter=discounted"]')?.closest('.menu-item') ||
                        mainMenu.querySelector('.nav-item:first-child') ||
                        mainMenu.querySelector('.menu-item:first-child');
        
        // Store static items (only Sale - Shop and Blog removed)
        if (saleItem && saleItem.querySelector('a[href="/products.html?filter=discounted"]')) {
            staticItems.push(saleItem);
        }
        
        // Clear ALL menu items (including any old/dynamic categories)
        mainMenu.innerHTML = '';
        
        // Restore only static items (Sale only)
        staticItems.forEach(item => {
            // Clone the item to avoid any references to removed elements
            const clonedItem = item.cloneNode(true);
            mainMenu.appendChild(clonedItem);
        });
        
        // Load subcategories for all categories
        const subcategoriesMap = new Map();
        let saleCategoryId = null;
        let saleCategorySubcategories = [];
        
        try {
            // Use cache-busting to ensure fresh subcategories data
            const subcategories = await fetchJSON(`/api/subcategories?_t=${Date.now()}`);
            console.log('Loaded subcategories:', subcategories.length, subcategories);
            if (Array.isArray(subcategories)) {
                subcategories.forEach(subcat => {
                    // Handle both populated object and ObjectId string
                    let catId = null;
                    
                    // Try multiple ways to extract category ID
                    if (subcat.category) {
                        // Case 1: Populated object with _id
                        if (typeof subcat.category === 'object' && subcat.category._id) {
                            catId = subcat.category._id.toString();
                        }
                        // Case 2: String ID
                        else if (typeof subcat.category === 'string') {
                            catId = subcat.category;
                        }
                        // Case 3: Object with _id property (nested)
                        else if (subcat.category._id) {
                            catId = subcat.category._id.toString();
                        }
                    }
                    
                    // Also check if category is stored directly as an ID field
                    if (!catId && subcat.categoryId) {
                        catId = subcat.categoryId.toString();
                    }
                    
                    if (catId) {
                        // Convert to string for consistent comparison
                        const catIdStr = catId.toString();
                        if (!subcategoriesMap.has(catIdStr)) {
                            subcategoriesMap.set(catIdStr, []);
                        }
                        subcategoriesMap.get(catIdStr).push(subcat);
                        console.log(`✓ Mapped subcategory "${subcat.name}" (ID: ${subcat._id || subcat.id}) to category ID: ${catIdStr}`);
                    } else {
                        console.warn('⚠ Subcategory missing category ID:', {
                            subcategoryName: subcat.name,
                            subcategoryId: subcat._id || subcat.id,
                            categoryField: subcat.category,
                            fullSubcategory: subcat
                        });
                    }
                });
            }
            
            console.log('📋 Subcategories map summary:', Array.from(subcategoriesMap.entries()).map(([id, subs]) => 
                `Category ${id}: ${subs.length} subcategories (${subs.map(s => s.name).join(', ')})`
            ));
            
            // Find the "11.11 Sale" category to check for subcategories
            const saleCategory = categories.find(cat => {
                const catName = (cat.name || '').toLowerCase().trim();
                return catName.includes('11.11 sale') || catName.includes('11.11sale') || catName === 'sale';
            });
            
            if (saleCategory) {
                saleCategoryId = saleCategory._id || saleCategory.id;
                saleCategorySubcategories = subcategoriesMap.get(saleCategoryId) || [];
                
                // If "11.11 Sale" category has subcategories, add dropdown to static link
                if (saleCategorySubcategories.length > 0) {
                    // Support both .menu-item and .nav-item structures
                    const saleLink = mainMenu.querySelector('.menu-item:first-child .cms-item-title, .nav-item:first-child .nav-link');
                    if (saleLink) {
                        // Convert static link to dropdown (but keep it clickable)
                        const saleMenuItem = saleLink.closest('.menu-item, .nav-item');
                        const useMenuItemClass = saleMenuItem && saleMenuItem.classList.contains('menu-item');
                        
                        if (saleMenuItem) {
                            if (useMenuItemClass) {
                                saleMenuItem.className = 'menu-item type_dropdown has-children';
                                saleLink.className = 'cms-item-title dropdown-toggle nav-category-link';
                                // Don't use data-bs-toggle to avoid Bootstrap preventing navigation
                                saleLink.setAttribute('aria-expanded', 'false');
                            } else {
                                saleMenuItem.className = 'nav-item nav-item-category';
                                saleLink.className = 'nav-link nav-link-dropdown';
                            }
                            
                            // Update href to point to category page instead of products filter
                            saleLink.href = `/category/${saleCategoryId}`;
                            
                            // Add dropdown arrow icon - use Font Awesome for consistency
                            // Always use the same structure: span with icon-dropdown class containing the icon
                            if (!saleLink.querySelector('.icon-dropdown')) {
                                const dropdownIcon = document.createElement('span');
                                dropdownIcon.className = 'icon-dropdown';
                                const icon = document.createElement('i');
                                // Use Font Awesome chevron-down for all dropdown icons
                                icon.className = 'fas fa-chevron-down';
                                dropdownIcon.appendChild(icon);
                                saleLink.appendChild(dropdownIcon);
                            }
                            
                            // Create dropdown menu
                            let dropdownMenu = saleMenuItem.querySelector('.category-dropdown, .dropdown-menu');
                            if (!dropdownMenu) {
                                if (useMenuItemClass) {
                                    dropdownMenu = document.createElement('ul');
                                    dropdownMenu.className = 'dropdown-menu sub-menu';
                                } else {
                                    dropdownMenu = document.createElement('div');
                                    dropdownMenu.className = 'category-dropdown';
                                }
                                dropdownMenu.setAttribute('aria-labelledby', `category-${saleCategoryId}`);
                                saleMenuItem.appendChild(dropdownMenu);
                            }
                            
                            // Clear and populate dropdown
                            dropdownMenu.innerHTML = '';
                            
                            let dropdownList;
                            if (useMenuItemClass) {
                                dropdownList = dropdownMenu; // For menu-item, the ul itself is the list
                            } else {
                                dropdownList = document.createElement('ul');
                                dropdownList.className = 'category-dropdown-list';
                                dropdownMenu.appendChild(dropdownList);
                            }
                            
                            saleCategorySubcategories
                                .sort((a, b) => (a.ordering || 0) - (b.ordering || 0) || a.name.localeCompare(b.name))
                                .forEach(subcat => {
                                    const subcatId = subcat._id || subcat.id;
                                    const subcatName = subcat.name || 'Unnamed Subcategory';
                                    const subcatItem = document.createElement('li');
                                    const subcatLink = document.createElement('a');
                                    subcatLink.href = `/subcategory/${subcatId}`;
                                    
                                    if (useMenuItemClass) {
                                        subcatLink.className = 'dropdown-item';
                                        subcatLink.textContent = subcatName;
                                    } else {
                                        subcatItem.className = 'category-dropdown-item';
                                        subcatLink.className = 'category-dropdown-link';
                                        subcatLink.textContent = subcatName;
                                    }
                                    
                                    subcatItem.appendChild(subcatLink);
                                    dropdownList.appendChild(subcatItem);
                                });
                        }
                    } else {
                        // If no subcategories, just update the href to point to category page
                        const saleLinkNoSub = mainMenu.querySelector('.menu-item:first-child .cms-item-title, .nav-item:first-child .nav-link');
                        if (saleLinkNoSub && saleCategory) {
                            saleLinkNoSub.href = `/category/${saleCategoryId}`;
                        }
                    }
                } else if (saleCategory) {
                    // If "11.11 Sale" category exists but has no subcategories, update href to category page
                    const saleLinkNoSub = mainMenu.querySelector('.menu-item:first-child .cms-item-title, .nav-item:first-child .nav-link');
                    if (saleLinkNoSub) {
                        saleLinkNoSub.href = `/category/${saleCategoryId}`;
                    }
                }
            }
        } catch (error) {
            console.warn('Error loading subcategories:', error);
        }
        
        // Track added category IDs to prevent duplicates
        const addedCategoryIds = new Set();
        
        // Check which structure to use (menu-item or nav-item)
        const existingItem = mainMenu.querySelector('.menu-item, .nav-item');
        const useMenuItemClass = existingItem && existingItem.classList.contains('menu-item');
        
        // Add all categories as menu items with subcategories dropdown
        // Only add categories that are actually in the database response
        activeCategories.forEach(category => {
            // Double-check: ensure category has required fields
            if (!category._id && !category.id) {
                console.warn('Skipping category without ID:', category);
                return;
            }
            
            const catId = category._id || category.id;
            
            // Skip if already added (prevent duplicates)
            if (addedCategoryIds.has(catId)) {
                console.warn('Skipping duplicate category:', category.name);
                return;
            }
            addedCategoryIds.add(catId);
            
            const catName = category.name || 'Unnamed Category';
            // Ensure we're comparing string IDs - try multiple formats
            const catIdStr = catId.toString();
            let subcategories = subcategoriesMap.get(catIdStr) || [];
            
            // If no subcategories found, try with different ID format (ObjectId vs string)
            if (subcategories.length === 0) {
                // Try to find by matching all possible ID formats
                for (const [mapId, subs] of subcategoriesMap.entries()) {
                    // Compare as strings
                    if (mapId.toString() === catIdStr || mapId === catIdStr) {
                        subcategories = subs;
                        console.log(`✓ Found subcategories for "${catName}" using alternative ID match: ${mapId}`);
                        break;
                    }
                }
            }
            
            const hasSubcategories = subcategories.length > 0;
            
            if (hasSubcategories) {
                console.log(`✓ Category "${catName}" (ID: ${catIdStr}) has ${subcategories.length} subcategories:`, 
                    subcategories.map(s => s.name));
            } else {
                console.log(`⊘ Category "${catName}" (ID: ${catIdStr}) has no subcategories`);
            }
            
            // Create menu item (support both .nav-item and .menu-item structures)
            const menuItem = document.createElement('li');
            
            if (hasSubcategories) {
                menuItem.className = useMenuItemClass ? 'menu-item type_dropdown has-children' : 'nav-item nav-item-category';
            } else {
                menuItem.className = useMenuItemClass ? 'menu-item' : 'nav-item';
            }
            
            // Create link
            const link = document.createElement('a');
            link.href = `/category/${catId}`;
            if (useMenuItemClass) {
                link.className = hasSubcategories ? 'cms-item-title dropdown-toggle nav-category-link' : 'cms-item-title nav-category-link';
            } else {
                link.className = hasSubcategories ? 'nav-link nav-link-dropdown' : 'nav-link';
            }
            link.setAttribute('data-category-key', catName.toLowerCase().replace(/\s+/g, '-'));
            link.textContent = catName;
            
            // Add dropdown toggle attributes for Bootstrap if using menu-item structure
            // But we'll handle clicks manually to allow navigation
            if (hasSubcategories && useMenuItemClass) {
                // Don't use data-bs-toggle to avoid Bootstrap preventing navigation
                // We'll handle dropdown via CSS hover and manual click handlers
                link.setAttribute('aria-expanded', 'false');
            }
            
            if (hasSubcategories) {
                // Add dropdown arrow icon - use Font Awesome for consistency
                // Always use the same structure: span with icon-dropdown class containing the icon
                const dropdownIcon = document.createElement('span');
                dropdownIcon.className = 'icon-dropdown';
                const icon = document.createElement('i');
                // Use Font Awesome chevron-down for all dropdown icons
                icon.className = 'fas fa-chevron-down';
                dropdownIcon.appendChild(icon);
                link.appendChild(dropdownIcon);
                
                // Create dropdown menu (support both structures)
                let dropdownMenu;
                if (useMenuItemClass) {
                    // Bootstrap dropdown structure for .menu-item
                    dropdownMenu = document.createElement('ul');
                    dropdownMenu.className = 'dropdown-menu sub-menu';
                    dropdownMenu.setAttribute('aria-labelledby', `category-${catId}`);
                } else {
                    // Custom dropdown structure for .nav-item
                    dropdownMenu = document.createElement('div');
                    dropdownMenu.className = 'category-dropdown';
                    dropdownMenu.setAttribute('aria-labelledby', `category-${catId}`);
                    
                    const dropdownList = document.createElement('ul');
                    dropdownList.className = 'category-dropdown-list';
                    dropdownMenu.appendChild(dropdownList);
                }
                
                // Sort subcategories
                const subcategoriesSorted = subcategories.sort((a, b) => 
                    (a.ordering || 0) - (b.ordering || 0) || a.name.localeCompare(b.name)
                );
                
                // Add each subcategory as a list item
                subcategoriesSorted.forEach(subcat => {
                    const subcatId = subcat._id || subcat.id;
                    const subcatName = subcat.name || 'Unnamed Subcategory';
                    const subcatItem = document.createElement('li');
                    const subcatLink = document.createElement('a');
                    subcatLink.href = `/subcategory/${subcatId}`;
                    
                    if (useMenuItemClass) {
                        subcatItem.className = '';
                        subcatLink.className = 'dropdown-item';
                        subcatLink.textContent = subcatName;
                    } else {
                        subcatItem.className = 'category-dropdown-item';
                        subcatLink.className = 'category-dropdown-link';
                        subcatLink.textContent = subcatName.toUpperCase();
                    }
                    
                    subcatItem.appendChild(subcatLink);
                    
                    if (useMenuItemClass) {
                        dropdownMenu.appendChild(subcatItem);
                    } else {
                        dropdownMenu.querySelector('.category-dropdown-list').appendChild(subcatItem);
                    }
                });
                
                // Verify dropdown was created with items
                if (subcategoriesSorted.length > 0) {
                    console.log(`✓ Created dropdown menu for "${catName}" with ${subcategoriesSorted.length} subcategories`);
                } else {
                    console.warn(`⚠ Dropdown menu for "${catName}" is empty!`);
                }
                
                menuItem.appendChild(link);
                menuItem.appendChild(dropdownMenu);
            } else {
                menuItem.appendChild(link);
            }
            
            mainMenu.appendChild(menuItem);
        });
        
        // Re-initialize category links after adding them
        await initialiseCategoryNavLinks();
        
        // Allow category links to be clickable even when they have dropdowns
        // In the new professional navbar, links are always clickable and dropdowns show on hover
        const dropdownLinks = mainMenu.querySelectorAll('.nav-link-dropdown, .dropdown-toggle.nav-category-link');
        dropdownLinks.forEach(link => {
            // Links are clickable - dropdowns show on hover via CSS
            link.addEventListener('click', function(e) {
                // Only prevent default if clicking on the dropdown icon itself
                const iconDropdown = link.querySelector('.icon-dropdown');
                if (iconDropdown && (e.target === iconDropdown || iconDropdown.contains(e.target))) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
                // Otherwise, allow navigation to category page
                // Remove Bootstrap dropdown behavior to allow normal link navigation
                if (link.hasAttribute('data-bs-toggle')) {
                    // Don't prevent default - allow the link to navigate
                }
            }, true);
        });
        
        if (typeof window.Logger !== 'undefined') {
            window.Logger.info(`Loaded ${activeCategories.length} categories into navbar`);
        } else {
            console.log(`Loaded ${activeCategories.length} categories into navbar`);
        }
        
        categoriesLoading = false;
    } catch (error) {
        categoriesLoading = false;
        if (typeof window.Logger !== 'undefined') {
            window.Logger.warn('Error loading categories for navbar', { error: error.message });
        } else {
            console.warn('Error loading categories for navbar:', error);
        }
    }
}

function resolveImageUrl(entity) {
    if (!entity) return globalFallbackImage;
    if (entity.imageUpload && entity.imageUpload.url) return entity.imageUpload.url;
    if (entity.image) return entity.image;
    return globalFallbackImage;
}

function createProductCard(product) {
    if (!product) return '';

    // Extract product ID - handle both string and object formats
    let productId = '';
    if (product._id) {
        productId = typeof product._id === 'string' ? product._id : product._id.toString();
    } else if (product.id) {
        productId = typeof product.id === 'string' ? product.id : product.id.toString();
    }
    
    if (!productId) {
        console.error('Product missing ID:', product);
        return ''; // Don't render card if no ID
    }
    
    const name = htmlEscape(product.name || 'Product');
    const image = htmlEscape(product.image || globalFallbackImage);
    const discount = Number(product.discount) || 0;
    const priceValue = Number(product.price);
    const hasNumericPrice = !Number.isNaN(priceValue);
    const finalPrice = hasNumericPrice
        ? (discount > 0 ? priceValue * (1 - discount / 100) : priceValue)
        : null;

    const priceMarkup = hasNumericPrice
        ? `
            <div class="product-price">
                ${discount > 0
                    ? `<span class="product-price__current">Rs. ${finalPrice.toFixed(2)}</span>
                       <span class="product-price__old">Rs. ${priceValue.toFixed(2)}</span>`
                    : `<span class="product-price__current">Rs. ${priceValue.toFixed(2)}</span>`}
            </div>
        `
        : '';
    
    return `
        <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="product-card">
                <div class="product-img">
                    <img src="${image}" alt="${name}">
                </div>
                <div class="product-body">
                    <h6>${name}</h6>
                    ${product.category?.name ? `<span class="product-meta">${htmlEscape(product.category.name)}</span>` : ''}
                    ${priceMarkup}
                    <div class="product-actions">
                        <a href="/product/${htmlEscape(productId)}" class="btn btn-outline-primary btn-sm view-product" data-id="${htmlEscape(productId)}">View</a>
                        <button type="button" class="btn btn-primary btn-sm add-to-cart" data-id="${htmlEscape(productId)}" data-product-id="${htmlEscape(productId)}">Add to cart</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createCategoryProductCard(product) {
    if (!product) return '';

    // Extract product ID - handle both string and object formats
    let productId = '';
    if (product._id) {
        productId = typeof product._id === 'string' ? product._id : product._id.toString();
    } else if (product.id) {
        productId = typeof product.id === 'string' ? product.id : product.id.toString();
    }
    
    if (!productId) {
        console.error('Product missing ID in category card:', product);
        return ''; // Don't render card if no ID
    }
    
    const name = htmlEscape(product.name || 'Product');
    const image = htmlEscape(product.image || globalFallbackImage);
    const priceValue = Number(product.price);
    const hasNumericPrice = !Number.isNaN(priceValue);

    return `
        <div class="product-card category-card-lite">
            <div class="product-img">
                <img src="${image}" alt="${name}">
            </div>
            <div class="product-body">
                <h6>${name}</h6>
                ${hasNumericPrice ? `<span class="product-price__current">Rs. ${priceValue.toFixed(2)}</span>` : ''}
                <div class="product-actions">
                    <a href="/product/${htmlEscape(productId)}" class="btn btn-outline-primary btn-sm view-product" data-id="${htmlEscape(productId)}">View</a>
                    <button type="button" class="btn btn-primary btn-sm add-to-cart" data-id="${htmlEscape(productId)}" data-product-id="${htmlEscape(productId)}">Add to cart</button>
                </div>
            </div>
        </div>
    `;
}

function bindHeroCarouselEvents() {
    const prevButton = document.querySelector('.hero-carousel__nav--prev');
    const nextButton = document.querySelector('.hero-carousel__nav--next');
    const dotsContainer = document.getElementById('heroDots');

    if (prevButton) {
        prevButton.onclick = () => {
            moveHeroSlide(heroCarousel.currentIndex - 1);
            restartHeroAutoplay();
        };
    }

    if (nextButton) {
        nextButton.onclick = () => {
            moveHeroSlide(heroCarousel.currentIndex + 1);
            restartHeroAutoplay();
        };
    }

    if (dotsContainer) {
        dotsContainer.onclick = event => {
            const target = event.target.closest('.hero-dot');
            if (!target) return;
            const index = Number(target.dataset.index);
            if (!Number.isNaN(index)) {
                moveHeroSlide(index);
                restartHeroAutoplay();
            }
        };
    }
}

function moveHeroSlide(targetIndex) {
    const slideCount = heroCarousel.slides.length;
    if (!slideCount) return;

    const normalizedIndex = (targetIndex + slideCount) % slideCount;
    heroCarousel.currentIndex = normalizedIndex;

    const slideElements = document.querySelectorAll('.hero-slide');
    const dotElements = document.querySelectorAll('.hero-dot');
    const track = document.querySelector('.hero-carousel__track');

    // Move the track container - this is the correct approach for flexbox layout
    if (track) {
        // Calculate the percentage to move (negative because we're moving left)
        const translateX = -normalizedIndex * 100;
        track.style.transform = `translateX(${translateX}%)`;
    }

    // Remove any individual slide transforms (they shouldn't have any)
    slideElements.forEach((slide) => {
        slide.style.transform = '';
        slide.style.left = '';
        slide.style.right = '';
    });

    // Update slide active states
    slideElements.forEach((slide, index) => {
        slide.classList.toggle('is-active', index === normalizedIndex);
    });

    // Update dot active states
    dotElements.forEach((dot, index) => {
        dot.classList.toggle('is-active', index === normalizedIndex);
    });
}

function startHeroAutoplay() {
    stopHeroAutoplay();
    if (heroCarousel.slides.length <= 1) return;

    heroCarousel.timer = window.setInterval(() => {
        moveHeroSlide(heroCarousel.currentIndex + 1);
    }, heroCarousel.delay);
}

function stopHeroAutoplay() {
    if (heroCarousel.timer) {
        window.clearInterval(heroCarousel.timer);
        heroCarousel.timer = null;
    }
}

function restartHeroAutoplay() {
    stopHeroAutoplay();
    startHeroAutoplay();
}

function initialiseMessenger() {
    const toggle = document.querySelector(messengerSelectors.toggle);
    const windowPanel = document.querySelector(messengerSelectors.window);
    const closeButton = document.querySelector(messengerSelectors.close);
    const sendButton = document.querySelector(messengerSelectors.send);
    const input = document.querySelector(messengerSelectors.input);

    toggle?.addEventListener('click', () => {
        windowPanel?.classList.toggle('active');
    });

    closeButton?.addEventListener('click', () => {
        windowPanel?.classList.remove('active');
    });

    sendButton?.addEventListener('click', () => {
        const message = input?.value.trim();
        if (!message) return;

        addUserMessage(message);
        if (input) input.value = '';

        window.setTimeout(() => {
            const aiResponse = generateAIResponse(message);
            addBotMessage(aiResponse);
        }, 1000);
    });

    input?.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendButton?.click();
        }
    });
}

function initialiseNewsletter() {
    const form = document.querySelector('.newsletter-form');
    if (!form) return;

    form.addEventListener('submit', event => {
        event.preventDefault();
        const emailInput = form.querySelector('input[type="email"]');
        const email = emailInput?.value.trim();
        if (!email) return;

        alert(`Thank you for subscribing with email: ${email}`);
        if (emailInput) emailInput.value = '';
    });
}

// Global search functionality
let searchTimeout = null;
let currentSearchAbortController = null;

function initializeSearch() {
    const headerSearchInput = document.getElementById('headerSearchInput');
    const searchPopupInput = document.getElementById('searchInput');
    
    if (headerSearchInput) {
        setupSearchInput(headerSearchInput, 'headerSearchDropdown');
    }
    
    if (searchPopupInput) {
        setupSearchInput(searchPopupInput, 'searchPopupDropdown');
    }
}

function setupSearchInput(input, dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Debounced search on input
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Cancel previous request
        if (currentSearchAbortController) {
            currentSearchAbortController.abort();
        }
        
        if (query.length < 2) {
            dropdown.innerHTML = '';
            dropdown.classList.remove('active');
            return;
        }
        
        // Debounce search
        searchTimeout = setTimeout(() => {
            performSearch(query, dropdown);
        }, 300);
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
    
    // Handle keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const firstItem = dropdown.querySelector('.search-result-item');
            if (firstItem) {
                firstItem.focus();
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('active');
            input.blur();
        }
    });
    
    // Allow Enter to submit form if no results are focused
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !dropdown.querySelector('.search-result-item:focus')) {
            // Let form submit normally
            return true;
        }
    });
}

async function performSearch(query, dropdown) {
    if (!query || query.length < 2) {
        dropdown.innerHTML = '';
        dropdown.classList.remove('active');
        return;
    }
    
    // Show loading state
    dropdown.innerHTML = '<div class="search-loading">Searching...</div>';
    dropdown.classList.add('active');
    
    // Create new abort controller
    currentSearchAbortController = new AbortController();
    
    try {
        const searchUrl = `/api/search?q=${encodeURIComponent(query)}&limit=10`;
        console.log('🔍 Frontend: Searching for:', query);
        console.log('🔍 Frontend: Search URL:', searchUrl);
        
        const response = await fetch(searchUrl, {
            signal: currentSearchAbortController.signal
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('🔍 Search API error:', response.status, errorText);
            throw new Error(`Search failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('🔍 Frontend: Search results:', data);
        console.log('🔍 Frontend: Products found:', data.products?.length || 0);
        console.log('🔍 Frontend: Total results:', data.total || 0);
        
        renderSearchResults(data, dropdown);
    } catch (error) {
        if (error.name === 'AbortError') {
            // Request was cancelled, ignore
            console.log('🔍 Search cancelled');
            return;
        }
        console.error('🔍 Search error:', error);
        dropdown.innerHTML = '<div class="search-error">Error searching. Please try again.</div>';
        dropdown.classList.add('active');
    }
}

function renderSearchResults(data, dropdown) {
    const { products = [], categories = [], departments = [], subcategories = [], total = 0 } = data;
    
    console.log('🔍 Rendering results - Products:', products.length, 'Total:', total);
    
    if (!products || products.length === 0) {
        if (total === 0) {
            dropdown.innerHTML = '<div class="search-no-results">No results found</div>';
            dropdown.classList.add('active');
            return;
        }
    }
    
    let html = '<div class="search-results">';
    
    // Products - Show first (main focus like reference image)
    if (products && products.length > 0) {
        console.log('🔍 Rendering', products.length, 'products');
        products.forEach(product => {
            const imageUrl = product.image || window.globalFallbackImage || '';
            let priceHtml = '';
            const productPrice = product.price || 0;
            const productDiscount = product.discount || 0;
            
            if (productDiscount > 0 && productPrice > 0) {
                const originalPrice = productPrice;
                const discountedPrice = productPrice * (1 - productDiscount / 100);
                priceHtml = `
                    <div class="search-price">
                        <span class="original-price">Rs.${originalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span class="discounted-price">Rs.${discountedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                `;
            } else if (productPrice > 0) {
                priceHtml = `<div class="search-price">Rs.${productPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>`;
            } else {
                priceHtml = '<div class="search-price">Price not available</div>';
            }
            
            html += `
                <a href="${product.url}" class="search-result-item">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(product.name)}" class="search-result-image" onerror="this.src='${window.globalFallbackImage || ''}'">` : '<div class="search-result-image-placeholder"></div>'}
                    <div class="search-result-content">
                        <div class="search-result-name">${escapeHtml(product.name)}</div>
                        ${priceHtml}
                    </div>
                </a>
            `;
        });
    }
    
    // Categories - Show after products if no products found
    if (products.length === 0 && categories.length > 0) {
        categories.forEach(category => {
            const imageUrl = category.image || '';
            html += `
                <a href="${category.url}" class="search-result-item">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(category.name)}" class="search-result-image">` : '<div class="search-result-image-placeholder"></div>'}
                    <div class="search-result-content">
                        <div class="search-result-name">${escapeHtml(category.name)}</div>
                        <div class="search-result-type">Category</div>
                    </div>
                </a>
            `;
        });
    }
    
    // Departments - Show if no products or categories
    if (products.length === 0 && categories.length === 0 && departments.length > 0) {
        departments.forEach(department => {
            const imageUrl = department.image || '';
            html += `
                <a href="${department.url}" class="search-result-item">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(department.name)}" class="search-result-image">` : '<div class="search-result-image-placeholder"></div>'}
                    <div class="search-result-content">
                        <div class="search-result-name">${escapeHtml(department.name)}</div>
                        <div class="search-result-type">Department</div>
                    </div>
                </a>
            `;
        });
    }
    
    // Subcategories - Show if no other results
    if (products.length === 0 && categories.length === 0 && departments.length === 0 && subcategories.length > 0) {
        subcategories.forEach(subcategory => {
            const imageUrl = subcategory.image || '';
            html += `
                <a href="${subcategory.url}" class="search-result-item">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(subcategory.name)}" class="search-result-image">` : '<div class="search-result-image-placeholder"></div>'}
                    <div class="search-result-content">
                        <div class="search-result-name">${escapeHtml(subcategory.name)}</div>
                        <div class="search-result-type">Subcategory</div>
                    </div>
                </a>
            `;
        });
    }
    
    html += '</div>';
    dropdown.innerHTML = html;
    dropdown.classList.add('active');
    
    // Debug: Verify dropdown is visible
    console.log('🔍 Dropdown element:', dropdown);
    console.log('🔍 Dropdown has active class:', dropdown.classList.contains('active'));
    console.log('🔍 Dropdown computed display:', window.getComputedStyle(dropdown).display);
    console.log('🔍 Dropdown computed z-index:', window.getComputedStyle(dropdown).zIndex);
    console.log('🔍 Dropdown HTML length:', dropdown.innerHTML.length);
    
    // Add keyboard navigation to result items
    const resultItems = dropdown.querySelectorAll('.search-result-item');
    resultItems.forEach((item, index) => {
        item.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = resultItems[index + 1];
                if (next) next.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = resultItems[index - 1];
                if (prev) {
                    prev.focus();
                } else {
                    // Return focus to input
                    const input = dropdown.closest('.search-input-wrapper')?.querySelector('input');
                    if (input) input.focus();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                item.click();
            }
        });
        
        // Make items focusable
        item.setAttribute('tabindex', '0');
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initialiseGlobalDelegates() {
    // Use event delegation to handle dynamically created buttons
    document.addEventListener('click', async event => {
        // Debug: log what was clicked
        const target = event.target;
        const clickedElement = target.closest('button, a');
        
        // Handle search popup toggle
        const searchTrigger = event.target.closest('.push_side[data-id="#search_pupop"]');
        if (searchTrigger) {
            event.preventDefault();
            const searchPopup = document.getElementById('search_pupop');
            if (searchPopup) {
                searchPopup.classList.add('active');
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    setTimeout(() => searchInput.focus(), 100);
                }
            }
            return false;
        }

        // Handle search popup close
        const closeSearch = event.target.closest('.close-push');
        if (closeSearch) {
            const searchPopup = document.getElementById('search_pupop');
            if (searchPopup) {
                searchPopup.classList.remove('active');
            }
            return false;
        }

        // Mobile menu toggle is handled by initialiseMobileMenu() - skip here to avoid conflicts
        
        // Handle mobile menu dropdown toggles
        const mobileDropdownToggle = event.target.closest('.mobile-menu-list .dropdown-toggle');
        if (mobileDropdownToggle) {
            event.preventDefault();
            event.stopPropagation();
            const menuItem = mobileDropdownToggle.closest('.menu-item');
            if (menuItem) {
                menuItem.classList.toggle('expanded');
            }
            return false;
        }

        // Handle dropdown toggle for departments
        // Handle dropdown toggles - but allow navigation if clicking on the link text (not the icon)
        const dropdownToggle = event.target.closest('.dropdown-toggle');
        if (dropdownToggle) {
            // Only prevent default if clicking on the dropdown icon, not the link text
            const iconDropdown = dropdownToggle.querySelector('.icon-dropdown');
            if (iconDropdown && (event.target === iconDropdown || iconDropdown.contains(event.target))) {
                event.preventDefault();
                const menuItem = dropdownToggle.closest('.menu-item');
                if (menuItem) {
                    menuItem.classList.toggle('show');
                }
                return false;
            }
            // If clicking on the link text itself, allow navigation (don't prevent default)
        }

        // Close dropdowns when clicking outside
        if (!event.target.closest('.menu-item.has-children')) {
            document.querySelectorAll('.menu-item.show').forEach(item => {
                if (!item.contains(event.target)) {
                    item.classList.remove('show');
                }
            });
        }
        
        // Handle add to cart buttons (on product cards)
        const addButton = event.target.closest('.add-to-cart');
        if (addButton) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            
            // Try multiple ways to get productId
            let productId = addButton.getAttribute('data-id') || 
                           addButton.getAttribute('data-product-id') ||
                           addButton.dataset?.id || 
                           addButton.dataset?.productId;
            
            // If using jQuery, try that too
            if (!productId && typeof $ !== 'undefined') {
                const $btn = $(addButton);
                productId = $btn.attr('data-id') || $btn.attr('data-product-id') || $btn.data('id') || $btn.data('product-id');
            }
            
            console.log('Add to cart clicked, productId:', productId, 'Button:', addButton);
            console.log('Button attributes:', {
                'data-id': addButton.getAttribute('data-id'),
                'data-product-id': addButton.getAttribute('data-product-id'),
                dataset: addButton.dataset,
                innerHTML: addButton.innerHTML.substring(0, 100)
            });
            
            if (productId) {
                // Ensure productId is a string
                productId = String(productId).trim();
                if (productId && productId !== 'undefined' && productId !== 'null') {
                    try {
                        await handleAddToCart(productId);
                    } catch (error) {
                        console.error('Error in handleAddToCart:', error);
                        alert('Failed to add product to cart. Please try again.');
                    }
                } else {
                    console.error('Invalid productId after conversion:', productId);
                    alert('Invalid product ID. Cannot add to cart.');
                }
            } else {
                console.error('Add to cart button missing product ID. Button attributes:', {
                    id: addButton.id,
                    class: addButton.className,
                    dataset: addButton.dataset,
                    innerHTML: addButton.innerHTML.substring(0, 100)
                });
                alert('Unable to add product to cart. Product ID is missing.');
            }
            return false;
        }

        // Note: "Add to Cart" buttons only appear on product cards, not on sliders, banners, categories, or departments

        // Handle cart icon click - navigate to cart page
        const cartIcon = event.target.closest('.cart-icon a, .cart-block a');
        if (cartIcon && !event.target.closest('.cart-count')) {
            event.preventDefault();
            window.location.href = '/cart.html';
            return false;
        }

        // Handle view product buttons
        const viewButton = event.target.closest('.view-product');
        if (viewButton) {
            event.preventDefault();
            const productId = viewButton.dataset.id || viewButton.dataset.productId;
            if (productId) {
                handleViewProduct(productId);
            }
            return false;
        }
    }, true); // Use capture phase to catch events earlier

    // Close search popup when clicking outside
    document.addEventListener('click', event => {
        const searchPopup = document.getElementById('search_pupop');
        if (searchPopup && searchPopup.classList.contains('active')) {
            if (!searchPopup.contains(event.target) && !event.target.closest('.push_side[data-id="#search_pupop"]')) {
                searchPopup.classList.remove('active');
            }
        }
    });

    // Close search popup on ESC key
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            const searchPopup = document.getElementById('search_pupop');
            if (searchPopup && searchPopup.classList.contains('active')) {
                searchPopup.classList.remove('active');
            }
        }
    });
}

function toggleMobileMenu() {
    // Use the existing mobile menu panel from HTML
    const mobileMenu = document.getElementById('mobileMenuPanel');
    if (mobileMenu) {
        mobileMenu.classList.toggle('active');
        document.body.classList.toggle('mobile-menu-open');
    }
}

function loadMobileMenu() {
    const mobileMenuList = document.getElementById('mobileMenuList');
    if (!mobileMenuList) return;

    // Clone main menu items from desktop navigation
    const mainMenu = document.getElementById('menu-main-menu');
    if (mainMenu) {
        // Clear existing items
        mobileMenuList.innerHTML = '';
        
        // Clone each menu item
        Array.from(mainMenu.children).forEach(li => {
            const clone = li.cloneNode(true);
            
            // Fix dropdown toggles for mobile - make them expandable
            const dropdownToggle = clone.querySelector('.dropdown-toggle');
            if (dropdownToggle) {
                // Remove Bootstrap dropdown attributes
                dropdownToggle.removeAttribute('data-bs-toggle');
                dropdownToggle.removeAttribute('id');
                
                // Change href to # if it's just #
                if (dropdownToggle.getAttribute('href') === '#') {
                    dropdownToggle.setAttribute('href', '#');
                }
                
                // Add click handler for mobile expansion
                const toggleElement = dropdownToggle;
                toggleElement.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    clone.classList.toggle('expanded');
                });
            }
            
            // Remove any Bootstrap-specific classes that might interfere
            clone.querySelectorAll('[data-bs-toggle]').forEach(el => {
                el.removeAttribute('data-bs-toggle');
            });
            
            mobileMenuList.appendChild(clone);
        });
        
        // Also sync dropdown content if available
        syncMobileMenuDropdowns();
    }
}

// Sync dropdown content from desktop to mobile menu
function syncMobileMenuDropdowns() {
    // Sync Makeup categories
    const desktopMakeup = document.getElementById('makeupMenu');
    const mobileMakeup = document.getElementById('mobileMakeupMenu');
    if (desktopMakeup && mobileMakeup) {
        mobileMakeup.innerHTML = desktopMakeup.innerHTML;
    }
    
    // Sync Skincare categories
    const desktopSkincare = document.getElementById('skincareMenu');
    const mobileSkincare = document.getElementById('mobileSkincareMenu');
    if (desktopSkincare && mobileSkincare) {
        mobileSkincare.innerHTML = desktopSkincare.innerHTML;
    }
    
    // Sync Haircare categories
    const desktopHaircare = document.getElementById('haircareMenu');
    const mobileHaircare = document.getElementById('mobileHaircareMenu');
    if (desktopHaircare && mobileHaircare) {
        mobileHaircare.innerHTML = desktopHaircare.innerHTML;
    }
    
    // Sync Departments
    const desktopDepartments = document.getElementById('departmentsMenu');
    const mobileDepartments = document.getElementById('mobileDepartmentsMenu');
    if (desktopDepartments && mobileDepartments) {
        mobileDepartments.innerHTML = desktopDepartments.innerHTML;
    }
}

// Guest cart functions
function getGuestCart() {
    try {
        const cartStr = localStorage.getItem('guestCart');
        return cartStr ? JSON.parse(cartStr) : { items: [] };
    } catch (e) {
        return { items: [] };
    }
}

function saveGuestCart(cart) {
    localStorage.setItem('guestCart', JSON.stringify(cart));
}

function getGuestCartCount() {
    const cart = getGuestCart();
    return cart.items.reduce((total, item) => total + (item.quantity || 0), 0);
}

function addToGuestCart(productId, quantity = 1, price = 0, discount = 0) {
    const cart = getGuestCart();
    const existingItemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (existingItemIndex >= 0) {
        cart.items[existingItemIndex].quantity += quantity;
    } else {
        cart.items.push({
            productId: productId,
            quantity: quantity,
            price: price,
            discount: discount
        });
    }
    
    saveGuestCart(cart);
    return getGuestCartCount();
}

async function mergeGuestCartWithUserCart() {
    const guestCart = getGuestCart();
    if (!guestCart.items || guestCart.items.length === 0) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        return;
    }

    try {
        // Add each item from guest cart to user cart
        for (const item of guestCart.items) {
            try {
                await fetchJSON('/api/cart/add', {
                    method: 'POST',
                    body: {
                        productId: item.productId,
                        quantity: item.quantity
                    }
                });
            } catch (error) {
                console.error(`Failed to add product ${item.productId} to cart:`, error);
            }
        }

        // Clear guest cart after successful merge
        localStorage.removeItem('guestCart');
        await loadCartCount();
    } catch (error) {
        console.error('Failed to merge guest cart:', error);
    }
}

async function loadCartCount() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            // Show guest cart count if not logged in
            const guestCount = getGuestCartCount();
            updateCartCount(guestCount);
            return;
        }

        const response = await fetchJSON('/api/cart/count', {
            method: 'GET'
        });

        if (response && typeof response.count === 'number') {
            updateCartCount(response.count);
        }
    } catch (error) {
        // If user is not logged in or token is invalid, show guest cart count
        const guestCount = getGuestCartCount();
        updateCartCount(guestCount);
    }
}

function updateCartCount(count) {
    const cartCountEl = document.querySelector('.cart-count');
    if (cartCountEl) {
        cartCountEl.textContent = String(count || 0);
    }
}

async function handleAddToCart(productId) {
    console.log('handleAddToCart called with productId:', productId);
    
    if (!productId) {
        console.error('handleAddToCart: No productId provided');
        alert('Product ID is missing. Cannot add to cart.');
        return;
    }

    // Ensure productId is a string
    productId = String(productId).trim();
    
    if (!productId || productId === 'undefined' || productId === 'null') {
        console.error('handleAddToCart: Invalid productId:', productId);
        alert('Invalid product ID. Cannot add to cart.');
        return;
    }

    const token = localStorage.getItem('token');
    
    // If not logged in, add to guest cart
    if (!token) {
        console.log('handleAddToCart: No token found, adding to guest cart');
        
        // Fetch product details to get price
        try {
            const productResponse = await fetchJSON(`/api/public/products/${productId}`);
            if (productResponse) {
                const cartCount = addToGuestCart(
                    productId,
                    1,
                    productResponse.price || 0,
                    productResponse.discount || 0
                );
                updateCartCount(cartCount);
                alert('Product added to cart! Sign in to save your cart.');
            } else {
                alert('Product not found.');
            }
        } catch (error) {
            console.error('Error fetching product details:', error);
            // Add to guest cart with default values
            const cartCount = addToGuestCart(productId, 1, 0, 0);
            updateCartCount(cartCount);
            alert('Product added to cart! Sign in to save your cart.');
        }
        return;
    }

    console.log('handleAddToCart: Making API call with productId:', productId);

    try {
        const response = await fetchJSON('/api/cart/add', {
            method: 'POST',
            body: { 
                productId: productId, 
                quantity: 1 
            }
        });

        console.log('handleAddToCart: API response:', response);
        console.log('handleAddToCart: Response totalItems:', response?.totalItems);

        if (response && typeof response.totalItems === 'number') {
            updateCartCount(response.totalItems);
            console.log('handleAddToCart: Cart count updated to:', response.totalItems);
            alert('Product added to cart!');
        } else {
            // Fallback: reload cart count from API
            console.warn('handleAddToCart: Response missing totalItems, reloading cart count from API');
            try {
                await loadCartCount();
            } catch (countError) {
                console.error('handleAddToCart: Error loading cart count:', countError);
                // Last resort: increment manually
                const cartCountEl = document.querySelector('.cart-count');
                if (cartCountEl) {
                    const currentCount = Number(cartCountEl.textContent) || 0;
                    updateCartCount(currentCount + 1);
                }
            }
            alert('Product added to cart!');
        }
    } catch (error) {
        console.error('Add to cart failed', error);
        console.error('Error details:', {
            message: error.message,
            status: error.status,
            stack: error.stack
        });
        
        let errorMessage = 'Unable to add product to cart.';
        if (error.status === 401) {
            errorMessage = 'Please log in to add products to cart.';
            localStorage.removeItem('token');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
        } else if (error.status === 400 || error.status === 404) {
            errorMessage = error.message || 'Product not available.';
        }
        
        alert(errorMessage);
    }
}

function handleViewProduct(productId) {
    if (!productId) return;
    window.location.href = `/product/${productId}`;
}

function addUserMessage(message) {
    const container = document.querySelector(messengerSelectors.messages);
    if (!container) return;

    container.insertAdjacentHTML('beforeend', `
        <div class="message user-message">
            <p>${message}</p>
        </div>
    `);
    scrollToBottom();
}

function addBotMessage(message) {
    const container = document.querySelector(messengerSelectors.messages);
    if (!container) return;

    container.insertAdjacentHTML('beforeend', `
        <div class="message bot-message">
            <p>${message}</p>
        </div>
    `);
    scrollToBottom();
}

function scrollToBottom() {
    const messengerBody = document.querySelector(messengerSelectors.body);
    if (!messengerBody) return;
    messengerBody.scrollTop = messengerBody.scrollHeight;
}

function generateAIResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('hello') || message.includes('hi')) {
        return 'Hello! How can I help you today? You can ask me about our products, departments, or current offers.';
    }
    if (message.includes('medicine') || message.includes('medicines')) {
        return "We have a wide range of medicines for various health conditions. Our medicine department includes categories like allergy medicine, heart medicine, stomach medicine, and more. Would you like to know about any specific category?";
    }
    if (message.includes('cosmetics') || message.includes('makeup')) {
        return 'Our cosmetics department offers a variety of products including color cosmetics, skincare, and beauty accessories. We have products from top brands at competitive prices.';
    }
    if (message.includes('perfume') || message.includes('fragrance')) {
        return 'We have an extensive collection of perfumes for men and women from international brands. You can find both luxury and affordable options in our perfume department.';
    }
    if (message.includes('discount') || message.includes('offer') || message.includes('sale')) {
        return "We currently have special discounts on selected products. You can check our 'Special Offers' section on the homepage for the latest deals. Would you like to know about any specific department's offers?";
    }
    if (message.includes('delivery') || message.includes('shipping')) {
        return 'We offer home delivery across Pakistan. Standard delivery takes 3-5 working days, while express delivery takes 1-2 working days in major cities. Delivery charges may apply based on your location.';
    }
    if (message.includes('payment')) {
        return 'We accept multiple payment methods including cash on delivery, credit/debit cards, and online bank transfers. All transactions are secure and encrypted.';
    }
    if (message.includes('return') || message.includes('refund')) {
        return 'We have a 7-day return policy for most products. Items must be unused, in original packaging, and accompanied by the receipt. Some restrictions apply to medicines and personal care items.';
    }
    return 'Thank you for your message. For more specific information, you can browse our departments or contact our customer service at +92 300 1234567. Is there anything else I can help you with?';
}

function fetchOptionsFrom({ method = 'GET', body, headers, ...rest } = {}) {
    const options = { method, headers: { ...(headers || {}) }, ...rest };

    if (body !== undefined) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!options.headers['Content-Type']) {
            options.headers['Content-Type'] = 'application/json';
        }
    }

    return options;
}

async function fetchJSON(url, options) {
    const fetchOpts = fetchOptionsFrom(options);
    
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token && !fetchOpts.headers['x-auth-token']) {
        fetchOpts.headers['x-auth-token'] = token;
    }
    
    const response = await fetch(url, fetchOpts);

    if (!response.ok) {
        const error = new Error(`Request failed with status ${response.status}`);
        error.status = response.status;
        
        // Try to get error message from response
        try {
            const errorData = await response.json();
            error.message = errorData.message || error.message;
        } catch (e) {
            // If response is not JSON, use default message
        }
        
        throw error;
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

function htmlEscape(content = '') {
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Load footer data
async function loadFooter() {
    try {
        console.log('Loading footer data from database...');
        // Use cache-busting to ensure fresh data
        const footer = await fetchJSON(`/api/footer/public?_t=${Date.now()}`);
        console.log('Footer data received:', footer);
        
        const footerContainer = document.getElementById('siteFooter');
        if (!footerContainer) {
            console.warn('Footer container not found');
            return;
        }
        
        // Build footer HTML dynamically
        let footerHTML = '<div class="container"><div class="row">';
        
        // About Section
        if (footer.logo || footer.aboutText || footer.socialMedia) {
            footerHTML += '<div class="col-lg-4"><div class="footer-about">';
            if (footer.logo) {
                footerHTML += `<img src="${htmlEscape(footer.logo)}" alt="D.Watson Pharmacy" class="footer-logo">`;
            }
            if (footer.aboutText) {
                footerHTML += `<p>${htmlEscape(footer.aboutText)}</p>`;
            }
            // Social Links
            if (footer.socialMedia) {
                footerHTML += '<div class="social-links">';
                if (footer.socialMedia.facebook) {
                    footerHTML += `<a href="${htmlEscape(footer.socialMedia.facebook)}" target="_blank" rel="noopener"><i class="fab fa-facebook-f"></i></a>`;
                }
                if (footer.socialMedia.twitter) {
                    footerHTML += `<a href="${htmlEscape(footer.socialMedia.twitter)}" target="_blank" rel="noopener"><i class="fab fa-twitter"></i></a>`;
                }
                if (footer.socialMedia.instagram) {
                    footerHTML += `<a href="${htmlEscape(footer.socialMedia.instagram)}" target="_blank" rel="noopener"><i class="fab fa-instagram"></i></a>`;
                }
                if (footer.socialMedia.linkedin) {
                    footerHTML += `<a href="${htmlEscape(footer.socialMedia.linkedin)}" target="_blank" rel="noopener"><i class="fab fa-linkedin-in"></i></a>`;
                }
                if (footer.socialMedia.youtube) {
                    footerHTML += `<a href="${htmlEscape(footer.socialMedia.youtube)}" target="_blank" rel="noopener"><i class="fab fa-youtube"></i></a>`;
                }
                if (footer.socialMedia.whatsapp) {
                    const whatsappUrl = footer.socialMedia.whatsapp.startsWith('http') 
                        ? footer.socialMedia.whatsapp 
                        : `https://wa.me/${footer.socialMedia.whatsapp}`;
                    footerHTML += `<a href="${htmlEscape(whatsappUrl)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i></a>`;
                }
                footerHTML += '</div>';
            }
            footerHTML += '</div></div>';
        }
        
        // Quick Links Section
        if (footer.quickLinks && footer.quickLinks.length > 0) {
            footerHTML += '<div class="col-lg-2"><div class="footer-links">';
            footerHTML += `<h4>${htmlEscape(footer.quickLinksTitle || 'Quick Links')}</h4>`;
            footerHTML += '<ul>';
            footer.quickLinks.forEach(link => {
                if (link.title && link.url) {
                    footerHTML += `<li><a href="${htmlEscape(link.url)}">${htmlEscape(link.title)}</a></li>`;
                }
            });
            footerHTML += '</ul></div></div>';
        }
        
        // Departments Section (will be loaded separately)
        footerHTML += '<div class="col-lg-3"><div class="footer-links"><h4>DEPARTMENTS</h4><ul id="footerDepartments"></ul></div></div>';
        
        // Contact Info Section
        if (footer.address || footer.phone || footer.email) {
            footerHTML += '<div class="col-lg-3"><div class="footer-contact">';
            footerHTML += `<h4>${htmlEscape(footer.contactInfoTitle || 'Contact Info')}</h4>`;
            if (footer.address) {
                footerHTML += `<p><i class="fas fa-map-marker-alt"></i> ${htmlEscape(footer.address)}</p>`;
            }
            if (footer.phone) {
                footerHTML += `<p><i class="fas fa-phone"></i> ${htmlEscape(footer.phone)}</p>`;
            }
            if (footer.email) {
                footerHTML += `<p><i class="fas fa-envelope"></i> ${htmlEscape(footer.email)}</p>`;
            }
            footerHTML += '</div></div>';
        }
        
        footerHTML += '</div>'; // Close row
        
        // Footer Bottom
        footerHTML += '<div class="footer-bottom"><div class="row">';
        footerHTML += '<div class="col-md-6">';
        if (footer.copyrightText) {
            footerHTML += `<p>${htmlEscape(footer.copyrightText)}</p>`;
        }
        footerHTML += '</div>';
        footerHTML += '<div class="col-md-6 text-end">';
        if (footer.paymentMethodsImage) {
            footerHTML += `<img src="${htmlEscape(footer.paymentMethodsImage)}" alt="Payment Methods" class="footer-payment-methods-img">`;
        }
        footerHTML += '</div></div></div>'; // Close footer-bottom, row
        footerHTML += '</div>'; // Close container
        
        footerContainer.innerHTML = footerHTML;
        
        // Load departments into footer after HTML is rendered
        await loadFooterDepartments();
        
        console.log('Footer loaded and rendered successfully');
    } catch (error) {
        console.error('Error loading footer:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

// Load departments into footer
async function loadFooterDepartments() {
    try {
        // Use cache-busting to ensure fresh data
        const departments = await fetchJSON(`/api/departments?_t=${Date.now()}`);
        if (!Array.isArray(departments) || departments.length === 0) {
            console.warn('No departments found for footer');
            return;
        }
        
        const footerDepartments = document.getElementById('footerDepartments');
        if (footerDepartments) {
            footerDepartments.innerHTML = departments.map(dept => {
                const deptId = dept._id || dept.id;
                return `<li><a href="/department/${deptId}">${htmlEscape(dept.name)}</a></li>`;
            }).join('');
            console.log(`Loaded ${departments.length} departments into footer`);
        }
    } catch (error) {
        console.error('Error loading footer departments:', error);
    }
}

// Export functions to window for use in other scripts
if (typeof window !== 'undefined') {
    window.handleAddToCart = handleAddToCart;
    window.addToGuestCart = addToGuestCart;
    window.loadCartCount = loadCartCount;
    window.getGuestCart = getGuestCart;
    window.htmlEscape = htmlEscape;
    window.resolveImageUrl = resolveImageUrl;
    window.globalFallbackImage = globalFallbackImage;
    window.loadFooter = loadFooter;
}