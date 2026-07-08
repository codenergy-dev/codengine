import * as vscode from "vscode"
import { workflows } from "./workflows";

export async function activate(context: vscode.ExtensionContext) {
	await workflows.run('extension', 'activate', { args: { context } })
}
