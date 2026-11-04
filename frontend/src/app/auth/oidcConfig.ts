
export const cognitoAuthConfig = {
  authority:
    "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_3bM95Jcw3",

  client_id: "3ssmien992lbn3gh71tfilo4tg",

  redirect_uri: "http://localhost:5173/",

  post_logout_redirect_uri: "http://localhost:5173/",

  response_type: "code",

  scope: "openid email phone",
};
