package com.resumebuilder.model;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

public class GenerateResumeRequest {
    @JsonProperty("content")
    private String content;

    @JsonProperty("jobDescription")
    private String jobDescription;

    @JsonProperty("jobTitle")
    private String jobTitle;

    public GenerateResumeRequest() {
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getJobDescription() {
        return jobDescription;
    }

    public void setJobDescription(String jobDescription) {
        this.jobDescription = jobDescription;
    }

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    @JsonAnySetter
    public void handleUnknownProperty(String name, Object value) {
        // Handle n8n's nested property format: "output[0].content[0].text"
        if (name.equals("output[0].content[0].text")) {
            this.content = (String) value;
        }
        if (name.equals("job_description") || name.equals("jobDescription")) {
            this.jobDescription = String.valueOf(value);
        }
        if (name.equals("job_title") || name.equals("jobTitle")) {
            this.jobTitle = String.valueOf(value);
        }
        // Also handle direct nested objects from n8n
        if ("output".equals(name) && value instanceof Map) {
            try {
                Map<String, Object> output = (Map<String, Object>) value;
                if (output.containsKey("content") && output.get("content") instanceof java.util.List) {
                    java.util.List<?> contentList = (java.util.List<?>) output.get("content");
                    if (!contentList.isEmpty() && contentList.get(0) instanceof Map) {
                        Map<String, Object> contentMap = (Map<String, Object>) contentList.get(0);
                        if (contentMap.containsKey("text")) {
                            this.content = (String) contentMap.get("text");
                        }
                    }
                }
            } catch (Exception e) {
                // Silently ignore if structure doesn't match
            }
        }
    }
}

