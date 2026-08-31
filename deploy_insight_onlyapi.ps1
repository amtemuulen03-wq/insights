docker build `
  --tag insight-api:latest `
  .\backend

docker save `
  --output .\insight-api.tar `
  insight-api:latest

scp `
  .\insight-api.tar `
  marketing@10.21.69.79:/home/marketing/INSIGHT