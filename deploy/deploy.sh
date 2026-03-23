#!/bin/bash
# Vino服务 - 腾讯云部署脚本
# 服务器: 106.54.50.88
# 端口: 前端5301, 后端5302, MySQL3308
# 部署流程: git push -> SSH -> git pull -> docker-compose rebuild

set -e

SSH_KEY="F:/ItsyourTurnMy/backend/deploy/test.pem"
SERVER="ubuntu@106.54.50.88"
SSH_OPTS="-o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no"
REMOTE_PATH="/root/Vino_test"
GITHUB_MIRROR="https://ghfast.top/https://github.com/a654889339/zhikeweilai.git"

echo "========================================="
echo "  Vino服务 - 部署到腾讯云"
echo "========================================="

echo "[1/4] 推送代码到GitHub..."
git push origin main

echo "[2/4] 服务器拉取最新代码..."
REPO_EXISTS=$(ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo test -d $REMOTE_PATH/.git && echo yes || echo no")

if [ "$REPO_EXISTS" = "yes" ]; then
    echo "  -> git pull (更新已有代码)"
    # 更新远程仓库地址，避免 pull 仍然拉取旧的 Vino_test 镜像
    ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo git -C $REMOTE_PATH remote set-url origin $GITHUB_MIRROR && sudo git -C $REMOTE_PATH pull"
else
    echo "  -> git clone (首次部署)"
    ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo bash -c 'cd /root && git clone $GITHUB_MIRROR Vino_test'"
    ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo git -C $REMOTE_PATH remote set-url origin $GITHUB_MIRROR"
fi

echo "[3/4] 构建并启动容器..."
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo bash -c 'cd $REMOTE_PATH && docker-compose down 2>/dev/null; docker-compose up -d --build'"

echo "[4/4] 检查容器状态..."
sleep 8
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo docker ps --filter name=vino --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo "========================================="
echo "  部署完成!"
echo "  前端: http://106.54.50.88:5301"
echo "  后端: http://106.54.50.88:5302/api/health"
echo "========================================="
