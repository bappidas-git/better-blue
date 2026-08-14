import { env } from '@/config/env'

// Temporary placeholder shell — replaced by the real app shell in
// Prompts 02 (design system) and 08 (routing).
export default function App() {
  return (
    <main className="shell">
      <h1 className="shell-title">BetterBlue</h1>
      <p className="shell-tagline">Commercial content, made by creators.</p>
      <p className="shell-env">API: {env.apiBaseUrl}</p>
    </main>
  )
}
