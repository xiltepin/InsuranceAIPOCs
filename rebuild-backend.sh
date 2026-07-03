#!/bin/bash
# Docker rebuild script - run this manually on the LXC server
# Location: /root/projects/pocs/AIG/InsuranceAIPOCs/

set -e
cd /root/projects/pocs/AIG/InsuranceAIPOCs

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Stopping backend container ==="
docker compose stop backend

echo "=== Rebuilding backend image (this takes 5-15 minutes) ==="
DOCKER_BUILDKIT=1 docker compose build --no-cache backend

echo "=== Starting backend container ==="
docker compose up -d backend

echo "=== Checking container status ==="
sleep 5
docker compose ps backend
docker compose logs --tail=20 backend
