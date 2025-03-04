# Use an official Node.js image as the base
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy the entire project
COPY . .

# Expose the port your app runs on
EXPOSE 5000

# Start the application
CMD ["node", "App.js"]
