import * as vscode from 'vscode';
import { clearDecorations, formatInterval } from './view';
import { FlameGraphViewProvider } from './providers/flamegraph';
import { AustinController } from './controller';
import { AustinStats } from './model';
import { TopDataProvider } from './providers/top';
import { CallStackDataProvider } from './providers/callstack';
import { AustinProfileTaskProvider } from './providers/task';
import { AustinRuntimeSettings } from './settings';
import { AustinMode } from './types';


export function activate(context: vscode.ExtensionContext) {
	vscode.workspace.onDidChangeTextDocument((changeEvent) => {
		clearDecorations();
	});

	const output = vscode.window.createOutputChannel("Austin");

	const stats = new AustinStats();
	const austinProfileProvider = new AustinProfileTaskProvider(stats, output);
	const controller = new AustinController(stats, austinProfileProvider, output);

	const flameGraphViewProvider = new FlameGraphViewProvider(context.extensionUri);
	const topProvider = new TopDataProvider();
	const callStackProvider = new CallStackDataProvider();

	stats.registerBeforeCallback(() => flameGraphViewProvider.showLoading());
	stats.registerAfterCallback((stats) => flameGraphViewProvider.refresh(stats));
	stats.registerAfterCallback((stats) => topProvider.refresh(stats));
	stats.registerAfterCallback((stats) => callStackProvider.refresh(stats));

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			FlameGraphViewProvider.viewType,
			flameGraphViewProvider,
		)
	);

	context.subscriptions.push(
		vscode.tasks.registerTaskProvider("austin", austinProfileProvider)
	);

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider(TopDataProvider.viewType, topProvider)
	);

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider(CallStackDataProvider.viewType, callStackProvider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('austin-vscode.profile', () => {
			controller.profileScript();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('austin-vscode.load', () => {
			controller.openSampleFile();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('austin-vscode.openSourceAtLine', (module: string, line: number) => {
			controller.openSourceFileAtLine(module, line);
		})
	);

	// ---- Interval selector ----
	const austinIntervalStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

	austinIntervalStatusBarItem.command = "austin-vscode.interval";
	austinIntervalStatusBarItem.text = formatInterval(AustinRuntimeSettings.getInterval());
	austinIntervalStatusBarItem.tooltip = "Austin sampling interval";

	context.subscriptions.push(
		vscode.commands.registerCommand(austinIntervalStatusBarItem.command, () => {
			// Show interval dialog
			vscode.window.showInputBox({
				"value": AustinRuntimeSettings.getInterval().toString(),
				"prompt": "Enter new Austin sampling interval",
				"validateInput": (value) => {
					if (isNaN(parseInt(value)) || !/^\d+$/.test(value)) { return "The interval must be an integer."; }
				},
			}).then((value) => {
				if (value) {
					const newInterval = parseInt(value);
					AustinRuntimeSettings.setInterval(newInterval);
					austinIntervalStatusBarItem.text = formatInterval(newInterval);
				}
			});
		})
	);


	// ---- Mode selector ----
	const austinModeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

	austinModeStatusBarItem.command = "austin-vscode.mode";
	austinModeStatusBarItem.text = `$(clock) ${AustinRuntimeSettings.getMode()}`;
	austinModeStatusBarItem.tooltip = "Austin sampling mode";

	context.subscriptions.push(
		vscode.commands.registerCommand(austinModeStatusBarItem.command, () => {
			// Show mode picker
			vscode.window.showQuickPick(
				["Wall time", "CPU time"],
				{
					"title": "Pick Austin sampling mode",
					"canPickMany": false
				}
			).then((value) => {
				if (value) {
					AustinRuntimeSettings.setMode(value as AustinMode);
					austinModeStatusBarItem.text = `$(clock) ${value}`;
				}
			});
		})
	);

	austinModeStatusBarItem.show();
	austinIntervalStatusBarItem.show();
}


export function deactivate() { }
