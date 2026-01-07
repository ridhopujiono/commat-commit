import * as vscode from "vscode";
import { exec } from "child_process";

/* ================= GLOBAL CONTEXT ================= */

let extensionContext: vscode.ExtensionContext;

/* ================= ACTIVATE ================= */

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  const command = vscode.commands.registerCommand(
    "commatCommit.generate",
    async () => {
      try {
        const apiKey = await getGeminiApiKey();
        if (!apiKey) return;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.SourceControl,
            title: "Commat Commit: Generating commit message…",
            cancellable: false,
          },
          async () => {
            const diff = await getGitDiff();

            if (!diff.trim()) {
              vscode.window.showWarningMessage(
                "No staged changes found. Please run git add first."
              );
              return;
            }

            const rawMessage = await generateCommitMessage(apiKey, diff);

            const repo = getActiveRepository();
            repo.inputBox.value = rawMessage;
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

// 🔐 Gemini API Key
async function getGeminiApiKey(): Promise<string | undefined> {
  let apiKey = await extensionContext.secrets.get("geminiApiKey");

  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      prompt: "Enter your Gemini API Key",
      password: true,
      ignoreFocusOut: true,
    });

    if (apiKey) {
      await extensionContext.secrets.store("geminiApiKey", apiKey);
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

// 🤖 Gemini API call
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
                text: `Generate a Conventional Commit message from this git diff.
Answer with a single-line commit message, maximum 50 characters.
Only output the commit message.

${diff}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  // 🔴 RATE LIMIT HANDLING
  if (response.status === 429) {
    const choice = await vscode.window.showErrorMessage(
      "Gemini API rate limit exceeded for this API key.",
      "Enter New API Key",
      "Cancel"
    );

    if (choice === "Enter New API Key") {
      const newKey = await promptNewGeminiApiKey();
      if (!newKey) {
        throw new Error("No API key provided");
      }
      // retry once
      return generateCommitMessage(newKey, diff);
    }

    throw new Error("Gemini API rate limit exceeded");
  }

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data: any = await response.json();

  // ✅ ROBUST PARSING
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    console.error("Gemini raw response:", data);
    throw new Error("Failed to generate commit message");
  }

  const text = parts
    .map((p: any) => p?.text)
    .filter(Boolean)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Empty commit message from Gemini");
  }

  return text;
}

// 🔑 Prompt new API key (rate limit)
async function promptNewGeminiApiKey(): Promise<string | undefined> {
  const newKey = await vscode.window.showInputBox({
    prompt: "Gemini API key terkena limit. Masukkan API key baru:",
    password: true,
    ignoreFocusOut: true,
  });

  if (newKey) {
    await extensionContext.secrets.store("geminiApiKey", newKey);
  }

  return newKey;
}

// 🔗 Native Git API
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
