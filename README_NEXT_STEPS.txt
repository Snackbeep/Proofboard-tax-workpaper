PROOFBOARD — FIRST CODE REVIEW UPDATE

WHAT THIS PATCH CHANGES
1. Investigation evidence now opens its document directly (not only D71).
2. Source preview is at the top of Documents rather than below the entire index.
3. Extracted fields are selectable, with matching printed text highlighted.
4. Simulated SSNs are masked in the printed document for users without sensitive-data clearance.
5. A not-yet-received document shows an explicit message, never an unrelated first document.
6. Findings requiring future-arriving documents, messages, or questionnaire answers are hidden until the selected Season clock reaches them. These are replay visibility safeguards; we have NOT implemented a complete version-specific historical recomputation.

HOW TO INSTALL ON WINDOWS
1. STOP the Vite terminal with Ctrl+C, then close the browser tab if desired.
2. BACK UP your folder C:\Users\sujit\tax-workpaper before doing anything else.
3. Open this ZIP and copy the entire 'src' folder into your existing 'tax-workpaper' folder. Choose Replace files when Windows asks. Do NOT copy a parent 'proofboard_updated' directory inside your project.
4. The ZIP also includes public/packet.json and all setup files for convenience. Your original packet was NOT changed. You only need to replace 'src' for this update.
5. Run in Cursor Terminal: npm.cmd run dev
6. Open http://localhost:5173/ and set Season clock to July 14, 2026 (or later).
7. Click Investigations > People & identity > D71. You should see D71 above the document index and a highlighted (masked, depending on the active role) source-field match.
8. Scroll down to confirm the document index is still present. Refresh Chrome to ensure no errors.

IMPORTANT LIMITATIONS BEFORE SUBMISSION
- State still lives in the browser localStorage, not in a synchronized multi-user backend.
- The role switcher is a demonstration, not secure authentication/authorization.
- Some historical computations, changes-since-last-seen and tax-effect estimates still need validation.
- True e-file integration, external notifications, audit-grade security and public deployment are not implemented in this patch.
- Do not market the app as production-grade, secure, or complete based on this update.
