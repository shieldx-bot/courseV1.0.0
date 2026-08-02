import uuid
import hashlib
import logging
from datetime import datetime, timezone
from io import BytesIO
from fpdf import FPDF

from app.core.config import settings
from app.db.mongodb import get_db

logger = logging.getLogger(__name__)


def _generate_verification_code(user_id: str, course_id: str, completed_at: str) -> str:
    raw = f"{user_id}:{course_id}:{completed_at}:{settings.jwt_secret}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16].upper()


def _compute_total_hours(course: dict) -> float:
    total_seconds = sum(
        lesson.get("duration_seconds", 0) for lesson in course.get("syllabus", [])
    )
    return round(total_seconds / 3600, 1)


class CertificatePDF(FPDF):
    def __init__(self):
        super().__init__(orientation="L", unit="mm", format="A4")
        self.set_auto_page_break(auto=False, margin=0)

    def _add_border(self):
        self.set_draw_color(41, 128, 185)
        self.set_line_width(1.5)
        self.rect(10, 10, self.w - 20, self.h - 20)
        self.set_draw_color(44, 62, 80)
        self.set_line_width(0.5)
        self.rect(13, 13, self.w - 26, self.h - 26)

    def _add_header_text(self):
        self.set_y(50)
        self.set_font("Helvetica", "B", 36)
        self.set_text_color(44, 62, 80)
        self.cell(0, 15, "CERTIFICATE OF COMPLETION", align="C", new_x="LMARGIN", new_y="NEXT")

    def _add_body(self, user_name: str, course_title: str, hours: float, date_str: str, code: str):
        self.set_y(78)
        self.set_font("Helvetica", "", 14)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, "This certifies that", align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_y(92)
        self.set_font("Helvetica", "B", 28)
        self.set_text_color(41, 128, 185)
        self.cell(0, 15, user_name, align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_y(112)
        self.set_font("Helvetica", "", 14)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, "has successfully completed", align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_y(126)
        self.set_font("Helvetica", "B", 22)
        self.set_text_color(44, 62, 80)
        self.cell(0, 15, course_title, align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_y(148)
        self.set_font("Helvetica", "", 13)
        self.set_text_color(100, 100, 100)
        self.cell(
            0, 10,
            f"Completed on {date_str}  |  {hours} hour{'s' if hours != 1 else ''} of learning",
            align="C",
            new_x="LMARGIN",
            new_y="NEXT",
        )

        self.set_y(175)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(160, 160, 160)
        self.cell(0, 8, f"Verification code: {code}", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 8, f"Verify at: {settings.frontend_url}/verify/cert/{code}", align="C", new_x="LMARGIN", new_y="NEXT")

    def _add_footer(self):
        self.set_y(215)
        self.set_font("Helvetica", "I", 10)
        self.set_text_color(160, 160, 160)
        self.cell(0, 10, "Ascendly - Premium Online Learning", align="C", new_x="LMARGIN", new_y="NEXT")


def generate_pdf(user_name: str, course_title: str, hours: float, date_str: str, code: str) -> bytes:
    pdf = CertificatePDF()
    pdf.add_page()
    pdf._add_border()
    pdf._add_header_text()
    pdf._add_body(user_name, course_title, hours, date_str, code)
    pdf._add_footer()
    return pdf.output()


async def get_certificates(user_id: str) -> list[dict]:
    db = get_db()
    certs = await db.certificates.find({"user_id": user_id}).sort("completed_at", -1).to_list(100)
    return [
        {
            "id": c["_id"],
            "user_id": c["user_id"],
            "course_id": c["course_id"],
            "course_title": c["course_title"],
            "user_name": c["user_name"],
            "completed_at": c["completed_at"],
            "verification_code": c["verification_code"],
            "hours": c["hours"],
        }
        for c in certs
    ]


async def get_certificate(cert_id: str) -> dict | None:
    db = get_db()
    c = await db.certificates.find_one({"_id": cert_id})
    if not c:
        return None
    return {
        "id": c["_id"],
        "user_id": c["user_id"],
        "course_id": c["course_id"],
        "course_title": c["course_title"],
        "user_name": c["user_name"],
        "completed_at": c["completed_at"],
        "verification_code": c["verification_code"],
        "hours": c["hours"],
    }


async def verify_certificate(code: str) -> dict | None:
    db = get_db()
    c = await db.certificates.find_one({"verification_code": code})
    if not c:
        return None
    return {
        "id": c["_id"],
        "user_name": c["user_name"],
        "course_title": c["course_title"],
        "completed_at": c["completed_at"],
        "verification_code": c["verification_code"],
        "hours": c["hours"],
        "valid": True,
    }


async def issue_certificate(user_id: str, course_id: str) -> dict | None:
    db = get_db()

    user = await db.users.find_one({"_id": user_id})
    if not user:
        logger.warning("User %s not found for certificate issuance", user_id)
        return None

    course = await db.courses.find_one({"_id": course_id})
    if not course:
        logger.warning("Course %s not found for certificate issuance", course_id)
        return None

    lesson_ids = {l["id"] for l in course.get("syllabus", [])}
    completed_lessons = await db.progress.count_documents(
        {"user_id": user_id, "lesson_id": {"$in": list(lesson_ids)}, "completed": True}
    )
    if completed_lessons < len(lesson_ids):
        logger.info(
            "User %s has not completed all lessons in %s (%d/%d)",
            user_id, course_id, completed_lessons, len(lesson_ids),
        )
        return None

    existing = await db.certificates.find_one({"user_id": user_id, "course_id": course_id})
    if existing:
        return {
            "id": existing["_id"],
            "user_id": existing["user_id"],
            "course_id": existing["course_id"],
            "course_title": existing["course_title"],
            "user_name": existing["user_name"],
            "completed_at": existing["completed_at"],
            "verification_code": existing["verification_code"],
            "hours": existing["hours"],
        }

    now = datetime.now(timezone.utc)
    completed_at = now.isoformat()
    user_name = user.get("name") or user.get("email", "Learner")
    course_title = course["title"]
    hours = _compute_total_hours(course)
    verification_code = _generate_verification_code(user_id, course_id, completed_at)

    cert_id = f"cert-{user_id}-{course_id}"
    doc = {
        "_id": cert_id,
        "user_id": user_id,
        "course_id": course_id,
        "course_title": course_title,
        "user_name": user_name,
        "completed_at": completed_at,
        "verification_code": verification_code,
        "hours": hours,
    }
    await db.certificates.insert_one(doc)
    logger.info("Certificate %s issued for user %s course %s", cert_id, user_id, course_id)

    # Publish domain event — learner notification / achievement domains react.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="CertificateIssued",
        producer="certificate.issue_certificate",
        payload={
            "certificate_id": cert_id,
            "user_id": user_id,
            "course_id": course_id,
            "course_title": course_title,
        },
    ))

    return {
        "id": cert_id,
        "user_id": user_id,
        "course_id": course_id,
        "course_title": course_title,
        "user_name": user_name,
        "completed_at": completed_at,
        "verification_code": verification_code,
        "hours": hours,
    }


async def download_certificate_pdf(cert_id: str) -> bytes | None:
    db = get_db()
    c = await db.certificates.find_one({"_id": cert_id})
    if not c:
        return None

    user_name = c["user_name"]
    course_title = c["course_title"]
    hours = c["hours"]
    completed_at = c["completed_at"]
    verification_code = c["verification_code"]

    try:
        dt = datetime.fromisoformat(completed_at)
        date_str = dt.strftime("%B %d, %Y")
    except (ValueError, TypeError):
        date_str = completed_at[:10]

    pdf_bytes = generate_pdf(user_name, course_title, hours, date_str, verification_code)
    return pdf_bytes
