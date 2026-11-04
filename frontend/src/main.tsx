import { createRoot } from "react-dom/client";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import App from "./app/App.tsx";
import { cognitoAuthConfig } from "./app/auth/oidcConfig";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <OidcProvider
    {...cognitoAuthConfig}
    onSigninCallback={() => {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }}
    onSigninError={(error) => {
      console.error("OIDC Signin Error:", error);
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }}
  >
    <App />
  </OidcProvider>
);
