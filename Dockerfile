FROM node:6

WORKDIR /usr/src/app

COPY package.json .

RUN npm install

COPY . .

EXPOSE 3978
EXPOSE 3000

CMD ["/bin/sh", "-c", "npm start > debug.log 2>&1"]
