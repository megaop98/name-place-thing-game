FROM node:20

# 1. Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# 2. Set the PORT right now (Crucial for the Vite build)
ENV PORT=7860
ENV NODE_ENV=production

# 3. Copy files
COPY . .

# 4. Install and Build
RUN pnpm install
RUN pnpm run build

EXPOSE 7860

# 5. Start
CMD ["pnpm", "start"]