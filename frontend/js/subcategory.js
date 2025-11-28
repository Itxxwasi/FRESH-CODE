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
    loadDepartments();

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
                                <a href="/product/${productId}" class="btn btn-outline-secondary">
                                    View Details
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join(''));

    // Add to cart functionality
    $('.add-to-cart').click(function() {
        const productId = $(this).data('product-id');
        addToCart(productId, 1);
    });
}

