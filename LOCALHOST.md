# Localhost Instructions

You can run the Campus Twin application locally and test the new admin features.

## How to start the dev server
1. Open a terminal and navigate to the project root:
```powershell
cd "e:\Projects\Campus Twin"
```
2. Install dependencies (only the first time):
```powershell
npm install
```
3. Run the development server:
```powershell
npm run dev   # Vite (default)
# or, if using CRA:
# npm start
```
4. Once the server starts, it will display the URL:
```
> Local:   http://localhost:3000/
```
5. Open **http://localhost:3000** in your browser.

## Quick test points
- Visit **/admin/branches** to manage branches (Super Admin).
- Visit **/branch/settings** to toggle maintenance mode (Branch Admin).
- Log in with appropriate roles to see the new UI.

You can also change the port via a `.env` file (`VITE_PORT=xxxx`). The URL will then be `http://localhost:<PORT>`.
