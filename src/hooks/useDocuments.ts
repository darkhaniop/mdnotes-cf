import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDocumentInput,
  DocumentDto,
  DocumentSummary,
  UpdateDocumentInput,
} from '@shared/schemas/document';
import { api } from '@/lib/api-client';
import { projectKeys } from './useProjects';

export const documentKeys = {
  list: (projectId: string) => ['projects', projectId, 'documents'] as const,
  detail: (docId: string) => ['documents', docId] as const,
};

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: documentKeys.list(projectId),
    queryFn: () =>
      api<{ documents: DocumentSummary[] }>(`/projects/${projectId}/documents`).then(
        (r) => r.documents,
      ),
    enabled: Boolean(projectId),
  });
}

export function useDocument(docId: string) {
  return useQuery({
    queryKey: documentKeys.detail(docId),
    queryFn: () => api<{ document: DocumentDto }>(`/documents/${docId}`).then((r) => r.document),
    enabled: Boolean(docId),
  });
}

export function useCreateDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      api<{ document: DocumentDto }>(`/projects/${projectId}/documents`, {
        method: 'POST',
        body: input,
      }).then((r) => r.document),
    onSuccess: (document) => {
      queryClient.setQueryData(documentKeys.detail(document.id), document);
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useUpdateDocument(docId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDocumentInput) =>
      api<{ document: DocumentDto }>(`/documents/${docId}`, { method: 'PATCH', body: input }).then(
        (r) => r.document,
      ),
    // Write through so switching to view mode after a save is instant.
    onSuccess: (document) => {
      queryClient.setQueryData(documentKeys.detail(docId), document);
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(projectId) });
    },
  });
}

export function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => api<void>(`/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
