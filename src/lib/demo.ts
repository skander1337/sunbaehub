/** Demo-only credentials for the seeded accounts. Every seeded seeker / specialist shares its role's password. */
export const DEMO_PASSWORDS = { seeker: "hoobae1234", expert: "sunbae1234", admin: "admin1234" } as const;

export const DEMO_CREDENTIALS = [
  { role: "seeker", email: "jiwoo@korea.ac.kr", password: DEMO_PASSWORDS.seeker },
  { role: "expert", email: "seojun@sunbae.demo", password: DEMO_PASSWORDS.expert },
  { role: "admin", email: "admin@sunbae.demo", password: DEMO_PASSWORDS.admin },
] as const;

/** Set to false to hide the credentials hint on the login page. */
export const SHOW_DEMO_CREDENTIALS = true;
