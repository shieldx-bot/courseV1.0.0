from fastapi import HTTPException


class AppException(HTTPException):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None):
        self.code = code
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message)
