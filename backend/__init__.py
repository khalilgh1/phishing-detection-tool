"""
__init__.py — Flask application factory.

Creates and configures the Flask app, registers blueprints.
"""

from flask import Flask
from flask_cors import CORS


def create_app() -> Flask:
    """Build and return the configured Flask application."""
    app = Flask(__name__)
    CORS(app)  # allow cross-origin requests (needed for the Chrome extension)

    from .routes import api
    app.register_blueprint(api, url_prefix="/api")

    return app
