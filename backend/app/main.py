from fastapi import FastAPI
from app.api.routes.auth import router as auth_router
from app.api.routes.transaction import router as transaction_router

app = FastAPI(title="LedgerLines", version="0.1.0")

# Include all auth routes
app.include_router(auth_router)

# Include all transaction routes
app.include_router(transaction_router)

@app.get("/")
async def root():
    return {"message": "LedgerLines API is running"}