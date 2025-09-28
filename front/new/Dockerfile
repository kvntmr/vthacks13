# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY . .

# Create a default .env.local file if it doesn't exist
RUN if [ ! -f .env.local ]; then \
    cp .env.example .env.local && \
    sed -i 's/\*\*\*\*/dummy_value/g' .env.local; \
    fi \   

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

# Expose port 3000
EXPOSE 3000

# Default command to run development server
CMD ["pnpm", "dev"]