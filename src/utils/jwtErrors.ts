/** Jeton rejeté par PostgREST (expiré, ou que le client croyait encore valide) : `PGRST301`/`PGRST303`. Rejouer la
 * requête avec le même jeton échouerait à l'identique : il faut d'abord renouveler la session. */
export const isRejectedJwt = (error: unknown): boolean => ['PGRST301', 'PGRST303'].includes((error as { code?: string } | null)?.code ?? '')
