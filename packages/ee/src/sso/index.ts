/**
 * SSO exports - stub for community edition.
 */

export const getSsoAuthProviderIdForDomain = async (
  _domain: string,
): Promise<string | null> => {
  return null;
};

export const isAnySsoConfigured = async (): Promise<boolean> => {
  return false;
};
