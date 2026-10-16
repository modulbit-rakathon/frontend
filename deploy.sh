#!/usr/bin/env bash
# Deploys the frontend to Azure App Service for Containers: the Vite build
# served by nginx. Reuses the backend's registry and App Service plan, so run
# the backend's deploy.sh first.
#
# nginx proxies /api to the backend and adds the API key there, so the key
# lives in the App Service settings, never in the bundle:
#   set -a; . ./.env.local; set +a
#   ./deploy.sh
set -euo pipefail

RESOURCE_GROUP="rg-team92"   # the only group our account may write to
ACR_NAME="pillgazeteam92"    # created by backend/deploy.sh
PLAN_NAME="pillgaze-plan"    # created by backend/deploy.sh
APP_NAME="pillgaze-web-team92"   # -> https://pillgaze-web-team92.azurewebsites.net
VITE_MOCK_API="${VITE_MOCK_API:-false}"

: "${API_URL:?export API_URL}"
: "${API_KEY:?export API_KEY}"
API_URL="${API_URL%/}"   # nginx proxy_pass: no path, or it rewrites /api

cd "$(dirname "$0")"
TAG="$(git rev-parse --short HEAD)$(git diff --quiet || echo -dirty)"
IMAGE="$ACR_NAME.azurecr.io/pillgaze-frontend:$TAG"

az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --output none \
  || { echo "Registry $ACR_NAME missing, run backend/deploy.sh first" >&2; exit 1; }
az appservice plan show --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --output none \
  || { echo "Plan $PLAN_NAME missing, run backend/deploy.sh first" >&2; exit 1; }

# Build in the cloud from the Dockerfile.
az acr build --registry "$ACR_NAME" --image "pillgaze-frontend:$TAG" \
  --build-arg "VITE_MOCK_API=$VITE_MOCK_API" \
  . --output none

ACR_USER=$(az acr credential show --name "$ACR_NAME" --query username --output tsv)
ACR_PASS=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" --output tsv)

if ! az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null; then
  az webapp create --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --plan "$PLAN_NAME" \
    --container-image-name "$IMAGE" \
    --container-registry-url "https://$ACR_NAME.azurecr.io" \
    --container-registry-user "$ACR_USER" \
    --container-registry-password "$ACR_PASS" \
    --https-only true --output none
fi

# App settings are encrypted at rest and reach the container as env vars.
az webapp config appsettings set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --output none --settings \
  "WEBSITES_PORT=8080" \
  "API_URL=$API_URL" \
  "API_KEY=$API_KEY"

az webapp config set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --always-on true --http20-enabled true --output none

az webapp config container set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --container-image-name "$IMAGE" \
  --container-registry-url "https://$ACR_NAME.azurecr.io" \
  --container-registry-user "$ACR_USER" \
  --container-registry-password "$ACR_PASS" \
  --output none

az webapp restart --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --output none

HOST=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName --output tsv)
echo "Deployed $IMAGE"
echo "https://$HOST"
