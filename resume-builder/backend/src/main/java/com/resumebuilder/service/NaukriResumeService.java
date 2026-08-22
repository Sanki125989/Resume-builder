package com.resumebuilder.service;

import com.resumebuilder.model.User;
import com.resumebuilder.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class NaukriResumeService {

    private static final Logger logger = LoggerFactory.getLogger(NaukriResumeService.class);

    private static final String PUPPETEER_URL = "http://localhost:3001";
    private static final String TEMPLATE_PATH = "templates/resume-template.tex";
    private static final Path RESUMES_DIR = Paths.get(
            System.getProperty("user.home"),
            "Documents", "Personal documents", "Resume-builder", "resumes"
    );

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    /**
     * Full end-to-end flow:
     * 1. Login to Naukri → Recommended Jobs → Applies → scan 1st job
     * 2. Fill resume template with user profile + scanned key skills
     * 3. Compile to Sanket_Resume_DD_MM_YYYY.pdf
     * 4. Upload PDF to Naukri profile → logout
     */
    public Map<String, Object> loginAndUploadResume(String username, String password) throws Exception {

        // ── Step 1: Scrape recommended job from Naukri ──────────────────────
        logger.info("Step 1: Scraping recommended job from Naukri...");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> scrapeRequest = Map.of("username", username, "password", password);
        ResponseEntity<Map> scrapeResponse = restTemplate.postForEntity(
                PUPPETEER_URL + "/api/naukri/scrape-job",
                new HttpEntity<>(scrapeRequest, headers),
                Map.class
        );

        if (scrapeResponse.getBody() == null) {
            throw new RuntimeException("Empty response from puppeteer /api/naukri/scrape-job");
        }

        String jobDescription = (String) scrapeResponse.getBody().getOrDefault("jobDescription", "");
        @SuppressWarnings("unchecked")
        List<String> keySkills = (List<String>) scrapeResponse.getBody().getOrDefault("keySkills", new ArrayList<>());
        logger.info("Scraped {} key skills: {}", keySkills.size(), keySkills);

        // ── Step 2: Load resume template ────────────────────────────────────
        logger.info("Step 2: Loading resume template...");
        String templateContent = loadTemplate();

        // ── Step 3: Get user profile from DB ────────────────────────────────
        logger.info("Step 3: Fetching user profile...");
        User user = userRepository.findAll().stream().findFirst().orElse(null);

        // ── Step 4: Fill template with user data + scanned skills ────────────
        logger.info("Step 4: Filling template...");
        String filledLatex = fillTemplate(templateContent, user, keySkills, jobDescription);

        // ── Step 5: Compile to Sanket_Resume_DD_MM_YYYY.pdf ─────────────────
        logger.info("Step 5: Compiling to PDF...");
        String pdfPath = compileToNamedPdf(filledLatex);
        logger.info("PDF path: {}", pdfPath);

        // ── Step 6: Upload to Naukri profile + logout ───────────────────────
        logger.info("Step 6: Uploading resume to Naukri profile...");
        Map<String, String> uploadRequest = Map.of("resumePath", pdfPath);
        ResponseEntity<Map> uploadResponse = restTemplate.postForEntity(
                PUPPETEER_URL + "/api/naukri/upload-resume",
                new HttpEntity<>(uploadRequest, headers),
                Map.class
        );

        boolean uploadSuccess = uploadResponse.getBody() != null
                && Boolean.TRUE.equals(uploadResponse.getBody().get("success"));
        logger.info("Upload success: {}", uploadSuccess);

        return Map.of(
                "success", true,
                "pdfPath", pdfPath,
                "keySkillsUsed", keySkills,
                "uploadSuccess", uploadSuccess,
                "message", "Resume updated and uploaded to Naukri successfully"
        );
    }

    // ── Template loading ─────────────────────────────────────────────────────

    private String loadTemplate() throws Exception {
        ClassPathResource resource = new ClassPathResource(TEMPLATE_PATH);
        try (InputStreamReader reader = new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8)) {
            StringBuilder sb = new StringBuilder();
            char[] buf = new char[2048];
            int read;
            while ((read = reader.read(buf)) != -1) sb.append(buf, 0, read);
            return sb.toString();
        }
    }

    // ── Template filling ─────────────────────────────────────────────────────

    private String fillTemplate(String template, User user, List<String> keySkills, String jobDescription) {
        String name      = user != null && notBlank(user.getName())  ? user.getName()  : "Sanket";
        String email     = user != null && notBlank(user.getEmail()) ? user.getEmail() : "";
        String phone     = user != null && notBlank(user.getPhone()) ? user.getPhone() : "";
        String linkedin  = "https://linkedin.com/in/yourprofile";
        String headline  = buildHeadline(keySkills);
        String summary   = buildSummary(keySkills, jobDescription);
        String skills    = buildSkillsLatex(keySkills);
        String experience = buildExperienceLatex(user);
        String education  = buildEducationLatex(user);

        return template
                .replace("{{NAME}}",           escapeLatex(name))
                .replace("{{HEADLINE}}",        escapeLatex(headline))
                .replace("{{PHONE}}",           escapeLatex(phone))
                .replace("{{EMAIL}}",           escapeLatex(email))
                .replace("{{LINKEDIN}}",        linkedin)
                .replace("{{LINKEDIN_LABEL}}",  linkedin.replaceFirst("https?://", "").replaceAll("/$", ""))
                .replace("{{SUMMARY}}",         escapeLatex(summary))
                .replace("{{SKILLS}}",          skills)
                .replace("{{EXPERIENCE}}",      experience)
                .replace("{{EDUCATION}}",       education)
                .replace("{{PROJECT_SECTION}}", "");
    }

    private String buildHeadline(List<String> keySkills) {
        if (keySkills == null || keySkills.isEmpty()) {
            return "Full Stack Developer | Java | Spring Boot | React";
        }
        List<String> top = keySkills.stream().limit(4).collect(Collectors.toList());
        return "Full Stack Developer | " + String.join(" | ", top);
    }

    private String buildSummary(List<String> keySkills, String jobDescription) {
        String top3 = (keySkills != null && !keySkills.isEmpty())
                ? keySkills.stream().limit(3).collect(Collectors.joining(", "))
                : "Java, Spring Boot, React";
        return "Software Engineer with strong expertise in " + top3
                + ". Experienced in designing and delivering scalable applications that meet business objectives.";
    }

    private String buildSkillsLatex(List<String> keySkills) {
        if (keySkills == null || keySkills.isEmpty()) {
            return "\\textbf{Key Skills:} Java, Spring Boot, REST API, Microservices";
        }
        String escaped = keySkills.stream()
                .map(this::escapeLatex)
                .collect(Collectors.joining(", "));
        return "\\textbf{Key Skills:} " + escaped;
    }

    private String buildExperienceLatex(User user) {
        if (user == null || !notBlank(user.getExperience())) return "";
        String[] lines = user.getExperience().split("\\n");
        StringBuilder sb = new StringBuilder();
        sb.append("\\resumeSubheading{Software Engineer}{Present}{Company}{Location}\n");
        sb.append("\\resumeItemListStart\n");
        for (String line : lines) {
            String trimmed = line.trim().replaceFirst("^[-*•]\\s*", "");
            if (notBlank(trimmed)) {
                sb.append("  \\resumeItem{").append(escapeLatex(trimmed)).append("}\n");
            }
        }
        sb.append("\\resumeItemListEnd");
        return sb.toString();
    }

    private String buildEducationLatex(User user) {
        if (user == null || !notBlank(user.getEducation())) return "";
        return "\\resumeSubheading{" + escapeLatex(user.getEducation().trim()) + "}{}{}{}" ;
    }

    // ── PDF compilation ──────────────────────────────────────────────────────

    private String compileToNamedPdf(String latexContent) throws Exception {
        String dateStr   = LocalDate.now().format(DateTimeFormatter.ofPattern("dd_MM_yyyy"));
        String filename  = "Sanket_Resume_" + dateStr;
        return compileToNamedPdf(latexContent, filename);
    }

    private String compileToNamedPdf(String latexContent, String filename) throws Exception {
        Files.createDirectories(RESUMES_DIR);
        Path   texFile   = RESUMES_DIR.resolve(filename + ".tex");
        Path   pdfFile   = RESUMES_DIR.resolve(filename + ".pdf");

        Files.writeString(texFile, latexContent, StandardCharsets.UTF_8);
        logger.info("Wrote .tex file: {}", texFile);

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "pdflatex",
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-output-directory=" + RESUMES_DIR,
                    texFile.toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) logger.debug("pdflatex: {}", line);
            }

            int exitCode = process.waitFor();
            if (exitCode == 0 && Files.exists(pdfFile)) {
                logger.info("PDF compiled successfully via pdflatex: {}", pdfFile);
                return pdfFile.toString();
            }
            logger.warn("pdflatex exited with code {}. Triggering HTML-to-PDF fallback.", exitCode);
        } catch (Exception e) {
            logger.warn("pdflatex execution failed ({}). Triggering HTML-to-PDF fallback.", e.getMessage());
        }

        // Fallback: Compile to PDF via Puppeteer
        try {
            String htmlContent = convertLatexToHtml(latexContent);
            return compileHtmlToPdfViaPuppeteer(htmlContent, pdfFile);
        } catch (Exception fallbackEx) {
            logger.error("HTML-to-PDF fallback also failed!", fallbackEx);
            throw new RuntimeException("All PDF compilation methods failed (pdflatex and Puppeteer html-to-pdf fallback)", fallbackEx);
        }
    }

    private String compileHtmlToPdfViaPuppeteer(String htmlContent, Path pdfFile) throws Exception {
        logger.info("Calling Puppeteer HTML-to-PDF fallback endpoint...");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> requestBody = Map.of(
            "html", htmlContent,
            "outputPath", pdfFile.toAbsolutePath().toString()
        );

        ResponseEntity<Map> response = restTemplate.postForEntity(
                PUPPETEER_URL + "/api/naukri/html-to-pdf",
                new HttpEntity<>(requestBody, headers),
                Map.class
        );

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null
                && Boolean.TRUE.equals(response.getBody().get("success"))) {
            logger.info("Fallback PDF compiled successfully via Puppeteer at: {}", pdfFile);
            return pdfFile.toString();
        }

        throw new RuntimeException("Puppeteer html-to-pdf API failed: " + (response.getBody() != null ? response.getBody().toString() : "empty response"));
    }

    private String convertLatexToHtml(String latex) {
        int startDoc = latex.indexOf("\\begin{document}");
        if (startDoc != -1) {
            latex = latex.substring(startDoc + 16);
        }
        int endDoc = latex.indexOf("\\end{document}");
        if (endDoc != -1) {
            latex = latex.substring(0, endDoc);
        }

        String html = latex
            .replace("\\begin{center}", "<div style='text-align: center; margin-bottom: 20px;'>")
            .replace("\\end{center}", "</div>")
            .replaceAll("\\{\\\\Huge \\\\textbf\\{([^}]+)\\}\\}", "<h1 style='margin: 0; font-size: 24pt;'>$1</h1>")
            .replaceAll("\\\\href\\{mailto:([^}]+)\\}\\{([^}]+)\\}", "<a href='mailto:$1'>$2</a>")
            .replaceAll("\\\\href\\{([^}]+)\\}\\{([^}]+)\\}", "<a href='$1'>$2</a>")
            .replaceAll("\\\\small\\s+", "")
            .replaceAll("\\\\Large\\s+", "")
            .replaceAll("\\\\large\\s+", "")
            .replace("\\quad $|$ \\quad", " | ")
            .replace("\\quad", " ")
            .replaceAll("\\\\vspace\\{[^}]+\\}", "")
            .replaceAll("\\\\hfill", "")
            .replaceAll("\\\\\\\\", "<br/>");

        html = html.replaceAll("\\\\section\\{([^}]+)\\}", "<h2 style='border-bottom: 1px solid #333; padding-bottom: 3px; margin-top: 20px; margin-bottom: 8px; font-size: 14pt; font-weight: bold; text-transform: uppercase;'>$1</h2>");

        html = html.replace("\\resumeSubHeadingListStart", "<div class='list-subheading'>");
        html = html.replace("\\resumeSubHeadingListEnd", "</div>");
        html = html.replace("\\resumeItemListStart", "<ul style='margin-top: 4px; margin-bottom: 8px; padding-left: 20px;'>");
        html = html.replace("\\resumeItemListEnd", "</ul>");
        html = html.replaceAll("\\\\resumeItem\\{([^}]+)\\}", "<li style='margin-bottom: 3px;'>$1</li>");

        html = html.replaceAll(
            "\\\\resumeSubheading\\{([^}]+)\\}\\{([^}]+)\\}\\{([^}]+)\\}\\{([^}]+)\\}",
            "<div style='margin-bottom: 10px; font-size: 10.5pt;'>" +
            "  <table style='width: 100%; border-collapse: collapse;'>" +
            "    <tr>" +
            "      <td style='text-align: left;'><strong>$1</strong></td>" +
            "      <td style='text-align: right;'>$2</td>" +
            "    </tr>" +
            "    <tr>" +
            "      <td style='text-align: left; font-style: italic; color: #555;'>$3</td>" +
            "      <td style='text-align: right; font-style: italic; color: #555;'>$4</td>" +
            "    </tr>" +
            "  </table>" +
            "</div>"
        );

        html = html.replace("\\begin{itemize}[leftmargin=0.15in, label={}]", "<div style='font-size: 10.5pt; line-height: 1.4;'>");
        html = html.replace("\\end{itemize}", "</div>");
        html = html.replace("\\small{\\item{", "");
        html = html.replace("}}", "");
        html = html.replaceAll("\\\\textbf\\{([^}]+)\\}", "<strong>$1</strong>");

        html = html
            .replace("\\&", "&")
            .replace("\\%", "%")
            .replace("\\$", "$")
            .replace("\\#", "#")
            .replace("\\_", "_")
            .replace("\\{", "{")
            .replace("\\}", "}")
            .replace("\\textbackslash{}", "\\")
            .replace("\\textasciitilde{}", "~")
            .replace("\\textasciicircum{}", "^");

        return "<html>" +
               "<head>" +
               "<meta charset='utf-8'>" +
               "<style>" +
               "  body { font-family: 'Arial', sans-serif; font-size: 10.5pt; line-height: 1.35; color: #222; margin: 0; padding: 0; }" +
               "  a { color: #0056b3; text-decoration: none; }" +
               "  ul { margin: 0; padding-left: 20px; }" +
               "</style>" +
               "</head>" +
               "<body>" +
               html +
               "</body>" +
               "</html>";
    }

    public String tailorAndCompileResume(String jobTitle, String jobDescription) throws Exception {
        logger.info("Tailoring resume for job: {}", jobTitle);
        
        // 1. Load resume template
        String templateContent = loadTemplate();
        
        // 2. Fetch user profile
        User user = userRepository.findAll().stream().findFirst().orElse(null);
        
        // 3. Extract skills from description
        List<String> matchedSkills = extractSkillsFromDescription(jobDescription);
        logger.info("Extracted matched skills from description: {}", matchedSkills);
        
        // 4. Fill template
        String filledLatex = fillTemplateForJob(templateContent, user, matchedSkills, jobTitle, jobDescription);
        
        // 5. Compile to PDF with custom unique name
        String sanitizedTitle = jobTitle.replaceAll("[^a-zA-Z0-9]", "_");
        String timestamp = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "Sanket_Resume_" + sanitizedTitle + "_" + timestamp;
        
        String pdfPath = compileToNamedPdf(filledLatex, filename);
        logger.info("Tailored PDF compiled at: {}", pdfPath);
        
        return pdfPath;
    }

    private String fillTemplateForJob(String template, User user, List<String> keySkills, String jobTitle, String jobDescription) {
        String name      = user != null && notBlank(user.getName())  ? user.getName()  : "Sanket";
        String email     = user != null && notBlank(user.getEmail()) ? user.getEmail() : "";
        String phone     = user != null && notBlank(user.getPhone()) ? user.getPhone() : "";
        String linkedin  = "https://linkedin.com/in/yourprofile";
        
        // Build customized headline using the jobTitle
        String headline = jobTitle;
        if (keySkills != null && !keySkills.isEmpty()) {
            List<String> top = keySkills.stream().limit(3).collect(Collectors.toList());
            headline = jobTitle + " | " + String.join(" | ", top);
        }
        
        // Build customized summary
        String summary = "Software Engineer with expertise in designing and developing scalable enterprise applications. ";
        if (keySkills != null && !keySkills.isEmpty()) {
            String skillsJoined = keySkills.stream().limit(4).collect(Collectors.joining(", "));
            summary += "Strong technical hands-on experience with " + skillsJoined + ". ";
        }
        summary += "Experienced in requirements analysis, software engineering best practices, troubleshooting, and delivering business-aligned solutions.";
        
        String skills    = buildSkillsLatex(keySkills);
        String experience = buildExperienceLatex(user);
        String education  = buildEducationLatex(user);

        return template
                .replace("{{NAME}}",           escapeLatex(name))
                .replace("{{HEADLINE}}",        escapeLatex(headline))
                .replace("{{PHONE}}",           escapeLatex(phone))
                .replace("{{EMAIL}}",           escapeLatex(email))
                .replace("{{LINKEDIN}}",        linkedin)
                .replace("{{LINKEDIN_LABEL}}",  linkedin.replaceFirst("https?://", "").replaceAll("/$", ""))
                .replace("{{SUMMARY}}",         escapeLatex(summary))
                .replace("{{SKILLS}}",          skills)
                .replace("{{EXPERIENCE}}",      experience)
                .replace("{{EDUCATION}}",       education)
                .replace("{{PROJECT_SECTION}}", "");
    }

    private List<String> extractSkillsFromDescription(String jobDescription) {
        List<String> knownSkills = Arrays.asList(
            "Java", "Spring Boot", "Spring", "Hibernate", "JPA", "REST API", "REST APIs", "Microservices",
            "JavaScript", "TypeScript", "React", "ReactJS", "Angular", "Node.js", "SQL",
            "MySQL", "PostgreSQL", "MongoDB", "Azure", "AWS", "Docker", "Kubernetes",
            "CI/CD", "Git", "Maven", "JUnit", "Mockito", "Agile", "Code Reviews",
            "Software Testing", "Documentation", "Gitlab", "Jenkins", "Web Services"
        );
        if (jobDescription == null || jobDescription.isBlank()) {
            return Collections.emptyList();
        }
        String lower = jobDescription.toLowerCase();
        List<String> matched = new ArrayList<>();
        for (String skill : knownSkills) {
            if (lower.contains(skill.toLowerCase())) {
                matched.add(skill);
            }
        }
        return matched;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String escapeLatex(String text) {
        if (text == null) return "";
        return text
                .replace("\\", "\\textbackslash{}")
                .replace("&",  "\\&")
                .replace("%",  "\\%")
                .replace("$",  "\\$")
                .replace("#",  "\\#")
                .replace("_",  "\\_")
                .replace("{",  "\\{")
                .replace("}",  "\\}")
                .replace("~",  "\\textasciitilde{}")
                .replace("^",  "\\textasciicircum{}");
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
