import { backendClient } from '@/integrations/backend/client';

type TenantSlugAvailabilityResponse = {
  available?: boolean;
};

export async function isTenantSlugAvailable(slug: string): Promise<boolean> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return false;
  }

  const response = await backendClient.functions.invoke('check-tenant-slug-availability', {
    body: { slug: normalizedSlug },
  });

  if (response.error) {
    throw response.error;
  }

  const payload = response.data as TenantSlugAvailabilityResponse | null;
  return payload?.available === true;
}
