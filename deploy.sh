#!/usr/bin/env bash
set -e

# ==============================================================================
# Numbers Guesser — End-to-End Google Cloud & Firebase Deployment Script
# ==============================================================================

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
  echo "Error: No Google Cloud project selected. Run: gcloud config set project <PROJECT_ID>"
  exit 1
fi

REGION="us-central1"
SERVICE_NAME="numbers-guesser-api"

echo "=========================================================="
echo " Deploying Numbers Guesser to Google Cloud & Firebase"
echo " Project: $PROJECT_ID"
echo " Region:  $REGION"
echo "=========================================================="

# 1. Build and deploy FastAPI backend to Google Cloud Run
echo ""
echo "--> 1. Deploying Backend (FastAPI) to Google Cloud Run..."
cd backend
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID="$PROJECT_ID",ENV="production"
cd ..

# 2. Build React TypeScript frontend with Vite
echo ""
echo "--> 2. Building Frontend (React + TypeScript + Tailwind)..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run build
cd ..

# 3. Deploy Frontend & Hosting Rewrites to Firebase Hosting
echo ""
echo "--> 3. Deploying Frontend to Firebase Hosting CDN..."
firebase deploy --only hosting --project "$PROJECT_ID"

echo ""
echo "=========================================================="
echo " Deployment Complete!"
echo " App URL: https://${PROJECT_ID}.web.app"
echo "=========================================================="
