// static/js/users.js

let currentUsername = null;
let modals = {};
// Add debounce function to prevent too many searches while typing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all modals
    modals = {
        add: new bootstrap.Modal(document.getElementById('addUserModal')),
        edit: new bootstrap.Modal(document.getElementById('editUserModal')),
        reset: new bootstrap.Modal(document.getElementById('resetPasswordModal'))
    };

    // Setup password validation
    setupPasswordValidation();
    
    // Setup tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    const debouncedFilter = debounce(filterUsers, 300);
    
    const searchInput = document.getElementById('userSearch');
    const roleSelect = document.getElementById('roleFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', debouncedFilter);
    }
    
    if (roleSelect) {
        roleSelect.addEventListener('change', filterUsers);
    }
    
    // Add keyboard shortcut for search (Ctrl + K or Command + K)
    console.log('Initializing search and filter functionality');

    // Initialize search input
    if (searchInput) {
        const debouncedFilter = debounce(filterUsers, 300);
        searchInput.addEventListener('input', debouncedFilter);
        console.log('Search input initialized');
    } else {
        console.warn('Search input not found');
    }

    // Initialize role filter
    const roleFilter = document.getElementById('roleFilter');
    if (roleFilter) {
        roleFilter.addEventListener('change', filterUsers);
        console.log('Role filter initialized');
    } else {
        console.warn('Role filter not found');
    }

    // Add keyboard shortcut
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('userSearch');
            if (searchInput) {
                searchInput.focus();
            }
        }
    });
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

function showAddUserModal() {
    document.getElementById('addUserForm').reset();
    modals.add.show();
}

function closeModal(modalType) {
    if (modals[modalType]) {
        modals[modalType].hide();
    }
}

async function handleAddUser(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Password validation
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
    
    modals.edit.show();
}

async function handleEditUser(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
        
        const formData = new FormData(form);
        
        const response = await fetch(`/users/${currentUsername}`, {
            method: 'PUT',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Error updating user');
        }
        
        showAlert('User updated successfully!', 'success');
        modals.edit.hide();
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
        
        // Create FormData with the new_password field
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
        
        const data = await response.json();
        showAlert('Password reset successfully!', 'success');
        
        // Close the modal using Bootstrap
        const modal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
        modal.hide();
        
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
        const statusCell = userRow.querySelector('.badge');
        const isActive = statusCell.textContent.trim() === 'Active';
        
        const response = await fetch(`/users/${username}/toggle-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: !isActive })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
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
    // Get filter values
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase().trim() || '';
    const roleFilter = document.getElementById('roleFilter')?.value.toLowerCase() || '';
    
    // Get all user rows
    const tableRows = document.querySelectorAll('table.user-table tbody tr');
    
    // Debug logging
    console.log('Filtering with:', { searchTerm, roleFilter });
    console.log('Found rows:', tableRows.length);

    let visibleCount = 0;

    // Filter each row
    tableRows.forEach(row => {
        try {
            // Get text content safely with null checks
            const username = row.cells[0]?.textContent?.toLowerCase() || '';
            const fullName = row.cells[1]?.textContent?.toLowerCase() || '';
            const email = row.cells[2]?.textContent?.toLowerCase() || '';
            const role = row.cells[3]?.querySelector('.badge')?.textContent?.toLowerCase() || '';

            // Debug logging for each row
            console.log('Row data:', { username, fullName, email, role });

            // Check if row matches both filters
            const matchesSearch = !searchTerm || 
                username.includes(searchTerm) || 
                fullName.includes(searchTerm) || 
                email.includes(searchTerm) ||
                role.includes(searchTerm);

            const matchesRole = !roleFilter || role.includes(roleFilter);

            // Show/hide row
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

    // Update no-results message
    updateNoResultsMessage(visibleCount, searchTerm, roleFilter);
}
function updateNoResultsMessage(visibleCount, searchTerm, roleFilter) {
    const tbody = document.querySelector('table.user-table tbody');
    if (!tbody) return;

    // Remove existing no-results message if it exists
    const existingMessage = tbody.querySelector('.no-results');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Add no-results message if needed
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


function showAlert(message, type = 'info') {
    const alertPlaceholder = document.createElement('div');
    alertPlaceholder.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
    alertPlaceholder.style.zIndex = '9999';
    document.body.appendChild(alertPlaceholder);
    
    const alert = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    alertPlaceholder.innerHTML = alert;
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        const alertElement = alertPlaceholder.querySelector('.alert');
        if (alertElement) {
            const bsAlert = new bootstrap.Alert(alertElement);
            bsAlert.close();
        }
        setTimeout(() => alertPlaceholder.remove(), 150);
    }, 3000);
}function clearSearch() {
    const searchInput = document.getElementById('userSearch');
    const roleSelect = document.getElementById('roleFilter');
    
    if (searchInput) {
        searchInput.value = '';
    }
    if (roleSelect) {
        roleSelect.value = '';
    }
    
    filterUsers();
}