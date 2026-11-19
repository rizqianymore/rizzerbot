#!/usr/bin/env python3
"""
JKT48 Member Full Dataset & Image Scraper
Uses Bright Data Proxy to scrape official JKT48 member directory and profiles.
Saves JSON files and images into database/jkt48/ organized by team.
"""

import os
import sys
import json
import time
import ssl
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

PROXY_URL = "http://brd-customer-hl_66a04297-zone-web_unlocker2:lahl63zlmvrs@brd.superproxy.io:22225"
BASE_DIR = os.path.join(os.getcwd(), "database", "jkt48")
IMAGES_DIR = os.path.join(BASE_DIR, "images")

MONTH_NAMES_ID = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

def get_opener():
    ctx = ssl._create_unverified_context()
    proxy_handler = urllib.request.ProxyHandler({"http": PROXY_URL, "https": PROXY_URL})
    return urllib.request.build_opener(proxy_handler, urllib.request.HTTPSHandler(context=ctx))

opener = get_opener()

def fetch_json(url, max_retries=3):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://jkt48.com/member"
    }
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(1, max_retries + 1):
        try:
            with opener.open(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            if attempt == max_retries:
                print(f"[ERROR] Failed fetching {url} after {max_retries} attempts: {e}", file=sys.stderr)
                return None
            time.sleep(2)

def download_image(url, save_path, max_retries=3):
    if not url or not url.startswith("http"):
        return None
    if os.path.exists(save_path) and os.path.getsize(save_path) > 1024:
        return save_path
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://jkt48.com/"
    }
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(1, max_retries + 1):
        try:
            with opener.open(req, timeout=30) as resp:
                content = resp.read()
                if len(content) > 1024:
                    with open(save_path, "wb") as f:
                        f.write(content)
                    return save_path
        except Exception as e:
            if attempt == max_retries:
                print(f"[WARN] Failed downloading image {url}: {e}", file=sys.stderr)
                return None
            time.sleep(1.5)
    return None

def format_date_id(iso_date_str):
    if not iso_date_str:
        return ""
    try:
        # e.g. "2008-08-05T17:00:00.000Z" -> Convert to UTC+7 WIB
        dt = datetime.fromisoformat(iso_date_str.replace("Z", "+00:00"))
        dt_wib = dt.astimezone(timezone(timedelta(hours=7)))
        day = f"{dt_wib.day:02d}"
        month = MONTH_NAMES_ID[dt_wib.month]
        year = dt_wib.year
        return f"{day} {month} {year}"
    except Exception:
        return iso_date_str

def process_member(item):
    member_id = item.get("jkt48_member_id")
    type_code = (item.get("type") or "TRAINEE").upper()
    name = item.get("name", "").strip()
    nickname = item.get("nickname", "").strip()
    code = item.get("code", "").strip()

    detail_url = f"https://jkt48.com/api/v1/members/{member_id}?lang=id"
    detail_res = fetch_json(detail_url)
    detail_data = detail_res.get("data") if detail_res and detail_res.get("status") else {}

    # Extract fields
    birth_date_raw = detail_data.get("birth_date") or ""
    birth_date_id = format_date_id(birth_date_raw)
    height_val = detail_data.get("body_height") or ""
    height_str = f"{height_val} cm" if height_val and not str(height_val).endswith("cm") else str(height_val)
    blood_type = (detail_data.get("blood_type") or "").strip()
    horoscope = (detail_data.get("horoscope") or "").strip()
    
    # Socials
    twitter = detail_data.get("twitter_account") or ""
    instagram = detail_data.get("instagram_account") or ""
    tiktok = detail_data.get("tiktok_account") or ""
    youtube_video = detail_data.get("youtube_profile_movie") or ""

    # Image URL
    photo_remote = detail_data.get("photo_1") or item.get("photo") or ""
    if not photo_remote and detail_data.get("photo"):
        photo_remote = f"https://jkt48.com/api/v1/storages/{detail_data['photo']}"

    # Determine team folder & slug
    team_slug = "trainee"
    if "LOVE" in type_code:
        team_slug = "love"
    elif "DREAM" in type_code:
        team_slug = "dream"
    elif "PASSION" in type_code:
        team_slug = "passion"
    elif "TRAINEE" in type_code:
        team_slug = "trainee"

    member_slug = name.lower().replace(" ", "-") + f"-{member_id}"
    web_url = f"https://jkt48.com/member/detail?member={member_slug}&type="

    # Image download destination
    image_filename = f"{member_id}_{code.lower() or name.lower().replace(' ', '_')}.jpg"
    team_image_dir = os.path.join(IMAGES_DIR, team_slug)
    os.makedirs(team_image_dir, exist_ok=True)
    local_image_path = os.path.join(team_image_dir, image_filename)
    relative_image_path = f"database/jkt48/images/{team_slug}/{image_filename}"

    # Download image
    download_image(photo_remote, local_image_path)

    member_record = {
        "id": member_id,
        "nama": name,
        "panggilan": nickname,
        "kode": code,
        "tim": type_code.capitalize(),
        "kategori_tim": team_slug,
        "tanggal_lahir": birth_date_id,
        "tanggal_lahir_raw": birth_date_raw,
        "tinggi": height_str,
        "golongan_darah": blood_type,
        "horoskop": horoscope,
        "media_sosial": {
            "twitter": f"https://twitter.com/{twitter}" if twitter else "",
            "instagram": f"https://instagram.com/{instagram}" if instagram else "",
            "tiktok": f"https://tiktok.com/@{tiktok}" if tiktok else "",
            "youtube_movie": youtube_video
        },
        "foto_url": photo_remote,
        "foto_lokal": relative_image_path,
        "url_profil": web_url,
        "fan_letter_url": "https://jkt48.com/fan-letter-gift"
    }

    print(f"  [+] [{type_code}] {name} ({nickname}) - Selesai.")
    return member_record

def main():
    print("[1/4] Menginisialisasi direktori output...")
    os.makedirs(BASE_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    for t in ["love", "dream", "passion", "trainee"]:
        os.makedirs(os.path.join(IMAGES_DIR, t), exist_ok=True)

    print("[2/4] Mengambil daftar seluruh member dari official API (via Bright Data Proxy)...")
    list_url = "https://jkt48.com/api/v1/members?lang=id"
    list_res = fetch_json(list_url)
    if not list_res or not list_res.get("status"):
        print("[ERROR] Gagal memuat daftar member!", file=sys.stderr)
        sys.exit(1)

    raw_members = list_res.get("data", [])
    print(f"Ditemukan {len(raw_members)} member resmi.")

    print("[3/4] Melakukan scraping detail profil & mengunduh foto tiap member...")
    all_members = []
    
    # Run with multithreading for fast scraping
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process_member, m): m for m in raw_members}
        for future in as_completed(futures):
            try:
                res = future.result()
                if res:
                    all_members.append(res)
            except Exception as e:
                print(f"[ERROR] Thread exception: {e}", file=sys.stderr)

    # Sort by ID ascending
    all_members.sort(key=lambda x: x["id"])

    # Categorize by team
    teams = {
        "love": [],
        "dream": [],
        "passion": [],
        "trainee": []
    }

    for m in all_members:
        team_key = m.get("kategori_tim", "trainee")
        if team_key in teams:
            teams[team_key].append(m)
        else:
            teams["trainee"].append(m)

    print("[4/4] Menyimpan file JSON ke database/jkt48/...")
    # Write all.json
    all_file = os.path.join(BASE_DIR, "all.json")
    with open(all_file, "w", encoding="utf-8") as f:
        json.dump(all_members, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {all_file} ({len(all_members)} member)")

    # Write each team file
    for team_name, members in teams.items():
        team_file = os.path.join(BASE_DIR, f"{team_name}.json")
        with open(team_file, "w", encoding="utf-8") as f:
            json.dump(members, f, ensure_ascii=False, indent=2)
        print(f"  ✓ {team_file} ({len(members)} member)")

    print("\n🎉 SCRAPING JKT48 MEMBER & FOTO SELESAI DENGAN SUKSES!")

if __name__ == "__main__":
    main()
