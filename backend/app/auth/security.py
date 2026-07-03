from passlib.context import CryptContext

# Use bcrypt to resist brute-force and GPU-accelerated cracking attacks.
# 'deprecated="auto" flag marks outdated hashes for automatic updating in case of changing algorithms.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Hash the plain password again and compare to the stored hash.
# We never decrypt (hashing only works one way).
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)