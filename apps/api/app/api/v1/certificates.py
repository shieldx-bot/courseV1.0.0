from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from app.core.deps import get_current_user
from app.core.response import api_response, error_response
from app.services.certificate import (
    get_certificates,
    get_certificate,
    issue_certificate,
    download_certificate_pdf,
    verify_certificate,
)
from app.db.mongodb import get_db

router = APIRouter()


@router.get("/certificates")
async def list_certificates(user: dict = Depends(get_current_user)):
    certs = await get_certificates(user["id"])
    return api_response(certs)


@router.get("/certificates/{cert_id}")
async def get_single_certificate(cert_id: str, user: dict = Depends(get_current_user)):
    cert = await get_certificate(cert_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    if cert["user_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not your certificate")
    return api_response(cert)


@router.post("/certificates/issue/{course_id}")
async def issue( course_id: str, user: dict = Depends(get_current_user)):
    cert = await issue_certificate(user["id"], course_id)
    if not cert:
        db = get_db()
        course = await db.courses.find_one({"_id": course_id})
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        raise HTTPException(status_code=400, detail="Complete all lessons first")
    return api_response(cert)


@router.get("/certificates/{cert_id}/download")
async def download(cert_id: str, user: dict = Depends(get_current_user)):
    cert = await get_certificate(cert_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    if cert["user_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not your certificate")

    pdf_bytes = await download_certificate_pdf(cert_id)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="certificate-{cert_id}.pdf"',
        },
    )


@router.get("/verify/{code}")
async def verify(code: str):
    cert = await verify_certificate(code)
    if not cert:
        return api_response({"valid": False, "verification_code": code})
    return api_response(cert)
