FROM node:22-alpine
WORKDIR /app

# 1. Build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 2. Build backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY backend/ ./backend/
RUN cd backend && npm run build

# 3. Expose backend port
EXPOSE 3001

# 4. Start backend
WORKDIR /app/backend
CMD ["npm", "start"]
