import { apiRequest } from './client'
export type BusinessField = {
  id: string; label: string; type: 'text' | 'number' | 'date' | 'boolean' | 'select'; hint: string;
  options: string[]; readRoles: string[]; editRoles: string[];
}
export type BusinessStage = { id: string; label: string; roles: string[]; requiredFields: string[]; nextStages: string[] }
export type BusinessSchema = { title: string; description: string; initialStageId: string; fields: BusinessField[]; stages: BusinessStage[] }
export type BusinessDefinition = { id: number; process_id: number; version: number; archived: boolean; schema: BusinessSchema }
export type BusinessValues = Record<string, string | number | boolean | null>
export type BusinessInstance = {
  id: number; definition_id: number; process_id: number; version: number; revision: number; stage_id: string;
  schema: BusinessSchema; values: BusinessValues; locked: boolean; editableFieldIds: string[]; allowedTransitions: string[];
  events: { id: number; kind: string; from_stage_id: string | null; to_stage_id: string; actor_name: string | null; created_at: string; changes: Record<string, { before: unknown; after: unknown }> }[];
}
const root = '/business-processes'
export const getBusinessDefinitions = () => apiRequest<BusinessDefinition[]>(`${root}/definitions`)
export const publishBusinessDefinition = (schema: BusinessSchema, previous?: BusinessDefinition) => apiRequest<BusinessDefinition>(`${root}/definitions`, {
  method: 'POST', body: JSON.stringify({ ...schema, ...(previous ? { processId: previous.process_id, baseVersion: previous.version } : {}) }),
})
export const archiveBusinessDefinition = (processId: number, archived: boolean) => apiRequest(`${root}/definitions/${processId}/archive`, { method: 'PUT', body: JSON.stringify({ archived }) })
export const getTaskBusinessProcesses = (taskId: number) => apiRequest<BusinessInstance[]>(`${root}/tasks/${taskId}`)
export const attachBusinessProcess = (taskId: number, definitionId: number) => apiRequest(`${root}/tasks/${taskId}`, { method: 'POST', body: JSON.stringify({ definitionId }) })
export const saveBusinessProcess = (taskId: number, instanceId: number, revision: number, values: BusinessValues, toStageId?: string) => apiRequest(`${root}/tasks/${taskId}/${instanceId}/actions`, { method: 'POST', body: JSON.stringify({ revision, values, toStageId }) })
