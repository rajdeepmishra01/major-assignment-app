FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_AUTH_API_URL=http://localhost:5001
ARG VITE_TODO_API_URL=http://localhost:5002
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL
ENV VITE_TODO_API_URL=$VITE_TODO_API_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
