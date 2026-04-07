package com.resumebuilder.service;

import com.resumebuilder.model.Job;
import com.resumebuilder.repository.JobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.ArrayList;

@Service
public class JobScrapingService {

    private static final Logger logger = LoggerFactory.getLogger(JobScrapingService.class);

    private final RestTemplate restTemplate;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private PuppeteerService puppeteerService;

    @Autowired
    public JobScrapingService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<String> scrapeJobsFromNaukri(String keyword) {
        // Logic to scrape job descriptions from Naukri
        return null; // Replace with actual scraping logic
    }

    public List<String> scrapeJobsFromLinkedIn(String keyword) {
        // Logic to scrape job descriptions from LinkedIn
        return null; // Replace with actual scraping logic
    }

    public List<Job> fetchAllJobs() {
        try {
            logger.info("Fetching all jobs from database");
            return jobRepository.findAll();
        } catch (Exception e) {
            logger.error("Error fetching all jobs: ", e);
            return new ArrayList<>();
        }
    }

    public Job fetchJobById(Long jobId) {
        try {
            logger.info("Fetching job with ID: {}", jobId);
            return jobRepository.findById(jobId)
                    .orElseThrow(() -> new RuntimeException("Job not found with ID: " + jobId));
        } catch (Exception e) {
            logger.error("Error fetching job by ID: ", e);
            throw new RuntimeException("Failed to fetch job", e);
        }
    }

    public List<Job> scrapeJobsFromSources() {
        try {
            logger.info("Starting job scraping from multiple sources");
            List<Job> allJobs = new ArrayList<>();
            
            // Scrape from Naukri
            try {
                List<Job> naukriJobs = puppeteerService.fetchJobs("naukri", 10);
                if (naukriJobs != null) {
                    allJobs.addAll(naukriJobs);
                    logger.info("Scraped {} jobs from Naukri", naukriJobs.size());
                }
            } catch (Exception e) {
                logger.error("Error scraping from Naukri: ", e);
            }
            
            // Scrape from LinkedIn
            try {
                List<Job> linkedinJobs = puppeteerService.fetchJobs("linkedin", 10);
                if (linkedinJobs != null) {
                    allJobs.addAll(linkedinJobs);
                    logger.info("Scraped {} jobs from LinkedIn", linkedinJobs.size());
                }
            } catch (Exception e) {
                logger.error("Error scraping from LinkedIn: ", e);
            }
            
            // Save scraped jobs to database
            if (!allJobs.isEmpty()) {
                allJobs = jobRepository.saveAll(allJobs);
                logger.info("Saved {} jobs to database", allJobs.size());
            }
            
            return allJobs;
        } catch (Exception e) {
            logger.error("Error in scrapeJobsFromSources: ", e);
            return new ArrayList<>();
        }
    }
}