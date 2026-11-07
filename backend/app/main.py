from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from app.core.errors import validation_error_without_input
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.api.routes.auth import router as auth_router
from app.api.routes.transaction import router as transaction_router
from app.api.routes.category import router as category_router
from app.api.routes.analytics import router as analytics_router
from app.core.config import settings
from app.core.limiter import limiter
app = FastAPI(title="LedgerLines", version="0.1.0")
# Attach the limiter to the application state
app.state.limiter = limiter
# Register the exception handler to return a clean 429 response when limits are hit
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# Add CORS middleware before including routers. Origins come from CORS_ORIGINS; the
# frontend's own /api proxy is same-origin and doesn't need an entry
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
# Include all auth routes
app.include_router(auth_router)
# Include all transaction routes
app.include_router(transaction_router)
# Include all category routes
app.include_router(category_router)
# Include all analytics routes
app.include_router(analytics_router)
# Validation errors without the rejected values, so a password is never echoed back
app.add_exception_handler(RequestValidationError, validation_error_without_input)
@app.get("/")
async def root():
    return {"message": "LedgerLines API is running"}