import * as vscode from 'vscode';

/**
 * A utility class for reporting progress with more detailed information
 */
export class ProgressReporter {
    private progress: vscode.Progress<{ message?: string; increment?: number }>;
    private token: vscode.CancellationToken;
    private totalItems: number;
    private processedItems: number = 0;
    private lastReportTime: number = 0;
    private readonly REPORT_THROTTLE_MS = 100; // Throttle updates to avoid UI flicker

    constructor(
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken,
        totalItems: number
    ) {
        this.progress = progress;
        this.token = token;
        this.totalItems = totalItems;
    }

    /**
     * Report progress for a single item
     * @param message Optional message to display
     */
    public report(message?: string): void {
        this.processedItems++;
        
        // Throttle progress updates to avoid UI flicker
        const now = Date.now();
        if (now - this.lastReportTime < this.REPORT_THROTTLE_MS && this.processedItems < this.totalItems) {
            return;
        }
        
        this.lastReportTime = now;
        
        // Calculate percentage
        const percentage = Math.round((this.processedItems / this.totalItems) * 100);
        
        // Report progress
        this.progress.report({
            message: message || `${this.processedItems}/${this.totalItems} (${percentage}%)`,
            increment: 100 / this.totalItems
        });
    }

    /**
     * Check if the operation has been cancelled
     */
    public isCancelled(): boolean {
        return this.token.isCancellationRequested;
    }

    /**
     * Set a new total number of items
     */
    public setTotalItems(totalItems: number): void {
        this.totalItems = totalItems;
    }
}

/**
 * Run a task with progress reporting in the VS Code UI
 * @param title The title to display in the progress UI
 * @param totalItems The total number of items to process
 * @param task The task function that receives a progress reporter
 * @param location The location to display the progress (default: Notification)
 */
export async function withProgress<T>(
    title: string,
    totalItems: number,
    task: (reporter: ProgressReporter) => Promise<T>,
    location: vscode.ProgressLocation = vscode.ProgressLocation.Notification
): Promise<T> {
    return vscode.window.withProgress<T>(
        {
            location,
            title,
            cancellable: true
        },
        async (progress, token) => {
            const reporter = new ProgressReporter(progress, token, totalItems);
            return await task(reporter);
        }
    );
}
