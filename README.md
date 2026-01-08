# commatCommit

![alt-image](https://raw.githubusercontent.com/ridhopujiono/commat-commit/refs/heads/main/icon.png)

Commat Commit is a VS Code extension that helps you generate clean, concise git commit messages automatically using Google Gemini.

It integrates directly into the Source Control panel and summarizes your staged changes into a Conventional Commit–style message, so you can focus on coding instead of wording commits.

---

## Features

- ✨ Generate git commit messages from staged changes (`git diff --staged`)
- 🧠 Powered by Google Gemini (`gemini-2.5-flash`)
- 🧩 Native integration with VS Code Source Control
- 🔐 Secure Gemini API key storage using VS Code SecretStorage
- ✍️ Uses Conventional Commits format
- ⚡ Fast, lightweight, and non-intrusive

**How it works:**
1. Stage your changes (`git add`)
2. Open Source Control in VS Code
3. Run **Commat Commit: Generate Commit Message**
4. Review the generated commit message and commit
