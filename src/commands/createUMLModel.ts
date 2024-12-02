import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { ClassDiagramNode, DataTypeNode, ModelNode, ProfileNode, ProjectNode } from '../metaModel';

export async function createUMLModelCommand(args:any) {
    const fileName = await vscode.window.showInputBox({ prompt: 'Enter UML model name' });
    if (fileName) {
        // Check if the resource is a file or directory
        const uri = vscode.Uri.file(args.path);
        const stats = await vscode.workspace.fs.stat(uri);
        let umlParentDir: vscode.Uri | undefined;
        if (stats.type === vscode.FileType.Directory) {
            // If resource is a directory, use it directly
            umlParentDir = uri;
        } else if (stats.type === vscode.FileType.File) {
            // If resource is a file, use dirName as the parent directory
            umlParentDir = vscode.Uri.joinPath(uri, '..');
        }

        if (umlParentDir) {
            // Create the "uml" directory inside the parent directory
            const umlDir = vscode.Uri.joinPath(umlParentDir, 'uml');
            await vscode.workspace.fs.createDirectory(umlDir);
            
            // Create the new project file inside the "uml" directory...
            const filePath = vscode.Uri.joinPath(umlDir, `${fileName}.numl`);

            // Create a default starting project model
            const project = ProjectNode.getBlankProject(fileName);
            const defaultContent = JSON.stringify(project.toJSON(), null, 2);

            // Write the default content to the new file
            await vscode.workspace.fs.writeFile(filePath, Buffer.from(defaultContent));

            try {
                // Open the file with our custom editor
                await vscode.commands.executeCommand('vscode.openWith', filePath, 'nodeuml.umlDiagramEditor');
            } catch (error) {
                vscode.window.showErrorMessage(`Unable to open file: ${filePath.fsPath}. ${error}`);
            }
        }
    }
}
