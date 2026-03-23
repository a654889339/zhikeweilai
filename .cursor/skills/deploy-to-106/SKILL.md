---
name: deploy-to-106
description: Deploys the current project to the 106.54.50.88 server using the same SSH/git mirror + docker-compose rebuild workflow as Vino_test. Use when the user asks to publish/deploy or prepare a production release.
---

# Deploy to 106 (Vino_test workflow)

## Preconditions
- The local git repo is ready and `main` branch contains the latest code.
- SSH private key exists at `F:/ItsyourTurnMy/backend/deploy/test.pem`.
- Remote deployment directory is `/root/Vino_test`.
- Expected ports:
  - Frontend: `5301`
  - Backend API: `5302` (health at `/api/health`)

## Steps
1. Push code to GitHub mirror
   - Run: `git push origin main`

2. SSH to the server and pull/clone code
   - Server: `ubuntu@106.54.50.88`
   - Key: `F:/ItsyourTurnMy/backend/deploy/test.pem`
   - SSH options (from Vino_test):
     - `-o HostKeyAlgorithms=+ssh-rsa`
     - `-o PubkeyAcceptedKeyTypes=+ssh-rsa`
     - `-o StrictHostKeyChecking=no`
  - Variables (from Vino_test):
    - `REMOTE_PATH=/root/Vino_test`
    - `GITHUB_MIRROR=https://ghfast.top/https://github.com/a654889339/zhikeweilai.git`
   - Logic:
     - If `REMOTE_PATH/.git` exists: run `git -C $REMOTE_PATH pull`
     - Otherwise: `git clone $GITHUB_MIRROR Vino_test` under `/root`, then `git -C $REMOTE_PATH remote set-url origin $GITHUB_MIRROR`

3. Rebuild and restart docker containers
   - Run on remote:
     - `cd $REMOTE_PATH`
     - `docker-compose down 2>/dev/null`
     - `docker-compose up -d --build`

4. Verify
   - Check container status:
     - `docker ps --filter name=vino --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`
   - Health check (port updated to 5302):
     - `curl -s http://localhost:5302/api/health`

## Notes
- This workflow overwrites the code under `/root/Vino_test` on the server.
- If you need a different remote directory, update `REMOTE_PATH`.

