import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions_required';

/**
 * Uso: @Permissions('roles.manage', 'users.manage')
 */
export const Permissions = (...perms: string[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
