from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# Manages database network connections and connection pooling.
engine = create_engine(settings.database_url)

# Factory that creates short-lived workspaces for tracking data changes.
SessionLocal = sessionmaker(bind=engine)

# Central registry that maps Python classes to database tables.
class Base(DeclarativeBase):
    pass

# Lends a database session to the route, then guarantees it closes safely.
# yield hands the session to the route; finally guarantees close()
# runs even if the route raises an error, preventing leaked connections
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
