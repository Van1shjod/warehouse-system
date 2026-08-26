// Показати таб Lider
function showLiderTab(tab) {
    const tabs = document.querySelectorAll('.admin-tab-content');
    const btns = document.querySelectorAll('.tab-btn');

    tabs.forEach(t => t.style.display = 'none');
    btns.forEach(b => b.classList.remove('active'));

    document.getElementById('lider-' + tab).style.display = 'block';
    event.target.classList.add('active');

    if (tab === 'pallets') {
        loadPallets();
    } else if (tab === 'icc') {
        loadICCCodes();
    } else if (tab === 'users') {
        loadUsersActivity();
    }
}

// Завантажити палети
async function loadPallets() {
    try {
        const response = await fetch('/api/lider/pallets');
        const data = await response.json();

        const tbody = document.getElementById('pallets-table-body');
        tbody.innerHTML = '';

        data.forEach(item => {
            const pallet = item.pallet;
            const icc = item.icc;
            const user = item.user;

            const row = document.createElement('tr');
            const statusText = pallet.is_closed ? 'Закрита' : 'Відкрита';
            const statusClass = pallet.is_closed ? 'badge-success' : 'badge-warning';

            row.innerHTML = `
                <td>${pallet.pallet_number}</td>
                <td>${icc ? icc.icc_code : '-'}</td>
                <td>${pallet.type.toUpperCase()}</td>
                <td>${pallet.cartons_count}</td>
                <td>${user ? user.username : '-'}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${new Date(pallet.created_at).toLocaleString('uk-UA')}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        alert('Помилка завантаження палет');
    }
}

// Завантажити ICC коди
async function loadICCCodes() {
    try {
        const response = await fetch('/api/lider/icc_codes');
        const codes = await response.json();

        const tbody = document.getElementById('icc-table-body');
        tbody.innerHTML = '';

        codes.forEach(icc => {
            const row = document.createElement('tr');

            let progressText;
            let progressBar;
            if (icc.type === 'mix') {
                progressText = `${icc.current_cartons} картонів`;
                progressBar = '<div class="mini-progress"><div class="mini-progress-fill" style="width: 50%"></div></div>';
            } else {
                const percentage = (icc.current_cartons / icc.total_cartons) * 100;
                progressText = `${icc.current_cartons} / ${icc.total_cartons}`;
                progressBar = `<div class="mini-progress"><div class="mini-progress-fill" style="width: ${percentage}%"></div></div>`;
            }

            const statusText = icc.is_completed ? 'Готово ✓' : 'В процесі';
            const statusClass = icc.is_completed ? 'badge-success' : 'badge-info';

            row.innerHTML = `
                <td><strong>${icc.icc_code}</strong></td>
                <td>${icc.type.toUpperCase()}</td>
                <td>${progressBar}</td>
                <td>${progressText}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${new Date(icc.created_at).toLocaleString('uk-UA')}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        alert('Помилка завантаження ICC кодів');
    }
}

// Завантажити активність користувачів
async function loadUsersActivity() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();

        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');

            const roleLabel = user.role === 'admin' ? 'Admin' :
                            user.role === 'lider' ? 'Lider' : 'User';

            row.innerHTML = `
                <td>${user.username}</td>
                <td><span class="badge badge-${user.role}">${roleLabel}</span></td>
                <td><strong>${user.total_cartons}</strong> картонів</td>
                <td>${new Date(user.created_at).toLocaleString('uk-UA')}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        alert('Помилка завантаження користувачів');
    }
}

// Завантажити палети при завантаженні
loadPallets();
