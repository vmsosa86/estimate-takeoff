# Server Security Summary

This document summarizes the current production exposure for the Estimate Takeoff VPS.

## Public Exposure

These ports are intentionally reachable from the internet:

- `80/tcp`: website ingress, restricted to Cloudflare IP ranges by firewall rules
- `443/tcp`: website ingress, restricted to Cloudflare IP ranges by firewall rules
- `8443/tcp`: Telegram webhook ingress for n8n, intentionally public

The Estimate Takeoff website uses the normal HTTPS path on `443`:

- `https://getestimatetakeoff.com`

The n8n Telegram webhook uses:

- `https://vmi3145696.contaboserver.net:8443/webhook/heh-content-approval-v1-webhook/webhook`

## Private Or Localhost-Only Services

These services are not intended to be public:

- `127.0.0.1:3000`: Estimate Takeoff app container
- `127.0.0.1:5432`: PostgreSQL for Estimate Takeoff
- `127.0.0.1:5678`: n8n app

The public request path for Estimate Takeoff is:

- Cloudflare -> Caddy `:443` -> Nginx `:80` -> app `127.0.0.1:3000`

## Website Protection

Estimate Takeoff is protected by:

- Cloudflare proxied DNS
- HTTPS
- app-wide HTTP Basic Auth
- firewall rules that block direct non-Cloudflare access to `80/443`

The app's direct container port on `3000` is localhost-only and should not be reachable from the public internet.

## Webhook Protection

The Telegram webhook remains publicly reachable on `8443` because Telegram does not come through Cloudflare for this integration.

Current protections for the webhook:

- separate dedicated public port `8443`
- specific webhook path
- POST-only behavior at the proxy layer
- Telegram webhook secret validation on the application side

The old webhook path on public `443` has been retired.

## SSH Access

Administrative access is intended to use Tailscale.

Current admin path:

- Tailscale IP: `100.85.12.72`

Public SSH hardening was tested during the firewall work, but if you make future firewall changes, re-verify both of these before assuming the SSH posture is unchanged:

- Tailscale SSH still works
- fresh direct public SSH to port `22` is blocked

## What To Recheck After Any Networking Change

- `https://getestimatetakeoff.com/projects` returns the Basic Auth challenge
- `https://vmi3145696.contaboserver.net:8443/webhook/heh-content-approval-v1-webhook/webhook` still responds on `8443`
- `127.0.0.1:3000` remains the only app bind
- `127.0.0.1:5432` remains the only PostgreSQL bind
- direct public IP access to the website no longer works

## Next Hardening Options

- replace shared Basic Auth with a real user login system
- restrict webhook ingress further if Telegram source IP management becomes practical
- keep future websites behind the same reverse proxy strategy on `80/443`
- keep new app containers bound to localhost or private Docker networks only
