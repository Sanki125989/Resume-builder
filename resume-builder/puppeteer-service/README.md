# Puppeteer Service for Resume Builder

This project is a Puppeteer service designed to automate the process of scraping job descriptions from popular job portals such as Naukri and LinkedIn. It integrates with the Spring Boot backend to support automated job applications and resume updates.

## Features

- **Job Scraping**: Automatically extracts job descriptions from Naukri and LinkedIn.
- **Resume Generation**: Updates a LaTeX resume based on the extracted job descriptions.
- **Job Application Tracking**: Allows users to apply for jobs sequentially and track their application status.

## Project Structure

- **src/index.ts**: Entry point for the Puppeteer service, initializing the Puppeteer instance.
- **src/scrapers/naukri.ts**: Functions for scraping job descriptions from the Naukri job portal.
- **src/scrapers/linkedin.ts**: Functions for scraping job descriptions from the LinkedIn job portal.
- **src/services/automation.ts**: Automation functions for interacting with Puppeteer to perform tasks like logging in and extracting job descriptions.
- **src/types/index.ts**: TypeScript interfaces for the Puppeteer service's data models.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the `puppeteer-service` directory:
   ```
   cd puppeteer-service
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage

To start the Puppeteer service, run:
```
npm start
```

Ensure that the backend service is also running for full functionality.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.