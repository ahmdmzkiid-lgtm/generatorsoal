export interface ReviewOutput {
    questionId: string;
    valid: boolean;
    issues: string[];
    confidence: number;
    newStatus: "PASSED_AI_REVIEW" | "FLAGGED_BY_AI";
}
export declare function reviewQuestion(questionId: string): Promise<ReviewOutput>;
//# sourceMappingURL=aiReviewer.d.ts.map