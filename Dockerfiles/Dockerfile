FROM node:alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
FROM node:alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .
RUN mkdir -p images
EXPOSE 3000
ENV PORT=3000
CMD ["node","app.js"]
