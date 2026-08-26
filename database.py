import sqlite3
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class Database:
    def __init__(self, db_name='warehouse.db'):
        self.db_name = db_name
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        # Таблиця користувачів
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_cartons INTEGER DEFAULT 0,
                last_activity TIMESTAMP
            )
        ''')

        # Таблиця ICC кодів
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS icc_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                icc_code TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                total_cartons INTEGER NOT NULL,
                current_cartons INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_completed INTEGER DEFAULT 0,
                last_4_digits TEXT NOT NULL
            )
        ''')

        # Таблиця палет
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pallet_number TEXT NOT NULL,
                icc_code_id INTEGER,
                user_id INTEGER,
                type TEXT NOT NULL,
                cartons_count INTEGER DEFAULT 0,
                is_closed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP,
                FOREIGN KEY (icc_code_id) REFERENCES icc_codes (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблиця активності
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Створити admin акаунт якщо його немає
        cursor.execute("SELECT * FROM users WHERE username = 'admin'")
        if not cursor.fetchone():
            hashed_password = generate_password_hash('admin1324')
            cursor.execute(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                ('admin', hashed_password, 'admin')
            )

        conn.commit()
        conn.close()

    # Методи для користувачів
    def create_user(self, username, password, role='user'):
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            hashed_password = generate_password_hash(password)
            cursor.execute(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                (username, hashed_password, role)
            )
            conn.commit()
            return True, "Користувача створено"
        except sqlite3.IntegrityError:
            return False, "Користувач вже існує"
        finally:
            conn.close()

    def verify_user(self, username, password):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user['password'], password):
            return True, dict(user)
        return False, None

    def get_user_by_id(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        conn.close()
        return dict(user) if user else None

    def get_all_users(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        users = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return users

    def delete_user(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()

    def update_user_cartons(self, user_id, cartons):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET total_cartons = total_cartons + ? WHERE id = ?",
            (cartons, user_id)
        )
        conn.commit()
        conn.close()

    # Методи для ICC кодів
    def create_icc_code(self, icc_code, type_name, total_cartons, last_4_digits):
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO icc_codes (icc_code, type, total_cartons, last_4_digits) VALUES (?, ?, ?, ?)",
                (icc_code, type_name, total_cartons, last_4_digits)
            )
            conn.commit()
            icc_id = cursor.lastrowid
            conn.close()
            return True, icc_id
        except sqlite3.IntegrityError:
            conn.close()
            return False, None

    def get_icc_code(self, icc_code):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM icc_codes WHERE icc_code = ?", (icc_code,))
        code = cursor.fetchone()
        conn.close()
        return dict(code) if code else None

    def get_icc_code_by_last_4(self, last_4_digits):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM icc_codes WHERE last_4_digits = ? ORDER BY created_at DESC LIMIT 1", (last_4_digits,))
        code = cursor.fetchone()
        conn.close()
        return dict(code) if code else None

    def get_icc_code_by_id(self, icc_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM icc_codes WHERE id = ?", (icc_id,))
        code = cursor.fetchone()
        conn.close()
        return dict(code) if code else None

    def update_icc_cartons(self, icc_code, cartons_added):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE icc_codes SET current_cartons = current_cartons + ? WHERE icc_code = ?",
            (cartons_added, icc_code)
        )
        cursor.execute(
            "UPDATE icc_codes SET is_completed = 1 WHERE icc_code = ? AND current_cartons >= total_cartons",
            (icc_code,)
        )
        conn.commit()
        conn.close()

    def update_icc_cartons_by_id(self, icc_id, cartons_added):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE icc_codes SET current_cartons = current_cartons + ? WHERE id = ?",
            (cartons_added, icc_id)
        )
        cursor.execute(
            "UPDATE icc_codes SET is_completed = 1 WHERE id = ? AND current_cartons >= total_cartons AND total_cartons > 0",
            (icc_id,)
        )
        conn.commit()
        conn.close()

    def get_all_icc_codes(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM icc_codes ORDER BY created_at DESC")
        codes = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return codes

    # Методи для палет
    def create_pallet(self, pallet_number, icc_code_id, user_id, type_name, cartons_count):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO pallets (pallet_number, icc_code_id, user_id, type, cartons_count) VALUES (?, ?, ?, ?, ?)",
            (pallet_number, icc_code_id, user_id, type_name, cartons_count)
        )
        conn.commit()
        pallet_id = cursor.lastrowid
        conn.close()
        return pallet_id

    def close_pallet(self, pallet_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE pallets SET is_closed = 1, closed_at = ? WHERE id = ?",
            (datetime.now(), pallet_id)
        )
        conn.commit()
        conn.close()

    def get_open_pallet(self, icc_code_id, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM pallets WHERE icc_code_id = ? AND user_id = ? AND is_closed = 0 ORDER BY created_at DESC LIMIT 1",
            (icc_code_id, user_id)
        )
        pallet = cursor.fetchone()
        conn.close()
        return dict(pallet) if pallet else None

    def get_all_pallets(self, icc_code_id=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        if icc_code_id:
            cursor.execute("SELECT * FROM pallets WHERE icc_code_id = ? ORDER BY created_at DESC", (icc_code_id,))
        else:
            cursor.execute("SELECT * FROM pallets ORDER BY created_at DESC")
        pallets = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return pallets

    def get_closed_pallets_count(self, user_id, type_name):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) as count FROM pallets WHERE user_id = ? AND type = ? AND is_closed = 1",
            (user_id, type_name)
        )
        result = cursor.fetchone()
        conn.close()
        return result['count'] if result else 0

    def update_pallet_cartons(self, pallet_id, cartons_added):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE pallets SET cartons_count = cartons_count + ? WHERE id = ?",
            (cartons_added, pallet_id)
        )
        conn.commit()
        conn.close()

    # Методи для логів активності
    def log_activity(self, user_id, action, details=""):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)",
            (user_id, action, details)
        )
        # Оновити last_activity для користувача
        if user_id:
            cursor.execute(
                "UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
                (user_id,)
            )
        conn.commit()
        conn.close()

    def get_user_activity(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM activity_log WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100",
            (user_id,)
        )
        logs = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return logs

    def get_all_activity(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 100")
        logs = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return logs
