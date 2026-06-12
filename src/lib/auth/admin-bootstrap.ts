interface InstanceAdminBootstrapInput {
  email: string;
  configuredEmail?: string;
  countUsers: () => Promise<number>;
}

export async function shouldAssignInstanceAdmin({
  email,
  configuredEmail = process.env.INSTANCE_ADMIN_EMAIL,
  countUsers,
}: InstanceAdminBootstrapInput): Promise<boolean> {
  const normalizedConfiguredEmail = configuredEmail?.trim().toLowerCase();

  if (normalizedConfiguredEmail) {
    return email.trim().toLowerCase() === normalizedConfiguredEmail;
  }

  return (await countUsers()) === 0;
}
