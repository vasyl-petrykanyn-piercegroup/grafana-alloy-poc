FROM node:20-alpine

WORKDIR /app
COPY metrics-emulator/package.json ./package.json
COPY metrics-emulator/src ./src

EXPOSE 9091
CMD ["npm", "start"]
