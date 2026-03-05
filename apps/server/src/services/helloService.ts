export const helloService = {
  hello: () => {
    return { message: "Hello World!" };
  },

  helloAuthenticated: (user: Express.User) => {
    return { message: `Hello ${user.givenName}!` };
  },

  helloAdmin: (user: Express.User) => {
    return { message: `Hello ${user.givenName}! You are an admin.` };
  },
};
