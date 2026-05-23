package com.resumebuilder.service;

import com.resumebuilder.model.Job;
import com.resumebuilder.model.Resume;
import com.resumebuilder.model.User;
import com.resumebuilder.repository.ResumeRepository;
import com.resumebuilder.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ResumeGenerationService {

    private static final Logger logger = LoggerFactory.getLogger(ResumeGenerationService.class);
    private static final String TEMPLATE_PATH = "templates/resume-template.tex";
    private static final Path OUTPUT_DIR = Paths.get(System.getProperty("user.home"), "resume-builder", "resumes");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", Pattern.CASE_INSENSITIVE);
    private static final Pattern PHONE_PATTERN = Pattern.compile("(?:\\+?\\d[\\d\\s().-]{8,}\\d)");
    private static final Pattern LINKEDIN_PATTERN = Pattern.compile("(?:https?://)?(?:www\\.)?linkedin\\.com/in/[A-Za-z0-9_-]+/?", Pattern.CASE_INSENSITIVE);
    private static final List<String> KNOWN_SKILLS = Arrays.asList(
            "Java", "Spring Boot", "Spring", "Hibernate", "JPA", "REST APIs", "Microservices",
            "JavaScript", "TypeScript", "React", "ReactJS", "Angular", "Node.js", "SQL",
            "MySQL", "PostgreSQL", "MongoDB", "Azure", "AWS", "Docker", "Kubernetes",
            "CI/CD", "Git", "Maven", "JUnit", "Mockito", "Agile", "Code Reviews",
            "Root Cause Analysis", "Software Testing", "Documentation"
    );

    @Autowired
    private ResumeRepository resumeRepository;

    @Autowired
    private UserRepository userRepository;

    public Resume generateTailoredResume(Long userId, Long jobId, Job job) {
        try {
            User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
            ResumeDocument document = fromUser(user);
            document.jobTitle = safe(job.getTitle());
            applyJobDescription(document, job.getDescription(), job.getTitle());

            String latexContent = generateLatexContent(loadTemplate(), document);
            Resume resume = buildResume(userId, jobId, document.toPlainText(), latexContent);
            resume.setPdfPath(compileLaTex(latexContent, userId, jobId));
            return resumeRepository.save(resume);
        } catch (Exception e) {
            logger.error("Error generating tailored resume: ", e);
            throw new RuntimeException("Failed to generate tailored resume", e);
        }
    }

    public Resume generateResume(Long userId) {
        try {
            User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
            ResumeDocument document = fromUser(user);
            String latexContent = generateLatexContent(loadTemplate(), document);

            Resume resume = buildResume(userId, 0L, document.toPlainText(), latexContent);
            resume.setPdfPath(compileLaTex(latexContent, userId, 0L));
            return resumeRepository.save(resume);
        } catch (Exception e) {
            logger.error("Error generating resume: ", e);
            throw new RuntimeException("Failed to generate resume", e);
        }
    }

    public Resume generateResumeFromContent(String content) {
        return generateResumeFromContent(content, null, null);
    }

    public Resume generateResumeFromContent(String content, String jobDescription, String jobTitle) {
        try {
            if (isBlank(content)) {
                throw new IllegalArgumentException("Content is required");
            }

            String latexContent;
            String savedContent = content;
            if (looksLikeLatex(content)) {
                latexContent = content;
            } else {
                ResumeDocument document = parseResumeContent(content);
                applyJobDescription(document, jobDescription, jobTitle);
                latexContent = generateLatexContent(loadTemplate(), document);
                savedContent = document.toPlainText();
            }

            Resume resume = buildResume(0L, 0L, savedContent, latexContent);
            resume.setPdfPath(compileLaTex(latexContent, 0L, 0L));
            return resumeRepository.save(resume);
        } catch (Exception e) {
            logger.error("Error generating resume from content: ", e);
            throw new RuntimeException("Failed to generate resume from content", e);
        }
    }

    public Resume updateResume(Resume resume) {
        try {
            Resume existingResume = resumeRepository.findById(resume.getId())
                    .orElseThrow(() -> new RuntimeException("Resume not found"));

            existingResume.setContent(resume.getContent());
            existingResume.setLatexContent(resume.getLatexContent());
            existingResume.setUpdatedAt(LocalDateTime.now().toString());

            if (!isBlank(resume.getLatexContent())) {
                existingResume.setPdfPath(compileLaTex(resume.getLatexContent(), 0L, 0L));
            }

            return resumeRepository.save(existingResume);
        } catch (Exception e) {
            logger.error("Error updating resume: ", e);
            throw new RuntimeException("Failed to update resume", e);
        }
    }

    public Resume getResumeByUserAndJob(Long userId, Long jobId) {
        return null;
    }

    private String loadTemplate() throws IOException {
        ClassPathResource resource = new ClassPathResource(TEMPLATE_PATH);
        try (InputStreamReader reader = new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8)) {
            StringBuilder template = new StringBuilder();
            char[] buffer = new char[2048];
            int read;
            while ((read = reader.read(buffer)) != -1) {
                template.append(buffer, 0, read);
            }
            return template.toString();
        }
    }

    private Resume buildResume(Long userId, Long jobId, String content, String latexContent) {
        Resume resume = new Resume();
        resume.setUserId(userId);
        resume.setJobId(jobId);
        resume.setContent(content);
        resume.setLatexContent(latexContent);
        String now = LocalDateTime.now().toString();
        resume.setCreatedAt(now);
        resume.setUpdatedAt(now);
        return resume;
    }

    private ResumeDocument fromUser(User user) {
        ResumeDocument document = new ResumeDocument();
        document.name = defaultIfBlank(user.getName(), "Your Name");
        document.email = safe(user.getEmail());
        document.phone = safe(user.getPhone());
        document.linkedin = linkedinFromEmailOrName(user.getEmail(), user.getName());
        document.headline = "Software Engineer - Java Backend - Enterprise Applications";
        document.summary = "Software Engineer with experience designing, developing, and maintaining enterprise software applications using Java and Spring Boot.";
        document.skillsText = safe(user.getSkills());
        document.experiences = parseExperience(safe(user.getExperience()));
        document.education = parseEducation(safe(user.getEducation()));
        return document;
    }

    private ResumeDocument parseResumeContent(String content) {
        ResumeDocument document = new ResumeDocument();
        String normalized = content.replace("\r\n", "\n").replace("\r", "\n").trim();
        Map<String, String> sections = splitSections(normalized);
        List<String> lines = Arrays.stream(normalized.split("\\n"))
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .collect(Collectors.toList());

        document.email = firstMatch(EMAIL_PATTERN, normalized);
        document.phone = firstMatch(PHONE_PATTERN, normalized);
        document.linkedin = firstMatch(LINKEDIN_PATTERN, normalized);
        document.name = firstValue(sections, "name");
        document.headline = firstValue(sections, "headline", "title", "role");

        if (isBlank(document.name)) {
            document.name = firstLikelyName(lines);
        }
        if (isBlank(document.headline)) {
            document.headline = firstLikelyHeadline(lines, document.name);
        }
        if (isBlank(document.linkedin)) {
            document.linkedin = "https://linkedin.com/in/yourprofile";
        } else if (!document.linkedin.toLowerCase(Locale.ROOT).startsWith("http")) {
            document.linkedin = "https://" + document.linkedin;
        }

        document.summary = defaultIfBlank(firstValue(sections, "summary", "professional summary"),
                "Software Engineer with experience designing, developing, and maintaining enterprise software applications.");
        document.skillsText = firstValue(sections, "skills", "technical skills");
        document.experiences = parseExperience(firstValue(sections, "experience", "work experience", "professional experience"));
        document.education = parseEducation(firstValue(sections, "education"));
        document.projects = parseProjects(firstValue(sections, "projects"));
        return document;
    }

    private Map<String, String> splitSections(String content) {
        Map<String, StringBuilder> builders = new LinkedHashMap<>();
        String current = "profile";
        builders.put(current, new StringBuilder());

        for (String rawLine : content.split("\\n")) {
            String line = rawLine.trim();
            String key = sectionKey(line);
            if (key != null) {
                current = key;
                builders.putIfAbsent(current, new StringBuilder());
                String afterColon = line.contains(":") ? line.substring(line.indexOf(':') + 1).trim() : "";
                if (!afterColon.isEmpty()) {
                    builders.get(current).append(afterColon).append('\n');
                }
            } else {
                builders.get(current).append(rawLine).append('\n');
            }
        }

        Map<String, String> sections = new LinkedHashMap<>();
        builders.forEach((key, value) -> sections.put(key, value.toString().trim()));
        return sections;
    }

    private String sectionKey(String line) {
        String candidate = line;
        if (line.contains(":")) {
            candidate = line.substring(0, line.indexOf(':'));
        }
        String compact = candidate.toLowerCase(Locale.ROOT).replaceAll("[#:]", "").trim();
        if (Arrays.asList("name", "headline", "title", "role", "summary", "professional summary",
                "skills", "technical skills", "experience", "work experience", "professional experience",
                "education", "projects").contains(compact)) {
            return compact;
        }
        return null;
    }

    private void applyJobDescription(ResumeDocument document, String jobDescription, String jobTitle) {
        document.jobTitle = safe(jobTitle);
        Set<String> matchedSkills = extractJobKeywords(jobDescription);
        document.skillsText = prioritizeSkills(document.skillsText, matchedSkills);

        if (!isBlank(jobTitle)) {
            document.headline = jobTitle + " - " + defaultIfBlank(document.headline, "Software Engineer");
        }

        if (!matchedSkills.isEmpty()) {
            String skills = String.join(", ", matchedSkills);
            document.summary = "Software Engineer with experience designing, developing, and maintaining enterprise applications using "
                    + skills + ". Experienced in requirements analysis, scalable backend services, troubleshooting, testing, debugging, and deployment.";
        }
    }

    private Set<String> extractJobKeywords(String jobDescription) {
        Set<String> keywords = new LinkedHashSet<>();
        if (isBlank(jobDescription)) {
            return keywords;
        }
        String lower = jobDescription.toLowerCase(Locale.ROOT);
        for (String skill : KNOWN_SKILLS) {
            if (lower.contains(skill.toLowerCase(Locale.ROOT))) {
                keywords.add(skill);
            }
        }
        return keywords;
    }

    private String prioritizeSkills(String skillsText, Set<String> matchedSkills) {
        if (matchedSkills.isEmpty()) {
            return safe(skillsText);
        }
        LinkedHashSet<String> ordered = new LinkedHashSet<>(matchedSkills);
        if (!isBlank(skillsText)) {
            for (String skill : skillsText.split("[,\\n]")) {
                String trimmed = skill.trim();
                if (!trimmed.isEmpty()) {
                    ordered.add(trimmed);
                }
            }
        }
        return String.join(", ", ordered);
    }

    private String generateLatexContent(String template, ResumeDocument document) {
        return template
                .replace("{{NAME}}", escapeLatex(defaultIfBlank(document.name, "Your Name")))
                .replace("{{HEADLINE}}", escapeLatex(defaultIfBlank(document.headline, "Software Engineer")))
                .replace("{{PHONE}}", escapeLatex(document.phone))
                .replace("{{EMAIL}}", escapeLatex(document.email))
                .replace("{{LINKEDIN}}", safe(document.linkedin))
                .replace("{{LINKEDIN_LABEL}}", escapeLatex(linkedinLabel(document.linkedin)))
                .replace("{{SUMMARY}}", escapeLatex(document.summary))
                .replace("{{SKILLS}}", formatSkillsForLatex(document.skillsText))
                .replace("{{EXPERIENCE}}", formatExperienceForLatex(document.experiences))
                .replace("{{EDUCATION}}", formatEducationForLatex(document.education))
                .replace("{{PROJECT_SECTION}}", formatProjectsSectionForLatex(document.projects));
    }

    private String formatSkillsForLatex(String skillsText) {
        if (isBlank(skillsText)) {
            return "";
        }
        List<String> lines = Arrays.stream(skillsText.split("\\n"))
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .collect(Collectors.toList());
        if (lines.size() > 1 && lines.stream().anyMatch(line -> line.contains(":"))) {
            return lines.stream()
                    .map(line -> {
                        int idx = line.indexOf(':');
                        if (idx <= 0) {
                            return escapeLatex(line);
                        }
                        return "\\textbf{" + escapeLatex(line.substring(0, idx).trim()) + "}: "
                                + escapeLatex(line.substring(idx + 1).trim());
                    })
                    .collect(Collectors.joining(" \\\\ "));
        }
        return escapeLatex(skillsText.replace('\n', ' '));
    }

    private List<ExperienceEntry> parseExperience(String experienceText) {
        List<ExperienceEntry> entries = new ArrayList<>();
        if (isBlank(experienceText)) {
            return entries;
        }
        List<String> lines = Arrays.stream(experienceText.trim().split("\\n"))
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .collect(Collectors.toList());

        int cursor = 0;
        while (cursor < lines.size()) {
            ExperienceEntry entry = new ExperienceEntry();
            String originalTitle = cleanBullet(lines.get(cursor++));
            entry.title = originalTitle;

            if (cursor < lines.size() && looksLikeDate(lines.get(cursor))) {
                entry.dates = cleanBullet(lines.get(cursor++));
            }
            if (cursor < lines.size() && !isBullet(lines.get(cursor))) {
                entry.company = cleanBullet(lines.get(cursor++));
            }

            while (cursor < lines.size()) {
                String line = lines.get(cursor);
                boolean nextLineStartsAnotherRole = !isBullet(line)
                        && cursor + 1 < lines.size()
                        && looksLikeDate(lines.get(cursor + 1));
                boolean currentLineLooksLikeAnotherRole = !isBullet(line) && !entry.bullets.isEmpty();
                if (nextLineStartsAnotherRole || currentLineLooksLikeAnotherRole) {
                    break;
                }
                entry.bullets.add(cleanBullet(lines.get(cursor)));
                cursor++;
            }

            if (entry.bullets.isEmpty()) {
                entry.bullets.add(originalTitle);
                entry.title = "Software Engineer";
            }
            entries.add(entry);
        }
        return entries;
    }

    private String formatExperienceForLatex(List<ExperienceEntry> entries) {
        return entries.stream().map(entry -> {
            String bullets = entry.bullets.stream()
                    .filter(bullet -> !isBlank(bullet))
                    .map(bullet -> "\\resumeItem{" + escapeLatex(bullet) + "}")
                    .collect(Collectors.joining("\n"));
            return "\\resumeSubheading{" + escapeLatex(defaultIfBlank(entry.title, "Software Engineer")) + "}{"
                    + escapeLatex(entry.dates) + "}{" + escapeLatex(entry.company) + "}{"
                    + escapeLatex(entry.location) + "}\n\\resumeItemListStart\n" + bullets + "\n\\resumeItemListEnd";
        }).collect(Collectors.joining("\n"));
    }

    private List<EducationEntry> parseEducation(String educationText) {
        List<EducationEntry> entries = new ArrayList<>();
        if (isBlank(educationText)) {
            return entries;
        }
        String[] blocks = educationText.trim().split("\\n\\s*\\n");
        for (String block : blocks) {
            List<String> lines = Arrays.stream(block.split("\\n"))
                    .map(String::trim)
                    .filter(line -> !line.isEmpty())
                    .collect(Collectors.toList());
            if (lines.isEmpty()) {
                continue;
            }
            EducationEntry entry = new EducationEntry();
            entry.degree = cleanBullet(lines.get(0));
            if (lines.size() > 1) {
                entry.school = cleanBullet(lines.get(1));
            }
            if (lines.size() > 2) {
                entry.year = cleanBullet(lines.get(2));
            }
            entries.add(entry);
        }
        return entries;
    }

    private String formatEducationForLatex(List<EducationEntry> entries) {
        return entries.stream()
                .map(entry -> "\\resumeSubheading{" + escapeLatex(entry.degree) + "}{"
                        + escapeLatex(entry.year) + "}{" + escapeLatex(entry.school) + "}{}")
                .collect(Collectors.joining("\n"));
    }

    private List<String> parseProjects(String projectsText) {
        if (isBlank(projectsText)) {
            return new ArrayList<>();
        }
        return Arrays.stream(projectsText.split("\\n"))
                .map(this::cleanBullet)
                .filter(line -> !line.isEmpty())
                .collect(Collectors.toList());
    }

    private String formatProjectsSectionForLatex(List<String> projects) {
        if (projects == null || projects.isEmpty()) {
            return "";
        }
        String items = projects.stream()
                .map(project -> "\\resumeItem{" + escapeLatex(project) + "}")
                .collect(Collectors.joining("\n"));
        return "\\section{Projects}\n\\resumeItemListStart\n" + items + "\n\\resumeItemListEnd";
    }

    private String compileLaTex(String latexContent, Long userId, Long jobId) {
        try {
            Files.createDirectories(OUTPUT_DIR);
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String filename = String.format("resume_user%d_job%d_%s", userId, jobId, timestamp);
            Path texFile = OUTPUT_DIR.resolve(filename + ".tex");
            Path pdfFile = OUTPUT_DIR.resolve(filename + ".pdf");
            Files.writeString(texFile, latexContent, StandardCharsets.UTF_8);

            ProcessBuilder pb = new ProcessBuilder(
                    "pdflatex",
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-output-directory=" + OUTPUT_DIR,
                    texFile.toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    logger.debug("LaTeX output: {}", line);
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0 && Files.exists(pdfFile)) {
                return pdfFile.toString();
            }
            logger.warn("LaTeX compilation exited with code {}. Returning TeX file fallback: {}", exitCode, texFile);
            return texFile.toString();
        } catch (Exception e) {
            logger.warn("pdflatex unavailable or failed. Returning TeX file fallback. Details: {}", e.getMessage());
            try {
                Files.createDirectories(OUTPUT_DIR);
                String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
                Path texFile = OUTPUT_DIR.resolve(String.format("resume_user%d_job%d_%s.tex", userId, jobId, timestamp));
                Files.writeString(texFile, latexContent, StandardCharsets.UTF_8);
                return texFile.toString();
            } catch (Exception writeException) {
                logger.error("Error writing TeX fallback: ", writeException);
                return null;
            }
        }
    }

    private String escapeLatex(String text) {
        if (text == null) {
            return "";
        }
        return text
                .replace("\\", "\\textbackslash{}")
                .replace("&", "\\&")
                .replace("%", "\\%")
                .replace("$", "\\$")
                .replace("#", "\\#")
                .replace("_", "\\_")
                .replace("{", "\\{")
                .replace("}", "\\}")
                .replace("~", "\\textasciitilde{}")
                .replace("^", "\\textasciicircum{}");
    }

    private String firstValue(Map<String, String> sections, String... keys) {
        for (String key : keys) {
            String value = sections.get(key);
            if (!isBlank(value)) {
                return value;
            }
        }
        return "";
    }

    private String firstMatch(Pattern pattern, String content) {
        Matcher matcher = pattern.matcher(content);
        return matcher.find() ? matcher.group().trim() : "";
    }

    private String firstLikelyName(List<String> lines) {
        return lines.stream()
                .filter(line -> !line.contains("@"))
                .filter(line -> !LINKEDIN_PATTERN.matcher(line).find())
                .filter(line -> !PHONE_PATTERN.matcher(line).find())
                .findFirst()
                .orElse("Your Name");
    }

    private String firstLikelyHeadline(List<String> lines, String name) {
        return lines.stream()
                .filter(line -> !line.equals(name))
                .filter(line -> !line.contains("@"))
                .filter(line -> !LINKEDIN_PATTERN.matcher(line).find())
                .filter(line -> !PHONE_PATTERN.matcher(line).find())
                .findFirst()
                .orElse("Software Engineer");
    }

    private String linkedinLabel(String linkedin) {
        if (isBlank(linkedin)) {
            return "LinkedIn";
        }
        return linkedin.replaceFirst("https?://", "").replaceFirst("www\\.", "").replaceAll("/$", "");
    }

    private String linkedinFromEmailOrName(String email, String name) {
        return "https://linkedin.com/in/yourprofile";
    }

    private boolean looksLikeLatex(String content) {
        String trimmed = content.trim();
        return trimmed.startsWith("\\documentclass") || trimmed.contains("\\begin{document}");
    }

    private boolean looksLikeDate(String line) {
        return line.matches("(?i).*(present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|20\\d{2}|19\\d{2}).*");
    }

    private boolean isBullet(String line) {
        return line.matches("^[-*\\u2022\\u2013\\u2014].*");
    }

    private String cleanBullet(String line) {
        return safe(line).replaceFirst("^[-*\\u2022\\u2013\\u2014]\\s*", "").trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String defaultIfBlank(String value, String fallback) {
        return isBlank(value) ? fallback : value.trim();
    }

    private static class ResumeDocument {
        String name = "Your Name";
        String headline = "Software Engineer";
        String phone = "";
        String email = "";
        String linkedin = "https://linkedin.com/in/yourprofile";
        String summary = "";
        String skillsText = "";
        String jobTitle = "";
        List<ExperienceEntry> experiences = new ArrayList<>();
        List<EducationEntry> education = new ArrayList<>();
        List<String> projects = new ArrayList<>();

        String toPlainText() {
            return String.join("\n\n",
                    name + "\n" + headline + "\n" + phone + "\n" + email + "\n" + linkedin,
                    "Summary\n" + summary,
                    "Skills\n" + skillsText
            );
        }
    }

    private static class ExperienceEntry {
        String title = "";
        String dates = "";
        String company = "";
        String location = "";
        List<String> bullets = new ArrayList<>();
    }

    private static class EducationEntry {
        String degree = "";
        String school = "";
        String year = "";
    }
}
