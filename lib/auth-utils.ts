import { jwtVerify } from "jose";

export const secretKey = "vida_buddies_very_secret_key_change_this_in_prod";
export const key = new TextEncoder().encode(secretKey);

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}
