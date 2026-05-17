# Azure Migration Guide - MongoDB + JWT Auth System

Follow these steps to deploy your application to an **Azure App Service**.

## 1. Prerequisites
- **Azure Account** (Student or Free).
- **Azure App Service + Database** resource created in the portal (Select **Node 22 LTS** and **Cosmos DB with MongoDB API**).

## 2. Database Configuration
1. Go to your **Azure Cosmos DB** resource in the portal.
2. Find the **Connection String** section.
3. Copy the **Primary Connection String**.
4. In your **App Service** resource, go to **Configuration** (under Settings) -> **Application Settings**.
5. Add a new setting:
   - **Name**: `MONGO_URI`
   - **Value**: (Paste your connection string here)
6. Add other required settings:
   - `SESSION_SECRET`: (A random string)
   - `PORT`: `80`

## 3. Uploading Code (GitHub Recommended)
1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Migration to MongoDB and JWT"
   git push origin main
   ```
2. **Link to Azure**:
   - In the Azure Portal, go to your **App Service** -> **Deployment Center**.
   - Select **GitHub** as the source and link your repository.
   - Azure will automatically build and deploy your site.

## 4. Manual Upload (Alternative)
1. Zip the project (excluding `node_modules`).
2. Use **Advanced Tools (Kudu)** or **FTPS** to upload and unzip in `/home/site/wwwroot`.
3. Azure will automatically run `npm install` and `npm start`.

## 5. Accessing the Site
Your site will be live at: `https://<YOUR_APP_NAME>.azurewebsites.net`
