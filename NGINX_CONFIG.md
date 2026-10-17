# Nginx Proxy Manager

For the production proxy host `parapente.capic.ignorelist.com`, use these
forwarding settings:

- Scheme: `http`
- Forward hostname: `parapente-backend`
- Forward port: `8001`
- WebSocket support: enabled

The backend joins the external Docker network `apps_default` and publishes the
`parapente-backend` DNS alias there. Set `PROXY_DOCKER_NETWORK` if the Nginx
Proxy Manager container uses a network with a different name. For a staging
stack, the alias follows `CONTAINER_PREFIX`, for example
`parapente-staging-backend`.

Do not configure a proxy cache for HTML or error responses. The backend marks
HTML as revalidatable and Vite's fingerprinted assets as immutable. After
deploying a new image, verify both `/` and a lazy-loaded asset return `200` from
the public domain.
