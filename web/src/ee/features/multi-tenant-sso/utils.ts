export function isAnySsoConfigured(): boolean {
  return false;
}

export function getSsoAuthProviderIdForDomain(_domain: string): string | null {
  return null;
}

export async function findMultiTenantSsoConfig(_params: { providerId?: string; domain?: string }): Promise<{
  isMultiTenantSsoProvider: boolean;
  domain: string;
}> {
  return { isMultiTenantSsoProvider: false, domain: "" };
}

export async function loadSsoProviders(): Promise<[]> {
  return [];
}
