$(document).ready(function() {
    // Get subcategory ID from URL
    const pathParts = window.location.pathname.split('/');
    const subcategoryId = pathParts[pathParts.length - 1];
    
    if (!subcategoryId) {
        window.location.href = '/';
        return;
    }

    // Load cart count
    loadCartCount();
    
    // Initialize navbar - wait for main.js to load
    function initNavbar() {
        // Use main.js functions if available
        if (typeof window.loadDepartments === 'function') {
            window.loadDepartments().catch(err => console.warn('Departments loading failed:', err));
        } else {
            loadDepartmentsFallback();
        }
        
        if (typeof window.loadCategoriesForNavbar === 'function') {
            window.loadCategoriesForNavbar().catch(err => console.warn('Categories loading failed:', err));
        } else {
            // Retry after a short delay if main.js hasn't loaded yet
            setTimeout(initNavbar, 300);
        }
    }
    
    // Start navbar initialization
    initNavbar();

    // Load subcategory data
    loadSubcategoryData(subcategoryId);
});

function loadSubcategoryData(subcategoryId) {
    $.get(`/api/public/subcategories/${subcategoryId}`)
        .done(function(data) {
            const { subcategory, products } = data;

            // Update breadcrumb
            const catId = subcategory.category?._id || subcategory.category;
            const catName = subcategory.category?.name || 'Category';
            const deptId = subcategory.category?.department?._id || subcategory.category?.department;
            const deptName = subcategory.category?.department?.name || 'Department';
            
            let breadcrumbHtml = `
                <li class="breadcrumb-item"><a href="/">Home</a></li>
            `;
            
            if (deptId) {
                breadcrumbHtml += `<li class="breadcrumb-item"><a href="/department/${deptId}">${deptName}</a></li>`;
            }
            
            if (catId) {
                breadcrumbHtml += `<li class="breadcrumb-item"><a href="/category/${catId}">${catName}</a></li>`;
            }
            
            breadcrumbHtml += `<li class="breadcrumb-item active">${subcategory.name}</li>`;
            
            $('#breadcrumb').html(breadcrumbHtml);

            // Update subcategory header
            $('#subcategoryName').text(subcategory.name);
            $('#subcategoryDescription').text(subcategory.description || '');
            
            // Set subcategory image
            const subcatImage = subcategory.imageUpload?.url || subcategory.image || 'https://via.placeholder.com/400x300';
            $('#subcategoryImage').attr('src', subcatImage).attr('alt', subcategory.name);

            // Set category link
            if (catId) {
                $('#categoryLink').attr('href', `/category/${catId}`);
            } else {
                $('#categoryLink').hide();
            }

            // Render products
            renderProducts(products);

            // Update page title
            document.title = `${subcategory.name} - D.Watson Pharmacy`;
        })
        .fail(function(error) {
            console.error('Error loading subcategory:', error);
            if (error.status === 404) {
                alert('Subcategory not found');
                window.location.href = '/';
            } else {
                alert('Error loading subcategory. Please try again.');
            }
        });
}

function renderProducts(products) {
    const container = $('#productsGrid');
    const noProducts = $('#noProducts');
    
    if (!products || products.length === 0) {
        container.html('');
        noProducts.show();
        return;
    }

    noProducts.hide();
    
    container.html(products.map(product => {
        const productId = product._id || product.id;
        const productImage = product.imageUpload?.url || product.image || 'https://via.placeholder.com/300x300';
        const finalPrice = product.price * (1 - (product.discount || 0) / 100);
        const departmentName = product.department?.name || 'Uncategorized';
        
        return `
            <div class="col-lg-3 col-md-4 col-sm-6">
                <div class="card h-100 shadow-sm product-card">
                    <div class="position-relative product-img">
                        <img src="${productImage}" alt="${product.name}">
                        ${product.discount > 0 ? `<span class="badge bg-danger position-absolute top-0 end-0 m-2">-${product.discount}%</span>` : ''}
                    </div>
                    <div class="card-body d-flex flex-column">
                        <small class="text-muted">${departmentName}</small>
                        <h6 class="card-title mt-2">${product.name}</h6>
                        <p class="card-text text-muted small flex-grow-1">${product.description ? (product.description.substring(0, 100) + (product.description.length > 100 ? '...' : '')) : ''}</p>
                        <div class="mt-auto">
                            <div class="mb-2">
                                <strong class="text-primary">Rs. ${finalPrice.toFixed(2)}</strong>
                                ${product.discount > 0 ? `<small class="text-muted text-decoration-line-through ms-2">Rs. ${product.price.toFixed(2)}</small>` : ''}
                            </div>
                            <div class="d-grid gap-2">
                                <button class="btn btn-primary add-to-cart" data-id="${productId}" data-product-id="${productId}">
                                    <i class="fas fa-shopping-cart"></i> Add to Cart
                                </button>
                                <a href="/product/${productId}" class="btn btn-outline-primary btn-sm">View Details</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join(''));

    // Attach event handlers - use attr instead of data to get actual string value
    $('.add-to-cart').off('click.cart').on('click.cart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const productId = $(this).attr('data-id') || $(this).attr('data-product-id') || $(this).data('id') || $(this).data('product-id');
        if (productId) {
            handleAddToCart(String(productId).trim());
        } else {
            console.error('Product ID not found on button:', this);
            alert('Unable to add product to cart. Product ID is missing.');
        }
    });
}

// Guest cart helper functions
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

function handleAddToCart(productId) {
    // Validate productId
    if (!productId) {
        console.error('handleAddToCart: No productId provided');
        alert('Product ID is missing. Cannot add to cart.');
        return;
    }
    
    // Ensure productId is a string
    productId = String(productId).trim();
    
    if (!productId || productId === 'undefined' || productId === 'null' || productId === '') {
        console.error('handleAddToCart: Invalid productId:', productId);
        alert('Invalid product ID. Cannot add to cart.');
        return;
    }
    
    console.log('handleAddToCart called with productId:', productId);
    
    const token = localStorage.getItem('token');
    
    // If not logged in, add to guest cart
    if (!token) {
        console.log('handleAddToCart: No token found, adding to guest cart');
        // Fetch product details to get price - use public API endpoint
        $.get(`/api/public/products/${productId}`)
            .done(function(product) {
                if (product) {
                    const cartCount = addToGuestCart(
                        productId,
                        1,
                        product.price || 0,
                        product.discount || 0
                    );
                    $('.cart-count').text(cartCount);
                    alert('Product added to cart! Sign in to save your cart.');
                } else {
                    alert('Product not found.');
                }
            })
            .fail(function(error) {
                console.error('Error fetching product for guest cart:', error);
                // Add to guest cart with default values if API call fails
                const cartCount = addToGuestCart(productId, 1, 0, 0);
                $('.cart-count').text(cartCount);
                alert('Product added to cart! Sign in to save your cart.');
            });
        return;
    }

    console.log('handleAddToCart: Making API call with productId:', productId);

    $.ajaxSetup({
        headers: {
            'x-auth-token': token
        }
    });

    $.ajax({
        url: '/api/cart/add',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ 
            productId: productId, 
            quantity: 1 
        })
    })
    .done(function(data) {
        console.log('handleAddToCart: Success response:', data);
        alert('Product added to cart!');
        loadCartCount();
    })
    .fail(function(error) {
        console.error('Error adding to cart:', error);
        console.error('Error status:', error.status);
        console.error('Error responseText:', error.responseText);
        
        let errorMessage = 'Error adding product to cart. Please try again.';
        
        if (error.status === 400) {
            try {
                const errorData = JSON.parse(error.responseText);
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                errorMessage = 'Invalid request. Please check the product details.';
            }
        } else if (error.status === 401) {
            errorMessage = 'Please log in to add products to cart.';
            localStorage.removeItem('token');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
        } else if (error.status === 404) {
            errorMessage = 'Product not found.';
        }
        
        alert(errorMessage);
    });
}

function loadCartCount() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Show guest cart count if not logged in
        const guestCount = getGuestCartCount();
        $('.cart-count').text(guestCount);
        return;
    }

    $.ajaxSetup({
        headers: {
            'x-auth-token': token
        }
    });

    $.get('/api/cart/count')
        .done(function(data) {
            $('.cart-count').text(data.count || 0);
        })
        .fail(function() {
            // If API fails, show guest cart count
            const guestCount = getGuestCartCount();
            $('.cart-count').text(guestCount);
        });
}

// loadDepartments is now handled by main.js, but keeping this as fallback
function loadDepartmentsFallback() {
    $.get('/api/departments')
        .done(function(departments) {
            const menu = $('#departmentsMenu');
            const footer = $('#footerDepartments');
            
            if (menu.length) {
                menu.html(departments.map(dept => {
                    const deptId = dept._id || dept.id;
                    return `<li><a class="dropdown-item" href="/department/${deptId}">${dept.name}</a></li>`;
                }).join(''));
            }
            
            if (footer.length) {
                footer.html(departments.map(dept => {
                    const deptId = dept._id || dept.id;
                    return `<li><a href="/department/${deptId}">${dept.name}</a></li>`;
                }).join(''));
            }
        })
        .fail(function() {
            console.error('Error loading departments');
        });
}

