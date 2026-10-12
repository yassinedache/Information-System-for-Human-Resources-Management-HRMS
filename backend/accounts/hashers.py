import base64
import hashlib
import hmac
import struct

from django.contrib.auth.hashers import PBKDF2PasswordHasher


def pbkdf2_sha256(password: bytes, salt: bytes, iterations: int, dklen: int = 32) -> bytes:
    """PBKDF2-HMAC-SHA256 (RFC 8018) in pure Python: Pyodide's hashlib has no pbkdf2_hmac (no OpenSSL)."""
    mac = hmac.new(password, digestmod=hashlib.sha256)

    def prf(data: bytes) -> bytes:
        m = mac.copy()
        m.update(data)
        return m.digest()

    out = b""
    block = 1
    while len(out) < dklen:
        u = prf(salt + struct.pack(">I", block))
        acc = int.from_bytes(u, "big")
        for _ in range(iterations - 1):
            u = prf(u)
            acc ^= int.from_bytes(u, "big")
        out += acc.to_bytes(32, "big")
        block += 1
    return out[:dklen]


class DemoPBKDF2PasswordHasher(PBKDF2PasswordHasher):
    """Only for the in-browser demo, whose accounts are fictional and never leave the browser:
    the same PBKDF2-SHA256 as Django's default, with fewer iterations because WebAssembly is slow."""
    algorithm = "pbkdf2_sha256_demo"
    iterations = 2000

    def encode(self, password, salt, iterations=None):
        self._check_encode_args(password, salt)
        iterations = iterations or self.iterations
        h = pbkdf2_sha256(password.encode(), salt.encode(), iterations)
        return "%s$%d$%s$%s" % (self.algorithm, iterations, salt, base64.b64encode(h).decode("ascii").strip())
