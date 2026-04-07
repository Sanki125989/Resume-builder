package com.resumebuilder.controller;

import com.resumebuilder.model.Job;
import com.resumebuilder.service.JobScrapingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    private final JobScrapingService jobScrapingService;

    @Autowired
    public JobController(JobScrapingService jobScrapingService) {
        this.jobScrapingService = jobScrapingService;
    }

    @GetMapping
    public ResponseEntity<List<Job>> getAllJobs() {
        List<Job> jobs = jobScrapingService.fetchAllJobs();
        return ResponseEntity.ok(jobs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Job> getJobById(@PathVariable Long id) {
        Job job = jobScrapingService.fetchJobById(id);
        return ResponseEntity.ok(job);
    }

    @PostMapping("/scrape")
    public ResponseEntity<Void> scrapeJobs() {
        jobScrapingService.scrapeJobsFromSources();
        return ResponseEntity.ok().build();
    }
}