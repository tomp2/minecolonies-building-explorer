import { Toaster } from "@/components/ui/sonner";
import "./index.css";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.querySelector("#root")!).render(
    <StrictMode>
        <PostHogProvider
            apiKey={import.meta.env.VITE_REACT_APP_PUBLIC_POSTHOG_KEY}
            options={{
                api_host: import.meta.env.VITE_REACT_APP_PUBLIC_POSTHOG_HOST,
                persistence: localStorage.getItem("persistent-identity") ? "localStorage" : "memory",
                autocapture: false,
            }}
        >
            <App />
            <Toaster richColors />
        </PostHogProvider>
    </StrictMode>,
);
