$(document).ready(function() {
    // Get product ID from URL
    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];
    
    if (!productId) {
        showError('Product ID not found');
        return;
    }

    // Load cart count
    loadCartCount();
    
    // Load product details
    loadProduct(productId);
    
    // Quantity controls
    $('#increaseQty').click(function() {
        const qtyInput = $('#productQuantity');
        const currentQty = parseInt(qtyInput.val(), 10);
        const maxQty = parseInt(qtyInput.attr('max'), 10);
        if (currentQty < maxQty) {
            qtyInput.val(currentQty + 1);
        }
    });
    
    $('#decreaseQty').click(function() {
        const qtyInput = $('#productQuantity');
        const currentQty = parseInt(qtyInput.val(), 10);
        if (currentQty > 1) {
            qtyInput.val(currentQty - 1);
        }
    });
    
    // Add to cart button
    $('#addToCartBtn').click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Try multiple ways to get productId
        let productId = $(this).attr('data-product-id') || 
                       $(this).data('product-id') ||
                       $(this).attr('data-id') ||
                       $(this).data('id');
        
        // If still no productId, try to get it from the URL (fallback)
        if (!productId) {
            const pathParts = window.location.pathname.split('/');
            productId = pathParts[pathParts.length - 1];
        }
        
        const quantity = parseInt($('#productQuantity').val(), 10) || 1;
        
        if (productId) {
            // Ensure productId is a string
            productId = String(productId).trim();
            if (productId && productId !== 'undefined' && productId !== 'null') {
                addToCart(productId, quantity);
            } else {
                console.error('Invalid productId:', productId);
                alert('Invalid product ID. Cannot add to cart.');
            }
        } else {
            console.error('Product ID not found on button');
            alert('Unable to add product to cart. Product ID is missing.');
        }
    });
    
    // Add to wishlist button
    $('#addToWishlistBtn').click(function() {
        alert('Wishlist functionality coming soon!');
    });
});

function loadProduct(productId) {
    console.log('Loading product:', productId);
    
    $.get(`/api/public/products/${productId}`)
        .done(function(product) {
            console.log('Product loaded:', product);
            renderProduct(product);
        })
        .fail(function(error) {
            console.error('Error loading product:', error);
            if (error.status === 404) {
                showError('Product not found');
            } else {
                showError('Error loading product. Please try again.');
            }
        });
}

function renderProduct(product) {
    const productId = product._id || product.id;
    const productImage = product.imageUpload?.url || product.image || 'https://via.placeholder.com/600x600';
    const finalPrice = product.price * (1 - (product.discount || 0) / 100);
    const hasDiscount = product.discount > 0;
    const isSoldOut = product.stockQuantity === 0 || product.isOutOfStock || false;
    
    // Safely extract category and department info
    const categoryName = product.category?.name || 'Uncategorized';
    const departmentName = product.department?.name || 'Unknown';
    
    // Get IDs - handle both populated and non-populated cases
    let departmentId = null;
    let categoryId = null;
    
    if (product.department) {
        departmentId = product.department._id?.toString() || product.department.toString();
    }
    
    if (product.category) {
        categoryId = product.category._id?.toString() || product.category.toString();
        
        // If category has department info, use it as fallback
        if (!departmentId && product.category.department) {
            departmentId = product.category.department._id?.toString() || product.category.department.toString();
        }
    }
    
    // Hide loading, show content
    $('#productLoading').hide();
    $('#productContent').show();
    
    // Product Image
    $('#productImage').attr('src', productImage).attr('alt', product.name);
    
    // Product Badges
    let badgesHtml = '';
    if (hasDiscount) {
        badgesHtml += `<span class="badge bg-danger product-badge">-${product.discount}%</span>`;
    }
    if (isSoldOut) {
        badgesHtml += `<span class="badge bg-secondary product-badge">Out of Stock</span>`;
    }
    $('#productBadges').html(badgesHtml);
    
    // Breadcrumb - Always show Department > Category > Product hierarchy
    let breadcrumbHtml = '<li class="breadcrumb-item"><a href="/">Home</a></li>';
    
    // Department should always come first (Department > Category > Product)
    if (departmentId) {
        breadcrumbHtml += `<li class="breadcrumb-item"><a href="/department.html?id=${departmentId}">${departmentName}</a></li>`;
    }
    
    // Category comes after department
    if (categoryId) {
        breadcrumbHtml += `<li class="breadcrumb-item"><a href="/category.html?id=${categoryId}">${categoryName}</a></li>`;
    }
    
    // Product name is the active item
    breadcrumbHtml += `<li class="breadcrumb-item active" aria-current="page">${product.name}</li>`;
    $('#productBreadcrumb').html(breadcrumbHtml);
    
    // Product Name
    $('#productName').text(product.name);
    
    // Product Price
    let priceHtml = '';
    if (hasDiscount) {
        priceHtml += `<span class="text-muted text-decoration-line-through me-2">Rs. ${product.price.toFixed(2)}</span>`;
    }
    priceHtml += `<span class="text-primary fs-3 fw-bold">Rs. ${finalPrice.toFixed(2)}</span>`;
    $('#productPrice').html(priceHtml);
    
    // Product Description
    $('#productDescription').html(product.description || 'No description available.');
    
    // Product Meta - Navigation links to department and category
    if (categoryId) {
        $('#productCategory').html(`<a href="/category.html?id=${categoryId}">${categoryName}</a>`);
    } else {
        $('#productCategory').html(`<span class="text-muted">${categoryName}</span>`);
    }
    
    if (departmentId) {
        $('#productDepartment').html(`<a href="/department.html?id=${departmentId}">${departmentName}</a>`);
    } else {
        $('#productDepartment').html(`<span class="text-muted">${departmentName}</span>`);
    }
    
    const stockText = isSoldOut ? '<span class="text-danger">Out of Stock</span>' : 
                     (product.stockQuantity ? `<span class="text-success">${product.stockQuantity} available</span>` : 
                     '<span class="text-success">In Stock</span>');
    $('#productStock').html(stockText);
    
    // Quantity input max
    if (product.stockQuantity) {
        $('#productQuantity').attr('max', Math.min(product.stockQuantity, 10));
    }
    
    // Add to cart button - set both data attribute and HTML attribute
    const addToCartBtn = $('#addToCartBtn');
    addToCartBtn.attr('data-product-id', productId); // Use attr for HTML attribute
    addToCartBtn.data('product-id', productId); // Also set jQuery data for compatibility
    if (isSoldOut) {
        addToCartBtn.prop('disabled', true).text('Out of Stock');
    } else {
        addToCartBtn.prop('disabled', false);
    }
    
    // Update page title
    document.title = `${product.name} - D.Watson Cosmetics`;
}

function showError(message) {
    $('#productLoading').hide();
    $('#productError').show().find('p').first().text(message);
}

function addToCart(productId, quantity = 1) {
    // Validate productId
    if (!productId) {
        console.error('addToCart: No productId provided');
        alert('Product ID is missing. Cannot add to cart.');
        return;
    }
    
    // Ensure productId is a string
    productId = String(productId).trim();
    
    if (!productId || productId === 'undefined' || productId === 'null' || productId === '') {
        console.error('addToCart: Invalid productId:', productId);
        alert('Invalid product ID. Cannot add to cart.');
        return;
    }
    
    // Validate quantity
    quantity = parseInt(quantity, 10) || 1;
    if (isNaN(quantity) || quantity < 1) {
        console.error('addToCart: Invalid quantity:', quantity);
        alert('Invalid quantity. Must be at least 1.');
        return;
    }
    
    console.log('addToCart called with productId:', productId, 'quantity:', quantity);
    
    const token = localStorage.getItem('token');
    
    if (!token) {
        // Guest cart - fetch product details first
        console.log('addToCart: No token, adding to guest cart');
        $.get(`/api/public/products/${productId}`)
            .done(function(product) {
                if (!product) {
                    alert('Product not found.');
                    return;
                }
                
                const productPrice = product.price || 0;
                const productDiscount = product.discount || 0;
                
                // Add to guest cart
                let guestCart = JSON.parse(localStorage.getItem('guestCart') || '{"items":[]}');
                const existingItemIndex = guestCart.items.findIndex(item => item.productId === productId);
                
                if (existingItemIndex >= 0) {
                    guestCart.items[existingItemIndex].quantity += quantity;
                } else {
                    guestCart.items.push({
                        productId: productId,
                        quantity: quantity,
                        price: productPrice,
                        discount: productDiscount
                    });
                }
                
                localStorage.setItem('guestCart', JSON.stringify(guestCart));
                const cartCount = guestCart.items.reduce((sum, item) => sum + item.quantity, 0);
                $('.cart-count').text(cartCount);
                alert('Product added to cart! Sign in to save your cart.');
            })
            .fail(function(error) {
                console.error('Error fetching product for guest cart:', error);
                alert('Error adding product to cart. Please try again.');
            });
        return;
    }
    
    // User cart - make API call
    console.log('addToCart: Making API call with productId:', productId, 'quantity:', quantity);
    
    $.ajax({
        url: '/api/cart/add',
        method: 'POST',
        headers: {
            'x-auth-token': token,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({ 
            productId: productId, 
            quantity: quantity 
        })
    })
    .done(function(data) {
        console.log('addToCart: Success response:', data);
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
        // Guest cart count
        try {
            const guestCart = JSON.parse(localStorage.getItem('guestCart') || '{"items":[]}');
            const cartCount = guestCart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            $('.cart-count').text(cartCount);
        } catch (e) {
            $('.cart-count').text('0');
        }
        return;
    }
    
    // User cart count
    $.ajax({
        url: '/api/cart/count',
        headers: {
            'x-auth-token': token
        }
    })
    .done(function(data) {
        $('.cart-count').text(data.count || 0);
    })
    .fail(function() {
        // Fallback to guest cart count
        try {
            const guestCart = JSON.parse(localStorage.getItem('guestCart') || '{"items":[]}');
            const cartCount = guestCart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            $('.cart-count').text(cartCount);
        } catch (e) {
            $('.cart-count').text('0');
        }
    });
}
