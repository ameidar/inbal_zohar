FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3010
CMD ["sh", "-c", "node src/migrations/run.js && node src/seed.js && node src/index.js"]
