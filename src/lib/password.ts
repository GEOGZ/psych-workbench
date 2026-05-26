import bcrypt from 'bcryptjs';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!PASSWORD_REGEX.test(password)) {
    return { valid: false, message: '密码须至少8位，包含大写字母、小写字母、数字和特殊字符' };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
