from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///server_b.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

MAX_ALLOWED = 5

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    token = db.Column(db.String(200), nullable=False)
    profiles = db.Column(db.Integer, default=0)

class Profile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)

def create_tables():
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(username='demo').first():
            u = User(username='demo', token='valid-token-demo', profiles=0)
            db.session.add(u)
            db.session.commit()

def validate_token(token):
    return User.query.filter_by(token=token).first()

@app.route('/create_profile', methods=['POST'])
def create_profile():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    name = request.json.get('name', 'profile')

    user = validate_token(token)
    if not user:
        return jsonify({'error': 'invalid token'}), 401

    # DUNG: kiem tra quota trong database TRUOC khi chap nhan request.
    if user.profiles >= MAX_ALLOWED:
        return jsonify({
            'error': 'quota exceeded',
            'max_allowed': MAX_ALLOWED,
            'current': user.profiles
        }), 403

    profile = Profile(user_id=user.id, name=name)
    user.profiles += 1
    db.session.add(profile)
    db.session.commit()

    return jsonify({
        'status': 'created',
        'profile_id': profile.id,
        'user_profiles': user.profiles
    }), 201

if __name__ == '__main__':
    create_tables()
    app.run(host='127.0.0.1', port=5002, debug=False)
