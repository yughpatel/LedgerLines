from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Pydantic attaches the rejected value ("input") and validator details ("ctx")
# to each error, and FastAPI returns them as-is. For a password that would send the
# plaintext back to the browser (and into its console and any error tracker), so only
# where the error is and what's wrong with it are returned
SAFE_ERROR_KEYS = ("type", "loc", "msg")


async def validation_error_without_input(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [{key: error[key] for key in SAFE_ERROR_KEYS if key in error} for error in exc.errors()]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": jsonable_encoder(errors)},
    )
