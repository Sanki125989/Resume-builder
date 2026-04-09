# Resume Builder API - Postman cURL Collection

## Base URL
```
http://localhost:8085
```

## ⚠️ IMPORTANT: Authentication Sequence

To avoid **401 Unauthorized** errors, follow this exact sequence:

### Prerequisites
1. **Start the Puppeteer Service First** (required for LinkedIn/Naukri login):
   ```bash
   cd puppeteer-service
   npm install
   npm run build
   npm start
   ```
   The service must be running on port 3001.

2. **Verify Puppeteer Service is Running**:
   ```bash
   curl http://localhost:3001/health
   # Expected: {"status":"ok","service":"puppeteer-automation"}
   ```

### Correct Authentication Flow

1. **Register User** (if not already registered)
2. **Login to Main App** (to get session/token) - NOT YET IMPLEMENTED
3. **Use Session/Token** for LinkedIn/Naukri login

**Current Issue:** The app uses Spring Security with sessions. You need a valid session before calling LinkedIn/Naukri login endpoints.

---

## 1. Authentication Endpoints

### 1.1 Register User
```bash
curl --location 'http://localhost:8085/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe",
    "phone": "+1234567890",
    "skills": "Java, Spring Boot, React, MySQL, Docker",
    "experience": "Software Engineer at Tech Company (2020-Present)\n- Developed microservices using Spring Boot\n- Built REST APIs\n- Worked with MySQL and MongoDB",
    "education": "Bachelor of Technology in Computer Science\nXYZ University (2016-2020)\nGPA: 8.5/10"
}'
```

**Note:** If you get "User already exists", skip to the next step.

### 1.2 Login to Naukri
**⚠️ Prerequisites:** 
- Puppeteer service must be running on port 3001
- User must be registered (step 1.1)

```bash
curl -i --location 'http://localhost:8085/api/auth/login/naukri' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "user@example.com",
    "naukriEmail": "naukri.user@example.com",
    "naukriPassword": "naukri_password_here"
}'
```

**Important:** Use the `-i` flag to see response headers. Copy the `JSESSIONID` from the `Set-Cookie` header for subsequent requests.

### 1.3 Login to LinkedIn
**⚠️ Prerequisites:** 
- Puppeteer service must be running on port 3001
- User must be registered (step 1.1)

```bash
curl -i --location 'http://localhost:8085/api/auth/login/linkedin' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "user@example.com",
    "linkedinEmail": "linkedin.user@example.com",
    "linkedinPassword": "linkedin_password_here"
}'
```

**Example with actual credentials:**
```bash
curl -i --location 'http://localhost:8085/api/auth/login/linkedin' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "shindesanket497@gmail.com",
    "linkedinEmail": "shindesanket497@gmail.com",
    "linkedinPassword": "Sanketlinkedin@220798"
}'
```

---

## 2. Resume Endpoints

### 2.1 Generate Resume
```bash
curl --location 'http://localhost:8085/api/resume/generate' \
--header 'Content-Type: application/json' \
--data '"1"'
```

**Note:** Pass the userId as a JSON string

**Alternative with actual job description:**
```bash
curl --location 'http://localhost:8085/api/resume/generate' \
--header 'Content-Type: application/json' \
--data '"Looking for a Java developer with 3+ years experience in Spring Boot, microservices, REST APIs, and MySQL"'
```

### 2.2 Update Resume
```bash
curl --location 'http://localhost:8085/api/resume/update' \
--header 'Content-Type: application/json' \
--data '{
    "id": 1,
    "userId": 1,
    "jobId": 5,
    "content": "SUMMARY:\nExperienced Java developer with 5+ years in enterprise applications\n\nEXPERIENCE:\nSenior Software Engineer at ABC Corp (2020-Present)\n- Led development of microservices architecture\n- Implemented CI/CD pipelines\n\nEDUCATION:\nB.Tech in Computer Science\nXYZ University (2016-2020)",
    "latexContent": "\\documentclass{article}\n\\begin{document}\nYour LaTeX content here\n\\end{document}",
    "pdfPath": "/path/to/resume.pdf",
    "updatedAt": "2026-04-07T10:30:00"
}'
```

---

## 3. Job Endpoints

### 3.1 Get All Jobs
```bash
curl --location 'http://localhost:8085/api/jobs' \
--header 'Content-Type: application/json'
```

### 3.2 Get Job by ID
```bash
curl --location 'http://localhost:8085/api/jobs/1' \
--header 'Content-Type: application/json'
```

### 3.3 Scrape Jobs from Sources
```bash
curl --location --request POST 'http://localhost:8085/api/jobs/scrape' \
--header 'Content-Type: application/json'
```

---

## 4. Automation Endpoints

### 4.1 Start Job Application Automation
```bash
curl --location 'http://localhost:8085/api/automation/start' \
--header 'Content-Type: application/json' \
--data '{
    "userId": 1,
    "portal": "naukri",
    "maxJobs": 10
}'
```

**For LinkedIn:**
```bash
curl --location 'http://localhost:8085/api/automation/start' \
--header 'Content-Type: application/json' \
--data '{
    "userId": 1,
    "portal": "linkedin",
    "maxJobs": 15
}'
```

### 4.2 Get User Applications
```bash
curl --location 'http://localhost:8085/api/automation/applications/1' \
--header 'Content-Type: application/json'
```

---

## Complete Workflow Example

### Step 1: Register a new user
```bash
curl --location 'http://localhost:8085/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "johndoe@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "phone": "+919876543210",
    "skills": "Java, Spring Boot, Microservices, React, MySQL, MongoDB, Docker, Kubernetes, AWS",
    "experience": "Senior Software Engineer at TechCorp (Jan 2020 - Present)\n- Developed and maintained microservices using Spring Boot\n- Implemented REST APIs serving 1M+ requests/day\n- Led migration to cloud infrastructure (AWS)\n\nSoftware Engineer at StartupXYZ (Jun 2018 - Dec 2019)\n- Built full-stack applications using React and Spring\n- Optimized database queries improving performance by 40%",
    "education": "Bachelor of Technology in Computer Science\nIIT Delhi (2014-2018)\nCGPA: 9.2/10\n\nRelevant Coursework: Data Structures, Algorithms, Database Systems, Software Engineering"
}'
```

### Step 2: Login to Naukri
```bash
curl --location 'http://localhost:8085/api/auth/login/naukri' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "johndoe@example.com",
    "naukriEmail": "john.naukri@example.com",
    "naukriPassword": "naukri_secure_password"
}'
```

### Step 3: Scrape jobs
```bash
curl --location --request POST 'http://localhost:8085/api/jobs/scrape' \
--header 'Content-Type: application/json'
```

### Step 4: View available jobs
```bash
curl --location 'http://localhost:8085/api/jobs' \
--header 'Content-Type: application/json'
```

### Step 5: Generate a resume for user
```bash
curl --location 'http://localhost:8085/api/resume/generate' \
--header 'Content-Type: application/json' \
--data '"1"'
```

### Step 6: Start automation
```bash
curl --location 'http://localhost:8085/api/automation/start' \
--header 'Content-Type: application/json' \
--data '{
    "userId": 1,
    "portal": "naukri",
    "maxJobs": 20
}'
```

### Step 7: Check application status
```bash
curl --location 'http://localhost:8085/api/automation/applications/1' \
--header 'Content-Type: application/json'
```

---

## Testing with Different Data

### Register Multiple Users
```bash
# User 2
curl --location 'http://localhost:8085/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "jane.smith@example.com",
    "password": "JanePass456!",
    "name": "Jane Smith",
    "phone": "+919123456789",
    "skills": "Python, Django, Flask, PostgreSQL, Docker, Redis, Celery",
    "experience": "Backend Developer at DataCorp (2019-Present)\n- Built scalable APIs using Django REST Framework\n- Implemented caching layer with Redis",
    "education": "M.Tech in Computer Science\nNIT Trichy (2017-2019)"
}'

# User 3 - Frontend Developer
curl --location 'http://localhost:8085/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "alex.johnson@example.com",
    "password": "AlexPass789!",
    "name": "Alex Johnson",
    "phone": "+918765432109",
    "skills": "React, Vue.js, TypeScript, JavaScript, HTML5, CSS3, Webpack, Redux",
    "experience": "Frontend Developer at WebSolutions (2020-Present)\n- Developed responsive web applications using React\n- Improved page load time by 50%",
    "education": "B.E. in Information Technology\nVIT Vellore (2016-2020)"
}'
```

### Update Resume with More Details
```bash
curl --location 'http://localhost:8085/api/resume/update' \
--header 'Content-Type: application/json' \
--data '{
    "id": 1,
    "userId": 1,
    "jobId": 3,
    "content": "PROFESSIONAL SUMMARY:\nHighly skilled Senior Software Engineer with 5+ years of experience in developing enterprise-level applications. Expert in Java, Spring Boot, and microservices architecture.\n\nTECHNICAL SKILLS:\n- Languages: Java, Python, JavaScript\n- Frameworks: Spring Boot, React, Node.js\n- Databases: MySQL, MongoDB, PostgreSQL\n- Tools: Docker, Kubernetes, Jenkins, Git\n\nPROFESSIONAL EXPERIENCE:\n\nSenior Software Engineer | TechCorp Inc. | Jan 2020 - Present\n- Architected and developed microservices handling 10M+ daily transactions\n- Led a team of 5 developers in agile environment\n- Reduced API response time by 60% through optimization\n- Implemented CI/CD pipelines using Jenkins and Docker\n\nSoftware Engineer | StartupXYZ | Jun 2018 - Dec 2019\n- Developed full-stack applications using Spring Boot and React\n- Designed and implemented RESTful APIs\n- Optimized database queries reducing load time by 40%\n\nEDUCATION:\nBachelor of Technology in Computer Science\nIIT Delhi | 2014-2018 | CGPA: 9.2/10\n\nCERTIFICATIONS:\n- AWS Certified Solutions Architect\n- Oracle Certified Java Professional",
    "latexContent": "",
    "pdfPath": "",
    "updatedAt": "2026-04-07T15:30:00"
}'
```

---

## Expected Response Examples

### Successful Registration Response
```json
{
    "success": true,
    "message": "User registered successfully",
    "user": {
        "id": 1,
        "email": "johndoe@example.com",
        "name": "John Doe"
    }
}
```

### Successful Login Response
```json
{
    "success": true,
    "message": "Naukri login successful",
    "user": {
        "id": 1,
        "email": "johndoe@example.com",
        "name": "John Doe"
    }
}
```

### Jobs List Response
```json
[
    {
        "id": 1,
        "title": "Senior Java Developer",
        "company": "TechCorp",
        "location": "Bangalore",
        "description": "Looking for experienced Java developer...",
        "url": "https://naukri.com/job/12345"
    },
    {
        "id": 2,
        "title": "Full Stack Developer",
        "company": "StartupXYZ",
        "location": "Mumbai",
        "description": "Join our dynamic team...",
        "url": "https://linkedin.com/jobs/67890"
    }
]
```

### Automation Start Response
```json
{
    "message": "Automation started successfully",
    "portal": "naukri",
    "maxJobs": 10
}
```

---

## Notes

1. **Port**: Application is running on port `8085` (not 8081)
2. **Puppeteer Service**: Must be running on port `3001` before using LinkedIn/Naukri login endpoints
3. **Spring Security**: Default security is enabled. Sessions are managed via JSESSIONID cookies
4. **Content-Type**: All requests require `Content-Type: application/json` header
5. **User ID**: Replace userId values (like `1`) with actual IDs from your database
6. **Passwords**: User passwords are hashed using BCrypt before storage

## Testing Tips

1. **Start Puppeteer Service First**:
   ```bash
   cd puppeteer-service
   npm install && npm run build && npm start
   ```

2. **Verify Services are Running**:
   - Backend: `curl http://localhost:8085/actuator/health` or check logs
   - Puppeteer: `curl http://localhost:3001/health`

3. **Follow the Correct Sequence**:
   - Register user
   - Login to job portals (Naukri/LinkedIn)
   - Scrape jobs or view existing jobs
   - Generate resumes
   - Start automation
   - Monitor applications

## Troubleshooting

### 401 Unauthorized Error

**Problem**: Getting 401 Unauthorized when calling LinkedIn/Naukri login endpoints.

**Solution**:
1. Ensure the user is registered first
2. The current implementation requires a valid session
3. For now, you may need to temporarily disable Spring Security or implement a proper login endpoint

### Connection Refused Error on Port 3001

**Problem**: 
```
org.springframework.web.client.ResourceAccessException: I/O error on POST request for "http://localhost:3001/api/login": Connection refused
```

**Solution**:
1. Start the puppeteer service:
   ```bash
   cd puppeteer-service
   npm install
   npm run build
   npm start
   ```
2. Verify it's running: `curl http://localhost:3001/health`

### User Already Exists

**Problem**: Registration fails with "User already exists"

**Solution**: Skip registration and proceed to login endpoints.

### TypeScript Compilation Errors in Puppeteer Service

**Problem**: Build fails with TypeScript errors about `error.message` or `puppeteer.Browser`

**Solution**: The TypeScript files have been fixed to properly handle error types and imports. Run:
```bash
cd puppeteer-service
npm run build
```

## Postman Import

To import into Postman:
1. Open Postman
2. Click "Import"
3. Copy and paste any of the cURL commands
4. Postman will automatically convert them to requests
5. Save to a collection for reuse

## Quick Start Script

```bash
#!/bin/bash
# Start all services

# Terminal 1: Start Puppeteer Service
cd puppeteer-service
npm install
npm run build
npm start &

# Wait for puppeteer service to start
sleep 5

# Terminal 2: Start Backend (if not already running)
cd ../backend
./mvnw spring-boot:run &

# Wait for backend to start
sleep 10

# Verify services
echo "Checking Puppeteer Service..."
curl http://localhost:3001/health

echo "\nChecking Backend..."
curl http://localhost:8085/actuator/health

echo "\nAll services are running!"
```

