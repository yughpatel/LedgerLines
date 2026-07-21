from fastapi import FastAPI
from app.api.routes.auth import router as auth_router
from app.api.routes.transaction import router as transaction_router
from app.api.routes.category import router as category_router
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(title="LedgerLines", version="0.1.0")

# Add CORS middleware before including routers
origins = ["http://localhost:3000"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"],
    allow_headers=["*"])

# Include all auth routes
app.include_router(auth_router)

# Include all transaction routes
app.include_router(transaction_router)

# Include all category routes
app.include_router(category_router)

@app.get("/")
async def root():
    return {"message": "LedgerLines API is running"}