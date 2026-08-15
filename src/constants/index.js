// Barrel for the domain constants (00 §5).
//
// Import from `@/constants` for convenience, or from the specific module when
// you want the narrowest possible dependency. Nothing here imports from
// services, components, or the theme — constants are the leaves of the
// dependency graph, so they stay safe to import anywhere (including the plain
// Node seed script in Prompt 05).

export * from './roles.js'
export * from './statuses.js'
export * from './stateMachines.js'
export * from './permissions.js'
export * from './notificationTypes.js'
export * from './transactionTemplates.js'
export * from './policy.js'
export * from './images.js'
export * from './categoriesFallback.js'
export * from './industries.js'
export * from './languages.js'
