---
name: "Umlauts not displayed in German language setting"
about: Report an issue where umlauts are not displayed when the language is set to German
---

**Describe the bug**
When the application language is set to German, umlauts (e.g., Ä, Ö, Ü) are not displayed correctly. Instead, placeholders or incorrect characters appear in their place. This leads to a suboptimal user experience for German-speaking users.

**Steps to Reproduce**
1. Set the application language to "Deutsch (German)."
2. Navigate to any section where text containing umlauts is displayed (e.g., notifications or labels).
3. Observe that umlauts are missing or rendered incorrectly.

**Expected behavior**
Umlauts (Ä, Ö, Ü) should be displayed correctly in all sections of the application.

**Actual behavior**
Umlauts are not displayed properly, affecting the readability of German text.

**Proposed Solution**
Check encoding and character set handling for the German language files. Ensure that the text strings include proper UTF-8 (or suitable) encoding to handle special characters like umlauts correctly.

**Additional context**
Add any other context about the problem here, such as screenshots or logs if available.