from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import require_teacher
from app.db.database import get_db
from app.models.models import ContentStatus, TestContent, TestType, User
from app.schemas.schemas import ContentResponse, CreateContentRequest

router = APIRouter(prefix="/api/admin/content", tags=["content"])


@router.get("/", response_model=list[ContentResponse])
async def list_content(
    test_type: str | None = None,
    section: str | None = None,
    status: str | None = None,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    query = select(TestContent)
    if test_type:
        query = query.where(TestContent.test_type == TestType(test_type))
    if section:
        query = query.where(TestContent.section == section)
    if status:
        query = query.where(TestContent.status == ContentStatus(status))
    query = query.order_by(TestContent.created_at.desc())

    result = await db.execute(query)
    return [ContentResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=ContentResponse)
async def create_content(
    request: CreateContentRequest,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    content = TestContent(
        test_type=TestType(request.test_type),
        section=request.section,
        question_type=request.question_type,
        title=request.title,
        content=request.content,
        media_url=request.media_url,
        difficulty=request.difficulty,
        topic=request.topic,
        source="curated",
        status=ContentStatus.draft,
        created_by=user.id,
    )
    db.add(content)
    await db.commit()
    await db.refresh(content)
    return ContentResponse.model_validate(content)


@router.put("/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: int,
    request: CreateContentRequest,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TestContent).where(TestContent.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    content.test_type = TestType(request.test_type)
    content.section = request.section
    content.question_type = request.question_type
    content.title = request.title
    content.content = request.content
    content.media_url = request.media_url
    content.difficulty = request.difficulty
    content.topic = request.topic

    await db.commit()
    await db.refresh(content)
    return ContentResponse.model_validate(content)


@router.put("/{content_id}/publish")
async def publish_content(
    content_id: int,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TestContent).where(TestContent.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    content.status = ContentStatus.published
    await db.commit()
    return {"status": "published", "id": content_id}


@router.delete("/{content_id}")
async def archive_content(
    content_id: int,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TestContent).where(TestContent.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    content.status = ContentStatus.archived
    await db.commit()
    return {"status": "archived", "id": content_id}
