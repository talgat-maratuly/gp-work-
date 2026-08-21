export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING]: 'Ожидает проверки',
  [ReviewStatus.APPROVED]: 'Подтверждено',
  [ReviewStatus.REJECTED]: 'Отклонено',
};
