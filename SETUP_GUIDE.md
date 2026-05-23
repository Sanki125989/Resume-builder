# Complete Setup Guide - Resume Builder

## Quick Start

### 1. Install Prerequisites

```bash
# Check Java version
java -version  # Should be 17+

# Check Node.js version
node --version  # Should be 18+

# Check MySQL
mysql --version

# Install LaTeX (Ubuntu)
sudo apt-get install texlive-full

# Or on macOS
brew install --cask mactex
```

### 2. Setup Database

```bash
mysql -u root -p

# In MySQL console:
CREATE DATABASE resume_builder;
EXIT;
```

### 3. Configure Backend

```bash
cd resume-builder/backend

# Edit application.properties
nano src/main/resources/application.properties

# Update these lines:
# spring.datasource.username=YOUR_MYSQL_USERNAME
# spring.datasource.password=YOUR_MYSQL_PASSWORD
```

### 4. Build & Run All Services

```bash
# Terminal 1 - Backend
cd resume-builder/backend
mvn clean install
mvn spring-boot:run

# Terminal 2 - Puppeteer Service
cd resume-builder/puppeteer-service
npm install
npm run dev
```

## Testing the Integration

### 1. Test Puppeteer Service

```bash
curl http://localhost:3001/health
```

Should return: `{"status":"ok","service":"puppeteer-automation"}`

### 2. Test Backend

```bash
curl http://localhost:8080/api/automation/status
```

### 3. Create Test User (via MySQL or Backend API)

```sql
INSERT INTO users (email, password, name, phone, skills, experience, education, naukri_email, naukri_password)
VALUES (
  'test@example.com',
  'password123',
  'John Doe',
  '+91-1234567890',
  'Java, Spring Boot, React, Python, AWS, Docker',
  'Software Engineer at ABC Corp (2020-Present): Developed microservices...',
  'B.Tech in Computer Science, XYZ University (2016-2020)',
  'your_naukri_email@example.com',
  'your_naukri_password'
);
```

### 4. Start Automation

```bash
curl -X POST http://localhost:8080/api/automation/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "portal": "naukri",
    "maxJobs": 3
  }'
```

## Expected Behavior

1. Puppeteer service opens Chrome browser (visible in non-headless mode)
2. Logs into Naukri with your credentials
3. Searches for jobs
4. For each job:
   - Extracts job description
   - Generates tailored resume
   - Creates PDF in `~/resume-builder/resumes/`
   - Attempts to apply
5. Saves application record in database

## Verify Results

```bash
# Check generated resumes
ls ~/resume-builder/resumes/

# Check applications in database
mysql -u root -p resume_builder -e "SELECT * FROM applications;"
```

## Troubleshooting

### Issue: pdflatex not found
```bash
# Add LaTeX to PATH
export PATH="/usr/local/texlive/2023/bin/x86_64-linux:$PATH"
```

### Issue: Puppeteer Chrome download fails
```bash
# Install Chromium
sudo apt-get install chromium-browser

# Set PUPPETEER_EXECUTABLE_PATH
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Issue: MySQL connection refused
```bash
# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql
```

## Production Deployment

### Use headless mode for Puppeteer

Edit `puppeteer-service/src/scrapers/naukri.ts` and `linkedin.ts`:
```typescript
browser = await puppeteer.launch({
    headless: true,  // Change to true
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### Run services with PM2

```bash
# Install PM2
npm install -g pm2

# Start Puppeteer service
cd resume-builder/puppeteer-service
pm2 start npm --name "puppeteer-service" -- start

# Start backend with systemd or supervisord
```

## Complete!

Your Resume Builder is now ready to automate job applications! 🎉
