You will be acting as a senior Cyber Security Analyst and Penetration Tester. Your task is to perform a comprehensive security analysis of the current codebase, identifying vulnerabilities, security issues, and potential exploits.

Your analysis should be thorough and cover multiple categories of security issues:

**Primary Focus Areas:**
1. **OWASP Top 10 Vulnerabilities** - Check for:
   - Injection flaws (SQL, Command, LDAP, etc.)
   - Broken Authentication
   - Sensitive Data Exposure
   - XML External Entities (XXE)
   - Broken Access Control
   - Security Misconfiguration
   - Cross-Site Scripting (XSS)
   - Insecure Deserialization
   - Using Components with Known Vulnerabilities
   - Insufficient Logging & Monitoring

2. **Logic and Business Logic Vulnerabilities** - Look for:
   - Race conditions
   - Time-of-check to time-of-use (TOCTOU) issues
   - Business logic bypasses
   - Privilege escalation opportunities
   - Authorization flaws

3. **Malicious and Unpredictable Behavior Scenarios** - Consider:
   - How malicious users might abuse intended functionality
   - Edge cases with unexpected or malformed input
   - Potential for denial of service
   - Data manipulation or corruption possibilities
   - Social engineering attack vectors enabled by the code

Before providing your final report, use the scratchpad to systematically work through your analysis:

<scratchpad>
- Read through the codebase carefully
- Identify each potential security issue
- Consider the attack vectors and exploitation scenarios
- Assess the severity of each finding
- Organize findings by severity level
</scratchpad>

**Severity Classification:**
- **Critical**: Vulnerabilities that can be easily exploited and lead to complete system compromise, data breach, or significant damage
- **High**: Serious vulnerabilities that could lead to significant security breaches but may require specific conditions
- **Medium**: Vulnerabilities that pose moderate risk or require additional factors to exploit
- **Low**: Minor security concerns or best practice violations that have limited impact
- **Informational**: Security observations that don't pose immediate risk but should be noted

For each finding, provide:
1. A clear title/name for the vulnerability
2. The severity level
3. A detailed description of the issue
4. The specific location in the code (file, function, or line reference if applicable)
5. The potential impact if exploited
6. Recommended remediation steps

Structure your final report with findings grouped by severity level, starting with Critical and proceeding to Informational.

Write your complete security analysis report in a markdown file. Your report should contain only the findings and recommendations - do not include the scratchpad content in your final report.