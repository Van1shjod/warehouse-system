from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from functools import wraps
from database import Database
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

db = Database()

# Декоратор для перевірки авторизації
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Необхідна авторизація'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Декоратор для перевірки ролі Admin (прибрано lider)
def admin_or_lider_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Необхідна авторизація'}), 401
        user = db.get_user_by_id(session['user_id'])
        if user['role'] not in ['admin']:
            return jsonify({'error': 'Недостатньо прав'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Декоратор для перевірки ролі Admin
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Необхідна авторизація'}), 401
        user = db.get_user_by_id(session['user_id'])
        if user['role'] != 'admin':
            return jsonify({'error': 'Потрібні права адміністратора'}), 403
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Введіть логін і пароль'}), 400

    success, message = db.create_user(username, password)
    if success:
        db.log_activity(None, 'register', f'Новий користувач: {username}')
        return jsonify({'message': message}), 200
    return jsonify({'error': message}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    success, user = db.verify_user(username, password)
    if success:
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        db.log_activity(user['id'], 'login', f'Вхід в систему')
        return jsonify({'message': 'Успішний вхід', 'role': user['role']}), 200
    return jsonify({'error': 'Невірний логін або пароль'}), 401

@app.route('/logout')
def logout():
    if 'user_id' in session:
        db.log_activity(session['user_id'], 'logout', 'Вихід з системи')
    session.clear()
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    user = db.get_user_by_id(session['user_id'])
    return render_template('dashboard.html', user=user)

@app.route('/admin')
@admin_required
def admin_panel():
    return render_template('admin.html')

@app.route('/lider')
@admin_required
def lider_panel():
    return render_template('lider.html')

# API для роботи з ICC кодами
@app.route('/api/icc/check', methods=['POST'])
@login_required
def check_icc():
    data = request.get_json()
    icc_last_4 = data.get('icc_code')  # Тепер це останні 4 цифри
    type_name = data.get('type')

    # Перевірка що введено 4 цифри
    if not icc_last_4 or len(icc_last_4) != 4 or not icc_last_4.isdigit():
        return jsonify({'error': 'Введіть рівно 4 цифри'}), 400

    # Шукаємо ICC код що закінчується на ці 4 цифри
    existing = db.get_icc_code_by_last_4(icc_last_4)
    if existing:
        # Перевірка чи завершено
        if existing['is_completed']:
            return jsonify({'status': 'completed', 'message': 'Цей ICC код вже завершено!'}), 200

        # Отримати відкриту палету
        open_pallet = db.get_open_pallet(existing['id'], session['user_id'])

        return jsonify({
            'status': 'exists',
            'icc_data': existing,
            'open_pallet': open_pallet
        }), 200

    return jsonify({'status': 'new'}), 200

@app.route('/api/icc/create', methods=['POST'])
@login_required
def create_icc():
    data = request.get_json()
    icc_last_4 = data.get('icc_code')  # Тепер це останні 4 цифри
    type_name = data.get('type')
    total_cartons = data.get('total_cartons')

    # Перевірка що введено 4 цифри
    if not icc_last_4 or len(icc_last_4) != 4 or not icc_last_4.isdigit():
        return jsonify({'error': 'Введіть рівно 4 цифри'}), 400

    if type_name == 'mix':
        total_cartons = 0  # Для Mix не потрібно вказувати загальну кількість

    # Генеруємо унікальний ICC код: тип + останні_4_цифри + timestamp
    import time
    icc_code = f"{type_name.upper()}-{icc_last_4}-{int(time.time())}"

    success, icc_id = db.create_icc_code(icc_code, type_name, total_cartons, icc_last_4)
    if success:
        db.log_activity(session['user_id'], 'create_icc', f'Створено ICC код: {icc_last_4} ({type_name})')
        return jsonify({'message': 'ICC код створено', 'icc_id': icc_id}), 200
    return jsonify({'error': 'Помилка створення ICC коду'}), 400

@app.route('/api/pallet/add', methods=['POST'])
@login_required
def add_to_pallet():
    data = request.get_json()
    icc_last_4 = data.get('icc_code')  # Останні 4 цифри
    cartons_count = data.get('cartons_count')
    pallet_number = data.get('pallet_number')

    icc_data = db.get_icc_code_by_last_4(icc_last_4)
    if not icc_data:
        return jsonify({'error': 'ICC код не знайдено'}), 404

    # Перевірка чи є відкрита палета
    open_pallet = db.get_open_pallet(icc_data['id'], session['user_id'])

    if not open_pallet:
        # Створити нову палету
        if not pallet_number:
            return jsonify({'error': 'need_pallet_number', 'message': 'Введіть номер палети'}), 400

        pallet_id = db.create_pallet(pallet_number, icc_data['id'], session['user_id'], icc_data['type'], cartons_count)
        db.log_activity(session['user_id'], 'create_pallet', f'Створено палету {pallet_number} для ICC-{icc_last_4}')
    else:
        # Додати до існуючої палети
        pallet_id = open_pallet['id']
        db.update_pallet_cartons(pallet_id, cartons_count)

    # Оновити лічильник ICC коду
    db.update_icc_cartons_by_id(icc_data['id'], cartons_count)

    # Оновити статистику користувача
    db.update_user_cartons(session['user_id'], cartons_count)

    db.log_activity(session['user_id'], 'add_cartons', f'Додано {cartons_count} картонів до ICC-{icc_last_4}')

    # Перевірити чи завершено
    updated_icc = db.get_icc_code_by_id(icc_data['id'])
    is_completed = updated_icc['is_completed']

    return jsonify({
        'message': 'Картони додано',
        'current_cartons': updated_icc['current_cartons'],
        'total_cartons': updated_icc['total_cartons'],
        'is_completed': is_completed
    }), 200

@app.route('/api/pallet/close', methods=['POST'])
@login_required
def close_pallet():
    data = request.get_json()
    icc_last_4 = data.get('icc_code')  # Останні 4 цифри

    icc_data = db.get_icc_code_by_last_4(icc_last_4)
    if not icc_data:
        return jsonify({'error': 'ICC код не знайдено'}), 404

    open_pallet = db.get_open_pallet(icc_data['id'], session['user_id'])
    if open_pallet:
        db.close_pallet(open_pallet['id'])
        db.log_activity(session['user_id'], 'close_pallet', f'Закрито палету {open_pallet["pallet_number"]}')
        return jsonify({'message': 'Палету закрито'}), 200

    return jsonify({'error': 'Немає відкритої палети'}), 400

@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    user_id = session['user_id']

    stats = {
        'single_pallets': db.get_closed_pallets_count(user_id, 'single'),
        'mix_pallets': db.get_closed_pallets_count(user_id, 'mix'),
        'vevor_pallets': db.get_closed_pallets_count(user_id, 'vevor')
    }

    return jsonify(stats), 200

# API для Admin (було Lider)
@app.route('/api/lider/pallets', methods=['GET'])
@admin_required
def get_all_pallets_info():
    pallets = db.get_all_pallets()
    icc_codes = db.get_all_icc_codes()
    users = db.get_all_users()

    # Збагатити палети інформацією
    result = []
    for pallet in pallets:
        icc = next((i for i in icc_codes if i['id'] == pallet['icc_code_id']), None)
        user = next((u for u in users if u['id'] == pallet['user_id']), None)

        result.append({
            'pallet': pallet,
            'icc': icc,
            'user': user
        })

    return jsonify(result), 200

@app.route('/api/lider/icc_codes', methods=['GET'])
@admin_required
def get_all_icc():
    codes = db.get_all_icc_codes()
    return jsonify(codes), 200

# API для Admin
@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users_admin():
    users = db.get_all_users()
    return jsonify(users), 200

@app.route('/api/admin/create_account', methods=['POST'])
@admin_required
def create_account():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')

    # Перевірка валідності ролі (тільки user або admin)
    if role not in ['user', 'admin']:
        return jsonify({'error': 'Невірна роль'}), 400

    success, message = db.create_user(username, password, role)
    if success:
        db.log_activity(session['user_id'], 'create_account', f'Створено {role}: {username}')
        return jsonify({'message': f'Акаунт {role} створено'}), 200
    return jsonify({'error': message}), 400

@app.route('/api/admin/delete_user/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user_admin(user_id):
    user = db.get_user_by_id(user_id)
    if user and user['role'] != 'admin':
        db.delete_user(user_id)
        db.log_activity(session['user_id'], 'delete_user', f'Видалено користувача ID: {user_id}')
        return jsonify({'message': 'Користувача видалено'}), 200
    return jsonify({'error': 'Не можна видалити адміна'}), 400

@app.route('/api/admin/activity', methods=['GET'])
@admin_required
def get_all_activity_admin():
    activity = db.get_all_activity()
    return jsonify(activity), 200

@app.route('/api/admin/activity/<int:user_id>', methods=['GET'])
@admin_required
def get_user_activity_admin(user_id):
    activity = db.get_user_activity(user_id)
    return jsonify(activity), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
