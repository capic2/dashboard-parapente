# Nginx Proxy Manager

For the production proxy host `parapente.capic.ignorelist.com`, use these
forwarding settings:

- Scheme: `http`
- Forward hostname: `parapente-backend`
- Forward port: `8001`
- WebSocket support: enabled

The production deployment applies `docker-compose.production.yml`, which joins
the backend to the external Docker network `apps_default` and publishes the
`parapente-backend` DNS alias there. Set `PROXY_DOCKER_NETWORK` if Nginx Proxy
Manager uses a network with a different name. The base Compose file does not
require this network, so local development and staging can start without it.

Do not cache HTML or error responses in the proxy. The backend marks HTML for
revalidation and Vite's fingerprinted assets as immutable. After deployment,
verify the root page and a lazy-loaded asset return `200` through the public
domain.
