import asyncio
from unittest.mock import MagicMock
from datetime import datetime
from app.domain.entities.enterprise import Contest, ContestStatus, ContestType
from app.domain.services.enterprise_usecase import EnterpriseUseCase
from app.domain.services.grading import ContestCodingStrategy
from app.domain.entities.exam import Question


def test_contest_coding_strategy():
    strategy = ContestCodingStrategy()
    # Fixed Question entity creation with required fields
    question = Question(
        id="q1", 
        exam_id="e1",
        title="Coding Challenge",
        content="Write a function",
        points=10, 
        type="coding", 
        order_index=1,
        options=[]
    )
    
    # CodingStrategy().grade() returns (False, 0, "...")
    is_correct, score, feedback = strategy.grade(question, "print('hello')")
    
    assert score == 0
    assert is_correct == False

def test_enterprise_usecase_registration():
    mock_repo = MagicMock()
    
    # Helper to return a coroutine for async methods
    async def mock_get_contest(*args, **kwargs):
        return Contest(
            id="c1", title="Test", description="Desc", start_time=datetime.now(), 
            end_time=datetime.now(), organizer_id="org1", status=ContestStatus.UPCOMING, 
            type=ContestType.PUBLIC
        )
    
    async def mock_register(*args, **kwargs):
        return True

    mock_repo.get_contest = mock_get_contest
    mock_repo.register_participant = mock_register
    
    usecase = EnterpriseUseCase(mock_repo)
    # Await the async method via asyncio.run (no pytest-asyncio dependency)
    result = asyncio.run(usecase.register_for_contest("c1", "user1"))
    
    assert result == True
