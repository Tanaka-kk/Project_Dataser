FROM node:20-alpine

WORKDIR /app

COPY database/database/package*.json ./database/database/
RUN npm --prefix ./database/database install

COPY . .

EXPOSE 8000

CMD ["npm", "--prefix", "database/database", "start"]
