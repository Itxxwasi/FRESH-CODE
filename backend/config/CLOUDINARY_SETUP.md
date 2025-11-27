# Cloudinary Image Upload Setup Guide

## Overview
This guide explains how to set up and use Cloudinary image upload for products in the admin panel.

## 1. Install Dependencies

```bash
npm install cloudinary multer
```

## 2. Environment Variables

Add these variables to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### How to Get Cloudinary Credentials:
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard
3. Copy your:
   - **Cloud Name** (found at the top)
   - **API Key** (found in Account Details)
   - **API Secret** (found in Account Details - click "Reveal")

## 3. File Structure

```
backend/
├── config/
│   └── cloudinary.js          # Cloudinary configuration
├── middleware/
│   └── upload.js              # Multer middleware for file uploads
├── services/
│   └── cloudinaryUpload.js    # Cloudinary upload service
└── routes/
    └── products.js            # Contains POST /api/products/upload-image route
```

## 4. API Endpoint

### Upload Image
**POST** `/api/products/upload-image`

**Headers:**
- `x-auth-token`: Admin JWT token (required)
- `Content-Type`: `multipart/form-data`

**Body:**
- `image`: Image file (required)

**Optional Query Parameters:**
- `folder`: Cloudinary folder name (default: "products")

**Response (Success):**
```json
{
  "success": true,
  "message": "Image uploaded successfully to Cloudinary",
  "url": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/products/product_1234567890.jpg",
  "publicId": "products/product_1234567890",
  "width": 1920,
  "height": 1080,
  "format": "jpg",
  "size": 245678,
  "originalName": "my-image.jpg"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Error message here"
}
```

## 5. Frontend Usage Example

### HTML Form
```html
<form id="uploadForm" enctype="multipart/form-data">
    <input type="file" name="image" id="imageInput" accept="image/*" required>
    <button type="submit">Upload Image</button>
</form>
```

### JavaScript (jQuery)
```javascript
$('#uploadForm').on('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const imageFile = $('#imageInput')[0].files[0];
    
    if (!imageFile) {
        alert('Please select an image');
        return;
    }
    
    formData.append('image', imageFile);
    
    try {
        const response = await $.ajax({
            url: '/api/products/upload-image',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'x-auth-token': localStorage.getItem('token')
            }
        });
        
        if (response.success) {
            console.log('Image URL:', response.url);
            // Use response.url to save to product
            // Example: $('#productImage').val(response.url);
            alert('Image uploaded successfully!');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload image: ' + (error.responseJSON?.message || error.message));
    }
});
```

### Vanilla JavaScript (Fetch API)
```javascript
document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const imageFile = document.getElementById('imageInput').files[0];
    
    if (!imageFile) {
        alert('Please select an image');
        return;
    }
    
    formData.append('image', imageFile);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/products/upload-image', {
            method: 'POST',
            headers: {
                'x-auth-token': token
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Image URL:', data.url);
            // Use data.url to save to product
            alert('Image uploaded successfully!');
        } else {
            alert('Failed to upload: ' + data.message);
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload image');
    }
});
```

## 6. Saving URL to Product

After uploading, save the URL to your product document:

```javascript
// After successful upload
const productData = {
    name: 'Product Name',
    description: 'Product Description',
    price: 99.99,
    image: response.url, // Use the Cloudinary URL
    // ... other fields
};

// Save to MongoDB via your API
await $.ajax({
    url: '/api/admin/products',
    method: 'POST',
    headers: {
        'x-auth-token': localStorage.getItem('token'),
        'Content-Type': 'application/json'
    },
    data: JSON.stringify(productData)
});
```

## 7. Supported Image Formats

- JPEG/JPG
- PNG
- GIF
- WebP
- SVG

## 8. File Size Limits

- Maximum file size: **10MB**

## 9. Features

✅ Automatic temp file cleanup
✅ Secure HTTPS URLs from Cloudinary
✅ Image validation (type and size)
✅ Unique filename generation
✅ Error handling
✅ Admin authentication required
✅ CDN cache invalidation

## 10. Troubleshooting

### Error: "Cloudinary credentials not found"
- Make sure you've added `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to your `.env` file
- Restart your server after adding environment variables

### Error: "Invalid file type"
- Make sure you're uploading one of the supported image formats (JPEG, PNG, GIF, WebP, SVG)

### Error: "File too large"
- The maximum file size is 10MB. Resize or compress your image before uploading.

### Error: "Unauthorized"
- Make sure you're sending a valid admin JWT token in the `x-auth-token` header.

