let allUsers = [];
let selectedUserId = null;

// Показати таб адміна
function showAdminTab(tab) {
    const tabs = document.querySelectorAll('.admin-tab-content');
    const btns = document.querySelectorAll('.tab-btn');

    tabs.forEach(t => t.style.display = 'none');
    btns.forEach(b => b.classList.remove('active'));

    document.getElementById('admin-' + tab).style.display = 'block';
    event.target.classList.add('active');

    if (tab === 'users') {
        loadUsers();
    } else if (tab === 'activity') {
        loadUsersForActivity();
        loadActivity();
    }
}

// Завантажити користувачів для таблиці
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        allUsers = users;

        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');

            const roleLabel = user.role === 'admin' ? 'Admin' : 'User';
            const canDelete = user.role !== 'admin';

            // Визначити статус (онлайн якщо активність менше 5 хв тому)
            const lastActivity = user.last_activity ? new Date(user.last_activity) : null;
            const now = new Date();
            const isOnline = lastActivity && (now - lastActivity) < 5 * 60 * 1000;
            const statusBadge = isOnline
                ? '<span class="badge badge-success">Онлайн</span>'
                : '<span class="badge" style="background: #6c757d; color: white;">Офлайн</span>';

            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td><span class="badge badge-${user.role}">${roleLabel}</span></td>
                <td>${statusBadge}</td>
                <td>${user.total_cartons}</td>
                <td>${new Date(user.created_at).toLocaleString('uk-UA')}</td>
                <td>
                    ${canDelete ? `<button class="btn btn-small btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">Видалити</button>` : '-'}
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        alert('Помилка завантаження користувачів');
    }
}

// Завантажити список користувачів для панелі активності
async function loadUsersForActivity() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        allUsers = users;

        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';

        // Кнопка "Вся активність"
        const allActivityBtn = document.createElement('div');
        allActivityBtn.className = 'user-list-item' + (selectedUserId === null ? ' active' : '');
        allActivityBtn.innerHTML = '<strong>Вся активність</strong>';
        allActivityBtn.onclick = () => {
            selectedUserId = null;
            loadActivity();
            document.querySelectorAll('.user-list-item').forEach(item => item.classList.remove('active'));
            allActivityBtn.classList.add('active');
            document.getElementById('activity-title').textContent = 'Вся активність';
        };
        usersList.appendChild(allActivityBtn);

        // Розділити на онлайн та офлайн
        const now = new Date();
        const onlineUsers = users.filter(u => {
            const lastActivity = u.last_activity ? new Date(u.last_activity) : null;
            return lastActivity && (now - lastActivity) < 5 * 60 * 1000;
        });
        const offlineUsers = users.filter(u => {
            const lastActivity = u.last_activity ? new Date(u.last_activity) : null;
            return !lastActivity || (now - lastActivity) >= 5 * 60 * 1000;
        });

        // Онлайн користувачі
        if (onlineUsers.length > 0) {
            const onlineHeader = document.createElement('div');
            onlineHeader.style.cssText = 'padding: 0.75rem 1rem; background: #e8f5e9; font-weight: 600; color: #2e7d32;';
            onlineHeader.textContent = `🟢 Онлайн (${onlineUsers.length})`;
            usersList.appendChild(onlineHeader);

            onlineUsers.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'user-list-item' + (selectedUserId === user.id ? ' active' : '');
                userItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span><strong>${user.username}</strong></span>
                        <span class="badge badge-${user.role}" style="font-size: 0.7rem;">${user.role === 'admin' ? 'Admin' : 'User'}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #666;">Картонів: ${user.total_cartons}</div>
                `;
                userItem.onclick = () => {
                    selectedUserId = user.id;
                    loadActivity(user.id);
                    document.querySelectorAll('.user-list-item').forEach(item => item.classList.remove('active'));
                    userItem.classList.add('active');
                    document.getElementById('activity-title').textContent = `Активність: ${user.username}`;
                };
                usersList.appendChild(userItem);
            });
        }

        // Офлайн користувачі
        if (offlineUsers.length > 0) {
            const offlineHeader = document.createElement('div');
            offlineHeader.style.cssText = 'padding: 0.75rem 1rem; background: #f5f5f5; font-weight: 600; color: #666;';
            offlineHeader.textContent = `⚫ Офлайн (${offlineUsers.length})`;
            usersList.appendChild(offlineHeader);

            offlineUsers.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'user-list-item' + (selectedUserId === user.id ? ' active' : '');
                userItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span><strong>${user.username}</strong></span>
                        <span class="badge badge-${user.role}" style="font-size: 0.7rem;">${user.role === 'admin' ? 'Admin' : 'User'}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #666;">Картонів: ${user.total_cartons}</div>
                `;
                userItem.onclick = () => {
                    selectedUserId = user.id;
                    loadActivity(user.id);
                    document.querySelectorAll('.user-list-item').forEach(item => item.classList.remove('active'));
                    userItem.classList.add('active');
                    document.getElementById('activity-title').textContent = `Активність: ${user.username}`;
                };
                usersList.appendChild(userItem);
            });
        }
    } catch (error) {
        alert('Помилка завантаження користувачів');
    }
}

// Видалити користувача
async function deleteUser(userId, username) {
    if (!confirm(`Видалити користувача ${username}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/delete_user/${userId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            alert('Користувача видалено');
            loadUsers();
        } else {
            alert(data.error || 'Помилка видалення');
        }
    } catch (error) {
        alert('Помилка видалення користувача');
    }
}

// Завантажити активність (всю або конкретного користувача)
async function loadActivity(userId = null) {
    try {
        const url = userId
            ? `/api/admin/activity/${userId}`
            : '/api/admin/activity';

        const response = await fetch(url);
        const logs = await response.json();

        const tbody = document.getElementById('activity-table-body');
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #999;">Немає записів активності</td></tr>';
            return;
        }

        logs.forEach(log => {
            const row = document.createElement('tr');

            // Знайти ім'я користувача
            const user = allUsers.find(u => u.id === log.user_id);
            const username = user ? user.username : `User ID: ${log.user_id || 'System'}`;

            row.innerHTML = `
                <td>${new Date(log.timestamp).toLocaleString('uk-UA')}</td>
                <td><strong>${username}</strong></td>
                <td>${log.action}</td>
                <td>${log.details || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        alert('Помилка завантаження активності');
    }
}

// Створити акаунт
document.getElementById('create-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('account-username').value;
    const password = document.getElementById('account-password').value;
    const role = document.getElementById('account-role').value;

    if (password.length < 4) {
        alert('Пароль має бути не менше 4 символів');
        return;
    }

    // Перевірка що роль тільки user або admin
    if (role !== 'user' && role !== 'admin') {
        alert('Невірна роль');
        return;
    }

    try {
        const response = await fetch('/api/admin/create_account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Акаунт створено успішно!');
            document.getElementById('create-account-form').reset();
            showAdminTab('users');
        } else {
            alert(data.error || 'Помилка створення акаунта');
        }
    } catch (error) {
        alert('Помилка створення акаунта');
    }
});

// Завантажити користувачів при завантаженні
loadUsers();
