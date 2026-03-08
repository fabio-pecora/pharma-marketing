import psycopg2
from config import DATABASE_URL


def get_connection():
    conn = psycopg2.connect(DATABASE_URL)
    return conn