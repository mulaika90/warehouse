# Stockwise warehouse portal

Stockwise is a component-based React and Express warehouse management portal
with four role-specific workspaces. The interface uses a black-and-purple
theme by default, supports a persisted light theme, and respects reduced-motion
preferences.

## Roles

- **Admin:** view operation statistics; manage users, roles, warehouse
  assignments, products, and warehouses; review supplier profiles, stock
  movements, low-stock alerts, orders, and supply requests.
- **Warehouse Manager:** access assigned warehouses, inventory, low-stock
  items, stock history, and movement totals; record stock receipts and stock
  out; create or update products, including ImageKit images; review supply
  requests and process sales orders.
- **Supplier:** manage a company profile and ImageKit logo; view associated
  products; submit multi-product supply requests and track their status.
- **Sales Representative:** search and filter live available stock, create
  multi-product sales orders, review order history, and cancel only pending
  orders.

Public registration is limited to Suppliers and Sales Representatives. Admin
creates Admin and Warehouse Manager accounts and assigns warehouse access.

## Run locally

1. Copy `class8/.env.example` to `class8/.env` and set `MONGODB_URI`,
   `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
   Use a private, random JWT secret with at least 32 characters and an admin
   password with at least 12 characters. Never commit or share `.env`.
2. Set `IMAGEKIT_PRIVATE_KEY` to enable product image and supplier logo
   uploads. Image files accept JPG, PNG, or WebP up to 5 MB.
3. Use a MongoDB deployment that supports sessions and transactions (such as
   Atlas or a replica set); stock changes, supply approvals, and order
   processing are transactional.
4. Start the API from `class8` with `npm start`.
5. From `frontend`, install dependencies once with `npm install`, then run
   `npm run dev`. Vite proxies `/api` requests to `http://localhost:3000`.

The backend migrates legacy clinic roles at startup: patients and generic
users become Sales Representatives; doctors become unassigned Warehouse
Managers. Admin must assign warehouses to migrated managers before they can
work inventory.

To serve a production frontend through Express, run `npm run build` in
`frontend` and start the backend. Express serves `frontend/dist`.

## API overview

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`,
  `GET /api/auth/me`, `POST /api/auth/logout`.
- **Admin:** `/api/admin/stats`, `/api/admin/users`,
  `/api/admin/warehouses`, `/api/admin/suppliers`,
  `/api/admin/transactions`, `/api/admin/orders`, and
  `/api/admin/supply-requests`.
- **Warehouses:** `GET /api/warehouses`, `/api/warehouses/catalog`,
  `/api/warehouses/low-stock`, `/api/warehouses/transactions`,
  `GET /api/warehouses/:warehouseId/inventory`,
  `GET /api/warehouses/:warehouseId/transactions`, and
  `POST /api/warehouses/:warehouseId/transactions`.
- **Products:** `GET /api/product`, `POST /api/product/create`,
  `PATCH /api/product/:id`, `DELETE /api/product/:id`. Creation and updates
  accept multipart form data; new products require an image and a unique SKU.
- **Supplier:** `/api/suppliers/profile`, `/api/suppliers/products`,
  `/api/suppliers/catalog`, and `/api/suppliers/requests`. Suppliers can
  request any catalog product; a warehouse manager or admin must approve the
  request before stock changes.
- **Sales orders:** `GET /api/orders`, `POST /api/orders`,
  `PATCH /api/orders/:id/cancel`, and `PATCH /api/orders/:id/status`.

Authenticated routes use an HTTP-only session cookie and load the current
account role and warehouse assignments from MongoDB on each request. The
backend JSON error handler returns explicit API errors.
