package com.resumebuilder.model;

import javax.persistence.*;

@Entity
@Table(name = "resumes")
public class Resume {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "job_id")
    private Long jobId;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "latex_content", columnDefinition = "TEXT")
    private String latexContent;

    @Column(name = "pdf_path")
    private String pdfPath;

    @Column(name = "updated_at")
    private String updatedAt;

    public Resume() {
    }

    public Resume(Long userId, Long jobId, String content, String latexContent, String updatedAt) {
        this.userId = userId;
        this.jobId = jobId;
        this.content = content;
        this.latexContent = latexContent;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getJobId() {
        return jobId;
    }

    public void setJobId(Long jobId) {
        this.jobId = jobId;
    }

    public String getLatexContent() {
        return latexContent;
    }

    public void setLatexContent(String latexContent) {
        this.latexContent = latexContent;
    }

    public String getPdfPath() {
        return pdfPath;
    }

    public void setPdfPath(String pdfPath) {
        this.pdfPath = pdfPath;
    }
}