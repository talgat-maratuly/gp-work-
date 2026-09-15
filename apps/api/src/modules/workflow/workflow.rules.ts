export type WaitingInterval = { task_id: number; category: string; created_at: string | Date; closed_at: string | Date | null };
// Union intervals within a task/category so duplicate reports never double the elapsed time.
// Categories may overlap; the output is task-minutes, not payroll/person-minutes.
export function waitingByCategory(rows: WaitingInterval[], now: Date, since: Date) {
  const groups = new Map<string, [number, number][]>();
  for (const row of rows) {
    const start = Math.max(since.getTime(), new Date(row.created_at).getTime());
    const end = Math.min(now.getTime(), row.closed_at ? new Date(row.closed_at).getTime() : now.getTime());
    if (!(end > start)) continue;
    const key = `${row.category}:${row.task_id}`;
    groups.set(key, [...(groups.get(key) ?? []), [start, end]]);
  }
  const totals: Record<string, number> = {};
  for (const [key, ranges] of groups) {
    ranges.sort((a,b) => a[0]-b[0]);
    let [start,end] = ranges[0]; let total = 0;
    for (const [a,b] of ranges.slice(1)) {
      if (a <= end) end = Math.max(end,b);
      else { total += end-start; start=a; end=b; }
    }
    const category = key.split(':')[0];
    totals[category] = (totals[category] ?? 0) + (total+end-start)/60000;
  }
  return Object.entries(totals).map(([category, minutes]) => ({category, minutes: Math.round(minutes*10)/10})).sort((a,b) => b.minutes-a.minutes);
}
export function allChecked(checked: number[], labels: string[]): boolean {
  return checked.length === labels.length && new Set(checked).size === checked.length && checked.every(i => Number.isInteger(i) && i >= 0 && i < labels.length);
}
export function improved(baseline: number, observed: number, direction: string): boolean {
  return Number.isFinite(baseline) && Number.isFinite(observed) && (direction === 'LOWER' ? observed < baseline : observed > baseline);
}
