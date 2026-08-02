from slowapi.util import get_remote_address
from slowapi import Limiter

# Shared Limiter instance for local memory-based IP limiting
limiter = Limiter(key_func=get_remote_address)