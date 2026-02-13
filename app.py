"""
app.py — Entry point for the Flask server.

Usage:
    python app.py
"""

from backend import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
