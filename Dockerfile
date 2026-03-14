# Railway / any Docker host — Python + pre-built frontend
FROM python:3.11-slim

WORKDIR /app

# Pre-built frontend (copied from repo)
COPY frontend/dist /app/frontend/dist

# Backend
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ /app/backend/

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

# Railway sets PORT; default 8080 for local Docker
CMD gunicorn --worker-class eventlet -w 1 --chdir backend app:app --bind 0.0.0.0:${PORT:-8080}
