"""Categories API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List
import uuid
import logging

from app.database import get_db
from app.models import Category, SYSTEM_CATEGORIES, User
from app.schemas import CategoryCreate, CategoryUpdate, StatusResponse
from app.api.deps import get_current_user

log = logging.getLogger(__name__)

router = APIRouter()


def _to_dict(c: Category) -> dict:
    """Serialize a Category ORM object to a dict."""
    return {
        "id": str(c.id),
        "user_id": str(c.user_id) if c.user_id else None,
        "name": c.name,
        "icon": c.icon,
        "color": c.color,
        "description": c.description,
        "is_system": c.is_system,
        "is_active": c.is_active,
        "sort_order": c.sort_order,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


async def ensure_system_categories(
    db: AsyncSession, user_id: uuid.UUID
) -> List[Category]:
    """
    Ensure system categories exist for a user.
    Creates them if they don't exist, returns all user's categories.
    """
    # Check if user has any system categories
    result = await db.execute(
        select(Category).where(
            and_(
                Category.user_id == user_id,
                Category.is_system == True,  # noqa: E712
            )
        )
    )
    existing = result.scalars().all()

    if len(existing) >= len(SYSTEM_CATEGORIES):
        # Already initialized
        return list(existing)

    existing_names = {c.name.lower() for c in existing}

    # Create missing system categories
    for i, cat_data in enumerate(SYSTEM_CATEGORIES):
        if cat_data["name"].lower() not in existing_names:
            cat = Category(
                user_id=user_id,
                name=cat_data["name"],
                icon=cat_data["icon"],
                color=cat_data["color"],
                description=cat_data["description"],
                is_system=True,
                sort_order=i,
            )
            db.add(cat)

    await db.flush()

    # Return all categories
    result = await db.execute(
        select(Category)
        .where(
            and_(
                Category.user_id == user_id,
                Category.is_active == True,  # noqa: E712
            )
        )
        .order_by(Category.sort_order)
    )
    return list(result.scalars().all())


@router.get("/", response_model=List[dict])
async def list_categories(
    include_system: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all categories for the current user."""
    # Ensure system categories exist
    await ensure_system_categories(db, current_user.id)

    query = select(Category).where(
        and_(
            Category.user_id == current_user.id,
            Category.is_active == True,  # noqa: E712
        )
    )

    if not include_system:
        query = query.where(Category.is_system == False)  # noqa: E712

    query = query.order_by(Category.sort_order, Category.name)

    result = await db.execute(query)
    categories = result.scalars().all()

    return [_to_dict(c) for c in categories]


@router.post("/", response_model=dict)
async def create_category(
    category: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a custom category for the current user."""
    # Check for duplicate name
    result = await db.execute(
        select(Category).where(
            and_(
                Category.user_id == current_user.id,
                func.lower(Category.name) == category.name.lower(),
                Category.is_active == True,  # noqa: E712
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Category with this name already exists"
        )

    # Get max sort order
    max_order_result = await db.execute(
        select(func.max(Category.sort_order)).where(Category.user_id == current_user.id)
    )
    max_order = max_order_result.scalar() or 0

    cat = Category(
        user_id=current_user.id,
        name=category.name,
        icon=category.icon,
        color=category.color,
        description=category.description,
        is_system=False,
        sort_order=max_order + 1,
    )
    db.add(cat)
    await db.flush()

    return _to_dict(cat)


@router.get("/{category_id}", response_model=dict)
async def get_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single category."""
    try:
        cat_uuid = uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category ID")

    result = await db.execute(
        select(Category).where(
            and_(Category.id == cat_uuid, Category.user_id == current_user.id)
        )
    )
    cat = result.scalar_one_or_none()

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    return _to_dict(cat)


@router.put("/{category_id}", response_model=dict)
async def update_category(
    category_id: str,
    update: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a category."""
    try:
        cat_uuid = uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category ID")

    result = await db.execute(
        select(Category).where(
            and_(Category.id == cat_uuid, Category.user_id == current_user.id)
        )
    )
    cat = result.scalar_one_or_none()

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # System categories have limited editability
    if cat.is_system:
        # Can only update icon, color, is_active for system categories
        if update.icon is not None:
            cat.icon = update.icon
        if update.color is not None:
            cat.color = update.color
        if update.is_active is not None:
            cat.is_active = update.is_active
    else:
        # Custom categories are fully editable
        if update.name is not None:
            cat.name = update.name
        if update.icon is not None:
            cat.icon = update.icon
        if update.color is not None:
            cat.color = update.color
        if update.description is not None:
            cat.description = update.description
        if update.is_active is not None:
            cat.is_active = update.is_active
        if update.sort_order is not None:
            cat.sort_order = update.sort_order

    await db.flush()
    return _to_dict(cat)


@router.delete("/{category_id}", response_model=StatusResponse)
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete (deactivate) a category. System categories can only be hidden."""
    try:
        cat_uuid = uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category ID")

    result = await db.execute(
        select(Category).where(
            and_(Category.id == cat_uuid, Category.user_id == current_user.id)
        )
    )
    cat = result.scalar_one_or_none()

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if cat.is_system:
        # System categories are hidden, not deleted
        cat.is_active = False
    else:
        # Custom categories are soft-deleted
        cat.is_active = False

    await db.flush()
    return StatusResponse(status="success", message="Category deleted")


@router.get("/stats/counts", response_model=dict)
async def get_category_counts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get memory counts per category."""
    from app.models import Memory

    # Ensure categories exist
    await ensure_system_categories(db, current_user.id)

    # Get all categories with counts
    result = await db.execute(
        select(
            Category.id,
            Category.name,
            Category.icon,
            Category.color,
            func.count(Memory.id).label("memory_count"),
        )
        .outerjoin(
            Memory,
            and_(
                Memory.category_id == Category.id,
                Memory.is_deleted == False,  # noqa: E712
            ),
        )
        .where(
            and_(
                Category.user_id == current_user.id,
                Category.is_active == True,  # noqa: E712
            )
        )
        .group_by(Category.id, Category.name, Category.icon, Category.color)
        .order_by(Category.sort_order)
    )

    counts = []
    for row in result.all():
        counts.append(
            {
                "id": str(row.id),
                "name": row.name,
                "icon": row.icon,
                "color": row.color,
                "count": row.memory_count,
            }
        )

    return {"categories": counts}
