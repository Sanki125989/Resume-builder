package com.resumebuilder.model;

import javax.persistence.*;

@Entity
@Table(name = "users")
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    private String name;

    @Column(name = "naukri_email")
    private String naukriEmail;

    @Column(name = "naukri_password")
    private String naukriPassword;

    @Column(name = "linkedin_email")
    private String linkedinEmail;

    @Column(name = "linkedin_password")
    private String linkedinPassword;

    @Column(name = "phone")
    private String phone;

    @Column(name = "skills", columnDefinition = "TEXT")
    private String skills;

    @Column(name = "experience", columnDefinition = "TEXT")
    private String experience;

    @Column(name = "education", columnDefinition = "TEXT")
    private String education;

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getNaukriEmail() {
        return naukriEmail;
    }

    public void setNaukriEmail(String naukriEmail) {
        this.naukriEmail = naukriEmail;
    }

    public String getNaukriPassword() {
        return naukriPassword;
    }

    public void setNaukriPassword(String naukriPassword) {
        this.naukriPassword = naukriPassword;
    }

    public String getLinkedinEmail() {
        return linkedinEmail;
    }

    public void setLinkedinEmail(String linkedinEmail) {
        this.linkedinEmail = linkedinEmail;
    }

    public String getLinkedinPassword() {
        return linkedinPassword;
    }

    public void setLinkedinPassword(String linkedinPassword) {
        this.linkedinPassword = linkedinPassword;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getSkills() {
        return skills;
    }

    public void setSkills(String skills) {
        this.skills = skills;
    }

    public String getExperience() {
        return experience;
    }

    public void setExperience(String experience) {
        this.experience = experience;
    }

    public String getEducation() {
        return education;
    }

    public void setEducation(String education) {
        this.education = education;
    }
}