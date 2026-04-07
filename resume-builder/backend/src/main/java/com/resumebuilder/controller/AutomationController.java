package com.resumebuilder.controller;

import com.resumebuilder.model.Application;
import com.resumebuilder.service.JobApplicationAutomationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/automation")
@CrossOrigin(origins = "*")
public class AutomationController {

    @Autowired
    private JobApplicationAutomationService automationService;

    @PostMapping("/start")
    public ResponseEntity<?> startAutomation(@RequestBody Map<String, Object> request) {
        try {
            Long userId = Long.parseLong(request.get("userId").toString());
            String portal = request.get("portal").toString();
            int maxJobs = request.containsKey("maxJobs") ? 
                         Integer.parseInt(request.get("maxJobs").toString()) : 10;

            // Start automation in background thread
            new Thread(() -> {
                automationService.runAutomatedJobApplication(userId, portal, maxJobs);
            }).start();

            return ResponseEntity.ok(Map.of(
                "message", "Automation started successfully",
                "portal", portal,
                "maxJobs", maxJobs
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Failed to start automation",
                "message", e.getMessage()
            ));
        }
    }

    @GetMapping("/applications/{userId}")
    public ResponseEntity<List<Application>> getUserApplications(@PathVariable Long userId) {
        List<Application> applications = automationService.getUserApplications(userId);
        return ResponseEntity.ok(applications);
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        return ResponseEntity.ok(Map.of(
            "status", "running",
            "service", "job-automation"
        ));
    }
}
