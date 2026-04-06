# 构建：docker build -t zkwl-backend .
FROM golang:1.22-alpine AS build
RUN apk add --no-cache git ca-certificates
WORKDIR /src
# 腾讯云等国内环境访问 proxy.golang.org 易超时，构建时使用国内代理
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /zkwl-server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /zkwl-server /app/zkwl-server
COPY static ./static
EXPOSE 5302
ENV PORT=5302
CMD ["/app/zkwl-server"]
