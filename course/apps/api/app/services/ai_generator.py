import logging
from typing import Any, Dict
from app.services.llm import call_llm
from app.domain.entities.exam import Difficulty, QuestionType

logger = logging.getLogger(__name__)

async def generate_exam_content(
    topic: str,
    difficulty: Difficulty,
    num_questions: int = 5
) -> Dict[str, Any]:
    """Generates exam questions using LLM."""
    
    prompt = f"""
    You are an expert technical content creator for a competitive learning platform.
    Create {num_questions} high-quality questions for a test on the topic: '{topic}'.
    Difficulty level: {difficulty.value}.
    
    For each question, provide:
    - title
    - content (the question body)
    - type (theory, debug, coding, analysis)
    - points (default 10)
    - options (if applicable, list of content and is_correct)
    - explanation (the logic behind the answer)
    
    Return the result strictly as a JSON object with a 'questions' key containing the list of questions.
    """
    
    try:
        response = await call_llm(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.7,
        )
        # Parse logic would go here
        return {"content": response}
    except Exception as e:
        logger.error(f"Failed to generate exam content: {e}")
        return {"error": "Generation failed"}