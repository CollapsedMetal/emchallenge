FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm install \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/tmp/*

RUN npm install -g nodemon ts-node --silent && npm cache clean --force

COPY . .

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]