from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta
import base64
import os

from database import get_db, init_db, Session, DrillLog, FavoritePrompt
from ai import generate_prompt, analyze_object_work

app = FastAPI()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# --- Prompt Generation ---

@app.get("/api/prompt/{drill_type}")
async def get_prompt(drill_type: str, context: str = ""):
    valid_types = ["scene", "character", "environment", "word_association", "emotional", "story", "object", "first_last"]
    if drill_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid drill type")
    result = await generate_prompt(drill_type, context)
    return result


# --- Session Tracking ---

class SessionCreate(BaseModel):
    duration_seconds: int
    drill_types: List[str]
    notes: Optional[str] = ""


class DrillLogCreate(BaseModel):
    session_id: int
    drill_type: str
    prompt_text: str


@app.post("/api/sessions")
def create_session(data: SessionCreate, db: DBSession = Depends(get_db)):
    logged_day = data.duration_seconds >= 1200  # 20 minutes
    session = Session(
        duration_seconds=data.duration_seconds,
        drill_types=",".join(data.drill_types),
        notes=data.notes,
        logged_day=logged_day
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "logged_day": logged_day}


@app.post("/api/drill-log")
def log_drill(data: DrillLogCreate, db: DBSession = Depends(get_db)):
    entry = DrillLog(
        session_id=data.session_id,
        drill_type=data.drill_type,
        prompt_text=data.prompt_text
    )
    db.add(entry)
    db.commit()
    return {"ok": True}


@app.get("/api/stats")
def get_stats(db: DBSession = Depends(get_db)):
    all_sessions = db.query(Session).all()
    logged_days = [s for s in all_sessions if s.logged_day]

    # Calculate streak
    day_set = set()
    for s in logged_days:
        day_set.add(s.date.date())

    streak = 0
    check = date.today()
    while check in day_set:
        streak += 1
        check -= timedelta(days=1)

    # Drill type breakdown from drill logs
    all_logs = db.query(DrillLog).all()
    drill_counts = {}
    for log in all_logs:
        drill_counts[log.drill_type] = drill_counts.get(log.drill_type, 0) + 1

    return {
        "total_logged_days": len(set(s.date.date() for s in logged_days)),
        "current_streak": streak,
        "total_sessions": len(all_sessions),
        "drill_counts": drill_counts,
        "recent_sessions": [
            {
                "id": s.id,
                "date": s.date.isoformat(),
                "duration_seconds": s.duration_seconds,
                "drill_types": s.drill_types.split(",") if s.drill_types else [],
                "notes": s.notes,
                "logged_day": s.logged_day
            }
            for s in sorted(all_sessions, key=lambda x: x.date, reverse=True)[:10]
        ]
    }


# --- Favorites ---

class FavoriteCreate(BaseModel):
    drill_type: str
    prompt_text: str


@app.post("/api/favorites")
def add_favorite(data: FavoriteCreate, db: DBSession = Depends(get_db)):
    fav = FavoritePrompt(drill_type=data.drill_type, prompt_text=data.prompt_text)
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return {"id": fav.id}


@app.get("/api/favorites")
def get_favorites(db: DBSession = Depends(get_db)):
    favs = db.query(FavoritePrompt).order_by(FavoritePrompt.created_at.desc()).all()
    return [
        {"id": f.id, "drill_type": f.drill_type, "prompt_text": f.prompt_text, "created_at": f.created_at.isoformat()}
        for f in favs
    ]


@app.delete("/api/favorites/{fav_id}")
def delete_favorite(fav_id: int, db: DBSession = Depends(get_db)):
    fav = db.query(FavoritePrompt).filter(FavoritePrompt.id == fav_id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(fav)
    db.commit()
    return {"ok": True}


# --- Object Work Analysis ---

class ObjectAnalysisRequest(BaseModel):
    object_name: str
    with_frames: List[str]     # base64 JPEG frames
    without_frames: List[str]


@app.post("/api/object-analysis")
async def object_analysis(data: ObjectAnalysisRequest):
    feedback = await analyze_object_work(data.with_frames, data.without_frames, data.object_name)
    return {"feedback": feedback}
