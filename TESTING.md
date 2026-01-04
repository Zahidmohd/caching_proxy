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

## Next Testing Phase

Stage 3 (continued) will add request forwarding to the origin server.

