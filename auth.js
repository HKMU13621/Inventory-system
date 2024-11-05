// auth.js
class Auth {
    static async login(username, password) {
        try {
            const response = await fetch('http://localhost:8000/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `username=${username}&password=${password}`
            });
            const data = await response.json();
            if (data.access_token) {
                localStorage.setItem('token', data.access_token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    static isAuthenticated() {
        return localStorage.getItem('token') !== null;
    }

    static logout() {
        localStorage.removeItem('token');
    }
}

// api.js
class API {
    static async fetchProducts() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('http://localhost:8000/products', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }

    static async fetchProduct(id) {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`http://localhost:8000/products/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching product:', error);
            return null;
        }
    }
}

// products.js
async function displayProducts() {
    const products = await API.fetchProducts();
    const productsContainer = document.getElementById('products-container');
    productsContainer.innerHTML = '';

    products.forEach(product => {
        const productElement = document.createElement('div');
        productElement.className = 'product-card';
        productElement.innerHTML = `
            <img src="${product.image_path}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p>Price: $${product.price}</p>
            <p>Stock: ${product.quantity}</p>
        `;
        productsContainer.appendChild(productElement);
    });
}