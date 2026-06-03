from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./improv.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.utcnow)
    duration_seconds = Column(Integer, default=0)
    drill_types = Column(String, default="")  # comma-separated
    notes = Column(Text, default="")
    logged_day = Column(Boolean, default=False)  # True if >= 20 min


class DrillLog(Base):
    __tablename__ = "drill_logs"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer)
    drill_type = Column(String)
    prompt_text = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)


class FavoritePrompt(Base):
    __tablename__ = "favorite_prompts"
    id = Column(Integer, primary_key=True, index=True)
    drill_type = Column(String)
    prompt_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
