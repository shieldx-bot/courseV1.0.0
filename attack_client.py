import requests

BASE_URL_A = 'http://127.0.0.1:5001'
BASE_URL_B = 'http://127.0.0.1:5002'
TOKEN = 'valid-token-demo'

def attack_server_a(n=20):
    print(f'=== Tan cong Server A (thiet ke sai), gui {n} request ===')
    success = 0
    blocked = 0
    for i in range(n):
        r = requests.post(
            f'{BASE_URL_A}/create_profile',
            headers={'Authorization': f'Bearer {TOKEN}'},
            json={'name': f'profile-{i}'}
        )
        if r.status_code == 201:
            success += 1
        else:
            blocked += 1
    print(f'Thanh cong: {success}, Bi chuan: {blocked}')
    print('Ket luan: Client bypass giao dien, tao vo han profile duoc.\n')

def attack_server_b(n=20):
    print(f'=== Tan cong Server B (thiet ke dung), gui {n} request ===')
    success = 0
    blocked = 0
    for i in range(n):
        r = requests.post(
            f'{BASE_URL_B}/create_profile',
            headers={'Authorization': f'Bearer {TOKEN}'},
            json={'name': f'profile-{i}'}
        )
        if r.status_code == 201:
            success += 1
        else:
            blocked += 1
    print(f'Thanh cong: {success}, Bi chuan: {blocked}')
    print('Ket luan: Server B chan dung tai database, khong phai tai client.\n')

if __name__ == '__main__':
    attack_server_a()
    attack_server_b()
