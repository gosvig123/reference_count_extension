import * as vscode from 'vscode';

let decorationType: vscode.TextEditorDecorationType | undefined;
let currentMinimalisticSetting: boolean | undefined;

function createDecorationType(minimalisticDecorations: boolean): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        after: {
            margin: minimalisticDecorations ? '0' : '0 0 0 0.5em',
            textDecoration: 'none',
        },
        // Ensure the decorations are removed when the text is changed
        // This might not be strictly necessary with the new lifecycle management,
        // but it's a good safeguard.
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed, 
    });
}

export const getDecorationType = (): vscode.TextEditorDecorationType => {
    const newMinimalisticSetting = vscode.workspace.getConfiguration('referenceCounter').get<boolean>('minimalisticDecorations') || false;

    // If the decoration type already exists and the setting hasn't changed, reuse it.
    if (decorationType && currentMinimalisticSetting === newMinimalisticSetting) {
        return decorationType;
    }

    // If the old decoration type exists (e.g., setting changed), dispose of it.
    if (decorationType) {
        decorationType.dispose();
    }

    // Create a new decoration type with the current setting.
    decorationType = createDecorationType(newMinimalisticSetting);
    currentMinimalisticSetting = newMinimalisticSetting;
    
    return decorationType;
};

export function disposeDecorationType(): void {
    if (decorationType) {
        decorationType.dispose();
        decorationType = undefined;
        currentMinimalisticSetting = undefined;
    }
}
