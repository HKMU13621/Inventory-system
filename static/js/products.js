// static/js/products.js

let currentProductId = null;

// Product Management Functions
function showAddProductModal() {
    const imagePreview = document.getElementById('imagePreview');
    const form = document.querySelector('#addProductModal form');
    
    if (imagePreview) {
        imagePreview.innerHTML = '';
    }
    if (form) {
        form.reset();
    }
    
    showModal('addProductModal');
}

function editProduct(productId) {
    console.log('Editing product with ID:', productId);
    
    try {
        if (!products || !products[productId]) {
            console.error('Product not found:', productId);
            alert('Error: Product not found');
            return;
        }

        currentProductId = productId;
        const product = products[productId];
        
        console.log('Product data:', product);
        
        // Fill the form with current product data
        const form = document.getElementById('editProductForm');
        const nameInput = document.getElementById('edit-name');
        const descriptionInput = document.getElementById('edit-description');
        const priceInput = document.getElementById('edit-price');
        const quantityInput = document.getElementById('edit-quantity');
        const previewDiv = document.getElementById('editImagePreview');
        
        if (!form || !nameInput || !descriptionInput || !priceInput || !quantityInput || !previewDiv) {
            console.error('Required form elements not found');
            alert('Error: Form elements not found');
            return;
        }

        // Update form fields
        nameInput.value = product.name;
        descriptionInput.value = product.description;
        priceInput.value = product.price;
        quantityInput.value = product.quantity;
        
        // Show current image
        previewDiv.innerHTML = `<img src="${product.image_path}" alt="Current product image">`;
        
        // Update form action
        form.action = `/products/${productId}/edit`;
        
        // Add form submission handler
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            try {
                const submitButton = form.querySelector('button[type="submit"]');
                const originalButtonText = submitButton.textContent;
                submitButton.textContent = 'Updating...';
                submitButton.disabled = true;

                const formData = new FormData(form);
                
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    window.location.reload();
                } else {
                    const error = await response.text();
                    console.error('Server error:', error);
                    alert('Error updating product. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error updating product. Please try again.');
            } finally {
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.textContent = originalButtonText;
                    submitButton.disabled = false;
                }
            }
        };
        
        showModal('editProductModal');
        
    } catch (error) {
        console.error('Error in editProduct:', error);
        alert('An error occurred while preparing to edit the product');
    }
}

function deleteProduct(productId) {
    if (!productId) {
        console.error('No product ID provided');
        return;
    }
    currentProductId = productId;
    showModal('deleteConfirmModal');
}

async function confirmDelete() {
    if (!currentProductId) {
        console.error('No product selected for deletion');
        return;
    }

    try {
        const response = await fetch(`/products/${currentProductId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const productCard = document.querySelector(`[data-product-id="${currentProductId}"]`);
            if (productCard) {
                productCard.remove();
            }
            closeModal('deleteConfirmModal');
        } else {
            const error = await response.text();
            throw new Error(error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting product: ' + error.message);
    }
}

function setupImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    if (input && preview) {
        input.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert('Please select an image file');
                    this.value = '';
                    return;
                }
                
                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('Image size should be less than 5MB');
                    this.value = '';
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Image preview">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Initialize product page functionality
document.addEventListener('DOMContentLoaded', function() {
    const addProductModal = document.getElementById('addProductModal');
    if (addProductModal) {  // Only run on products page
        setupImagePreview('image', 'imagePreview');
        setupImagePreview('edit-image', 'editImagePreview');
    }
});