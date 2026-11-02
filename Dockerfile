FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV DATABASE_URL="mysql://root:build-placeholder@db:3306/channel_qa_tool"

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && if [ \"$SEED_DEMO_DATA\" = \"true\" ]; then npm run seed:demo; fi && npm run start"]

