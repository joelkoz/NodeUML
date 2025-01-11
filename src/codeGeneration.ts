
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { openProjects } from './projectDocument';


function setNodeMDAStatus(status: string, refresh = true) {
  const activeFolder = vscode.workspace.workspaceFolders?.[0];
  let config = vscode.workspace.getConfiguration('nodeuml.nodemda', activeFolder);
  config.update('status', status, vscode.ConfigurationTarget.Global);
  config.update('status', status, vscode.ConfigurationTarget.Workspace);
  config.update('status', status, vscode.ConfigurationTarget.WorkspaceFolder);

  // Refresh the display
  if (refresh) {
     openSettingsForConfiguration();
  }
}


export async function isNodeMDAInstalled(showMessage = true): Promise<boolean> {
  return new Promise((resolve) => {

    exec('nodemda -V', (error, stdout, stderr) => {
      if (error) {
        vscode.window.showErrorMessage(`NodeMDA not found: ${stderr || error.message}`);
        setNodeMDAStatus('Not installed');
        resolve(false);
        return;
      }

      // Parse and check version
      const output = stdout.trim();
      const lfIndex = output.lastIndexOf('\n');
      let version;
      if (lfIndex > 0) {
        version = output.substring(lfIndex + 1);
      }
      else {
        version = output;
      }
      const requiredVersion = '2.1.0';
      if (compareVersions(version, requiredVersion) < 0) {
        vscode.window.showWarningMessage(
          `NodeMDA version ${version} is installed, but version ${requiredVersion} or greater is required.`
        );
        setNodeMDAStatus('Out of date');
        resolve(false);
        return;
      }

      // Check for NodeUML reader
      exec('nodemda readers', (readersError, readersStdout, readersStderr) => {
        if (readersError) {
          vscode.window.showErrorMessage(
            `Error checking NodeMDA readers: ${readersStderr || readersError.message}`
          );
          setNodeMDAStatus('Reader not installed');
          resolve(false);
          return;
        }

        // Parse the readers output
        const readers = readersStdout
          .split('\n')
          .filter((line) => line.trim().startsWith('o '))
          .map((line) => line.replace(/^o /, '').split(':')[0].trim());

        if (readers.includes('nodeuml')) {
          if (showMessage) {
             vscode.window.showInformationMessage('NodeMDA and NodeUML reader are installed and ready!');
          }
          setNodeMDAStatus('Installed and ready', showMessage);
          resolve(true);
        } else {
          vscode.window.showWarningMessage(
            'NodeUML reader is not installed. Please install it using npm.'
          );
          setNodeMDAStatus('Missing NodeUML reader');
          resolve(false);
        }
      });
    });
  });
}


// Helper function to compare semantic versions
function compareVersions(version1: string, version2: string): number {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;

    if (num1 > num2) { return 1; }
    if (num1 < num2) { return -1; }
  }

  return 0;
}


export function installNodeMDAPlugin() {
  vscode.window.showInformationMessage('Installing NodeMDA and NodeUML reader globally...');

  // Define the command to install packages globally
  const command = 'npm install -g nodemda nodemda-nodeuml';

  // Execute the command
  exec(command, (error, stdout, stderr) => {
    if (error) {
      vscode.window.showErrorMessage(`Failed to install packages: ${stderr || error.message}`);
      return;
    }

    vscode.window.showInformationMessage('NodeMDA and NodeMDA-NodeUML installed successfully!');
  });
}

async function getAvailablePlugins(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // Execute the "nodemda platforms" command
    exec('nodemda plugins', (error, stdout, stderr) => {
      if (error) {
        vscode.window.showErrorMessage(`Error running nodemda: ${stderr || error.message}`);
        reject([]);
        return;
      }

      // Parse the output to extract platform names
      const platforms: string[] = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        // Look for lines that start with "o " (indicating a platform)
        const match = line.match(/^o (.+?):/);
        if (match) {
          platforms.push(match[1].trim());
        }
      }

      resolve(platforms);
    });
  });
}



export async function selectTargetPlatform() {
  const platforms = await getAvailablePlugins();

  if (platforms.length === 0) {
    vscode.window.showErrorMessage('No plugins available. Install NodeMDA plugins.');
    return;
  }

  const selected = await vscode.window.showQuickPick(platforms, {
    placeHolder: 'Select the stack to use',
  });

  if (!selected) {
    return;
  }

  const optFolder = 'This project only';
  const optWorkspace = 'All folders in this workspace';
  const optUser = 'Always for me (User)';
  const scope = await vscode.window.showQuickPick([optFolder, optWorkspace, optUser], {
    placeHolder: 'Use this stack for?',
  });

  if (!scope) {
    return; // User canceled the selection
  }

  const targetScope =
    scope === optFolder ? vscode.ConfigurationTarget.WorkspaceFolder :
      scope === optWorkspace ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;

  const activeFolder = vscode.workspace.workspaceFolders?.[0];
  vscode.workspace
    .getConfiguration('nodeuml.nodemda', activeFolder)
    .update('targetPlatform', selected, targetScope);

  console.log(`Target stack set to: ${selected} for scope ${targetScope}`);


  // Refresh the display
  openSettingsForConfiguration();
}


export function openSettingsForConfiguration() {
  vscode.commands.executeCommand(
    'workbench.action.openSettings',
    '@ext:joelkoz.nodeuml'
  );
}



export async function generateCode() {
  const activeFolder = vscode.workspace.workspaceFolders?.[0];
  const config = vscode.workspace.getConfiguration('nodeuml.nodemda', activeFolder);
  const platform = config.get<string>('targetPlatform');
  const forceOverwrite = config.get<boolean>('forceOverwrite');

  const nodeMDAInstalled = await isNodeMDAInstalled(false);

  if (!nodeMDAInstalled || !platform) {
    const choice = await vscode.window.showWarningMessage(
      'Code generation is not configured. Would you like to configure it now?',
      'Yes',
      'No'
    );

    if (choice === 'Yes') {
      openSettingsForConfiguration();
    }
    return;
  }

  // Retrieve the current project document
  const currentProjectDoc = openProjects.currentProjectDoc;
  if (!currentProjectDoc) {
    vscode.window.showErrorMessage(
      'Please make a UML diagram editor the active tab\nbefore running the code generator.'
    );
    return;
  }

  // Derive the output directory and model file name
  const modelFileUri = currentProjectDoc.uri;
  const outputDirectory = vscode.workspace.getWorkspaceFolder(modelFileUri)?.uri.fsPath;
  if (!outputDirectory) {
    vscode.window.showErrorMessage('Unable to determine the workspace root directory.');
    return;
  }

  const modelFileName = modelFileUri.fsPath;

  // Build the command
  const readerModuleName = 'nodemda-nodeuml';
  const command = [
    'nodemda gen',
    `--stack "${platform}"`,
    `--reader "${readerModuleName}"`,
    `--model "${modelFileName}"`,
    `--output "${outputDirectory}"`,
    forceOverwrite ? '--forceOverwrite' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Run the command in the Integrated Terminal
  let terminal = vscode.window.terminals.find((t) => t.name === 'Code Generator');
  if (!terminal) {
    terminal = vscode.window.createTerminal('Code Generator');
  }

  terminal.show();
  terminal.sendText(command);
}