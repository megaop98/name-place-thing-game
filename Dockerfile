FROM node:20

# Install pnpm globally so the server can use it
RUN npm install -g pnpm

WORKDIR /app

# Copy all files (including pnpm-lock.yaml and workspace files)
COPY . .

# Install dependencies using pnpm
RUN pnpm install

# Build the project
RUN pnpm run build

EXPOSE 7860
ENV PORT=7860

# Use pnpm to start the game
CMD ["pnpm", "start"]