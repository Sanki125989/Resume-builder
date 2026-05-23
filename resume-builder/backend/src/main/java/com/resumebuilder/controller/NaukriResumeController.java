package com.resumebuilder.controller;

import com.resumebuilder.service.NaukriResumeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class NaukriResumeController {

    @Autowired
    private NaukriResumeService naukriResumeService;

    @PostMapping("/api/login-and-upload-resume")
    public ResponseEntity<?> loginAndUploadResume(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "username and password are required"));
        }

        try {
            Map<String, Object> result = naukriResumeService.loginAndUploadResume(username, password);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to complete login-and-upload-resume flow",
                    "message", e.getMessage()
            ));
        }
    }
}
