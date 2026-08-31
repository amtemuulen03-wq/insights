$ErrorActionPreference = "Stop"

docker build --pull=false --tag insight-next:latest .
docker build --pull=false --tag insight-api:latest .\backend

docker save `
  --output .\insight-images.tar `
  insight-next:latest `
  insight-api:latest

npm run build

scp `
  .\insight-images.tar `
  marketing@10.21.69.79:/home/marketing/INSIGHT