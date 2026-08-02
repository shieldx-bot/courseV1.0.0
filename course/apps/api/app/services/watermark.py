import asyncio
import os
import shutil
import tempfile

from app.services.drive import get_file_bytes
from app.services.r2_storage import r2_storage


async def migrate_drive_to_r2(lesson_id: str, drive_file_id: str, watermark_text: str | None = None) -> str:
    """Migrate a single video from Google Drive → R2, optionally watermarking."""
    original = await get_file_bytes(drive_file_id)
    if not original:
        raise RuntimeError(f"Could not fetch video from Drive: {drive_file_id}")

    data = original
    if watermark_text:
        try:
            data = await _apply_watermark(original, watermark_text)
        except Exception:
            pass

    key = await r2_storage.upload(lesson_id, data)
    return key


async def _apply_watermark(data: bytes, text: str) -> bytes:
    tmpdir = tempfile.mkdtemp()
    in_path = os.path.join(tmpdir, "in.mp4")
    out_path = os.path.join(tmpdir, "out.mp4")

    try:
        with open(in_path, "wb") as f:
            f.write(data)

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-i", in_path,
            "-vf", f"drawtext=text='{text}':fontsize=24:fontcolor=white:x=10:y=10:alpha=0.5",
            "-codec:a", "copy",
            "-y",
            out_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        rc = await proc.wait()
        if rc != 0:
            raise RuntimeError(f"ffmpeg exited with code {rc}")

        with open(out_path, "rb") as f:
            return f.read()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
