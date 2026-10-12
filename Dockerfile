# HRMS: one image with the Django API and the built React app (served by WhiteNoise).
#
#   docker build -t hrms .
#   docker run -p 8000:8000 -e DJANGO_SECRET_KEY=<long random value> -e DJANGO_ALLOWED_HOSTS=localhost \
#              -e DJANGO_SECURE_SSL_REDIRECT=0 hrms
#   docker exec <container> python manage.py seed_demo      # optional: the fictional demo company
#
# In production, put it behind HTTPS and set DATABASE_URL (PostgreSQL); see README.md.

# ---- 1. build the React app
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Django + gunicorn
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt "psycopg[binary]>=3.2"
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist frontend/dist
WORKDIR /app/backend
RUN DJANGO_SECRET_KEY=collectstatic-only python manage.py collectstatic --noinput \
    && useradd --create-home --uid 1000 app && chown -R app /app/backend
USER app
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-3} --access-logfile -"]
