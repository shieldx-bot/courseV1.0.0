"""Code Generator - AI-powered code generation for coding lessons.

Uses Groq/OpenAI-compatible LLM to generate starter code, solution code, and test cases.
"""

import logging
from typing import Any

from app.core.config import settings
from app.services.llm import call_llm, is_llm_available

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert programming instructor creating coding exercises for students.

Generate THREE things for a coding lesson:
1. STARTER CODE - A template with function signatures, comments, and TODO markers for students to fill in
2. SOLUTION CODE - Complete, correct, well-commented solution
3. TEST CASES - Multiple test cases covering normal cases, edge cases, and error conditions

Rules:
- Use the specified programming language
- Match the lesson topic and difficulty
- Starter code should be minimal but clear (function signatures + docstrings + TODO comments)
- Solution code should be production-quality with good practices
- Test cases should be in a runnable format for the language (pytest for Python, Jest for JS/TS, etc.)
- Return ONLY valid JSON with keys: starter_code, solution_code, test_cases"""

_USER_PROMPT_TEMPLATE = """Lesson Title: {title}
Lesson Description: {description}
Language: {language}
Difficulty: {difficulty}
Topics: {topics}

Generate starter code, solution code, and test cases for this lesson.
Return ONLY valid JSON:
{{
  "starter_code": "...",
  "solution_code": "...",
  "test_cases": "..."
}}"""


async def _call_llm(messages: list[dict[str, str]], max_tokens: int = 4000) -> str:
    """Call the LLM (multi-provider) with the given messages."""
    if not is_llm_available():
        raise ValueError("No LLM provider configured")

    return await call_llm(
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.2,
    )


def _strip_markdown(text: str) -> str:
    """Remove markdown code fences and formatting."""
    import re

    text = re.sub(r"^```\w*\n", "", text.strip())
    text = re.sub(r"\n```$", "", text)
    return text.strip()


def _parse_json_response(text: str) -> dict[str, Any]:
    """Parse JSON from LLM response, handling markdown code fences."""
    import json
    import re

    text = _strip_markdown(text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        raise


async def generate_lesson_code(
    title: str,
    description: str,
    language: str = "python",
    difficulty: str = "beginner",
    topics: list[str] | None = None,
) -> dict[str, Any]:
    """Generate starter code, solution code, and test cases for a coding lesson.

    Args:
        title: Lesson title (e.g., "Binary Search Implementation")
        description: Lesson description/context
        language: Programming language (python, javascript, typescript, java, go, rust, cpp, sql)
        difficulty: beginner, intermediate, advanced
        topics: List of topics/tags (e.g., ["algorithms", "binary-search", "arrays"])

    Returns:
        Dict with starter_code, solution_code, test_cases
    """
    topics_str = ", ".join(topics) if topics else "general programming"

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": _USER_PROMPT_TEMPLATE.format(
                title=title,
                description=description,
                language=language,
                difficulty=difficulty,
                topics=topics_str,
            ),
        },
    ]

    try:
        result = await _call_llm(messages)
        parsed = _parse_json_response(result)

        starter_code = parsed.get("starter_code", "").strip()
        solution_code = parsed.get("solution_code", "").strip()
        test_cases = parsed.get("test_cases", "").strip()

        if not starter_code or not solution_code or not test_cases:
            raise ValueError("LLM returned incomplete response")

        return {
            "starter_code": starter_code,
            "solution_code": solution_code,
            "test_cases": test_cases,
            "language": language,
        }
    except Exception as e:
        logger.error("Code generation failed: %s", e)
        return _fallback_code(title, description, language, difficulty, topics)


def _fallback_code(
    title: str,
    description: str,
    language: str,
    difficulty: str,
    topics: list[str] | None,
) -> dict[str, Any]:
    """Provide rule-based fallback code when LLM fails."""
    templates = {
        "python": {
            "starter": f'"""\n{title}\n{description}\n\nTODO: Implement the solution below\n"""\n\ndef solve():\n    """Main function to solve the problem."""\n    # TODO: Write your solution here\n    pass\n\n\nif __name__ == "__main__":\n    solve()\n',
            "solution": f'"""\n{title}\n{description}\n\nSolution implementation\n"""\n\ndef solve():\n    """Main function to solve the problem."""\n    # Solution implementation\n    print("Solution executed successfully")\n\n\nif __name__ == "__main__":\n    solve()\n',
            "tests": f'"""Tests for {title}"""\nimport pytest\n\ndef test_solve():\n    """Test the solve function."""\n    # TODO: Add actual test cases\n    assert True\n\nif __name__ == "__main__":\n    pytest.main([__file__, "-v"])\n',
        },
        "javascript": {
            "starter": f"""/**
 * {title}
 * {description}
 *
 * TODO: Implement the solution below
 */

function solve() {{
    // TODO: Write your solution here
    console.log("Solution executed");
}}

solve();

module.exports = {{ solve }};""",
            "solution": f"""/**
 * {title}
 * {description}
 *
 * Solution implementation
 */

function solve() {{
    // Solution implementation
    console.log("Solution executed successfully");
}}

solve();

module.exports = {{ solve }};""",
            "tests": f"""// Tests for {title}
const {{ solve }} = require('./solution');

test('solve function works', () => {{
    // TODO: Add actual test cases
    expect(true).toBe(true);
}});""",
        },
        "typescript": {
            "starter": f"""/**
 * {title}
 * {description}
 *
 * TODO: Implement the solution below
 */

function solve(): void {{
    // TODO: Write your solution here
    console.log("Solution executed");
}}

solve();""",
            "solution": f"""/**
 * {title}
 * {description}
 *
 * Solution implementation
 */

function solve(): void {{
    // Solution implementation
    console.log("Solution executed successfully");
}}

solve();""",
            "tests": f"""// Tests for {title}
import {{ solve }} from './solution';

test('solve function works', () => {{
    // TODO: Add actual test cases
    expect(true).toBe(true);
}});""",
        },
    }

    tpl = templates.get(language, templates["python"])
    return {
        "starter_code": tpl["starter"],
        "solution_code": tpl["solution"],
        "test_cases": tpl["tests"],
        "language": language,
    }