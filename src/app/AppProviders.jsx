// Global provider stack. Intentionally a pass-through for now — theme,
// router, auth, and feedback providers are layered in by later prompts.
export default function AppProviders({ children }) {
  return children
}
