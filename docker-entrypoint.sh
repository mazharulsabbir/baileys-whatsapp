#!/bin/sh
set -e
cd /app
npx prisma migrate deploy
exec npx next start -p "${PORT:-3000}"
