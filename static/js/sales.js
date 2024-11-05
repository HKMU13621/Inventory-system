// static/js/sales.js

let currentProduct = null;

function showNewSaleModal() {
    document.getElementById('newSaleModal').style.display = 'block';
    resetForm();
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    resetForm();
}

function resetForm() {
    document.getElementById('newSaleForm').reset();
    document.getElementById('unit-price').textContent = '$0.00';
    document.getElementById('total-price').textContent = '$0.00';
    document.getElementById('stock-warning').textContent = '';
}

function updatePrice() {
    const productSelect = document.getElementById('product');
    const quantityInput = document.getElementById('quantity');
    const unitPriceElement = document.getElementById('unit-price');
    const stockWarning = document.getElementById('stock-warning');
    
    if (productSelect.value) {
        currentProduct = products[productSelect.value];
        unitPriceElement.textContent = `$${currentProduct.price.toFixed(2)}`;
        
        // Reset quantity input max value
        quantityInput.max = currentProduct.quantity;
        
        // Update stock warning
        if (currentProduct.quantity < 5) {
            stockWarning.textContent = `Low stock alert: Only ${currentProduct.quantity} left`;
        } else {
            stockWarning.textContent = '';
        }
    } else {
        currentProduct = null;
        unitPriceElement.textContent = '$0.00';
        stockWarning.textContent = '';
    }
    
    updateTotal();
}

function updateTotal() {
    const quantityInput = document.getElementById('quantity');
    const totalPriceElement = document.getElementById('total-price');
    const stockWarning = document.getElementById('stock-warning');
    
    if (currentProduct && quantityInput.value) {
        const quantity = parseInt(quantityInput.value);
        
        // Validate quantity against stock
        if (quantity > currentProduct.quantity) {
            stockWarning.textContent = `Insufficient stock. Available: ${currentProduct.quantity}`;
            quantityInput.value = currentProduct.quantity;
            return updateTotal();
        }
        
        const total = currentProduct.price * quantity;
        totalPriceElement.textContent = `$${total.toFixed(2)}`;
    } else {
        totalPriceElement.textContent = '$0.00';
    }
}

async function handleNewSale(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    try {
        // Disable submit button and show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';
        
        const formData = new FormData(form);
        const response = await fetch('/sales/create', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // Refresh the page to show new sale
            window.location.reload();
        } else {
            const error = await response.text();
            alert('Error creating sale: ' + error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error creating sale. Please try again.');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = 'Complete Sale';
    }
    
    return false;
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
};