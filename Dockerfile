FROM node:20

# 1. Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# 2. Set environment variables for the whole system
ENV PORT=7860
ENV NODE_ENV=production

# 3. Copy everything
COPY . .

# 4. Install dependencies
RUN pnpm install

# 5. FORCE the build with the PORT variable injected directly into the shell
RUN PORT=7860 pnpm run build

EXPOSE 7860

# 6. Start the server
CMD ["pnpm", "start"]