# Railway / any Docker host — Python + pre-built frontend
FROM python:3.11-slim

WORKDIR /app

# Pre-built frontend (copied from repo)
COPY frontend/dist /app/frontend/dist

# Backend
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ /app/backend/
RUN chmod +x /app/backend/start.sh

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

# start.sh reads $PORT at runtime (Railway injects it)
WORKDIR /app/backend
CMD ["/app/backend/start.sh"]
