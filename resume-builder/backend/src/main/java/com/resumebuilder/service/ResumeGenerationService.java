package com.resumebuilder.service;

import com.resumebuilder.model.Resume;
import com.resumebuilder.model.User;
import com.resumebuilder.model.Job;
import com.resumebuilder.repository.ResumeRepository;
import com.resumebuilder.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ResumeGenerationService {

    private static final Logger logger = LoggerFactory.getLogger(ResumeGenerationService.class);

    @Autowired
    private ResumeRepository resumeRepository;

    @Autowired
    private UserRepository userRepository;

    private static final String TEMPLATE_PATH = "templates/resume-template.tex";
    private static final String OUTPUT_DIR = System.getProperty("user.home") + "/resume-builder/resumes/";

    public Resume generateTailoredResume(Long userId, Long jobId, Job job) {
        try {
            User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
            String template = loadTemplate();
            Map<String, String> keywords = extractJobKeywords(job.getDescription());
            String tailoredContent = tailorResumeContent(user, job, keywords);
            String latexContent = generateLatexContent(template, user, tailoredContent, keywords);

            Resume resume = new Resume();
            resume.setUserId(userId);
            resume.setJobId(jobId);
            resume.setContent(tailoredContent);
            resume.setLatexContent(latexContent);
            resume.setUpdatedAt(LocalDateTime.now().toString());

            String pdfPath = compileLaTex(latexContent, userId, jobId);
            resume.setPdfPath(pdfPath);

            return resumeRepository.save(resume);
        } catch (Exception e) {
            logger.error("Error generating resume: ", e);
            throw new RuntimeException("Failed to generate resume", e);
        }
    }

    private String loadTemplate() throws IOException {
        ClassPathResource resource = new ClassPathResource(TEMPLATE_PATH);
        return new String(Files.readAllBytes(Paths.get(resource.getURI())));
    }

    private Map<String, String> extractJobKeywords(String jobDescription) {
        Map<String, String> keywords = new HashMap<>();
        Pattern skillPattern = Pattern.compile("(Java|Python|JavaScript|React|Angular|Spring|Node\\.js|Docker|Kubernetes|AWS|Azure|MySQL|PostgreSQL|MongoDB)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = skillPattern.matcher(jobDescription);
        StringBuilder skills = new StringBuilder();
        while (matcher.find()) {
            skills.append(matcher.group()).append(", ");
        }
        keywords.put("skills", skills.toString());
        return keywords;
    }

    private String tailorResumeContent(User user, Job job, Map<String, String> keywords) {
        StringBuilder content = new StringBuilder();
        content.append("SUMMARY:\nExperienced professional with expertise in ");
        content.append(keywords.getOrDefault("skills", "various technologies"));
        content.append(". Passionate about ").append(job.getTitle()).append(" opportunities.\n\n");
        if (user.getExperience() != null) content.append("EXPERIENCE:\n").append(user.getExperience()).append("\n\n");
        if (user.getEducation() != null) content.append("EDUCATION:\n").append(user.getEducation()).append("\n\n");
        if (user.getSkills() != null) content.append("SKILLS:\n").append(user.getSkills()).append("\n");
        return content.toString();
    }

    private String generateLatexContent(String template, User user, String tailoredContent, Map<String, String> keywords) {
        String latex = template;
        latex = latex.replace("{{NAME}}", escapeLatex(user.getName() != null ? user.getName() : "Your Name"));
        latex = latex.replace("{{EMAIL}}", escapeLatex(user.getEmail()));
        latex = latex.replace("{{PHONE}}", escapeLatex(user.getPhone() != null ? user.getPhone() : ""));
        latex = latex.replace("{{LINKEDIN}}", "https://linkedin.com/in/yourprofile");
        latex = latex.replace("{{GITHUB}}", "https://github.com/yourprofile");
        latex = latex.replace("{{SUMMARY}}", extractSection(tailoredContent, "SUMMARY"));
        latex = latex.replace("{{SKILLS}}", user.getSkills() != null ? user.getSkills() : "");
        latex = latex.replace("{{EXPERIENCE}}", user.getExperience() != null ? formatExperienceForLatex(user.getExperience()) : "");
        latex = latex.replace("{{EDUCATION}}", user.getEducation() != null ? formatEducationForLatex(user.getEducation()) : "");
        latex = latex.replace("{{PROJECTS}}", "");
        return latex;
    }

    private String extractSection(String content, String section) {
        Pattern pattern = Pattern.compile(section + ":\\s*([^\\n]+)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(content);
        if (matcher.find()) return matcher.group(1).trim();
        return "";
    }

    private String formatExperienceForLatex(String experience) {
        return "\\resumeSubheading{Software Engineer}{Jan 2020 - Present}{Company Name}{Location}\\resumeItemListStart\\resumeItem{" + escapeLatex(experience) + "}\\resumeItemListEnd";
    }

    private String formatEducationForLatex(String education) {
        return "\\resumeSubheading{Bachelor of Technology}{2016 - 2020}{University Name}{Location}";
    }

    private String escapeLatex(String text) {
        if (text == null) return "";
        return text.replace("&", "\\&").replace("%", "\\%").replace("$", "\\$").replace("#", "\\#").replace("_", "\\_");
    }

    private String compileLaTex(String latexContent, Long userId, Long jobId) throws IOException, InterruptedException {
        File outputDir = new File(OUTPUT_DIR);
        if (!outputDir.exists()) outputDir.mkdirs();
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = String.format("resume_user%d_job%d_%s", userId, jobId, timestamp);
        String texFile = OUTPUT_DIR + filename + ".tex";
        String pdfFile = OUTPUT_DIR + filename + ".pdf";
        Files.write(Paths.get(texFile), latexContent.getBytes());
        ProcessBuilder pb = new ProcessBuilder("pdflatex", "-interaction=nonstopmode", "-output-directory=" + OUTPUT_DIR, texFile);
        pb.redirectErrorStream(true);
        Process process = pb.start();
        int exitCode = process.waitFor();
        if (exitCode == 0 && new File(pdfFile).exists()) {
            logger.info("PDF generated successfully: " + pdfFile);
            return pdfFile;
        } else {
            logger.error("Failed to compile LaTeX. Exit code: " + exitCode);
            return texFile;
        }
    }

    public Resume getResumeByUserAndJob(Long userId, Long jobId) {
        return resumeRepository.findByUserIdAndJobId(userId, jobId).orElse(null);
    }

    public Resume generateResume(String userId) {
        try {
            Long userIdLong = Long.parseLong(userId);
            User user = userRepository.findById(userIdLong)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            String template = loadTemplate();
            String tailoredContent = generateDefaultResumeContent(user);
            String latexContent = generateLatexContentForUser(template, user);

            Resume resume = new Resume();
            resume.setUserId(userIdLong);
            resume.setJobId(null);
            resume.setContent(tailoredContent);
            resume.setLatexContent(latexContent);
            resume.setUpdatedAt(LocalDateTime.now().toString());

            String pdfPath = compileLaTex(latexContent, userIdLong, 0L);
            resume.setPdfPath(pdfPath);

            return resumeRepository.save(resume);
        } catch (Exception e) {
            logger.error("Error generating resume: ", e);
            throw new RuntimeException("Failed to generate resume", e);
        }
    }

    public Resume updateResume(Resume resume) {
        try {
            Resume existingResume = resumeRepository.findById(resume.getId())
                    .orElseThrow(() -> new RuntimeException("Resume not found"));
            
            existingResume.setContent(resume.getContent());
            existingResume.setLatexContent(resume.getLatexContent());
            existingResume.setUpdatedAt(LocalDateTime.now().toString());
            
            if (resume.getLatexContent() != null && !resume.getLatexContent().isEmpty()) {
                String pdfPath = compileLaTex(resume.getLatexContent(), 
                    existingResume.getUserId(), 
                    existingResume.getJobId() != null ? existingResume.getJobId() : 0L);
                existingResume.setPdfPath(pdfPath);
            }
            
            return resumeRepository.save(existingResume);
        } catch (Exception e) {
            logger.error("Error updating resume: ", e);
            throw new RuntimeException("Failed to update resume", e);
        }
    }

    private String generateDefaultResumeContent(User user) {
        StringBuilder content = new StringBuilder();
        content.append("SUMMARY:\nExperienced professional with diverse skills and expertise.\n\n");
        if (user.getExperience() != null) {
            content.append("EXPERIENCE:\n").append(user.getExperience()).append("\n\n");
        }
        if (user.getEducation() != null) {
            content.append("EDUCATION:\n").append(user.getEducation()).append("\n\n");
        }
        if (user.getSkills() != null) {
            content.append("SKILLS:\n").append(user.getSkills()).append("\n");
        }
        return content.toString();
    }

    private String generateLatexContentForUser(String template, User user) {
        String latex = template;
        latex = latex.replace("{{NAME}}", escapeLatex(user.getName() != null ? user.getName() : "Your Name"));
        latex = latex.replace("{{EMAIL}}", escapeLatex(user.getEmail()));
        latex = latex.replace("{{PHONE}}", escapeLatex(user.getPhone() != null ? user.getPhone() : ""));
        latex = latex.replace("{{LINKEDIN}}", "https://linkedin.com/in/yourprofile");
        latex = latex.replace("{{GITHUB}}", "https://github.com/yourprofile");
        latex = latex.replace("{{SUMMARY}}", "Experienced professional with diverse skills and expertise");
        latex = latex.replace("{{SKILLS}}", user.getSkills() != null ? user.getSkills() : "");
        latex = latex.replace("{{EXPERIENCE}}", user.getExperience() != null ? formatExperienceForLatex(user.getExperience()) : "");
        latex = latex.replace("{{EDUCATION}}", user.getEducation() != null ? formatEducationForLatex(user.getEducation()) : "");
        latex = latex.replace("{{PROJECTS}}", "");
        return latex;
    }
}
