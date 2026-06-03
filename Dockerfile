FROM node:20

RUN npm install -g pnpm

RUN mkdir -p /home/node/app && chown -R node:node /home/node

WORKDIR /home/node/app

ENV PORT=7860
ENV BASE_PATH=/
ENV NODE_ENV=production

COPY --chown=node:node . .

USER node

RUN pnpm install

RUN PORT=7860 BASE_PATH=/ pnpm run build

EXPOSE 7860

CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
