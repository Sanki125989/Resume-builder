# Resume Builder Backend

This is the backend service for the Resume Builder project, built using Spring Boot. The backend is responsible for handling authentication, job scraping, resume generation, and managing job applications.

## Features

- **User Authentication**: Integrates with Naukri and LinkedIn for user login.
- **Job Scraping**: Extracts job descriptions from Naukri and LinkedIn using Puppeteer.
- **Resume Generation**: Updates and generates LaTeX resumes based on job descriptions.
- **Application Tracking**: Allows users to apply for jobs and track their application status.

## Technologies Used

- **Spring Boot**: Framework for building the backend REST API.
- **MySQL**: Database for storing user, job, and application data.
- **Puppeteer**: Library for automating browser tasks, used for scraping job descriptions.

## Setup Instructions

1. **Clone the Repository**:
   ```
   git clone <repository-url>
   cd resume-builder/backend
   ```

2. **Configure Database**:
   Update the `src/main/resources/application.properties` file with your MySQL database connection details.

3. **Build the Project**:
   Use Maven to build the project:
   ```
   mvn clean install
   ```

4. **Run the Application**:
   Start the Spring Boot application:
   ```
   mvn spring-boot:run
   ```

5. **API Endpoints**:
   - `/api/auth/login`: Authenticate user with Naukri or LinkedIn.
   - `/api/jobs`: Fetch job descriptions.
   - `/api/resume`: Generate or update the user's resume.
   - `/api/applications`: Submit and track job applications.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.