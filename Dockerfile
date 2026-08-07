# hanzoai/console — the console image. It serves itself.
#
# The console is a static SPA export; this puts hanzoai/static in front of it. That
# itself: hanzoai/static in front of the bundle. It exists so a console change
# can reach production without a cloud release.
#
# Today console.hanzo.ai is answered by the cloud binary, which go:embeds the
# bundle (webui/console.go `//go:embed all:dist`). That couples a frontend change
# to a backend release: the bundle must be published, its tag pinned in cloud's
# Dockerfile, and a whole cloud image rebuilt and rolled out. The pin commit that
# preceded this one says what that costs — "four changes that could not reach
# production".
#
# Nothing about the request path changes when this serves instead. The embedded
# console is already a static export talking to the SAME origin's /v1, and cloud's
# catch-all only ever answered paths that no API route claimed (its apiPrefixes
# list is exactly "/v1/", "/api/", "/zap", "/healthz", "/readyz"). So the split is
# the one the ingress already expresses for admin.lux.cloud: /v1 + /zap to cloud,
# everything else here. Same bytes, same origin, same cookie — one fewer release
# in the way.
#
# -spa, not a 404 page: every unknown path IS a client-side route for an app shell
# (/models, /billing/budgets, a deep link someone pasted). The marketing site takes
# the opposite setting for the opposite reason — there a miss is a mistake.

FROM public.ecr.aws/docker/library/node:24-alpine AS build
RUN apk add --no-cache git
WORKDIR /console
# Heap headroom so the full @hanzo/gui static export never OOMs into a stub; telemetry off.
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=8192
# The console.hanzo.ai analytics property (public per-site id, not a KMS secret) —
# the same default Dockerfile.embed bakes, so a bundle served from here reports
# identically to one served from inside cloud.
ARG NEXT_PUBLIC_ANALYTICS_WEBSITE_ID=7dce54ee-41f6-4751-96bf-fe005067c7c7
ENV NEXT_PUBLIC_ANALYTICS_WEBSITE_ID=$NEXT_PUBLIC_ANALYTICS_WEBSITE_ID
# The publishable ingest key, for SIGNED-OUT views only. A signed-in visitor is
# still attributed by their own IAM bearer -- src/lib/event.ts feeds this through
# getToken as `token ?? key`, never as `ingestKey`, so it can only fill the gap
# where there is no token and can never displace one.
#
# PUBLISHABLE_KEY is the name in KMS (org hanzo, path deploy, env prod) and on the
# --build-arg; NEXT_PUBLIC_ is what makes the bundler inline it and is a property
# of THIS build, so it is applied here and the secret store keeps the one plain
# name. No default: absent means signed-out views report nothing, exactly as
# before, which is a degradation and not a break.
ARG PUBLISHABLE_KEY
ENV NEXT_PUBLIC_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
# FAIL-HARD: the export MUST emit a real bundle, never a placeholder shell. An
# empty index.html would serve a blank page on every route with a 200, which is
# indistinguishable from a working deploy until someone opens it.
RUN pnpm build:embed && [ -s out/index.html ] && [ -d out/_next ] \
    && echo ">> servable REAL console bundle: $(wc -c < out/index.html)-byte index.html, $(du -sh out/_next | cut -f1) _next/"

# hanzoai/static, digest-pinned: a base image is pinned by digest so the bytes
# cannot change under a rebuild. (The console's OWN release is named by semver in
# the values file — that is the version a human reads.)
#
# v0.5.7: serves a directory's index IN PLACE. The prior pin 301'd `/` to
# `/index.html`, so the address bar carried the internal filename and the
# console's breadcrumb dutifully read "Home > index.html".
FROM ghcr.io/hanzoai/static@sha256:46b9a9b359b24377e228d39fb3d4e485af594d55bf1034dcc7b7a1e858a0bba6
COPY --from=build /console/out/ /srv/
EXPOSE 3000
ENTRYPOINT ["/static"]
CMD ["-root=/srv", "-spa", "-port=3000"]
