/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GOOGLE_API_KEY: string
    readonly VITE_OPENAI_API_KEY: string
    readonly GOOGLE_GENAI_API_KEY: string
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
