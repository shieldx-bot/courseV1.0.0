"""Code Assistant - AI-powered code generation, explanation, and debugging for coding lessons.

Uses Groq/OpenAI-compatible LLM for fast, free code assistance.
"""

import json
import logging
import re
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


_SYSTEM_PROMPTS = {
    "generate": """You are an expert programming tutor helping learners write code.

Rules:
1. Write clean, readable, well-commented code appropriate for the learner's level
2. Follow best practices and language conventions
3. Include brief comments explaining key concepts
4. If the task is ambiguous, ask clarifying questions or provide a reasonable default
5. Return ONLY the code (no markdown, no explanation unless requested)
6. Use the specified language and framework/library if mentioned""",

    "explain": """You are an expert programming tutor explaining code to a learner.

Rules:
1. Explain what the code does in simple terms
2. Break down complex parts step by step
3. Highlight key concepts and patterns used
4. Point out potential issues or improvements
5. Use analogies when helpful
6. Keep explanations beginner-friendly but accurate
7. Format with clear sections using plain text (no markdown)""",

    "debug": """You are an expert programmer helping a learner debug their code.

Rules:
1. Identify the bug(s) clearly
2. Explain WHY the bug occurs
3. Provide the corrected code
4. Explain the fix
5. Suggest how to avoid similar bugs
6. Be encouraging - debugging is a key skill
7. Format with clear sections using plain text (no markdown)""",

    "review": """You are a senior developer doing a code review for a learner.

Rules:
1. Acknowledge what's done well
2. Identify issues: bugs, style, performance, security, readability
3. Provide specific, actionable suggestions
4. Show improved version of problematic sections
5. Explain WHY each suggestion matters
6. Be constructive and educational
7. Format with clear sections using plain text (no markdown)""",
}


def _strip_markdown(text: str) -> str:
    """Remove markdown code fences and formatting."""
    text = re.sub(r"^```\w*\n", "", text.strip())
    text = re.sub(r"\n```$", "", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text.strip()


async def _call_llm(messages: list[dict[str, str]], max_tokens: int = 2000) -> str:
    """Call the LLM (Groq/OpenAI-compatible) with the given messages."""
    if not settings.openai_api_key:
        raise ValueError("OpenAI/Groq API key not configured")

    import openai

    client = openai.OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )

    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.2,
    )

    return response.choices[0].message.content or ""


async def generate_code(
    task: str,
    language: str = "python",
    context: str = "",
    starter_code: str = "",
) -> dict[str, Any]:
    """Generate code for a given task."""
    prompt_parts = [
        f"Task: {task}",
        f"Language: {language}",
    ]
    if context:
        prompt_parts.append(f"Additional context: {context}")
    if starter_code:
        prompt_parts.append(f"Starter code:\n```{language}\n{starter_code}\n```")
    
    prompt_parts.append("\nWrite complete, runnable code that solves this task. Include necessary imports and a main/example usage if appropriate.")
    prompt = "\n".join(prompt_parts)

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPTS["generate"]},
        {"role": "user", "content": prompt},
    ]

    try:
        result = await _call_llm(messages)
        return {"code": _strip_markdown(result), "language": language}
    except Exception as e:
        logger.error("Code generation failed: %s", e)
        return {"code": f"# Error generating code: {e}", "language": language, "error": str(e)}


async def explain_code(
    code: str,
    language: str = "python",
    focus: str = "",
) -> dict[str, Any]:
    """Explain what the code does."""
    prompt = f"""Code to explain:
```{language}
{code}
```
{f"Focus on: {focus}" if focus else "Explain the overall purpose, key parts, and how it works."}"""

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPTS["explain"]},
        {"role": "user", "content": prompt},
    ]

    try:
        result = await _call_llm(messages)
        return {"explanation": _strip_markdown(result)}
    except Exception as e:
        logger.error("Code explanation failed: %s", e)
        return {"explanation": f"Error explaining code: {e}", "error": str(e)}


async def debug_code(
    code: str,
    language: str = "python",
    error: str = "",
    task: str = "",
) -> dict[str, Any]:
    """Help debug code that isn't working."""
    prompt = f"""Code to debug:
```{language}
{code}
```
{f"Error: {error}" if error else ""}
{f"Expected behavior: {task}" if task else ""}

Find and fix the bug(s). Explain what was wrong and how to fix it."""

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPTS["debug"]},
        {"role": "user", "content": prompt},
    ]

    try:
        result = await _call_llm(messages)
        return {"analysis": _strip_markdown(result)}
    except Exception as e:
        logger.error("Code debugging failed: %s", e)
        return {"analysis": f"Error debugging code: {e}", "error": str(e)}


async def review_code(
    code: str,
    language: str = "python",
    context: str = "",
) -> dict[str, Any]:
    """Review code for improvements."""
    prompt = f"""Code to review:
```{language}
{code}
```
{f"Context: {context}" if context else ""}

Review this code for: correctness, readability, performance, security, best practices. Provide specific suggestions with improved code snippets."""

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPTS["review"]},
        {"role": "user", "content": prompt},
    ]

    try:
        result = await _call_llm(messages, max_tokens=3000)
        return {"review": _strip_markdown(result)}
    except Exception as e:
        logger.error("Code review failed: %s", e)
        return {"review": f"Error reviewing code: {e}", "error": str(e)}


async def get_code_suggestions(
    partial_code: str,
    language: str = "python",
    cursor_position: int = 0,
) -> dict[str, Any]:
    """Get code completion suggestions (like IntelliSense/Copilot)."""
    prompt = f"""Complete the code at the cursor position (marked with |).

Language: {language}
Code:
```{language}
{partial_code[:cursor_position]}|{partial_code[cursor_position:]}
```

Provide 3-5 relevant completions. Return ONLY a JSON array of strings:
["completion1", "completion2", ...]"""

    messages = [
        {"role": "system", "content": "You are a code completion engine. Return ONLY valid JSON array of completion strings."},
        {"role": "user", "content": prompt},
    ]

    try:
        result = await _call_llm(messages, max_tokens=500)
        result = _strip_markdown(result)
        suggestions = json.loads(result)
        if isinstance(suggestions, list):
            return {"suggestions": suggestions[:5]}
        return {"suggestions": []}
    except Exception as e:
        logger.error("Code suggestions failed: %s", e)
        return {"suggestions": [], "error": str(e)}