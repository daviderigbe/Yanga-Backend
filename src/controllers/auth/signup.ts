import Elysia from "elysia";

export const signup = new Elysia().post("signup", async (context) => {
  return "Signup";
});
