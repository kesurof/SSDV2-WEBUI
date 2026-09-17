FROM node:22-alpine AS frontend

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim

ARG TARGETARCH
ARG DOCKER_CLI_VERSION=29.6.1

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
    && apt-get install -y --no-install-recommends \
        sudo jq sqlite3 curl ca-certificates gettext-base apache2-utils pigz openssl tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data \
    && chown 10001:10001 /data

# CLI Docker embarquée : le conteneur n'a plus besoin du binaire de l'hôte.
RUN set -eux; \
    arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    case "$arch" in \
        amd64) docker_arch=x86_64 ;; \
        arm64) docker_arch=aarch64 ;; \
        *) echo "architecture non supportée : $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://download.docker.com/linux/static/stable/${docker_arch}/docker-${DOCKER_CLI_VERSION}.tgz" -o /tmp/docker.tgz; \
    tar -xzf /tmp/docker.tgz -C /tmp; \
    install -m 0755 /tmp/docker/docker /usr/local/bin/docker; \
    rm -rf /tmp/docker /tmp/docker.tgz; \
    docker --version

# ssdv2ctl vendored (copie épinglée, resynchroniser via scripts/sync-ssdv2ctl.sh)
COPY vendor/ssdv2ctl/ssdv2ctl /usr/local/bin/ssdv2ctl
RUN chmod 0755 /usr/local/bin/ssdv2ctl && ssdv2ctl --version

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
