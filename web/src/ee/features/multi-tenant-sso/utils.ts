/**
 * Multi-tenant SSO utilities - stub for community edition.
 * Multi-tenant SSO features are only available in the enterprise/cloud edition.
 */

/**
 * Returns the SSO auth provider ID for a given domain.
 * In community edition, always returns null (no SSO enforcement).
 */
export const getSsoAuthProviderIdForDomain = async (_domain: string): Promise<string | null> => {
  return null;
};

/**
 * Check if any SSO is configured.
 * In community edition, always returns false.
 */
export const isAnySsoConfigured = (): boolean => {
  return false;
};

/**
 * Load SSO providers for NextAuth.
 * In community edition, returns empty array.
 */
export const loadSsoProviders = (): never[] => {
  return [];
};

/**
 * Find multi-tenant SSO config for a provider.
 * In community edition, always returns isMultiTenantSsoProvider: false.
 */
export const findMultiTenantSsoConfig = async (_params: {
  providerId: string;
}): Promise<{ isMultiTenantSsoProvider: true; domain: string } | { isMultiTenantSsoProvider: false; domain: null }> => {
  return { isMultiTenantSsoProvider: false, domain: null };
};
