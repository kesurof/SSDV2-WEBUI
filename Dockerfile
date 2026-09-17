FROM node:22-alpine AS frontend

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install --no-cache-dir .

RUN pip install --no-cache-dir "ansible-core==2.21.0" \
    && mkdir -p /opt/ansible/collections /opt/ansible/roles \
    && ansible-galaxy collection install -p /opt/ansible/collections \
        community.docker:5.2.0 community.general:13.0.1 ansible.posix:2.2.0 \
    && ansible-galaxy role install -p /opt/ansible/roles \
        kwoodson.yedit geerlingguy.docker,8.0.0 \
    && printf '[local]\n127.0.0.1 ansible_connection=local\n' > /opt/ansible/inventory

ENV ANSIBLE_COLLECTIONS_PATH=/opt/ansible/collections \
    ANSIBLE_ROLES_PATH=/opt/ansible/roles \
    ANSIBLE_INVENTORY=/opt/ansible/inventory \
    ANSIBLE_HOME=/tmp/ansible \
    ANSIBLE_LOCAL_TEMP=/tmp/ansible \
    ANSIBLE_REMOTE_TEMP=/tmp/ansible

COPY --from=frontend /build/dist ./static

RUN apt-get update \
    && apt-get install -y --no-install-recommends sudo \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data \
    && chown 10001:10001 /data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
