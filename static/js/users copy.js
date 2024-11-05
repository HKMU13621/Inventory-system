// static/js/users.js

let currentUsername = null;

// Modal functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    document.body.classList.add('modal-open');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.classList.remove('modal-open');
}

function showAddUserModal() {
    document.getElementById('addUserForm').reset();
    showModal('addUserModal');
}

async function handleAddUser(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Password validation
    const password = form.password.value;
    const confirmPassword = form.confirm_password.value;
    
    if (password !== confirmPassword) {
        alert("Passwords don't match!");
        return false;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        // Create FormData object
        const formData = new FormData(form);
        
        const response = await fetch('/users/create', {
            method: 'POST',
            body: formData  // Send as FormData instead of JSON
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error creating user');
        }
        
        window.location.reload();
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create User';
    }
    
    return false;
}

function editUser(username) {
    currentUsername = username;
    const form = document.getElementById('editUserForm');
    
    // Find user data
    const userRow = document.querySelector(`tr[data-username="${username}"]`);
    if (!userRow) return;
    
    // Fill form with user data
    form.username.value = username;
    form.full_name.value = userRow.children[1].textContent;
    form.email.value = userRow.children[2].textContent;
    form.role.value = userRow.getAttribute('data-role');
    
    showModal('editUserModal');
}

async function handleEditUser(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
        
        // Create FormData object
        const formData = new FormData(form);
        
        const response = await fetch(`/users/${currentUsername}`, {
            method: 'PUT',
            body: formData  // Send as FormData instead of JSON
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error updating user');
        }
        
        window.location.reload();
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update User';
    }
    
    return false;
}
function resetPassword(username) {
    currentUsername = username;
    document.getElementById('resetPasswordForm').reset();
    document.getElementById('reset_username').value = username;
    showModal('resetPasswordModal');
}

async function handleResetPassword(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    const newPassword = form.new_password.value;
    const confirmPassword = form.confirm_new_password.value;
    
    if (newPassword !== confirmPassword) {
        alert("Passwords don't match!");
        return false;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Resetting...';
        
        const response = await fetch(`/users/${currentUsername}/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: newPassword })
        });
        
        if (response.ok) {
            closeModal('resetPasswordModal');
            alert('Password reset successfully');
        } else {
            const error = await response.text();
            alert('Error resetting password: ' + error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error resetting password');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password';
    }
    
    return false;
}

async function toggleUserStatus(username) {
    if (!confirm('Are you sure you want to change this user\'s status?')) {
        return;
    }
    
    try {
        const userRow = document.querySelector(`tr[data-username="${username}"]`);
        const isActive = userRow.querySelector('.status-badge').textContent.trim() === 'Active';
        
        const response = await fetch(`/users/${username}/toggle-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: !isActive })
        });
        
        if (response.ok) {
            window.location.reload();
        } else {
            const error = await response.text();
            alert('Error updating user status: ' + error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating user status');
    }
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value.toLowerCase();
    const rows = document.querySelectorAll('.user-table tbody tr');
    
    rows.forEach(row => {
        const username = row.children[0].textContent.toLowerCase();
        const fullName = row.children[1].textContent.toLowerCase();
        const email = row.children[2].textContent.toLowerCase();
        const role = row.getAttribute('data-role').toLowerCase();
        
        const matchesSearch = username.includes(searchTerm) || 
                            fullName.includes(searchTerm) || 
                            email.includes(searchTerm);
        const matchesRole = !roleFilter || role === roleFilter;
        
        row.style.display = matchesSearch && matchesRole ? '' : 'none';
    });
}

// Initialize tooltips and other UI elements
document.addEventListener('DOMContentLoaded', function() {
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    };
    
    // Add password validation
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm_password');
    
    function validatePassword() {
        if (password.value != confirmPassword.value) {
            confirmPassword.setCustomValidity("Passwords don't match");
        } else {
            confirmPassword.setCustomValidity('');
        }
    }
    
    password?.addEventListener('change', validatePassword);
    confirmPassword?.addEventListener('keyup', validatePassword);
});