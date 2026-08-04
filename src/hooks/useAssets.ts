import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetDto } from '@shared/schemas/asset';
import { api } from '@/lib/api-client';
import { projectKeys } from './useProjects';

export const assetKeys = {
  list: (projectId: string) => ['projects', projectId, 'assets'] as const,
};

export function useAssets(projectId: string) {
  return useQuery({
    queryKey: assetKeys.list(projectId),
    queryFn: () =>
      api<{ assets: AssetDto[] }>(`/projects/${projectId}/assets`).then((r) => r.assets),
    enabled: Boolean(projectId),
  });
}

export function useUploadAsset(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set('file', file);
      return api<{ asset: AssetDto }>(`/projects/${projectId}/assets`, {
        method: 'POST',
        body: form,
        raw: true,
      }).then((r) => r.asset);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useDeleteAsset(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) =>
      api<void>(`/projects/${projectId}/assets/${assetId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
