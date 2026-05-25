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

    @Autowired
    private RestTemplate restTemplate;

    /**
     * Finds the latest resume PDF in the resumes directory and submits Easy Apply job applications.
     */
    public Map<String, Object> applyToJobs(String username, String password, Integer limit) throws Exception {
        logger.info("Starting LinkedIn Easy Apply job application flow...");

        // 1. Locate the latest resume PDF file
        Path latestPdf = findLatestResumePdf();
        if (latestPdf == null) {
            throw new NoSuchFileException("No resume PDF files found in " + RESUMES_DIR + ". Please run the resume compilation or Naukri flow first.");
        }
        logger.info("Found latest resume PDF to submit: {}", latestPdf.toAbsolutePath());

        int maxLimit = (limit != null && limit > 0) ? limit : 5;

        // 2. Prepare HTTP Request to NodeJS Puppeteer Service
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("username", username);
        requestBody.put("password", password);
        requestBody.put("resumePath", latestPdf.toAbsolutePath().toString());
        requestBody.put("limit", maxLimit);

        String endpointUrl = PUPPETEER_URL + "/api/linkedin/easy-apply";
        logger.info("Sending request to Puppeteer service at: {}", endpointUrl);

        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Map> responseEntity = restTemplate.postForEntity(endpointUrl, requestEntity, Map.class);

        if (responseEntity.getBody() == null) {
            throw new RuntimeException("Empty response received from Puppeteer LinkedIn Easy Apply automation endpoint");
        }

        Map<String, Object> body = responseEntity.getBody();
        logger.info("LinkedIn Easy Apply response status: {}", responseEntity.getStatusCode());

        return Map.of(
                "success", true,
                "resumePathUsed", latestPdf.toAbsolutePath().toString(),
                "results", body.getOrDefault("results", Collections.emptyList()),
                "message", "LinkedIn Easy Apply applications completed"
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
