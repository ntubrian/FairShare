import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client/react";
import App from "./App";
import { apolloClient } from "./graphql/apolloClient";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import "./styles/global.module.scss";

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);

registerServiceWorker();
