// static/js/users.js

let currentUsername = null;
let modals = {};

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing application...');
    const editForm = document.getElementById('editUserForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditUser);
        console.log('Edit form submit handler attached');
    } else {
        console.error('Edit form not found');
    }
    // Initialize all modals
    try {
        modals = {
            add: new bootstrap.Modal(document.getElementById('addUserModal')),
            edit: new bootstrap.Modal(document.getElementById('editUserModal')),
            reset: new bootstrap.Modal(document.getElementById('resetPasswordModal'))
        };
        console.log('Modals initialized:', modals);
    } catch (error) {
        console.error('Error initializing modals:', error);
    }

    // Setup password validation
    setupPasswordValidation();
    
    // Setup search and filter functionality
    setupSearchAndFilter();
    
    // Setup tooltips
    setupTooltips();
});

function setupPasswordValidation() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm_password');
    
    if (password && confirmPassword) {
        const validatePassword = () => {
            if (password.value != confirmPassword.value) {
                confirmPassword.setCustomValidity("Passwords don't match");
            } else {
                confirmPassword.setCustomValidity('');
            }
        };

        password.addEventListener('change', validatePassword);
        confirmPassword.addEventListener('keyup', validatePassword);
    }
}

function setupSearchAndFilter() {
    const searchInput = document.getElementById('userSearch');
    const roleSelect = document.getElementById('roleFilter');
    
    if (searchInput) {
        const debouncedFilter = debounce(filterUsers, 300);
        searchInput.addEventListener('input', debouncedFilter);
        console.log('Search input initialized');
    }
    
    if (roleSelect) {
        roleSelect.addEventListener('change', filterUsers);
        console.log('Role filter initialized');
    }
    
    // Add keyboard shortcut (Ctrl/Cmd + K)
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (searchInput) searchInput.focus();
        }
    });
}

function setupTooltips() {
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
}

function showAddUserModal() {
    try {
        document.getElementById('addUserForm').reset();
        modals.add.show();
    } catch (error) {
        console.error('Error showing add user modal:', error);
        showAlert('Error opening modal', 'danger');
    }
}

function editUser(username) {
    console.log('Editing user:', username);
    currentUsername = username;
    
    try {
        // Get user data from the table row
        const userRow = document.querySelector(`tr[data-username="${username}"]`);
        if (!userRow) {
            throw new Error('User row not found');
        }
        
        // Get form fields
        const form = document.getElementById('editUserForm');
        const usernameInput = document.getElementById('edit-username');
        const fullNameInput = document.getElementById('edit-full-name');
        const emailInput = document.getElementById('edit-email');
        const roleSelect = document.getElementById('edit-role');
        
        // Check if all form fields exist
        if (!form || !usernameInput || !fullNameInput || !emailInput || !roleSelect) {
            throw new Error('Form fields not found');
        }
        
        // Fill form with user data
        usernameInput.value = username;
        fullNameInput.value = userRow.querySelector('td:nth-child(2)').textContent.trim();
        emailInput.value = userRow.querySelector('td:nth-child(3)').textContent.trim();
        
        // Get role from badge
        const roleBadge = userRow.querySelector('td:nth-child(4) .badge');
        if (roleBadge) {
            roleSelect.value = roleBadge.textContent.trim().toLowerCase();
        }
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error in editUser:', error);
        showAlert(error.message, 'danger');
    }
}

async function handleEditUser(event) {
    event.preventDefault();
    console.log('Handling edit user submission');
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
        
        // Get form data
        const formData = new FormData(form);
        
        // Log form data for debugging
        for (let [key, value] of formData.entries()) {
            console.log(`${key}: ${value}`);
        }
        
        const response = await fetch(`/users/${currentUsername}`, {
            method: 'PUT',
            body: formData
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error updating user');
        }
        
        // Show success message
        showAlert('User updated successfully!', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
        if (modal) {
            modal.hide();
        }
        
        // Reload page after short delay
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        console.error('Error:', error);
        showAlert(error.message, 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}


function resetPassword(username) {
    currentUsername = username;
    document.getElementById('resetPasswordForm').reset();
    document.getElementById('reset_username').value = username;
    modals.reset.show();
}

async function handleResetPassword(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    const newPassword = form.new_password.value;
    const confirmPassword = form.confirm_new_password.value;
    
    if (newPassword !== confirmPassword) {
        showAlert("Passwords don't match!", 'danger');
        return false;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Resetting...';
        
        const formData = new FormData();
        formData.append('new_password', newPassword);
        
        const response = await fetch(`/users/${currentUsername}/reset-password`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error resetting password');
        }
        
        showAlert('Password reset successfully!', 'success');
        modals.reset.hide();
        
    } catch (error) {
        console.error('Error:', error);
        showAlert(error.message, 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
    
    return false;
}

async function handleAddUser(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    const password = form.password.value;
    const confirmPassword = form.confirm_password.value;
    
    if (password !== confirmPassword) {
        showAlert("Passwords don't match!", 'danger');
        return false;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';
        
        const formData = new FormData(form);
        
        const response = await fetch('/users/create', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Error creating user');
        }
        
        showAlert('User created successfully!', 'success');
        modals.add.hide();
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        console.error('Error:', error);
        showAlert(error.message, 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
    
    return false;
}

async function toggleUserStatus(username) {
    if (!confirm('Are you sure you want to change this user\'s status?')) {
        return;
    }
    
    try {
        const userRow = document.querySelector(`tr[data-username="${username}"]`);
        const statusBadge = userRow.querySelector('.status-badge');
        const isActive = statusBadge.textContent.trim() === 'Active';
        
        const response = await fetch(`/users/${username}/toggle-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: !isActive })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error updating user status');
        }
        
        showAlert('User status updated successfully!', 'success');
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        console.error('Error:', error);
        showAlert(error.message, 'danger');
    }
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase().trim() || '';
    const roleFilter = document.getElementById('roleFilter')?.value.toLowerCase() || '';
    
    const tableRows = document.querySelectorAll('table.user-table tbody tr');
    let visibleCount = 0;
    
    tableRows.forEach(row => {
        if (row.classList.contains('no-results')) return;
        
        try {
            const username = row.cells[0]?.textContent?.toLowerCase() || '';
            const fullName = row.cells[1]?.textContent?.toLowerCase() || '';
            const email = row.cells[2]?.textContent?.toLowerCase() || '';
            const role = row.cells[3]?.querySelector('.badge')?.textContent?.toLowerCase() || '';
            
            const matchesSearch = !searchTerm || 
                username.includes(searchTerm) || 
                fullName.includes(searchTerm) || 
                email.includes(searchTerm) ||
                role.includes(searchTerm);
                
            const matchesRole = !roleFilter || role.includes(roleFilter);
            
            if (matchesSearch && matchesRole) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error processing row:', error);
            row.style.display = 'none';
        }
    });
    
    updateNoResultsMessage(visibleCount, searchTerm, roleFilter);
}

function updateNoResultsMessage(visibleCount, searchTerm, roleFilter) {
    const tbody = document.querySelector('table.user-table tbody');
    if (!tbody) return;
    
    const existingMessage = tbody.querySelector('.no-results');
    if (existingMessage) existingMessage.remove();
    
    if (visibleCount === 0) {
        const noResultsRow = document.createElement('tr');
        noResultsRow.className = 'no-results';
        noResultsRow.innerHTML = `
            <td colspan="7" class="text-center py-4 text-muted">
                <i class="bi bi-search me-2"></i>
                No users found matching "${searchTerm}"
                ${roleFilter ? ` in role "${roleFilter}"` : ''}
            </td>
        `;
        tbody.appendChild(noResultsRow);
    }
}

function clearSearch() {
    const searchInput = document.getElementById('userSearch');
    const roleSelect = document.getElementById('roleFilter');
    
    if (searchInput) searchInput.value = '';
    if (roleSelect) roleSelect.value = '';
    
    filterUsers();
}

function showAlert(message, type = 'info') {
    const alertPlaceholder = document.createElement('div');
    alertPlaceholder.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
    alertPlaceholder.style.zIndex = '9999';
    
    const alert = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    alertPlaceholder.innerHTML = alert;
    document.body.appendChild(alertPlaceholder);
    
    setTimeout(() => {
        const alertElement = alertPlaceholder.querySelector('.alert');
        if (alertElement) {
            new bootstrap.Alert(alertElement).close();
        }
        setTimeout(() => alertPlaceholder.remove(), 150);
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}