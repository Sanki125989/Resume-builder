package com.resumebuilder.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class LinkedInResumeService {

    private static final Logger logger = LoggerFactory.getLogger(LinkedInResumeService.class);

    private static final String PUPPETEER_URL = "http://localhost:3001";
    private static final Path RESUMES_DIR = Paths.get(
            System.getProperty("user.home"),
            "Documents", "Personal documents", "Resume-builder", "resumes"
    );

    private static final String DEFAULT_MESSAGE_TEMPLATE = 
            "Hello, Im Sanket, Software Engineer at Evoluteiq i have total 4+ years of experiance in SD1 role \n" +
            "im looking for new opportunity here is my resume im attaching please let me know if any opening position for role \n\n" +
            "thank you!";

    @Autowired
    private RestTemplate restTemplate;

    /**
     * Finds the latest resume PDF in the resumes directory and sends it to recruiters.
     */
    public Map<String, Object> messageRecruiters(String username, String password, Integer limit, String customTemplate) throws Exception {
        logger.info("Starting LinkedIn Recruiter outreach flow...");

        // 1. Locate the latest resume PDF file
        Path latestPdf = findLatestResumePdf();
        if (latestPdf == null) {
            throw new NoSuchFileException("No resume PDF files found in " + RESUMES_DIR + ". Please run the resume compilation or Naukri flow first.");
        }
        logger.info("Found latest resume PDF to send: {}", latestPdf.toAbsolutePath());

        // 2. Determine template
        String template = (customTemplate != null && !customTemplate.isBlank()) ? customTemplate : DEFAULT_MESSAGE_TEMPLATE;
        int maxLimit = (limit != null && limit > 0) ? limit : 5;

        // 3. Prepare HTTP Request to NodeJS Puppeteer Service
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("username", username);
        requestBody.put("password", password);
        requestBody.put("resumePath", latestPdf.toAbsolutePath().toString());
        requestBody.put("messageTemplate", template);
        requestBody.put("limit", maxLimit);

        String endpointUrl = PUPPETEER_URL + "/api/linkedin/message-recruiters";
        logger.info("Sending request to Puppeteer service at: {}", endpointUrl);

        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Map> responseEntity = restTemplate.postForEntity(endpointUrl, requestEntity, Map.class);

        if (responseEntity.getBody() == null) {
            throw new RuntimeException("Empty response received from Puppeteer LinkedIn automation endpoint");
        }

        Map<String, Object> body = responseEntity.getBody();
        logger.info("LinkedIn automation response status: {}", responseEntity.getStatusCode());

        return Map.of(
                "success", true,
                "resumePathUsed", latestPdf.toAbsolutePath().toString(),
                "results", body.getOrDefault("results", Collections.emptyList()),
                "message", "Recruiter outreach completed"
        );
    }

    /**
     * Scans the resumes directory to find the latest .pdf file sorted by last modified time.
     */
    private Path findLatestResumePdf() {
        if (!Files.exists(RESUMES_DIR) || !Files.isDirectory(RESUMES_DIR)) {
            return null;
        }

        try (Stream<Path> pathStream = Files.list(RESUMES_DIR)) {
            return pathStream
                    .filter(p -> p.toString().toLowerCase().endsWith(".pdf"))
                    .max(Comparator.comparingLong(p -> p.toFile().lastModified()))
                    .orElse(null);
        } catch (IOException e) {
            logger.error("Failed to list files in resumes directory: {}", e.getMessage());
            return null;
        }
    }
}
