package com.resumebuilder.service;

import com.resumebuilder.model.Job;
import com.resumebuilder.model.Resume;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

@Service
public class PuppeteerService {

    private static final Logger logger = LoggerFactory.getLogger(PuppeteerService.class);
    private static final String PUPPETEER_SERVICE_URL = "http://localhost:3001/api";
    
    private RestTemplate restTemplate = new RestTemplate();

    public boolean login(String portal, String username, String password) {
        try {
            String url = PUPPETEER_SERVICE_URL + "/login";
            Map<String, String> request = new HashMap<>();
            request.put("portal", portal);
            request.put("username", username);
            request.put("password", password);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            return response.getStatusCode() == HttpStatus.OK && 
                   Boolean.TRUE.equals(response.getBody().get("success"));
        } catch (Exception e) {
            logger.error("Error logging in to portal: " + portal, e);
            return false;
        }
    }

    public String extractJobDescription(String jobUrl, String portal) {
        try {
            String url = PUPPETEER_SERVICE_URL + "/extract-job";
            Map<String, String> request = new HashMap<>();
            request.put("jobUrl", jobUrl);
            request.put("portal", portal);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (String) response.getBody().get("description");
            }
            return "";
        } catch (Exception e) {
            logger.error("Error extracting job description from: " + jobUrl, e);
            return "";
        }
    }

    public List<Job> fetchJobs(String portal, int maxJobs) {
        try {
            String url = PUPPETEER_SERVICE_URL + "/fetch-jobs?portal=" + portal + "&limit=" + maxJobs;
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            
            List<Job> jobs = new ArrayList<>();
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<Map<String, Object>> jobData = (List<Map<String, Object>>) response.getBody().get("jobs");
                for (Map<String, Object> data : jobData) {
                    Job job = new Job();
                    job.setTitle((String) data.get("title"));
                    job.setCompany((String) data.get("company"));
                    job.setLocation((String) data.get("location"));
                    job.setUrl((String) data.get("url"));
                    jobs.add(job);
                }
            }
            return jobs;
        } catch (Exception e) {
            logger.error("Error fetching jobs from portal: " + portal, e);
            return new ArrayList<>();
        }
    }

    public boolean applyToJob(Job job, Resume resume, String portal) {
        try {
            String url = PUPPETEER_SERVICE_URL + "/apply";
            Map<String, Object> request = new HashMap<>();
            request.put("portal", portal);
            request.put("jobUrl", job.getUrl());
            request.put("resumePath", resume.getPdfPath());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            return response.getStatusCode() == HttpStatus.OK && 
                   Boolean.TRUE.equals(response.getBody().get("success"));
        } catch (Exception e) {
            logger.error("Error applying to job: " + job.getTitle(), e);
            return false;
        }
    }
}
