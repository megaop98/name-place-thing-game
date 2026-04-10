FROM node:20

RUN npm install -g pnpm

WORKDIR /app

ENV PORT=7860
ENV BASE_PATH=/
ENV NODE_ENV=production

COPY . .

RUN pnpm install

RUN PORT=7860 BASE_PATH=/ pnpm run build

EXPOSE 7860

# This is the new direct start command
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]