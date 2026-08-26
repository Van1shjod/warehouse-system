let currentType = null;
let currentICCCode = null;
let currentICCData = null;
let currentPalletNumber = null;
let pendingCartonsCount = null;

// Завантажити статистику
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        document.getElementById('single-pallets').textContent = data.single_pallets;
        document.getElementById('mix-pallets').textContent = data.mix_pallets;
        document.getElementById('vevor-pallets').textContent = data.vevor_pallets;
    } catch (error) {
        console.error('Помилка завантаження статистики:', error);
    }
}

// Показати меню Sort
function showSortMenu() {
    document.getElementById('sort-menu').style.display = 'flex';
}

// Закрити меню Sort
function closeSortMenu() {
    document.getElementById('sort-menu').style.display = 'none';
}

// Вибрати тип
function selectType(type) {
    currentType = type;
    document.getElementById('current-type').textContent = type.toUpperCase();
    closeSortMenu();
    document.getElementById('work-area').style.display = 'block';
    resetWorkArea();
    // Автофокус на поле ICC коду для сканера
    setTimeout(() => {
        document.getElementById('icc-code-input').focus();
    }, 100);
}

// Закрити робочу область
function closeWorkArea() {
    document.getElementById('work-area').style.display = 'none';
    currentType = null;
    currentICCCode = null;
    currentICCData = null;
    currentPalletNumber = null;
    pendingCartonsCount = null;
    loadStats();
}

// Скинути робочу область
function resetWorkArea() {
    document.getElementById('icc-input-section').style.display = 'block';
    document.getElementById('new-icc-section').style.display = 'none';
    document.getElementById('existing-icc-section').style.display = 'none';
    document.getElementById('icc-code-input').value = '';
    currentICCCode = null;
    currentICCData = null;
    currentPalletNumber = null;
    pendingCartonsCount = null;
}

// Автоматична перевірка ICC коду після введення/сканування
document.addEventListener('DOMContentLoaded', () => {
    const iccInput = document.getElementById('icc-code-input');
    if (iccInput) {
        iccInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                checkICCCode();
            }
        });
    }
});

// Перевірити ICC код
async function checkICCCode() {
    const iccCode = document.getElementById('icc-code-input').value.trim();

    if (!iccCode) {
        return;
    }

    try {
        const response = await fetch('/api/icc/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ icc_code: iccCode, type: currentType })
        });

        const data = await response.json();

        if (data.status === 'completed') {
            alert(data.message);
            // Очистити поле для нового сканування
            document.getElementById('icc-code-input').value = '';
            document.getElementById('icc-code-input').focus();
            return;
        }

        if (data.status === 'new') {
            // Новий ICC код
            currentICCCode = iccCode;
            showNewICCForm();
        } else {
            // Існуючий ICC код
            currentICCCode = iccCode;
            currentICCData = data.icc_data;
            showExistingICCForm(data);
        }
    } catch (error) {
        alert('Помилка перевірки ICC коду');
    }
}

// Показати форму нового ICC
function showNewICCForm() {
    document.getElementById('icc-input-section').style.display = 'none';
    document.getElementById('new-icc-section').style.display = 'block';

    // Для Mix не потрібна загальна кількість
    if (currentType === 'mix') {
        document.getElementById('total-cartons-group').style.display = 'none';
        // Одразу створити ICC для Mix
        createNewICC();
    } else {
        document.getElementById('total-cartons-group').style.display = 'block';
        // Автофокус на поле кількості
        setTimeout(() => {
            document.getElementById('total-cartons-input').focus();
        }, 100);
    }
}

// Створити новий ICC
async function createNewICC() {
    let totalCartons = 0;

    if (currentType !== 'mix') {
        totalCartons = parseInt(document.getElementById('total-cartons-input').value);
        if (!totalCartons || totalCartons < 1) {
            return;
        }
    }

    try {
        const response = await fetch('/api/icc/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                icc_code: currentICCCode,
                type: currentType,
                total_cartons: totalCartons
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Очистити поле
            document.getElementById('total-cartons-input').value = '';
            // Перезавантажити як існуючий
            checkICCCode();
        } else {
            alert(data.error || 'Помилка створення ICC коду');
        }
    } catch (error) {
        alert('Помилка створення ICC коду');
    }
}

// Показати форму існуючого ICC
function showExistingICCForm(data) {
    document.getElementById('icc-input-section').style.display = 'none';
    document.getElementById('existing-icc-section').style.display = 'block';

    document.getElementById('display-icc-code').textContent = currentICCCode;
    updateProgress(data.icc_data);

    // Зберегти номер палети для відображення
    if (data.open_pallet) {
        currentPalletNumber = data.open_pallet.pallet_number;
        document.getElementById('pallet-location-display').textContent = currentPalletNumber;
        document.getElementById('pallet-location-info').style.display = 'block';
    } else {
        currentPalletNumber = null;
        document.getElementById('pallet-location-info').style.display = 'none';
    }

    // Показати поле для введення КІЛЬКОСТІ (спочатку)
    document.getElementById('cartons-input-group').style.display = 'block';
    document.getElementById('location-input-group').style.display = 'none';
    document.getElementById('pallet-confirm-group').style.display = 'none';

    // Автофокус на поле кількості картонів
    setTimeout(() => {
        document.getElementById('current-cartons-input').focus();
    }, 100);
}

// Оновити прогрес
function updateProgress(iccData) {
    const current = iccData.current_cartons;
    const total = iccData.total_cartons;

    document.getElementById('current-cartons').textContent = current;

    if (currentType === 'mix') {
        document.getElementById('total-cartons').textContent = '∞';
        document.getElementById('progress-fill').style.width = '50%';
    } else {
        document.getElementById('total-cartons').textContent = total;
        const percentage = (current / total) * 100;
        document.getElementById('progress-fill').style.width = percentage + '%';
    }

    // Показати значок завершення
    if (iccData.is_completed) {
        document.getElementById('completion-badge').style.display = 'flex';
    } else {
        document.getElementById('completion-badge').style.display = 'none';
    }
}

// Після введення кількості - перейти до введення номера локації
function proceedToLocationInput() {
    const cartonsCount = parseInt(document.getElementById('current-cartons-input').value);

    if (!cartonsCount || cartonsCount < 1) {
        return;
    }

    // Зберегти кількість картонів
    pendingCartonsCount = cartonsCount;

    // Сховати поле кількості, показати поле для номера локації
    document.getElementById('cartons-input-group').style.display = 'none';

    // Якщо вже є відкрита палета - показати підтвердження
    if (currentPalletNumber) {
        showConfirmLocation();
    } else {
        // Якщо немає палети - запитати нову
        document.getElementById('location-input-group').style.display = 'block';
        setTimeout(() => {
            document.getElementById('new-pallet-number-input').focus();
        }, 100);
    }
}

// Показати підтвердження локації
function showConfirmLocation() {
    document.getElementById('pallet-confirm-group').style.display = 'block';
    document.getElementById('pallet-confirm-display').textContent = currentPalletNumber;

    // Автофокус на поле підтвердження
    setTimeout(() => {
        document.getElementById('pallet-confirm-input').focus();
    }, 100);
}

// Обробка введення номера нової палети
function processNewPalletNumber() {
    const newPalletNumber = document.getElementById('new-pallet-number-input').value.trim();

    if (!newPalletNumber) {
        return;
    }

    // Зберегти як поточний номер палети
    currentPalletNumber = newPalletNumber;

    // Показати підтвердження
    document.getElementById('location-input-group').style.display = 'none';
    showConfirmLocation();
}

// Додати картони після підтвердження локації
async function addCartonsWithConfirmation() {
    const confirmedPallet = document.getElementById('pallet-confirm-input').value.trim();

    if (!confirmedPallet) {
        return;
    }

    if (confirmedPallet !== currentPalletNumber) {
        alert(`ПОМИЛКА! Палета не співпадає!\nОчікується: ${currentPalletNumber}\nВведено: ${confirmedPallet}`);
        document.getElementById('pallet-confirm-input').value = '';
        document.getElementById('pallet-confirm-input').focus();
        return;
    }

    // Підтвердження пройшло, додаємо картони
    try {
        const response = await fetch('/api/pallet/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                icc_code: currentICCCode,
                cartons_count: pendingCartonsCount,
                pallet_number: currentPalletNumber
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Показати успіх
            showSuccessAndReset();

            // Оновити прогрес в фоні
            currentICCData.current_cartons = data.current_cartons;
            currentICCData.total_cartons = data.total_cartons;
            currentICCData.is_completed = data.is_completed;
        } else {
            alert(data.error || 'Помилка додавання картонів');
            // Повернутись до введення
            backToCartonsInput();
        }
    } catch (error) {
        alert('Помилка додавання картонів');
        backToCartonsInput();
    }
}

// Показати успіх і скинути до початку
function showSuccessAndReset() {
    // Показати повідомлення успіху
    const successMsg = document.createElement('div');
    successMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #28a745; color: white; padding: 2rem 3rem; border-radius: 12px; font-size: 1.5rem; font-weight: bold; z-index: 10000; box-shadow: 0 10px 40px rgba(0,0,0,0.3);';
    successMsg.textContent = '✓ УСПІШНО ДОДАНО';
    document.body.appendChild(successMsg);

    setTimeout(() => {
        successMsg.remove();
        // Повернутись на початок - поле ICC коду
        resetWorkArea();
        document.getElementById('work-area').style.display = 'block';
        document.getElementById('icc-input-section').style.display = 'block';
        setTimeout(() => {
            document.getElementById('icc-code-input').focus();
        }, 100);
    }, 1000);
}

// Повернутись до введення кількості
function backToCartonsInput() {
    document.getElementById('pallet-confirm-group').style.display = 'none';
    document.getElementById('location-input-group').style.display = 'none';
    document.getElementById('cartons-input-group').style.display = 'block';
    document.getElementById('pallet-confirm-input').value = '';
    document.getElementById('new-pallet-number-input').value = '';
    pendingCartonsCount = null;
    setTimeout(() => {
        document.getElementById('current-cartons-input').focus();
    }, 100);
}

// Обробка Enter для полів введення
document.addEventListener('DOMContentLoaded', () => {
    // Поле кількості картонів
    const currentCartonsInput = document.getElementById('current-cartons-input');
    if (currentCartonsInput) {
        currentCartonsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                proceedToLocationInput();
            }
        });
    }

    // Поле номера нової палети
    const newPalletInput = document.getElementById('new-pallet-number-input');
    if (newPalletInput) {
        newPalletInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                processNewPalletNumber();
            }
        });
    }

    // Поле підтвердження палети
    const palletConfirmInput = document.getElementById('pallet-confirm-input');
    if (palletConfirmInput) {
        palletConfirmInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCartonsWithConfirmation();
            }
        });
    }

    // Поле загальної кількості
    const totalCartonsInput = document.getElementById('total-cartons-input');
    if (totalCartonsInput) {
        totalCartonsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createNewICC();
            }
        });
    }
});

// Завантажити статистику при завантаженні сторінки
loadStats();
