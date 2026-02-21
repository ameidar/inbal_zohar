#!/bin/bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🚛 Starting Fleet Management System..."

# Start DB
echo "📦 Starting database..."
docker compose up -d db
echo "⏳ Waiting for database..."
sleep 8

# Install backend deps
echo "📦 Installing backend..."
cd backend && npm install --silent

# Run migrations
echo "🗄️  Running migrations..."
node src/migrations/run.js

# Seed data
echo "🌱 Seeding demo data..."
node src/seed.js || echo "Seed already done or partial, continuing..."

# Build frontend
echo "⚛️  Building frontend..."
cd ../frontend && npm install --silent && npm run build

# Copy frontend dist to backend
cp -r dist ../backend/frontend-dist 2>/dev/null || true
cp -r dist ../backend/ 2>/dev/null || true

cd "$DIR"

echo ""
echo "✅ Ready! Starting server..."
echo "🌐 Access: http://localhost:3010"
echo "👤 Admin: admin / admin123"
echo "👤 Reporter: reporter / report123"
echo ""

cd backend && PORT=3010 node src/index.js
