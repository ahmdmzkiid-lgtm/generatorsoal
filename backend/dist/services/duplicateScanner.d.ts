export interface DuplicateMatch {
    questionId: string;
    questionText: string;
    content: unknown;
    similarity: number;
}
export declare function scanDuplicates(questionId: string): Promise<{
    isDuplicate: boolean;
    matches: DuplicateMatch[];
}>;
//# sourceMappingURL=duplicateScanner.d.ts.map