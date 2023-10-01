from base64 import b64encode
from random import choice
from sage.all import GF

b64_alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\\="

field = list(GF(2**6))


def generate_secret_key(n):
  key = 1
  for _ in range(n):
    key *= choice(field)
    key += choice(field)
  return key


def encrypt(message, secret_key):
  message = b64encode(message)
  encrypted = ""
  mod_key = 6 * secret_key**6 + 3 * secret_key**4 + 7 * secret_key**3 + 15
  for char in message:
    encrypted += b64_alpha[field.index(field[b64_alpha.index(chr(char))] *
                                       mod_key)]
  return encrypted


key = generate_secret_key(10)
print(encrypt(b'[redacted]', key))
