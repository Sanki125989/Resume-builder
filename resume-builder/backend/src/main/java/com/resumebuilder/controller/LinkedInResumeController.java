package com.resumebuilder.controller;

import com.resumebuilder.service.LinkedInResumeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class LinkedInResumeController {

    @Autowired
    private LinkedInResumeService linkedInResumeService;

    @PostMapping("/api/linkedin/easy-apply")
    public ResponseEntity<?> easyApply(@RequestBody Map<String, Object> request) {
        String username = (String) request.get("username");
        String password = (String) request.get("password");
        
        // Optional parameters
        Integer limit = (Integer) request.get("limit");

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "username and password are required"));
        }

        try {
            Map<String, Object> result = linkedInResumeService.applyToJobs(username, password, limit);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to complete LinkedIn Easy Apply job application flow",
                    "message", e.getMessage()
            ));
        }
    }
}
