# Authentication Guide - Avoiding 401 Unauthorized Errors

## Problem Summary

When directly hitting the LinkedIn/Naukri login endpoints without proper setup, you get:
```
401 Unauthorized
```

And when the Puppeteer service is not running, you get:
```
org.springframework.web.client.ResourceAccessException: I/O error on POST request for "http://localhost:3001/api/login": Connection refused
```

## Root Causes

1. **Puppeteer Service Not Running**: The backend calls `http://localhost:3001/api/login` which requires the puppeteer-service to be running
2. **Spring Security Session Required**: The endpoints require a valid session/authentication context

## Complete Solution

### Step 1: Start Puppeteer Service (Port 3001)

```bash
cd /home/sanket/Documents/Backup/coursera/personal/Resume-builder/resume-builder/puppeteer-service
npm install
npm run build
npm start
```

**Verify it's running:**
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"puppeteer-automation"}
```

**Keep this terminal running in the background!**

### Step 2: Start Backend Service (Port 8085)

In a separate terminal:
```bash
cd /home/sanket/Documents/Backup/coursera/personal/Resume-builder/resume-builder/backend
./mvnw spring-boot:run
```

Or if using an IDE, just run the `ResumeBuilderApplication` class.

### Step 3: Register User (First Time Only)

```bash
curl --location 'http://localhost:8085/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "shindesanket497@gmail.com",
    "password": "YourSecurePassword123",
    "name": "Sanket Shinde",
    "phone": "+911234567890",
    "skills": "Java, Spring Boot, React, MySQL, Docker",
    "experience": "Software Engineer with experience in full-stack development",
    "education": "Bachelor of Technology in Computer Science"
}'
```

**If you get "User already exists"**, that's fine - skip to Step 4.

### Step 4: Login to LinkedIn

```bash
curl -i --location 'http://localhost:8085/api/auth/login/linkedin' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "shindesanket497@gmail.com",
    "linkedinEmail": "shindesanket497@gmail.com",
    "linkedinPassword": "Sanketlinkedin@220798"
}'
```

**Important Notes:**
- Use the `-i` flag to see response headers
- Look for `Set-Cookie: JSESSIONID=...` in the response
- The `email` field should match your registered user email
- The `linkedinEmail` and `linkedinPassword` are your actual LinkedIn credentials

### Step 5: Use Session for Subsequent Requests

If you need to make more authenticated requests, copy the `JSESSIONID` from the previous response and use it:

```bash
curl --location 'http://localhost:8085/api/jobs' \
--header 'Content-Type: application/json' \
--header 'Cookie: JSESSIONID=YOUR_SESSION_ID_HERE'
```

## Troubleshooting

### Error: Connection Refused (Port 3001)

**Symptom:**
```
Connection refused; nested exception is java.net.ConnectException: Connection refused
```

**Solution:**
The puppeteer service is not running. Start it:
```bash
cd puppeteer-service
npm install
npm run build
npm start
```

### Error: 401 Unauthorized

**Symptom:**
```
401 Unauthorized
```

**Possible Causes & Solutions:**

1. **User not registered**: Register the user first (Step 3)
2. **Invalid credentials**: Check that the email matches your registered user
3. **Spring Security blocking**: The current implementation may need session management improvements

**Workaround**: Check the Spring Security configuration in `SecurityConfig.java` to ensure the auth endpoints are properly permitted.

### Error: TypeScript Compilation Failed

**Symptom:**
```
error TS18046: 'error' is of type 'unknown'
error TS2503: Cannot find namespace 'puppeteer'
```

**Solution:**
The TypeScript files have been fixed. Just rebuild:
```bash
cd puppeteer-service
npm run build
```

### Error: npm install fails with "No matching version found for natural@^6.14.0"

**Symptom:**
```
npm error notarget No matching version found for natural@^6.14.0
```

**Solution:**
You were running `npm install` in the wrong directory (root). Always run it in the `puppeteer-service` directory:
```bash
cd puppeteer-service  # NOT the root directory
npm install
```

## Quick Verification Checklist

Before making any API calls, verify:

- [ ] Puppeteer service is running on port 3001
  ```bash
  curl http://localhost:3001/health
  ```

- [ ] Backend is running on port 8085
  ```bash
  curl http://localhost:8085/actuator/health  # or check logs
  ```

- [ ] User is registered in the database
  ```bash
  # Check MySQL database
  mysql -u root -p
  USE resume_builder;
  SELECT email FROM users WHERE email='shindesanket497@gmail.com';
  ```

## Complete Working Example

Here's a complete example from start to finish:

```bash
# Terminal 1: Start Puppeteer Service
cd /home/sanket/Documents/Backup/coursera/personal/Resume-builder/resume-builder/puppeteer-service
npm start

# Terminal 2: Backend should already be running on port 8085

# Terminal 3: Make API calls
# 1. Verify puppeteer service
curl http://localhost:3001/health

# 2. Register (if needed)
curl --location 'http://localhost:8085/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "shindesanket497@gmail.com",
    "password": "SecurePass123",
    "name": "Sanket Shinde",
    "phone": "+911234567890",
    "skills": "Java, Spring Boot, React",
    "experience": "Software Engineer",
    "education": "B.Tech Computer Science"
}'

# 3. Login to LinkedIn
curl -i --location 'http://localhost:8085/api/auth/login/linkedin' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "shindesanket497@gmail.com",
    "linkedinEmail": "shindesanket497@gmail.com",
    "linkedinPassword": "Sanketlinkedin@220798"
}'

# Success! No more 401 errors.
```

## Service Architecture

```
┌─────────────────┐
│   Your Client   │
│   (cURL/etc)    │
└────────┬────────┘
         │ HTTP Request
         ▼
┌─────────────────────────┐
│   Backend Service       │
│   (Spring Boot)         │
│   Port: 8085            │
└──────────┬──────────────┘
           │ HTTP Request
           ▼
┌──────────────────────────┐
│  Puppeteer Service       │
│  (Node.js/Express)       │
│  Port: 3001              │
└──────────┬───────────────┘
           │ Launches
           ▼
┌──────────────────────────┐
│  Headless Browser        │
│  (Chromium/Puppeteer)    │
│  Automates LinkedIn      │
└──────────────────────────┘
```

Both services MUST be running for LinkedIn/Naukri login to work!

## Files Fixed

The following files were updated to resolve the issues:

1. **`puppeteer-service/src/index.ts`** - Fixed TypeScript error handling
2. **`puppeteer-service/src/services/automation.ts`** - Fixed Browser import and HTMLElement casting
3. **`backend/POSTMAN_CURLS.md`** - Updated all URLs to use port 8085 and added authentication guidance

## Summary

To avoid 401 Unauthorized errors:

1. ✅ Start Puppeteer service on port 3001
2. ✅ Ensure backend is running on port 8085
3. ✅ Register your user first
4. ✅ Use the correct email in the request
5. ✅ Include proper headers (Content-Type: application/json)

The sequence matters! Always: **Puppeteer Service → Backend Service → Register → Login**

