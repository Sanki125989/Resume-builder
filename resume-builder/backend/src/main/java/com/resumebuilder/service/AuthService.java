package com.resumebuilder.service;

import com.resumebuilder.model.User;
import com.resumebuilder.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PuppeteerService puppeteerService;

    private BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public ResponseEntity<?> loginNaukri(User user) {
        try {
            // Validate user credentials from database
            User existingUser = userRepository.findByEmail(user.getEmail());
            if (existingUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(createErrorResponse("User not found"));
            }

            // Update Naukri credentials
            existingUser.setNaukriEmail(user.getNaukriEmail());
            existingUser.setNaukriPassword(user.getNaukriPassword());
            userRepository.save(existingUser);

            // Attempt login via Puppeteer
            boolean loginSuccess = puppeteerService.login("naukri", 
                user.getNaukriEmail(), 
                user.getNaukriPassword());
            
            if (loginSuccess) {
                return ResponseEntity.ok(createSuccessResponse("Naukri login successful", existingUser));
            } else {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(createErrorResponse("Naukri login failed"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Login error: " + e.getMessage()));
        }
    }

    public ResponseEntity<?> loginLinkedIn(User user) {
        try {
            // Validate user credentials from database
            User existingUser = userRepository.findByEmail(user.getEmail());
            if (existingUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(createErrorResponse("User not found"));
            }

            // Update LinkedIn credentials
            existingUser.setLinkedinEmail(user.getLinkedinEmail());
            existingUser.setLinkedinPassword(user.getLinkedinPassword());
            userRepository.save(existingUser);

            // Attempt login via Puppeteer
            boolean loginSuccess = puppeteerService.login("linkedin", 
                user.getLinkedinEmail(), 
                user.getLinkedinPassword());
            
            if (loginSuccess) {
                return ResponseEntity.ok(createSuccessResponse("LinkedIn login successful", existingUser));
            } else {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(createErrorResponse("LinkedIn login failed"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Login error: " + e.getMessage()));
        }
    }

    public ResponseEntity<?> registerUser(User user) {
        try {
            // Check if user already exists
            User existingUser = userRepository.findByEmail(user.getEmail());
            if (existingUser != null) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(createErrorResponse("User already exists"));
            }

            // Hash password before saving
            user.setPassword(passwordEncoder.encode(user.getPassword()));
            
            // Save new user
            User savedUser = userRepository.save(user);
            
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(createSuccessResponse("User registered successfully", savedUser));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Registration error: " + e.getMessage()));
        }
    }

    private Map<String, Object> createSuccessResponse(String message, User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", message);
        
        Map<String, Object> userData = new HashMap<>();
        userData.put("id", user.getId());
        userData.put("email", user.getEmail());
        userData.put("name", user.getName());
        
        response.put("user", userData);
        return response;
    }

    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", message);
        return response;
    }
}

