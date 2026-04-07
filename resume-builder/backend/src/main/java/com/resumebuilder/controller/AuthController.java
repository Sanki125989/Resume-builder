package com.resumebuilder.controller;

import com.resumebuilder.model.User;
import com.resumebuilder.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login/naukri")
    public ResponseEntity<?> loginNaukri(@RequestBody User user) {
        return authService.loginNaukri(user);
    }

    @PostMapping("/login/linkedin")
    public ResponseEntity<?> loginLinkedIn(@RequestBody User user) {
        return authService.loginLinkedIn(user);
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        return authService.registerUser(user);
    }
}