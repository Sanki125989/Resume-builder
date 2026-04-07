package com.resumebuilder.controller;

import com.resumebuilder.model.Resume;
import com.resumebuilder.service.ResumeGenerationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/resume")
public class ResumeController {

    private final ResumeGenerationService resumeGenerationService;

    @Autowired
    public ResumeController(ResumeGenerationService resumeGenerationService) {
        this.resumeGenerationService = resumeGenerationService;
    }

    @PostMapping("/generate")
    public ResponseEntity<Resume> generateResume(@RequestBody String jobDescription) {
        Resume resume = resumeGenerationService.generateResume(jobDescription);
        return ResponseEntity.ok(resume);
    }

    @PutMapping("/update")
    public ResponseEntity<Resume> updateResume(@RequestBody Resume resume) {
        Resume updatedResume = resumeGenerationService.updateResume(resume);
        return ResponseEntity.ok(updatedResume);
    }
}