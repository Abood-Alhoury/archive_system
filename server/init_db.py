import os
import sqlite3

# Setup DB connection
DB_PATH = "database.sqlite"
print(f"Initializing empty SQLite database at: {DB_PATH}")

# Delete existing DB file if it exists to start fresh and empty
if os.path.exists(DB_PATH):
    try:
        os.remove(DB_PATH)
        print("Removed existing database file.")
    except Exception as e:
        print(f"Error removing existing database: {e}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Enable UTF-8 configuration
cursor.execute("PRAGMA encoding = 'UTF-8';")

# Create simplified transactions table
print("Creating transactions table...")
cursor.executescript("""
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archive_number TEXT NOT NULL,
    applicant_name TEXT NOT NULL,
    university TEXT NOT NULL,
    equivalence_decision_number TEXT,
    equivalence_decision_date TEXT,
    eligibility_decision_number TEXT,
    eligibility_decision_date TEXT,
    pdf_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
""")

conn.commit()
conn.close()
print("Empty database initialized successfully!")
