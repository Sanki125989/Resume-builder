# Resume Builder Project

## Overview
The Resume Builder project is a web application that allows users to create and manage their resumes while applying for jobs from popular job portals like Naukri and LinkedIn. The application consists of a React.js frontend, a Spring Boot backend, and a Puppeteer service for web scraping job descriptions.

## Project Structure
```
resume-builder
├── frontend                # React.js frontend
│   ├── src
│   │   ├── App.tsx        # Main application component
│   │   ├── index.tsx      # Entry point for React application
│   │   ├── components      # React components
│   │   │   ├── JobList.tsx # Displays list of jobs
│   │   │   ├── ResumeEditor.tsx # Edits resumes based on job descriptions
│   │   │   ├── LoginForm.tsx # Handles user login
│   │   │   └── ApplicationTracker.tsx # Tracks job application status
│   │   ├── services        # API and authentication services
│   │   │   ├── api.ts
│   │   │   └── auth.ts
│   │   ├── types           # TypeScript interfaces
│   │   │   └── index.ts
│   │   └── styles          # CSS styles
│   │       └── App.css
│   ├── package.json        # Frontend dependencies and scripts
│   ├── tsconfig.json       # TypeScript configuration
│   └── README.md           # Frontend documentation
├── backend                 # Spring Boot backend
│   ├── src
│   │   └── main
│   │       ├── java
│   │       │   └── com
│   │       │       └── resumebuilder
│   │       │           ├── ResumeBuilderApplication.java # Main application entry point
│   │       │           ├── controller                  # Controllers for handling requests
│   │       │           │   ├── AuthController.java
│   │       │           │   ├── JobController.java
│   │       │           │   └── ResumeController.java
│   │       │           ├── service                     # Services for business logic
│   │       │           │   ├── PuppeteerService.java
│   │       │           │   ├── JobScrapingService.java
│   │       │           │   ├── ResumeGenerationService.java
│   │       │           │   └── ApplicationService.java
│   │       │           ├── model                       # Data models
│   │       │           │   ├── User.java
│   │       │           │   ├── Job.java
│   │       │           │   ├── Resume.java
│   │       │           │   └── Application.java
│   │       │           └── repository                  # Database repositories
│   │       │               ├── UserRepository.java
│   │       │               ├── JobRepository.java
│   │       │               └── ApplicationRepository.java
│   │       └── resources
│   │           ├── application.properties               # Configuration properties
│   │           └── templates
│   │               └── resume-template.tex              # LaTeX resume template
│   ├── pom.xml            # Maven configuration
│   └── README.md           # Backend documentation
├── puppeteer-service       # Puppeteer service for web scraping
│   ├── src
│   │   ├── index.ts       # Entry point for Puppeteer service
│   │   ├── scrapers       # Scraper implementations
│   │   │   ├── naukri.ts
│   │   │   └── linkedin.ts
│   │   ├── services       # Automation functions
│   │   │   └── automation.ts
│   │   └── types          # TypeScript interfaces
│   │       └── index.ts
│   ├── package.json       # Puppeteer service dependencies and scripts
│   ├── tsconfig.json      # TypeScript configuration
│   └── README.md          # Puppeteer service documentation
└── README.md              # Overall project documentation
```

## Features
- User authentication via Naukri and LinkedIn.
- Job scraping from Naukri and LinkedIn to extract job descriptions.
- Resume editing based on job descriptions.
- Application tracking for submitted job applications.
- LaTeX resume generation and updates.

## Technologies Used
- Frontend: React.js, TypeScript, CSS
- Backend: Spring Boot, Java
- Database: MySQL
- Web Scraping: Puppeteer

## Getting Started
1. Clone the repository.
2. Set up the MySQL database and configure the `application.properties` file in the backend.
3. Install dependencies for the frontend and backend:
   - Navigate to the `frontend` directory and run `npm install`.
   - Navigate to the `backend` directory and run `mvn install`.
   - Navigate to the `puppeteer-service` directory and run `npm install`.
4. Start the backend server and Puppeteer service.
5. Run the frontend application.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.