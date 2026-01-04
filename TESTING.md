# Testing Guide

## CLI Argument Parsing Tests

### ✅ Test 1: Help Command
```bash
node src/index.js --help
```
**Expected**: Display help information with all available options

### ✅ Test 2: Valid Server Start
```bash
node src/index.js --port 3000 --origin http://dummyjson.com
```
**Expected**: Show server starting with validated port and origin

### ✅ Test 3: Clear Cache Command
```bash
node src/index.js --clear-cache
```
**Expected**: Show cache clearing message

### ✅ Test 4: Invalid Port (Out of Range)
```bash
node src/index.js --port 99999 --origin http://dummyjson.com
```
**Expected**: Error message "Port must be between 1 and 65535"

### ✅ Test 5: Invalid URL Format
```bash
node src/index.js --port 3000 --origin invalid-url
```
**Expected**: Error message "Invalid origin URL"

### ✅ Test 6: Missing Arguments
```bash
node src/index.js
```
**Expected**: Usage examples and error message

### ✅ Test 7: Version Command
```bash
node src/index.js --version
```
**Expected**: Display version number (1.0.0)

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| Help display | ✅ PASS | Shows all options |
| Valid arguments | ✅ PASS | Validates and accepts |
| Clear cache flag | ✅ PASS | Recognized correctly |
| Invalid port | ✅ PASS | Proper validation |
| Invalid URL | ✅ PASS | Proper validation |
| No arguments | ✅ PASS | Shows usage guide |
| Version flag | ✅ PASS | Shows version |

## Stage 3 Tests - HTTP Server

### ✅ Test 8: Server Starts and Listens
```bash
node src/index.js --port 3000 --origin http://dummyjson.com
```
**Expected**: Server starts and listens on port 3000
**Result**: ✅ PASS - Server running successfully

### ✅ Test 9: Server Responds to Requests
```bash
curl http://localhost:3000/test
```
**Expected**: Server responds with acknowledgment message
**Result**: ✅ PASS - Returns "Proxy server received: GET /test"

### ✅ Test 10: Server Handles Different Endpoints
```bash
curl http://localhost:3000/products
```
**Expected**: Server responds to any endpoint
**Result**: ✅ PASS - Responds correctly

### ✅ Test 11: Request Forwarding to Origin
```bash
node src/index.js --port 3002 --origin https://dummyjson.com
curl http://localhost:3002/products/1
```
**Expected**: Proxy forwards request to origin and returns actual data
**Result**: ✅ PASS - Returns JSON data from dummyjson.com

### ✅ Test 12: Query Parameters Forwarding
```bash
curl http://localhost:3002/products?limit=3
```
**Expected**: Query parameters are forwarded correctly
**Result**: ✅ PASS - Returns limited results with all headers preserved

### ✅ Test 13: HTTP to HTTPS Forwarding
```bash
node src/index.js --port 3002 --origin https://dummyjson.com
```
**Expected**: Proxy handles HTTPS origin servers
**Result**: ✅ PASS - Successfully forwards to HTTPS origins

### ✅ Test 14: Status Code Forwarding
```bash
curl -i http://localhost:3002/products/1
```
**Expected**: Status codes from origin are forwarded to client
**Result**: ✅ PASS - HTTP 200 status code properly forwarded

### ✅ Test 15: POST Method with JSON Body
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Test Product","price":99.99}' \
  http://localhost:3000/products/add
```
**Expected**: POST request with body is forwarded correctly
**Result**: ✅ PASS - Returns `{"id":195,"title":"Test Product","price":99.99}`
**Server Log**: `📤 POST /products/add` → `📥 201 POST /products/add`

### ✅ Test 16: PUT Method with JSON Body
```bash
curl -X PUT -H "Content-Type: application/json" \
  -d '{"title":"Updated Product"}' \
  http://localhost:3000/products/1
```
**Expected**: PUT request updates resource
**Result**: ✅ PASS - Returns updated product data
**Server Log**: `📤 PUT /products/1` → `📥 200 PUT /products/1`

### ✅ Test 17: DELETE Method
```bash
curl -X DELETE http://localhost:3000/products/1
```
**Expected**: DELETE request is forwarded
**Result**: ✅ PASS - Returns deleted product with `"isDeleted":true`
**Server Log**: `📤 DELETE /products/1` → `📥 200 DELETE /products/1`

### ✅ Test 18: PATCH Method
```bash
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"price":199.99}' \
  http://localhost:3000/products/1
```
**Expected**: PATCH request partially updates resource
**Result**: ✅ PASS - Returns product with updated price
**Server Log**: `📤 PATCH /products/1` → `📥 200 PATCH /products/1`

## HTTP Methods Summary

All HTTP methods are supported:
- ✅ GET (read)
- ✅ POST (create)
- ✅ PUT (update/replace)
- ✅ PATCH (partial update)
- ✅ DELETE (delete)
- ✅ HEAD, OPTIONS, etc. (all methods forwarded)

## Next Testing Phase

Stage 4 will add caching mechanism (in-memory using Map).

