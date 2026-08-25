export const PASSWORD_MIN_LENGTH = 12;

export function senhaAtendePolitica(senha) {
  return typeof senha === "string" && senha.length >= PASSWORD_MIN_LENGTH;
}
