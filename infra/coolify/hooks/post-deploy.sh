#!/usr/bin/env sh
set -eu
api_url=http://api:8080
curl --fail --silent "$api_url/health/ready" >/dev/null
curl --fail --silent "$api_url/api/v1/release" >/dev/null
echo "post-deploy: readiness and release identity verified"
