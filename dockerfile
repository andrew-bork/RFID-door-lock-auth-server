FROM node:20.5.1

# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY ./src ./src/

CMD [ "npm", "start" ]