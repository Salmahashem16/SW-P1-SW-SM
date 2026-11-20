/** ACC-01: at least 8 characters, including at least one letter and one digit. */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include a letter and a digit';
