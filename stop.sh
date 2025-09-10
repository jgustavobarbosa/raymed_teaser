#!/bin/bash
echo "🛑 Parando RayMed..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "test-server.js" 2>/dev/null || true
pkill -f "PORT=.*node" 2>/dev/null || true
echo "✅ Processos parados"
