import * as vscode from "vscode";
import { exec } from "child_process";

let scm: vscode.SourceControl;

export function activate(context: vscode.ExtensionContext) {
  // Create Source Control integration
  scm = vscode.scm.createSourceControl(
    "commatCommit",
    "Commat Commit"
  );

  scm.inputBox.placeholder =
    "Commat Commit will generate your commit message here…";

  const generateCommand = vscode.commands.registerCommand(
    "commatCommit.generate",
    async () => {
      try {
        // 1. Get or ask Gemini API Key
        const apiKey = await getGeminiApiKey(context);
        if (!apiKey) return;

        // 2. Get git diff
        const diff = await getGitDiff();
        if (!diff.trim()) {
          vscode.window.showWarningMessage(
            "No staged changes found. Please git add first."
          );
          return;
        }

        // 3. Call Gemini
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.SourceControl,
            title: "Commat Commit: Generating commit message…",
          },
          async () => {
            const commitMessage = await generateCommitMessage(
              apiKey,
              diff
            );
            scm.inputBox.value = commitMessage;
          }
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `Commat Commit Error: ${err.message}`
        );
      }
    }
  );

  context.subscriptions.push(generateCommand, scm);
}

export function deactivate() {
  scm.dispose();
}

// ---------------- HELPERS ----------------

async function getGeminiApiKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  let apiKey = await context.secrets.get("geminiApiKey");

  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      prompt: "Enter your Gemini API Key",
      password: true,
      ignoreFocusOut: true,
    });

    if (apiKey) {
      await context.secrets.store("geminiApiKey", apiKey);
      vscode.window.showInformationMessage(
        "Gemini API Key saved securely ✅"
      );
    }
  }

  return apiKey;
}

function getGitDiff(): Promise<string> {
  return new Promise((resolve, reject) => {
    exec("git diff --staged", { maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      resolve(stdout);
    });
  });
}

async function generateCommitMessage(
  apiKey: string,
  diff: string
): Promise<string> {
  const response = await fetch(
       `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `
You are a senior software engineer.
Generate a concise Conventional Commit message.
Git diff:
${diff}
                `,
              },
            ],
          },
        ],
      }),
    }
  );

  const data: any = await response.json();
  return data.candidates[0].content.parts[0].text.trim();
}

