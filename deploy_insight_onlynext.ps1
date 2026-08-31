docker build `
  --tag insight-next:latest `
  .
docker save `
  --output .\insight-next.tar `
  insight-next:latest `

scp `
  .\insight-next.tar `
  marketing@10.21.69.79:/home/marketing/INSIGHT