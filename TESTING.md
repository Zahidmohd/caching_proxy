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

## Next Testing Phase

Stage 3 (continued) will add support for all HTTP methods and request body forwarding.

