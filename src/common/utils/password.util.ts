import { randomBytes } from 'crypto';

const UPP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOW = 'abcdefghijklmnopqrstuvwxyz';
const NUM = '0123456789';
const SYM = '!@#$%^&*()-_=+[]{};:,.?/';

const ALL = UPP + LOW + NUM + SYM;

/** Genera una contraseña de 12 caracteres cumpliendo complejidad. */
export function generateStrongPassword(len = 12): string {
  if (len < 4) throw new Error('Password length must be >= 4');

  // Garantizar al menos 1 de cada tipo
  const pick = (set: string) => set[randomBytes(1)[0] % set.length];

  const required = [pick(UPP), pick(LOW), pick(NUM), pick(SYM)];
  const remaining: string[] = [];
  for (let i = required.length; i < len; i++) {
    remaining.push(pick(ALL));
  }

  // Mezclar (Fisher–Yates)
  const pwd = [...required, ...remaining];
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join('');
}
