package com.resumebuilder.controller;

import com.resumebuilder.model.Resume;
import com.resumebuilder.model.GenerateResumeRequest;
import com.resumebuilder.service.ResumeGenerationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/resume")
public class ResumeController {

    private final ResumeGenerationService resumeGenerationService;

    @Autowired
    public ResumeController(ResumeGenerationService resumeGenerationService) {
        this.resumeGenerationService = resumeGenerationService;
    }

    @PostMapping("/generate/{userId}")
    public ResponseEntity<?> generateResume(@PathVariable Long userId) {
        try {
            Resume resume = resumeGenerationService.generateResume(userId);
            return ResponseEntity.ok(resume);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error: " + e.getMessage());
        }
    }

    /**
     * Generate resume from content only.
     * Accepts n8n format: {"output[0].content[0].text": "content..."}
     * or standard format: {"content": "content..."}
     */
    @PostMapping("/generate")
    public ResponseEntity<?> generateResumeFromContent(@RequestBody GenerateResumeRequest request) {
        try {
            if (request.getContent() == null || request.getContent().trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Error: Content is required");
            }

            Resume resume = resumeGenerationService.generateResumeFromContent(
                    request.getContent(),
                    request.getJobDescription(),
                    request.getJobTitle()
            );
            return ResponseEntity.ok(resume);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error: " + e.getMessage());
        }
    }

    @PutMapping("/update")
    public ResponseEntity<?> updateResume(@RequestBody Resume resume) {
        try {
            Resume updatedResume = resumeGenerationService.updateResume(resume);
            return ResponseEntity.ok(updatedResume);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error: " + e.getMessage());
        }
    }
}
