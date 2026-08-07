---
title: Containerise & Deploy
summary: Take your project, build a proper image, push it to a private registry, and run it in the cloud — with the pipeline building and deploying it automatically.
minutes: 140
objectives:
  - Push an image to Amazon ECR or Azure Container Registry using short-lived credentials
  - Deploy a container to Azure Container Apps or AWS App Runner / ECS Fargate
  - Wire container build and deploy into your CI pipeline
  - Configure health probes, scaling rules and environment configuration
  - Diagnose a container that fails to start in a managed platform
keyTerms:
  - term: ECR / ACR
    definition: Amazon Elastic Container Registry and Azure Container Registry. Private image registries with IAM/RBAC-controlled access.
  - term: Container Apps
    definition: Azure's managed serverless container platform. Scales to zero, handles ingress, revisions and traffic splitting.
  - term: App Runner
    definition: AWS's managed container service. Point it at an image or a repo and it runs, scales and load-balances it.
  - term: Revision
    definition: An immutable snapshot of a Container Apps deployment. Traffic can be split across revisions for canary releases.
  - term: Liveness probe
    definition: A check determining whether a container should be restarted.
  - term: Readiness probe
    definition: A check determining whether a container should receive traffic. Distinct from liveness, and frequently confused with it.
resources:
  - label: Azure Container Apps documentation
    url: https://learn.microsoft.com/en-us/azure/container-apps/overview
  - label: AWS App Runner documentation
    url: https://docs.aws.amazon.com/apprunner/latest/dg/what-is-apprunner.html
  - label: Amazon ECR user guide
    url: https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html
---

A heavier build day. By the end, pushing to `main` will build an image, publish it to a private registry and deploy it — with no manual steps.

Pick **one** cloud to do properly. The other is a written exercise; the concepts transfer almost exactly.

## Registries

:::tabs

:::tab{title="Azure Container Registry"}
```bash
RG=rg-learning-day27
ACR="acrlearning$RANDOM"

az group create --name $RG --location uksouth
az acr create --resource-group $RG --name $ACR --sku Basic

# Build IN Azure — no local Docker needed, and it builds for linux/amd64
az acr build --registry $ACR --image support-tool:1.0.0 .

# Or build locally and push
az acr login --name $ACR
docker tag support-tool:1.0.0 $ACR.azurecr.io/support-tool:1.0.0
docker push $ACR.azurecr.io/support-tool:1.0.0

az acr repository show-tags --name $ACR --repository support-tool --output table
```

:::hint{type=success}
`az acr build` is genuinely useful. It uploads your build context and builds **in Azure**, which means no local Docker daemon and — importantly on an Apple Silicon machine — no architecture mismatch. It is also the fastest way to build from a constrained laptop.
:::
:::

:::tab{title="Amazon ECR"}
```bash
REGION=eu-west-2
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REPO=support-tool

aws ecr create-repository \
  --repository-name $REPO \
  --image-scanning-configuration scanOnPush=true \
  --image-tag-mutability IMMUTABLE

aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"

docker build -t $REPO:1.0.0 .
docker tag $REPO:1.0.0 "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:1.0.0"
docker push "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:1.0.0"
```

`--image-tag-mutability IMMUTABLE` prevents overwriting a published tag. Combined with tagging by commit SHA, it makes "build once, promote" structurally enforced — you cannot accidentally push a different image under the same tag.
:::

:::

### Tagging strategy

```bash title="tags.sh"
SHA=$(git rev-parse --short HEAD)
docker tag support-tool "$REGISTRY/support-tool:$SHA"        # immutable, the real identity
docker tag support-tool "$REGISTRY/support-tool:1.4.2"       # semantic version
docker tag support-tool "$REGISTRY/support-tool:latest"      # convenience only
```

:::hint{type=danger}
**Never deploy `:latest` to production.** It is a mutable pointer — you cannot tell what is running, rollback is meaningless, and two nodes pulling at different times can run different code. Deploy the **commit SHA tag**. `latest` is for local convenience and nothing else.
:::

Lifecycle policies stop registry costs growing forever:

```json title="ecr-lifecycle.json"
{
  "rules": [{
    "rulePriority": 1,
    "description": "Keep the 20 most recent images",
    "selection": {
      "tagStatus": "any",
      "countType": "imageCountMoreThan",
      "countNumber": 20
    },
    "action": { "type": "expire" }
  }]
}
```

## Deploying

:::tabs

:::tab{title="Azure Container Apps"}
```bash
ENVNAME=cae-learning

az containerapp env create \
  --name $ENVNAME --resource-group $RG --location uksouth

az containerapp create \
  --name ca-support-tool \
  --resource-group $RG \
  --environment $ENVNAME \
  --image "$ACR.azurecr.io/support-tool:1.0.0" \
  --registry-server "$ACR.azurecr.io" \
  --system-assigned \
  --target-port 8000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 5 \
  --cpu 0.5 --memory 1.0Gi \
  --env-vars LOG_LEVEL=INFO ENVIRONMENT=prod \
  --query properties.configuration.ingress.fqdn -o tsv
```

Let the app's managed identity pull from the registry, so no registry password is stored:

```bash
PRINCIPAL=$(az containerapp show -n ca-support-tool -g $RG --query identity.principalId -o tsv)
az role assignment create --assignee $PRINCIPAL --role AcrPull \
  --scope $(az acr show -n $ACR --query id -o tsv)

az containerapp registry set -n ca-support-tool -g $RG \
  --server "$ACR.azurecr.io" --identity system
```

**Scaling rules** — this is where Container Apps is strong:

```bash
az containerapp update -n ca-support-tool -g $RG \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50
```

`--min-replicas 0` means it **scales to zero** when idle — you pay nothing between requests, at the cost of a cold start. That is Lambda-like economics for a container.

**Revisions and traffic splitting** give you canary deployments for free:

```bash
az containerapp update -n ca-support-tool -g $RG \
  --image "$ACR.azurecr.io/support-tool:1.1.0" --revision-suffix v110

az containerapp ingress traffic set -n ca-support-tool -g $RG \
  --revision-weight ca-support-tool--v110=10 latest=90
```
:::

:::tab{title="AWS App Runner / ECS Fargate"}
**App Runner** is the simplest path — the closest AWS equivalent to Container Apps:

```bash
aws apprunner create-service \
  --service-name support-tool \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "'"$ACCOUNT"'.dkr.ecr.eu-west-2.amazonaws.com/support-tool:1.0.0",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": { "LOG_LEVEL": "INFO" }
      }
    },
    "AutoDeploymentsEnabled": true,
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::'"$ACCOUNT"':role/AppRunnerECRAccessRole"
    }
  }' \
  --instance-configuration '{"Cpu":"0.5 vCPU","Memory":"1 GB"}' \
  --health-check-configuration '{"Protocol":"HTTP","Path":"/health","Interval":10,"Timeout":5,"HealthyThreshold":1,"UnhealthyThreshold":3}'
```

**ECS Fargate** is more work and more control — task definitions, services, a load balancer, target groups. Use it when you need VPC integration, sidecars, or fine-grained networking. App Runner cannot scale to zero (there is a minimum provisioned instance); Container Apps can.
:::

:::

## Health probes

The distinction between liveness and readiness is worth getting right, because getting it wrong causes restart loops.

| Probe | Question | Failure means |
|---|---|---|
| **Startup** | Has it finished booting? | Keep waiting; do not restart yet |
| **Liveness** | Is the process healthy? | **Restart the container** |
| **Readiness** | Can it serve traffic *right now*? | Remove from the load balancer; do **not** restart |

```yaml title="container-app-probes.yaml"
probes:
  - type: startup
    httpGet: { path: /health, port: 8000 }
    initialDelaySeconds: 5
    periodSeconds: 3
    failureThreshold: 20
  - type: liveness
    httpGet: { path: /health, port: 8000 }
    periodSeconds: 30
    failureThreshold: 3
  - type: readiness
    httpGet: { path: /ready, port: 8000 }
    periodSeconds: 10
    failureThreshold: 3
```

```python title="health_endpoints.py"
@app.get("/health")
async def health():
    """Liveness: is the process itself alive? Deliberately checks nothing external."""
    return {"status": "ok", "version": VERSION}


@app.get("/ready")
async def ready():
    """Readiness: can we actually serve a request? Checks dependencies."""
    checks = {}
    try:
        await db.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"failed: {exc}"
        return JSONResponse({"status": "degraded", "checks": checks}, status_code=503)
    return {"status": "ok", "checks": checks}
```

:::hint{type=danger}
**Do not check downstream dependencies in the liveness probe.** If the database goes down and liveness checks it, every container restarts — repeatedly — while the database is unavailable. Now you have a database outage *and* a crash-looping service, and the restarts may prevent recovery.

Liveness answers "is *this process* wedged?" Readiness answers "can I serve traffic?" Dependencies belong in readiness.
:::

## Wiring it into CI

```yaml title=".github/workflows/deploy-container.yml"
name: Build and deploy container

on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write            # OIDC — no stored cloud credentials

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.meta.outputs.image }}
    steps:
      - uses: actions/checkout@v4

      - id: meta
        run: echo "image=${{ vars.REGISTRY }}/support-tool:${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

      - uses: docker/setup-buildx-action@v3

      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Registry login
        run: az acr login --name ${{ vars.ACR_NAME }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: |
            ${{ steps.meta.outputs.image }}
            ${{ vars.REGISTRY }}/support-tool:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan the image
        uses: aquasecurity/trivy-action@0.24.0
        with:
          image-ref: ${{ steps.meta.outputs.image }}
          severity: CRITICAL,HIGH
          ignore-unfixed: true
          exit-code: '1'

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production      # protection rules provide the approval gate
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy the exact image that was built and scanned
        run: |
          az containerapp update \
            --name ca-support-tool --resource-group rg-support-prod \
            --image "${{ needs.build-and-push.outputs.image }}" \
            --revision-suffix "sha${GITHUB_SHA::7}"

      - name: Verify
        run: |
          FQDN=$(az containerapp show -n ca-support-tool -g rg-support-prod \
                  --query properties.configuration.ingress.fqdn -o tsv)
          for i in $(seq 1 20); do
            if curl -fsS "https://$FQDN/health" | grep -q '"status":"ok"'; then
              echo "Healthy after $((i*5))s"; exit 0
            fi
            sleep 5
          done
          echo "Never became healthy" >&2
          exit 1
```

`cache-from: type=gha` uses GitHub's cache for Docker layers, which typically cuts build time by more than half on repeat builds.

:::hint{type=warning}
`ignore-unfixed: true` on the scan is a deliberate choice: failing the build on a vulnerability with **no available fix** just blocks you with no action available. Fail on fixable high and critical findings; track the unfixable ones separately. A scanner configured to fail on everything gets disabled within a fortnight, which is worse than a scanner tuned to be actionable.
:::

```quiz
question: Your container platform restarts your service every 40 seconds during a database outage. What is most likely misconfigured?
options:
  - The readiness probe interval is too short
  - The liveness probe checks database connectivity, so a database outage makes the platform kill the container
  - The image tag is set to :latest
  - The memory limit is too low
answer: 1
explanation: Liveness failures cause restarts. If liveness depends on the database, every container is killed while the database is down — adding a crash loop to an existing outage. Dependency checks belong in the readiness probe, which only removes the instance from load balancing.
```

## Diagnosing a container that will not start in the cloud

The local techniques from yesterday still apply, but with fewer tools available. A triage order:

:::steps

1. **Read the platform logs**, not just the application logs.
   ```bash
   az containerapp logs show -n ca-support-tool -g $RG --type system --follow
   az containerapp logs show -n ca-support-tool -g $RG --type console --tail 200
   ```
   System logs tell you about image pull failures and probe failures; console logs are your app's stdout.

2. **Image pull failure?** Check the registry credentials or managed identity role assignment, and that the tag actually exists.

3. **Architecture mismatch?** `exec format error` in the logs means an arm64 image on an amd64 host. Build with `--platform linux/amd64`.

4. **Probe failing?** Confirm the app binds `0.0.0.0`, not `127.0.0.1`, and that the port matches `--target-port`.

5. **Missing configuration?** Environment variables and secrets that existed locally must be set on the platform too. `az containerapp show --query properties.template.containers[0].env`.

6. **OOM?** Exit code 137. Raise the memory allocation or find the leak.

7. **Reproduce locally with the production image.**
   ```bash
   docker run --rm -it --entrypoint /bin/sh "$REGISTRY/support-tool:$SHA"
   ```
   Pulling the exact image the platform is running eliminates "it must be the build".

:::

## Exercise

:::checklist{title="Day 27 checklist"}
- [ ] Private registry created (ACR or ECR) with image scanning on push
- [ ] Image built and pushed, tagged with the commit SHA
- [ ] Registry access via managed identity or an IAM role — **no stored password**
- [ ] Container deployed to Container Apps, App Runner or ECS Fargate
- [ ] Public URL responding
- [ ] Startup, liveness and readiness probes configured, with distinct `/health` and `/ready` endpoints
- [ ] Stop the database and confirm readiness fails while liveness stays healthy
- [ ] Scaling rule configured; generate load and watch replicas increase
- [ ] CI workflow builds, scans and pushes on every merge to `main`
- [ ] Deploy job uses the **exact digest/SHA** that was built and scanned
- [ ] Deploy a second version and split traffic 10/90 (Container Apps) or verify rollback works
- [ ] Deliberately deploy a broken image; diagnose it from the platform logs alone
- [ ] Lifecycle/retention policy configured on the registry
- [ ] `az group delete` / tear down AWS resources
:::

:::details{summary="Why is my container running but returning connection refused?"}
Nearly always one of three things:

1. **Bound to `127.0.0.1`.** Inside a container, localhost is the container's own loopback. Nothing outside can reach it. Bind `0.0.0.0`.
   ```python
   uvicorn.run(app, host="0.0.0.0", port=8000)   # not host="127.0.0.1"
   ```
2. **Port mismatch.** `--target-port 8000` must match what the app actually listens on. `docker exec <id> ss -tlnp` shows the truth.
3. **The app has not finished starting.** No startup probe, so the platform routes traffic immediately and the first requests fail. Add a startup probe with a generous `failureThreshold`.

Point 1 is the most common, and it is the same mistake as step 6 in Day 12's network triage — it recurs at every layer.
:::

## Where this is going

Tomorrow closes the chapter with AZ-900 practice, mirroring Day 14. Then Week 5 turns everything you have built into a portfolio project designed to look like the actual job.
