FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 7860
ENV PORT=7860

CMD ["npm", "start"]