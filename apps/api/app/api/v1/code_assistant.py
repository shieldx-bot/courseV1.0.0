from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.core.deps import get_current_user
from app.core.response import api_response
from app.services.code_assistant import (
    generate_code,
    explain_code,
    debug_code,
    review_code,
)

router = APIRouter()


class GenerateCodeRequest(BaseModel):
    task: str = Field(..., min_length=10, max_length=5000, description="Description of what code to generate")
    language: str = Field(default="python", pattern="^(python|javascript|typescript|java|go|rust|cpp|c|html|css|sql)$")
    context: str = Field(default="", max_length=2000, description="Additional context about the lesson/task")
    starter_code: str = Field(default="", max_length=3000, description="Starter code template")


class ExplainCodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=10000)
    language: str = Field(default="python", pattern="^(python|javascript|typescript|java|go|rust|cpp|c|html|css|sql)$")
    focus: str = Field(default="", max_length=500)


class DebugCodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=10000)
    language: str = Field(default="python", pattern="^(python|javascript|typescript|java|go|rust|cpp|c|html|css|sql)$")
    error: str = Field(..., min_length=1, max_length=2000)
    task: str = Field(default="", max_length=2000)


class ReviewCodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=15000)
    language: str = Field(default="python", pattern="^(python|javascript|typescript|java|go|rust|cpp|c|html|css|sql)$")
    task: str = Field(default="", max_length=1000)


@router.post("/code-assistant/generate")
async def generate_code_endpoint(
    body: GenerateCodeRequest,
    user: dict = Depends(get_current_user),
):
    """Generate code for a programming task."""
    result = await generate_code(
        task=body.task,
        language=body.language,
        context=body.context,
        starter_code=body.starter_code,
    )
    return api_response(result)


@router.post("/code-assistant/explain")
async def explain_code_endpoint(
    body: ExplainCodeRequest,
    user: dict = Depends(get_current_user),
):
    """Explain what a piece of code does."""
    result = await explain_code(
        code=body.code,
        language=body.language,
        focus=body.focus,
    )
    return api_response(result)


@router.post("/code-assistant/debug")
async def debug_code_endpoint(
    body: DebugCodeRequest,
    user: dict = Depends(get_current_user),
):
    """Debug code that has errors or unexpected behavior."""
    result = await debug_code(
        code=body.code,
        language=body.language,
        error=body.error,
        task=body.task,
    )
    return api_response(result)


@router.post("/code-assistant/review")
async def review_code_endpoint(
    body: ReviewCodeRequest,
    user: dict = Depends(get_current_user),
):
    """Get a code review with suggestions for improvement."""
    result = await review_code(
        code=body.code,
        language=body.language,
        task=body.task,
    )
    return api_response(result)