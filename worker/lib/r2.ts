/** R2 keys are `p/{projectId}/{assetId}/{filename}`. */
export function assetKey(projectId: string, assetId: string, filename: string): string {
  return `p/${projectId}/${assetId}/${filename}`;
}

export function projectPrefix(projectId: string): string {
  return `p/${projectId}/`;
}

/**
 * D1's ON DELETE CASCADE removes asset rows but leaves the objects behind, so
 * every project/asset delete path has to purge the bucket by prefix.
 */
export async function deleteProjectObjects(bucket: R2Bucket, projectId: string): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const listing = await bucket.list({ prefix: projectPrefix(projectId), cursor, limit: 1000 });
    const keys = listing.objects.map((o) => o.key);
    if (keys.length > 0) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
  return deleted;
}
