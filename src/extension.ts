import * as vscode from "vscode";
import { exec } from "child_process";

/* ================= ACTIVATE ================= */

export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    "commatCommit.generate",
    async () => {
      try {
        const apiKey = await getGeminiApiKey(context);
        if (!apiKey) return;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.SourceControl,
            title: "Commat Commit: Generating commit message…",
            cancellable: false
          },
          async () => {
            const diff = await getGitDiff();

            if (!diff.trim()) {
              vscode.window.showWarningMessage(
                "No staged changes found. Please run git add first."
              );
              return;
            }

            const commitMessage = await generateCommitMessage(apiKey, diff);

            const repo = getActiveRepository();
            repo.inputBox.value = commitMessage;
          }
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `Commat Commit Error: ${err.message}`
        );
      }
    }
  );

  context.subscriptions.push(command);
}


export function deactivate() {}

/* ================= HELPERS ================= */

// 🔐 Gemini API Key (secure)
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
        "Gemini API Key saved securely"
      );
    }
  }

  return apiKey;
}

// 📁 Workspace root
function getWorkspaceRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error("No workspace folder found");
  }
  return folders[0].uri.fsPath;
}

// 🧾 Git diff (staged)
function getGitDiff(): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      "git diff --cached",
      { cwd: getWorkspaceRoot(), maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          reject(new Error("Failed to get staged changes"));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

// 🤖 Gemini API call (FREE & FAST)
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
                text: ` Generate a Conventional Commit message from this git diff.
Only output the commit message.
${diff}
                `,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400,
        }
      }),
    }
  );

  const data: any = await response.json();
  return data.candidates[0].content.parts[0].text.trim();
}

// 🔗 Native Git API (BUKAN SCM custom)
function getGitApi(): any {
  const ext = vscode.extensions.getExtension("vscode.git");
  if (!ext) {
    throw new Error("Git extension not found");
  }
  return ext.exports.getAPI(1);
}

function getActiveRepository(): any {
  const git = getGitApi();
  if (!git.repositories.length) {
    throw new Error("No Git repository found");
  }
  return git.repositories[0];
}
