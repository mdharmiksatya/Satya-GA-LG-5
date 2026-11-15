# LensLab Studio – Camera Rental Management System

A robust, modular, and beginner-friendly RESTful backend API built with **Node.js**, **Express.js**, and **SQLite**. Designed for camera rental studios to manage their photographers (clients), camera gear inventory, and rental bookings with strict relational integrity, case-insensitive duplicate prevention, and atomic transactions.

---

## 1. Project Introduction

**LensLab Studio** is a backend system designed for professional photography gear rental services. The system manages three core domains:
- **Photographers**: Client profiles who book camera equipment.
- **Cameras**: Studio equipment inventory with dynamic availability tracking (`available` / `rented`).
- **Rentals**: Relational transactions connecting photographers with cameras over specific rental windows.

---

## 2. Project Objectives

- **Modular Architecture**: Clean separation between server configuration, database initialization, route definitions, and business logic.
- **Data Integrity**: Enforced SQLite foreign keys (`PRAGMA foreign_keys = ON;`) to prevent orphaned records.
- **Inventory Safety**: Automated status transitions (`available` ↔ `rented`) backed by atomic SQLite transactions.
- **Robust Validation**: Dual-layer (application + database) case-insensitive duplicate detection for equipment names.
- **Performant Queries**: Multi-table SQL `INNER JOIN` operations to provide complete, human-readable rental details in a single query.

---

## 3. Technology Stack

- **Runtime Environment**: [Node.js](https://nodejs.org/) (v20+)
- **Web Framework**: [Express.js](https://expressjs.com/) (v5.x)
- **Database Engine**: [SQLite3](https://www.sqlite.org/) (via `sqlite3` driver)
- **Development Tooling**: [Nodemon](https://nodemon.io/) (for hot-reloading)
- **API Testing**: [Postman](https://www.postman.com/)

---

## 4. Installation Instructions

### Prerequisites
Ensure that [Node.js](https://nodejs.org/) and `npm` are installed on your machine.

### Setup Steps
1. Clone or navigate to the project directory:
   ```bash
   cd "BDF GA"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## 5. Project Structure

```text
BDF GA/
├── config/
│   └── db.js                              # SQLite connection, schema creation, PRAGMA setup, and seed data
├── database/
│   └── lenslab.db                         # SQLite database file (auto-generated, gitignored)
├── routes/
│   ├── photographers.js                   # Photographer API endpoints
│   ├── cameras.js                         # Camera CRUD & search endpoints
│   └── rentals.js                         # Rental endpoints with SQL JOIN and transaction logic
├── .gitignore                             # Git exclusion rules
├── app.js                                 # Main Express application entry point
├── LensLab-Studio.postman_collection.json # Exportable Postman collection
├── package.json                           # Dependencies and npm scripts
├── package-lock.json                      # Dependency lockfile
└── README.md                              # Complete system documentation
```

---

## 6. Database Schema

The database consists of three relational tables stored in `database/lenslab.db`:

```
┌──────────────────┐               ┌─────────────┐               ┌──────────────────┐
│  photographers   │ 1           * │   rentals   │ *           1 │     cameras      │
├──────────────────┤───────────────┼─────────────┼───────────────├──────────────────┤
│ id (PK, AutoInc) │               │ id (PK)     │               │ id (PK, AutoInc) │
│ name (TEXT, Req) │               │ photog._id  │───────────────│ name (TEXT, UQ)  │
│ email (TEXT)     │               │ camera_id   │───────────────│ kind (TEXT, Req) │
│ phone (TEXT)     │               │ rental_date │               │ status (TEXT)    │
│                  │               │ return_date │               │                  │
└──────────────────┘               └─────────────┘               └──────────────────┘
```

### Table Definitions

#### 1. `photographers`
- `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
- `name`: `TEXT NOT NULL` — Full client name (required).
- `email`: `TEXT` — Email address (validated if supplied).
- `phone`: `TEXT` — Contact phone number.

#### 2. `cameras`
- `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
- `name`: `TEXT NOT NULL UNIQUE COLLATE NOCASE` — Unique camera name (case-insensitive).
- `kind`: `TEXT NOT NULL` — Category/type (e.g., `Mirrorless`, `DSLR`, `Cinema`).
- `status`: `TEXT DEFAULT 'available'` — Inventory status (`available` or `rented`).

#### 3. `rentals`
- `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
- `photographer_id`: `INTEGER NOT NULL` — Foreign Key referencing `photographers(id)`.
- `camera_id`: `INTEGER NOT NULL` — Foreign Key referencing `cameras(id)`.
- `rental_date`: `TEXT` — Start date of rental (`YYYY-MM-DD`).
- `return_date`: `TEXT` — Return date (`YYYY-MM-DD`). Must be on or after `rental_date`.

---

## 7. API Documentation

### Summary Table

| Domain | Method | Endpoint | Description | Status Codes |
|---|---|---|---|---|
| **System** | `GET` | `/` | API health and welcome message | `200` |
| **Photographers** | `GET` | `/photographers` | Fetch all photographers | `200`, `500` |
| | `GET` | `/photographers/:id` | Fetch single photographer by ID | `200`, `400`, `404`, `500` |
| | `POST` | `/photographers` | Create a new photographer | `201`, `400`, `500` |
| **Cameras** | `GET` | `/cameras` | List cameras (or search `?kind=...`) | `200`, `500` |
| | `GET` | `/cameras/:id` | Fetch single camera by ID | `200`, `400`, `404`, `500` |
| | `POST` | `/cameras` | Create camera (unique name check) | `201`, `400`, `409`, `500` |
| | `PUT` | `/cameras/:id` | Update camera name and kind | `200`, `400`, `404`, `409`, `500` |
| | `DELETE`| `/cameras/:id` | Delete camera (blocks if rented) | `200`, `400`, `404`, `409`, `500` |
| **Rentals** | `GET` | `/rentals` | List all rentals with SQL JOIN | `200`, `500` |
| | `GET` | `/rentals/:id` | Fetch single rental with SQL JOIN | `200`, `400`, `404`, `500` |
| | `POST` | `/rentals` | Book rental & update camera to `rented` | `201`, `400`, `404`, `500` |
| | `PUT` | `/rentals/:id` | Update rental & adjust camera statuses | `200`, `400`, `404`, `500` |
| | `DELETE`| `/rentals/:id` | Delete rental & release camera to `available` | `200`, `400`, `404`, `500` |

---

## 8. Request and Response Examples

### Photographers

#### `POST /photographers`
**Request Body**:
```json
{
  "name": "Elena Rostova",
  "email": "elena@example.com",
  "phone": "555-0199"
}
```
**Response** (`201 Created`):
```json
{
  "message": "Photographer created successfully",
  "id": 4,
  "name": "Elena Rostova",
  "email": "elena@example.com",
  "phone": "555-0199"
}
```

---

### Cameras

#### `POST /cameras` (Duplicate Name Rejection)
**Request Body**:
```json
{
  "name": "canon eos r5",
  "kind": "Mirrorless"
}
```
**Response** (`409 Conflict`):
```json
{
  "error": "canon eos r5 already exists"
}
```

#### `GET /cameras?kind=dslr` (Search by Kind)
**Response** (`200 OK`):
```json
[
  {
    "id": 3,
    "name": "Nikon D850",
    "kind": "DSLR",
    "status": "available"
  }
]
```

---

### Rentals

#### `POST /rentals` (Atomic Rental Booking)
**Request Body**:
```json
{
  "photographer_id": 1,
  "camera_id": 1,
  "rental_date": "2026-11-20",
  "return_date": "2026-11-25"
}
```
**Response** (`201 Created`):
```json
{
  "message": "Rental created successfully",
  "rental": {
    "id": 1,
    "photographer_id": 1,
    "photographer_name": "Alice Johnson",
    "camera_id": 1,
    "camera_name": "Canon EOS R5",
    "camera_kind": "Mirrorless",
    "rental_date": "2026-11-20",
    "return_date": "2026-11-25"
  }
}
```

#### `POST /rentals` (Rejection of Unavailable Camera)
**Request Body**:
```json
{
  "photographer_id": 2,
  "camera_id": 1,
  "rental_date": "2026-11-21"
}
```
**Response** (`400 Bad Request`):
```json
{
  "error": "Camera 'Canon EOS R5' is currently rented and cannot be rented."
}
```

---

## 9. Validation and Search Details

1. **Input Trimming & Required Fields**:
   - `name` and `kind` are trimmed before validation. Empty strings and whitespace-only submissions are rejected with `400 Bad Request`.
2. **Email Formatting**:
   - Photographers' emails are validated using standard regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) if supplied.
3. **Date Verification**:
   - Rental dates are validated against `YYYY-MM-DD` ISO format.
   - The condition `return_date >= rental_date` is strictly enforced.
4. **Flexible Query Search**:
   - `GET /cameras?kind=...` uses SQLite parameterized `LIKE ?` search with `%${kind}%`.
   - Matches case-insensitively (`?kind=dslr` matches `DSLR`).
   - Supports partial queries (`?kind=cine` matches `Cinema`).
   - An empty query parameter (`?kind=`) safely returns all cameras.

---

## 10. Case-Insensitive Duplicate Camera Protection

Duplicate camera names are prevented regardless of capitalization (`"Camera 3"`, `"camera 3"`, and `"CAMERA 3"` are treated as duplicates) through two defensive layers:

1. **Application-Level Pre-Checks**:
   - In `POST /cameras`:
     ```sql
     SELECT id FROM cameras WHERE name = ? COLLATE NOCASE
     ```
   - In `PUT /cameras/:id` (excluding the current camera's own ID):
     ```sql
     SELECT id FROM cameras WHERE name = ? COLLATE NOCASE AND id != ?
     ```
   - If a match is found, HTTP `409 Conflict` is returned with `{ "error": "<name> already exists" }`.
2. **Database Constraint Safety Net**:
   - The column is declared as:
     ```sql
     name TEXT NOT NULL UNIQUE COLLATE NOCASE
     ```
   - Even in race conditions, SQLite blocks duplicates via unique collation and triggers a `UNIQUE constraint failed` error that is caught and translated to HTTP `409`.

---

## 11. SQL JOIN Operations

The rental endpoints combine information across three tables in a single query:

```sql
SELECT 
  rentals.id AS id,
  rentals.photographer_id AS photographer_id,
  photographers.name AS photographer_name,
  rentals.camera_id AS camera_id,
  cameras.name AS camera_name,
  cameras.kind AS camera_kind,
  rentals.rental_date AS rental_date,
  rentals.return_date AS return_date
FROM rentals
INNER JOIN photographers ON rentals.photographer_id = photographers.id
INNER JOIN cameras ON rentals.camera_id = cameras.id
ORDER BY rentals.id ASC;
```

- **Why it matters**: Clients receive full names and categories (e.g., `"Alice Johnson"` and `"Canon EOS R5"`) without making secondary queries.
- **Aliases**: Resolves identical column names (`id`, `name`) cleanly into `photographer_name`, `camera_name`, and `camera_kind`.

---

## 12. Transaction Management

All operations modifying multiple tables simultaneously are wrapped in explicit SQLite transactions:

```text
POST /rentals:
BEGIN TRANSACTION ──> Insert into rentals ──> UPDATE cameras SET status = 'rented' ──> COMMIT
                                 │                                    │
                                 └── (Any Error -> ROLLBACK) ─────────┘

PUT /rentals/:id (switching cameras):
BEGIN TRANSACTION ──> Update rental ──> Old camera -> 'available' ──> New camera -> 'rented' ──> COMMIT
                                 │                                    │
                                 └── (Any Error -> ROLLBACK) ─────────┘

DELETE /rentals/:id:
BEGIN TRANSACTION ──> Delete rental ──> Check remaining rentals ──> Camera -> 'available' ──> COMMIT
                                 │                                    │
                                 └── (Any Error -> ROLLBACK) ─────────┘
```

- **Atomicity**: Guarantees that inventory status will never become out-of-sync with rental records if a database error occurs mid-operation.

---

## 13. How to Run the Server

### Development Mode (with Nodemon Auto-Reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Once running, the server listens on port `3000` (or `process.env.PORT`):
```text
Connected to SQLite database at: .../database/lenslab.db
SQLite foreign key constraints enabled.
Server is running on port 3000
Access the API at http://localhost:3000
```

---

## 14. How to Test Using Postman

1. Open **Postman**.
2. Click **Import** (top left).
3. Select the file:
   ```text
   LensLab-Studio.postman_collection.json
   ```
4. Confirm the `baseUrl` variable is set to `http://localhost:3000`.
5. Run requests or use the **Collection Runner** to execute all 23 pre-configured automated tests covering status codes, validation, duplicate prevention, and transaction flows.

---

## 15. License

ISC License. Built for Backend Development Fundamentals Assignment.
