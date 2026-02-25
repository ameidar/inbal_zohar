# PROJECT.md

PROJECT_ID: inbal-fleet
NAME: Fleet Management System
DESCRIPTION: מערכת ניהול צי רכב לחברת תשתיות ישראלית — פיילוט עבור ענבל
OWNER: עמי מידר
STATUS: active

## Paths
- REPO: /home/ameidar/.openclaw/workspace/inbal_zohar
- BACKEND: /home/ameidar/.openclaw/workspace/inbal_zohar/backend
- FRONTEND: /home/ameidar/.openclaw/workspace/inbal_zohar/frontend

## Endpoints
- DEV: http://187.124.2.69:3010

## Ports
- Backend: 3010
- DB (PostgreSQL): 5433 (external), 5432 (internal Docker)

## Start
cd /home/ameidar/.openclaw/workspace/inbal_zohar && ./start.sh

## Auth
- Admin: admin / admin123
- Reporter: reporter / report123
