/**
 * Utility for handling comments in code
 */
export class CommentHandler {
  private inMultiLineComment: boolean = false;
  
  /**
   * Process a line of code, removing comments
   * @param line The line to process
   * @returns The line with comments removed
   */
  processLine(line: string): string {
    let processedLine = line.trim();
    
    // Handle multi-line comments
    if (this.inMultiLineComment) {
      if (processedLine.includes('*/')) {
        this.inMultiLineComment = false;
        processedLine = processedLine.substring(processedLine.indexOf('*/') + 2).trim();
      } else {
        return ''; // Skip lines entirely within a multi-line comment
      }
    }
    
    // Handle start of multi-line comments
    if (processedLine.includes('/*')) {
      if (processedLine.includes('*/')) {
        // Single-line multi-line comment (e.g., /* comment */ import ...;)
        processedLine = processedLine.substring(0, processedLine.indexOf('/*')) + 
                        processedLine.substring(processedLine.indexOf('*/') + 2);
        processedLine = processedLine.trim();
      } else {
        this.inMultiLineComment = true;
        processedLine = processedLine.substring(0, processedLine.indexOf('/*')).trim();
      }
    }
    
    // Handle single-line comments
    if (processedLine.includes('//')) {
      processedLine = processedLine.substring(0, processedLine.indexOf('//')).trim();
    }
    
    return processedLine;
  }
  
  /**
   * Reset the comment handler state
   */
  reset(): void {
    this.inMultiLineComment = false;
  }
}
