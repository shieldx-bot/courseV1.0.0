from fastapi import HTTPException


class AppException(HTTPException):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None):
        self.code = code
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", details: dict | None = None):
        super().__init__(code="NOT_FOUND", message=message, status_code=404, details=details)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Access forbidden", details: dict | None = None):
        super().__init__(code="FORBIDDEN", message=message, status_code=403, details=details)
