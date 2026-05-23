package com.resumebuilder.service;

import com.resumebuilder.model.Job;
import com.resumebuilder.model.Resume;
import com.resumebuilder.model.Application;
import com.resumebuilder.model.User;
import com.resumebuilder.repository.JobRepository;
import com.resumebuilder.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

@Service
public class JobApplicationAutomationService {

    private static final Logger logger = LoggerFactory.getLogger(JobApplicationAutomationService.class);

    @Autowired
    private PuppeteerService puppeteerService;

    @Autowired
    private ResumeGenerationService resumeGenerationService;

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private UserRepository userRepository;

    private RestTemplate restTemplate = new RestTemplate();

    /**
     * Main automation flow: Login -> Fetch Jobs -> Apply to each
     */
    public void runAutomatedJobApplication(Long userId, String portal, int maxJobs) {
        try {
            logger.info("Starting automated job application for user {} on portal {}", userId, portal);

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Step 1: Login to portal
            boolean loginSuccess = loginToPortal(portal, user);
            if (!loginSuccess) {
                logger.error("Login failed for portal: {}", portal);
                return;
            }

            // Step 2: Fetch job listings
            List<Job> jobs = fetchJobListings(portal, maxJobs);
            logger.info("Fetched {} jobs from {}", jobs.size(), portal);

            // Step 3: Process each job
            for (Job job : jobs) {
                try {
                    processJobApplication(userId, job, portal);
                    Thread.sleep(5000); // Delay between applications to avoid detection
                } catch (Exception e) {
                    logger.error("Error processing job: " + job.getTitle(), e);
                }
            }

            logger.info("Completed automated job application process");

        } catch (Exception e) {
            logger.error("Error in automated job application: ", e);
        }
    }

    /**
     * Process single job application
     */
    private void processJobApplication(Long userId, Job job, String portal) {
        try {
            logger.info("Processing job: {} at {}", job.getTitle(), job.getCompany());

            // Step 1: Extract job description
            String jobDescription = puppeteerService.extractJobDescription(job.getUrl(), portal);
            job.setDescription(jobDescription);
            job = jobRepository.save(job);

            // Step 2: Generate tailored resume
            Resume resume = resumeGenerationService.generateTailoredResume(userId, job.getId(), job);
            logger.info("Generated resume for job: {}", job.getTitle());

            if (resume.getPdfPath() == null || !resume.getPdfPath().toLowerCase().endsWith(".pdf")) {
                logger.error("PDF resume was not generated for job: {}. Skipping auto-apply.", job.getTitle());
                recordApplication(userId, job, resume, "FAILED_PDF_GENERATION");
                return;
            }

            // Step 3: Apply for the job
            boolean applied = applyToJob(job, resume, portal);

            // Step 4: Record application
            recordApplication(userId, job, resume, applied ? "APPLIED" : "FAILED");

            logger.info("Job application {} for: {}", applied ? "successful" : "failed", job.getTitle());

        } catch (Exception e) {
            logger.error("Error processing job application: ", e);
        }
    }

    private void recordApplication(Long userId, Job job, Resume resume, String status) {
        Application application = new Application();
        application.setUserId(userId);
        application.setJobId(job.getId());
        application.setResumeId(resume.getId());
        application.setStatus(status);
        application.setAppliedDate(LocalDateTime.now().toString());
        applicationService.submitApplication(application);
    }

    /**
     * Login to job portal
     */
    private boolean loginToPortal(String portal, User user) {
        String username = "";
        String password = "";

        if ("naukri".equalsIgnoreCase(portal)) {
            username = user.getNaukriEmail();
            password = user.getNaukriPassword();
        } else if ("linkedin".equalsIgnoreCase(portal)) {
            username = user.getLinkedinEmail();
            password = user.getLinkedinPassword();
        }

        if (username == null || password == null) {
            logger.error("Credentials not found for portal: {}", portal);
            return false;
        }

        return puppeteerService.login(portal, username, password);
    }

    /**
     * Fetch job listings from portal
     */
    private List<Job> fetchJobListings(String portal, int maxJobs) {
        return puppeteerService.fetchJobs(portal, maxJobs);
    }

    /**
     * Apply to job using puppeteer service
     */
    private boolean applyToJob(Job job, Resume resume, String portal) {
        return puppeteerService.applyToJob(job, resume, portal);
    }

    /**
     * Get application status for user
     */
    public List<Application> getUserApplications(Long userId) {
        return applicationService.getApplicationsByUserId(userId);
    }
}
