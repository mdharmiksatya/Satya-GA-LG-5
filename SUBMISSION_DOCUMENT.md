# AURORA EDUTECH / BDF GROUP ASSIGNMENT SUBMISSION

---

## 1. AURORA HEADER

- **Institution**: Aurora Higher Education / Technical Institute
- **Course**: Backend Development Fundamentals (BDF)
- **Assignment**: Group Assignment – Problem Statement: *LensLab Studio (Camera Rental Management System)*
- **Learning Group (LG)**: LG-5
- **Student Name**: Malla Dharmik Satya
- **GitHub Repository**: [https://github.com/mdharmiksatya/Satya-GA-LG-5](https://github.com/mdharmiksatya/Satya-GA-LG-5)
- **Submission Date**: November 2026

---

## 2. LG GROUP MEMBERS

| S.No. | Student Name | Student Roll / ID | Assigned Task / Role |
|:---:|:---|:---:|:---|
| 1 | **Malla Dharmik Satya** *(You)* | *[Insert Your Roll No.]* | **Backend Validation & Technical Research** |
| 2 | *[Member 2 Name]* | *[Member 2 Roll No.]* | *[Member 2 Role, e.g., Database Schema & DB Initialization]* |
| 3 | *[Member 3 Name]* | *[Member 3 Roll No.]* | *[Member 3 Role, e.g., Photographer & Camera CRUD APIs]* |
| 4 | *[Member 4 Name]* | *[Member 4 Roll No.]* | *[Member 4 Role, e.g., Rentals API, SQL JOIN & Postman Testing]* |

---

## 3. QUESTION SCREENSHOT

> **[INSERT QUESTION SCREENSHOT HERE]**  
> *(Paste the screenshot of the original BDF assignment question / problem statement received from your instructor here)*

---

## 4. DESCRIPTION OF WHAT YOU HAVE DEVELOPED

### Assigned Role: **Backend Validation & Technical Research Lead**

For the **LensLab Studio – Camera Rental Management System**, my individual responsibility focused on **system-wide input validation, defensive database constraint design, query research, and data integrity verification**.

### Key Contributions & Developments:

1. **Technical Research on SQLite Behaviors**:
   - **Case-Insensitive Uniqueness Research**: Researched how SQLite compares text. Discovered that SQLite is case-sensitive by default for `TEXT UNIQUE`. Designed the solution utilizing `COLLATE NOCASE` both at the database column definition level (`name TEXT NOT NULL UNIQUE COLLATE NOCASE`) and in SQL queries (`WHERE name = ? COLLATE NOCASE`), ensuring that `"Camera 3"`, `"camera 3"`, and `"CAMERA 3"` are recognized as identical duplicates.
   - **Foreign Key Constraints Enforcement**: Researched SQLite's `PRAGMA foreign_keys`. Because SQLite disables foreign keys by default for backward compatibility, I ensured `PRAGMA foreign_keys = ON;` is executed on every database connection to guarantee referential integrity.
   - **Transaction Management**: Researched atomic operations with SQLite. Designed transaction blocks (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`) for rental creation, updates, and cancellations so that inventory status changes (`available` ↔ `rented`) never fall out of sync with rental bookings.
   - **Search Query Optimization**: Researched query filtering methods and implemented parameterized `LIKE ?` searches with wildcards (`%${kind}%`), enabling case-insensitive, partial matching for equipment categories (e.g., `kind=dslr` or `kind=cine`).

2. **Validation Logic Implemented**:
   - **Photographers Validation** (`routes/photographers.js`):
     - Enforced non-empty string validation for photographer names.
     - Implemented RFC-compliant regular expression validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) to reject malformed email addresses with `400 Bad Request`.
     - Validated ID parameters using integer pattern guards (`/^\d+$/`).
   - **Cameras Validation & Duplicate Protection** (`routes/cameras.js`):
     - Implemented dual-layer duplicate detection: application-level query pre-check and SQLite engine constraint handling.
     - Prevented duplicate camera names on both creation (`POST`) and update (`PUT`), excluding the current camera ID during updates so a camera can preserve its own name.
     - Mapped duplicate violations to **HTTP 409 Conflict** with custom error message `{"error":"<name> already exists"}`.
     - Protected rented cameras from accidental deletion by checking active rental references and returning **HTTP 409 Conflict**.
   - **Rentals Validation & Business Rules** (`routes/rentals.js`):
     - Validated positive integer IDs for `photographer_id` and `camera_id`.
     - Verified existence of both referenced records prior to booking.
     - Enforced inventory availability checks: blocked booking if `camera.status !== 'available'`.
     - Implemented date format validation (`YYYY-MM-DD`) and logical sequence validation (`return_date >= rental_date`).

---

## 5. CODE SCREENSHOTS

> *Take screenshots of the following highlighted code sections from your project and paste them below:*

### Code Section 1: Case-Insensitive Duplicate Camera Validation (`routes/cameras.js`)
```javascript
// Application-level check for duplicate name (case-insensitive)
const duplicateCheckSql = 'SELECT id FROM cameras WHERE name = ? COLLATE NOCASE';
db.get(duplicateCheckSql, [trimmedName], (checkErr, existingRow) => {
  if (existingRow) {
    return res.status(409).json({
      error: `${trimmedName} already exists`
    });
  }
  // Insert new camera record...
});
```
> **[INSERT CODE SCREENSHOT 1 HERE]**

---

### Code Section 2: Cross-ID Duplicate Validation on Camera Update (`routes/cameras.js`)
```javascript
// Check for duplicate name case-insensitively, excluding the current camera ID
const duplicateCheckSql = 'SELECT id FROM cameras WHERE name = ? COLLATE NOCASE AND id != ?';
db.get(duplicateCheckSql, [trimmedName, id], (dupErr, duplicateRow) => {
  if (duplicateRow) {
    return res.status(409).json({
      error: `${trimmedName} already exists`
    });
  }
  // Proceed with UPDATE cameras SET name = ?, kind = ? WHERE id = ?
});
```
> **[INSERT CODE SCREENSHOT 2 HERE]**

---

### Code Section 3: Email Format & Input Sanitization (`routes/photographers.js`)
```javascript
// Validate email format when provided
if (trimmedEmail) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({
      error: 'Validation failed: Invalid email format.'
    });
  }
}
```
> **[INSERT CODE SCREENSHOT 3 HERE]**

---

### Code Section 4: Date Format & Sequence Validation (`routes/rentals.js`)
```javascript
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

if (rental_date && !isValidDate(rDate)) {
  return res.status(400).json({
    error: 'Validation failed: rental_date must be a valid date in YYYY-MM-DD format.'
  });
}
if (retDate && retDate < rDate) {
  return res.status(400).json({
    error: 'Validation failed: return_date cannot be earlier than rental_date.'
  });
}
```
> **[INSERT CODE SCREENSHOT 4 HERE]**

---

### Code Section 5: Case-Insensitive & Partial Search by Kind (`routes/cameras.js`)
```javascript
if (kind && typeof kind === 'string' && kind.trim() !== '') {
  const trimmedKind = kind.trim();
  // SQLite LIKE is case-insensitive for ASCII and supports exact and partial matches
  const sql = 'SELECT * FROM cameras WHERE kind LIKE ? ORDER BY id ASC';
  db.all(sql, [`%${trimmedKind}%`], (err, rows) => {
    res.status(200).json(rows);
  });
}
```
> **[INSERT CODE SCREENSHOT 5 HERE]**

---

## 6. OUTPUT SCREENSHOTS

> *Below are the exact terminal tests executed and verified on the server. You can run these commands or use Postman to capture your screenshots:*

### Output 1: Case-Insensitive Duplicate Camera Rejection (`HTTP 409 Conflict`)
- **Request**: `POST http://localhost:3000/cameras`
- **Body**: `{ "name": "  fujifilm x-t5  ", "kind": "Mirrorless" }` (when `"Fujifilm X-T5"` already exists)
- **Response**:
```json
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": "fujifilm x-t5 already exists"
}
```
> **[INSERT OUTPUT SCREENSHOT 1 HERE]**

---

### Output 2: Search Cameras by Kind (Case-Insensitive & Partial Matching)
- **Request**: `GET http://localhost:3000/cameras?kind=dslr`
- **Response**:
```json
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": 3,
    "name": "Nikon D850",
    "kind": "DSLR",
    "status": "available"
  }
]
```
> **[INSERT OUTPUT SCREENSHOT 2 HERE]**

---

### Output 3: Invalid Email Format Rejected (`HTTP 400 Bad Request`)
- **Request**: `POST http://localhost:3000/photographers`
- **Body**: `{ "name": "John Doe", "email": "not-an-email" }`
- **Response**:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Validation failed: Invalid email format."
}
```
> **[INSERT OUTPUT SCREENSHOT 3 HERE]**

---

### Output 4: Booking Already Rented Camera Rejected (`HTTP 400 Bad Request`)
- **Request**: `POST http://localhost:3000/rentals`
- **Body**: `{ "photographer_id": 2, "camera_id": 1, "rental_date": "2026-11-20" }` (when Camera 1 is already rented)
- **Response**:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Camera 'Canon EOS R5' is currently rented and cannot be rented."
}
```
> **[INSERT OUTPUT SCREENSHOT 4 HERE]**

---

### Output 5: Date Order Validation Error (`HTTP 400 Bad Request`)
- **Request**: `POST http://localhost:3000/rentals`
- **Body**:
```json
{
  "photographer_id": 1,
  "camera_id": 2,
  "rental_date": "2026-11-25",
  "return_date": "2026-11-20"
}
```
- **Response**:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Validation failed: return_date cannot be earlier than rental_date."
}
```
> **[INSERT OUTPUT SCREENSHOT 5 HERE]**

---

### Output 6: SQL JOIN Rental Query Results (`HTTP 200 OK`)
- **Request**: `GET http://localhost:3000/rentals`
- **Response**:
```json
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": 1,
    "photographer_id": 1,
    "photographer_name": "Alice Johnson",
    "camera_id": 1,
    "camera_name": "Canon EOS R5",
    "camera_kind": "Mirrorless",
    "rental_date": "2026-11-20",
    "return_date": "2026-11-25"
  }
]
```
> **[INSERT OUTPUT SCREENSHOT 6 HERE]**

---

### Output 7: Automated Integration Test Suite (24/24 Passed)
```text
PASS: GET / returns 200 and online status
PASS: POST /photographers rejects missing name with 400
PASS: POST /photographers rejects invalid email format with 400
PASS: POST /photographers creates record with 201
PASS: GET /photographers/abc returns 400 for invalid ID
PASS: GET /photographers/99999 returns 404
PASS: POST /cameras creates record with 201
PASS: POST /cameras rejects duplicate name regardless of case with 409
PASS: PUT /cameras/:id rejects duplicate name of another camera with 409
PASS: PUT /cameras/:id updates camera with 200
PASS: GET /cameras?kind=dslr returns matching DSLR cameras case-insensitively
PASS: GET /cameras?kind=cine returns matching Cinema cameras by partial match
PASS: GET /cameras?kind= returns all cameras
PASS: POST /rentals rejects return_date earlier than rental_date with 400
PASS: POST /rentals creates rental with 201
PASS: Camera status changed to rented after rental creation
PASS: POST /rentals rejects booking an already rented camera with 400
PASS: DELETE /cameras/:id rejects deletion of rented camera with 409
PASS: GET /rentals/:id returns joined photographer and camera details
PASS: PUT /rentals/:id updates rental camera with 200
PASS: Previous camera status reverted to available and new camera status set to rented
PASS: DELETE /rentals/:id succeeds with 200
PASS: Camera 1 status reverted to available after rental deletion
PASS: DELETE /cameras/:id deletes unrented audit camera with 200

--- TOTAL TESTS RUN: 24 ---
Passed: 24
Failed: 0
```
> **[INSERT TERMINAL TEST RUN SCREENSHOT HERE]**
